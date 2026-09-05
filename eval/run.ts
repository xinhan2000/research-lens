import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { AiBenchmarkResponse } from "../lib/ai-benchmark-schema";
import { ANALYSIS_MODEL } from "../lib/anthropic-config";
import { loadSampleReports } from "../lib/reports";
import type { AnalysisResponse } from "../types/analytical-input";

import { scoreBenchmark, summarizeBenchmark, type BenchmarkReportScoring } from "./benchmark";
import { parseArgs, USAGE, type CliOptions } from "./cli";
import {
  aggregateTrustedMetrics,
  collectHardBlockers,
  decideReleaseStatus,
  evaluateReport,
} from "./evaluate";
import { indexGroundTruth, loadGroundTruth, type GroundTruthCase } from "./ground-truth";
import { InferenceError, runAnalysisInference, runBenchmarkInference } from "./inference";
import {
  analysisFileName,
  benchmarkFileName,
  loadSavedAnalysis,
  loadSavedBenchmark,
  SavedOutputError,
} from "./saved-output";
import { buildResultJson, DATASET_NOTE, renderConsole } from "./render";
import { goldenIdForProductId, productIdForGoldenId, type GoldenDocumentId } from "./report-map";
import type { ComparativeDiagnostic, EvalRun, ReportEvaluation } from "./types";

/**
 * Research Lens eval CLI.
 *
 * ORDERING IS THE ARCHITECTURE HERE. Inference runs first and completes
 * entirely; Ground Truth is loaded only afterwards, once every model output is
 * already fixed in memory. The answers are therefore not merely withheld from
 * the prompt — at the moment the request is made, they have not been read.
 *
 * Exit codes:
 *   0  evaluation completed, trusted path PASS
 *   1  evaluation completed, trusted path FAIL
 *   2  a harness, configuration, or inference error prevented valid evaluation
 *
 * A benchmark failure is never converted into a trusted-path failure. It is
 * recorded as benchmark infrastructure failure and the run continues.
 */

const EXIT_PASS = 0;
const EXIT_FAIL = 1;
const EXIT_HARNESS_ERROR = 2;

const RESULT_SCHEMA_VERSION = 1;

type ModelOutputs = {
  documentId: GoldenDocumentId;
  reportBody: string;
  analysis: AnalysisResponse;
  benchmark: AiBenchmarkResponse | null;
  benchmarkError: string | null;
};

function fail(message: string): never {
  console.error(message);
  process.exit(EXIT_HARNESS_ERROR);
}

/**
 * Loads the four built-in sample reports and indexes them by golden-set id.
 *
 * Uses the product's own `loadSampleReports`, so the text under evaluation is
 * the text the application renders.
 */
function loadReportBodies(): Map<GoldenDocumentId, string> {
  const bodies = new Map<GoldenDocumentId, string>();
  for (const report of loadSampleReports()) {
    const goldenId = goldenIdForProductId(report.id);
    if (goldenId) bodies.set(goldenId, report.content);
  }
  return bodies;
}

/* ------------------------------------------------------------------ *
 * Phase 1 — model outputs (no Ground Truth in scope)
 * ------------------------------------------------------------------ */

async function collectLiveOutputs(
  options: CliOptions,
  bodies: Map<GoldenDocumentId, string>,
): Promise<ModelOutputs[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    // Concise and safe: names the variable, prints nothing from the
    // environment, and returns before any network call is attempted.
    fail(
      [
        "Configuration error: ANTHROPIC_API_KEY is not set in this environment.",
        "",
        "Live eval requires it. Set it in your shell before running, or score",
        "saved output instead:  npm run eval -- --from-dir <directory>",
      ].join("\n"),
    );
  }

  const outputs: ModelOutputs[] = [];

  for (const documentId of options.reports) {
    const reportBody = bodies.get(documentId);
    if (reportBody === undefined) {
      fail(`Harness error: no built-in report found for ${documentId}.`);
    }

    process.stderr.write(`… analyzing ${documentId}\n`);

    let analysis: AnalysisResponse;
    try {
      analysis = await runAnalysisInference({
        apiKey,
        // The PRODUCT registry id, exactly as ResearchLensShell sends it.
        documentId: productIdForGoldenId(documentId),
        reportText: reportBody,
      });
    } catch (error) {
      const message =
        error instanceof InferenceError ? error.message : "Unknown inference failure.";
      fail(`Inference error for ${documentId}: ${message}`);
    }

    let benchmark: AiBenchmarkResponse | null = null;
    let benchmarkError: string | null = null;
    if (options.benchmark) {
      process.stderr.write(`… benchmarking ${documentId}\n`);
      try {
        benchmark = await runBenchmarkInference({ apiKey, reportText: reportBody });
      } catch (error) {
        // Never fails the trusted path. Recorded and carried forward.
        benchmarkError =
          error instanceof InferenceError ? error.message : "Unknown benchmark failure.";
      }
    }

    outputs.push({ documentId, reportBody, analysis, benchmark, benchmarkError });
  }

  return outputs;
}

