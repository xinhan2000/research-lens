import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseAnalysisResponse } from "../lib/analysis";
import { loadSampleReports } from "../lib/reports";
import type { AnalysisResponse, AnalyticalInput } from "../types/analytical-input";

import { indexGroundTruth, loadGroundTruth, type GroundTruthCase } from "./ground-truth";
import { goldenIdForProductId, type GoldenDocumentId } from "./report-map";

/**
 * Shared helpers for the eval test suites.
 *
 * Tests start from the committed synthetic fixtures in `eval/fixtures/smoke/`
 * and MUTATE them to simulate model drift. That is the important part: a test
 * that only asserts the happy path proves the harness runs, not that it
 * detects anything. Every failure-mode test below takes a passing
 * interpretation and breaks exactly one thing.
 *
 * The fixtures are hand-authored, not model output. See the README beside them.
 */

const SMOKE_DIR = join("eval", "fixtures", "smoke");

export function fixtureAnalysis(documentId: GoldenDocumentId): AnalysisResponse {
  const raw = readFileSync(
    join(process.cwd(), SMOKE_DIR, `${documentId}.analysis.json`),
    "utf8",
  );
  return parseAnalysisResponse(JSON.parse(raw), `test:${documentId}`);
}

const groundTruth = indexGroundTruth(loadGroundTruth());

export function goldenCase(documentId: GoldenDocumentId): GroundTruthCase {
  const entry = groundTruth.get(documentId);
  if (!entry) throw new Error(`No Ground Truth case for ${documentId}`);
  return entry;
}

const bodies = new Map<GoldenDocumentId, string>();
for (const report of loadSampleReports()) {
  const goldenId = goldenIdForProductId(report.id);
  if (goldenId) bodies.set(goldenId, report.content);
}

export function reportBody(documentId: GoldenDocumentId): string {
  const body = bodies.get(documentId);
  if (body === undefined) throw new Error(`No report body for ${documentId}`);
  return body;
}

/** Returns a copy of `analysis` with one input patched. */
export function patchInput(
  analysis: AnalysisResponse,
  inputId: string,
  patch: Partial<AnalyticalInput>,
): AnalysisResponse {
  const found = analysis.inputs.some((input) => input.input_id === inputId);
  if (!found) throw new Error(`No input ${inputId} in fixture`);
  return {
    ...analysis,
    inputs: analysis.inputs.map((input) =>
      input.input_id === inputId ? { ...input, ...patch } : input,
    ),
  };
}

/** Returns a copy of `analysis` without one input. */
export function dropInput(
  analysis: AnalysisResponse,
  inputId: string,
): AnalysisResponse {
  return {
    ...analysis,
    inputs: analysis.inputs.filter((input) => input.input_id !== inputId),
  };
}

/** Returns a copy of `analysis` with one extra input appended. */
export function addInput(
  analysis: AnalysisResponse,
  input: AnalyticalInput,
): AnalysisResponse {
  return { ...analysis, inputs: [...analysis.inputs, input] };
}

/** A well-formed input, cloned from an existing one, for building variants. */
export function cloneInput(
  analysis: AnalysisResponse,
  inputId: string,
  patch: Partial<AnalyticalInput> & { input_id: string },
): AnalyticalInput {
  const source = analysis.inputs.find((input) => input.input_id === inputId);
  if (!source) throw new Error(`No input ${inputId} in fixture`);
  return { ...source, ...patch };
}
