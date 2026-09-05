import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseAnalysisResponse } from "../lib/analysis";
import { parseBenchmarkResponse } from "../lib/ai-benchmark-schema";
import type { AiBenchmarkResponse } from "../lib/ai-benchmark-schema";
import type { AnalysisResponse } from "../types/analytical-input";

import type { GoldenDocumentId } from "./report-map";

/**
 * Saved-output scoring mode (`--from-dir`).
 *
 * Lets the scoring layer be re-run without another model call — the expensive
 * half of an eval run is inference, and iterating on scoring should not cost
 * anything. This mode requires no API key.
 *
 * A saved file is NOT trusted because it came from an earlier run. Every loaded
 * analysis is re-validated through the same production `parseAnalysisResponse`
 * used by `/api/analyze` and by live mode, and every loaded benchmark through
 * `parseBenchmarkResponse`. A file that has drifted out of contract is a load
 * failure, not a scoring input.
 */

export class SavedOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedOutputError";
  }
}

/** `<dir>/report_a_clean.analysis.json` */
export function analysisFileName(documentId: GoldenDocumentId): string {
  return `${documentId}.analysis.json`;
}

/** `<dir>/report_a_clean.benchmark.json` — optional, only read with --benchmark. */
export function benchmarkFileName(documentId: GoldenDocumentId): string {
  return `${documentId}.benchmark.json`;
}

function readJson(path: string, what: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new SavedOutputError(`Saved ${what} not readable at ${path}.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new SavedOutputError(`Saved ${what} at ${path} is not valid JSON.`);
  }
}

export function loadSavedAnalysis(
  directory: string,
  documentId: GoldenDocumentId,
): AnalysisResponse {
  const path = join(directory, analysisFileName(documentId));
  const json = readJson(path, "analysis");
  try {
    return parseAnalysisResponse(json, path);
  } catch {
    throw new SavedOutputError(
      `Saved analysis at ${path} does not satisfy the AnalysisResponse contract.`,
    );
  }
}

/** Returns null when no benchmark file exists for this report. */
export function loadSavedBenchmark(
  directory: string,
  documentId: GoldenDocumentId,
): AiBenchmarkResponse | null {
  const path = join(directory, benchmarkFileName(documentId));
  if (!existsSync(path)) return null;
  const json = readJson(path, "benchmark");
  try {
    return parseBenchmarkResponse(json);
  } catch {
    throw new SavedOutputError(
      `Saved benchmark at ${path} does not satisfy the AiBenchmarkResponse contract.`,
    );
  }
}