function collectSavedOutputs(
  options: CliOptions,
  bodies: Map<GoldenDocumentId, string>,
): ModelOutputs[] {
  const directory = options.fromDir!;
  const outputs: ModelOutputs[] = [];

  for (const documentId of options.reports) {
    const reportBody = bodies.get(documentId);
    if (reportBody === undefined) {
      fail(`Harness error: no built-in report found for ${documentId}.`);
    }

    try {
      const analysis = loadSavedAnalysis(directory, documentId);
      const benchmark = options.benchmark
        ? loadSavedBenchmark(directory, documentId)
        : null;
      outputs.push({
        documentId,
        reportBody,
        analysis,
        benchmark,
        benchmarkError:
          options.benchmark && benchmark === null
            ? `No saved benchmark file (${benchmarkFileName(documentId)}) in ${directory}.`
            : null,
      });
    } catch (error) {
      const message =
        error instanceof SavedOutputError ? error.message : "Unknown saved-output failure.";
      fail(`Saved-output error: ${message}`);
    }
  }

  return outputs;
}

/**
 * Writes validated snapshots in the `--from-dir` file convention.
 *
 * Model responses, already validated, so a live run can be re-scored offline.
 * The directory lives under `eval/results/`, which is gitignored: live model
 * output is never committed as baseline truth. Ground Truth remains the only
 * canonical expected dataset.
 */
function saveSnapshots(outputs: readonly ModelOutputs[]): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = join("eval", "results", stamp);
  mkdirSync(directory, { recursive: true });

  for (const output of outputs) {
    writeFileSync(
      join(directory, analysisFileName(output.documentId)),
      `${JSON.stringify(output.analysis, null, 2)}\n`,
      "utf8",
    );
    if (output.benchmark) {
      writeFileSync(
        join(directory, benchmarkFileName(output.documentId)),
        `${JSON.stringify(output.benchmark, null, 2)}\n`,
        "utf8",
      );
    }
  }

  return directory;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(`${parsed.error}\n\n${USAGE}`);
    return EXIT_HARNESS_ERROR;
  }
  const options = parsed.options;

  if (options.help) {
    console.log(USAGE);
    return EXIT_PASS;
  }

  const bodies = loadReportBodies();

  /* ---- PHASE 1: model outputs. Ground Truth is not loaded yet. ---- */
  const mode: "live" | "saved" = options.fromDir === null ? "live" : "saved";
  const outputs =
    mode === "live"
      ? await collectLiveOutputs(options, bodies)
      : collectSavedOutputs(options, bodies);

  if (mode === "live") {
    const directory = saveSnapshots(outputs);
    process.stderr.write(`… saved validated snapshots to ${directory}\n`);
  }

  /* ---- PHASE 2: only now are the answers read. ---- */
  let goldenById: Map<string, GroundTruthCase>;
  try {
    goldenById = indexGroundTruth(loadGroundTruth());
  } catch (error) {
    console.error(
      `Ground Truth error: ${error instanceof Error ? error.message : "unknown failure"}`,
    );
    return EXIT_HARNESS_ERROR;
  }

  /* ---- PHASE 3: scoring. ---- */
  const reports: ReportEvaluation[] = [];
  const benchmarkScorings: BenchmarkReportScoring[] = [];
  const comparativeDiagnostics: ComparativeDiagnostic[] = [];
  const benchmarkInfrastructureFailures: string[] = [];

  for (const output of outputs) {
    const goldenCase = goldenById.get(output.documentId);
    if (!goldenCase) {
      console.error(
        `Ground Truth error: no case for document ${output.documentId}.`,
      );
      return EXIT_HARNESS_ERROR;
    }

    const evaluation = evaluateReport({
      goldenCase,
      analysis: output.analysis,
      reportBody: output.reportBody,
      source: mode,
      benchmark: output.benchmark,
      benchmarkError: output.benchmarkError,
    });
    reports.push(evaluation);

    if (output.benchmarkError) {
      benchmarkInfrastructureFailures.push(
        `${output.documentId}: ${output.benchmarkError}`,
      );
    }
    if (options.benchmark && output.benchmark) {
      const scoring = scoreBenchmark({
        documentId: output.documentId,
        benchmark: output.benchmark,
        skills: evaluation.skills,
        expectedSkills: goldenCase.expected_skills,
      });
      benchmarkScorings.push(scoring);
      comparativeDiagnostics.push(...scoring.diagnostics);
    }
  }

  const run: EvalRun = {
    schemaVersion: RESULT_SCHEMA_VERSION,
    runAt: new Date().toISOString(),
    mode,
    model: ANALYSIS_MODEL,
    benchmarkEnabled: options.benchmark,
    datasetNote: DATASET_NOTE,
    reports,
    trustedMetrics: aggregateTrustedMetrics(reports),
    hardBlockers: collectHardBlockers(reports),
    // The benchmark is not an argument to this call. It cannot become one.
    releaseStatus: decideReleaseStatus(reports),
    benchmark: benchmarkScorings.length > 0 ? summarizeBenchmark(benchmarkScorings) : null,
    comparativeDiagnostics,
    benchmarkInfrastructureFailures,
  };

  console.log(renderConsole(run));

  if (options.output) {
    try {
      mkdirSync(dirname(options.output), { recursive: true });
      writeFileSync(
        options.output,
        `${JSON.stringify(buildResultJson(run), null, 2)}\n`,
        "utf8",
      );
      process.stderr.write(`… wrote results to ${options.output}\n`);
    } catch {
      console.error(`Harness error: could not write results to ${options.output}.`);
      return EXIT_HARNESS_ERROR;
    }
  }

  return run.releaseStatus === "PASS" ? EXIT_PASS : EXIT_FAIL;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // Deliberately narrow: a message, never a full error object, which could
    // carry request contents on an SDK failure.
    console.error(
      `Harness error: ${error instanceof Error ? error.message : "unknown failure"}`,
    );
    process.exitCode = EXIT_HARNESS_ERROR;
  });
