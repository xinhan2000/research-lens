import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

/**
 * EVAL-ONLY Ground Truth loader.
 *
 * This is the single module in the repository permitted to read
 * `03_Sample_Data/Ground_Truth.jsonl`. Nothing under `app/`, `components/`, or
 * `lib/` imports it, no API route exposes it, no prompt receives it, and it is
 * never bundled into browser JavaScript — the eval CLI is a Node process that
 * the Next application does not import.
 *
 * It is also deliberately NOT imported by `eval/inference.ts`. Inference must
 * complete before the answers are even loaded, so there is no code path along
 * which an expected answer could influence a model request.
 *
 * Validation is strict and loud. A malformed line reports its line number and
 * the schema issue paths; nothing is skipped silently, because a quietly
 * dropped expectation is an evaluation that passes by not looking.
 */

const GROUND_TRUTH_PATH = join(
  "03_Sample_Data",
  "Ground_Truth.jsonl",
);

/* ------------------------------------------------------------------ *
 * Schema
 *
 * Mirrors the CURRENT dataset. Objects are strict: an unrecognised key means
 * the dataset grew a concept the harness does not score, and silently ignoring
 * it would overstate coverage.
 * ------------------------------------------------------------------ */

/**
 * Ground Truth writes trust states in display form (`AUTO`, `ASK`). The
 * production schema uses canonical lowercase enum values. Case is normalized
 * for comparison only, in `eval/scoring.ts` — the dataset keeps its own spelling
 * and the production schema is untouched.
 */
export const expectedTrustStateSchema = z.enum([
  "AUTO",
  "ASK",
  "ABSTAIN",
  "NEVER",
]);

export const expectedConflictStateSchema = z.enum([
  "none",
  "consistent_multiple_sources",
  "possible_conflict",
  "material_conflict",
]);

export const expectedRangeSchema = z.strictObject({
  min: z.number(),
  max: z.number(),
});

export const expectedInputSchema = z.strictObject({
  /**
   * A LABEL id for evaluation, not a model id. The live model produces its own
   * `input_id`; the two are related by `eval/matching.ts`, never by equality.
   */
  id: z.string().min(1),
  metric: z.string().min(1),
  value: z.number().nullable().optional(),
  range: expectedRangeSchema.optional(),
  unit: z.string().min(1),
  currency: z.string().min(1).optional(),
  period: z.string().min(1).optional(),
  temporal_type: z.string().min(1).optional(),
  basis: z.string().min(1).optional(),
  precision: z.string().min(1).optional(),
  evidence: z.string().min(1).optional(),
  trust_state: expectedTrustStateSchema.optional(),
  conflict_state: expectedConflictStateSchema.optional(),
});

export const expectedSkillSchema = z.strictObject({
  skill_id: z.string().min(1),
  state: z.enum(["READY", "NEEDS_REVIEW", "BLOCKED", "NOT_APPLICABLE"]),
  /** Expected-input LABEL ids, mapped to actual ids through the matcher. */
  inputs: z.array(z.string().min(1)).optional(),
  result: z.number().optional(),
  reason: z.string().min(1).optional(),
});

export const resolutionExampleSchema = z.strictObject({
  /** Expected-input LABEL id of the candidate the analyst selects. */
  selected_input: z.string().min(1),
  result: z.number(),
  label: z.string().min(1),
});

/**
 * Behaviour flags are an open string->boolean map on purpose: predicates are
 * keyed by the ACTUAL Ground Truth names in `eval/behaviors.ts`, and an
 * unrecognised name is reported as unimplemented rather than passing silently.
 */
export const expectedBehaviorSchema = z.record(z.string(), z.boolean());

export const groundTruthCaseSchema = z.strictObject({
  document_id: z.string().min(1),
  scenario: z.string().min(1),
  expected_inputs: z.array(expectedInputSchema).min(1),
  expected_skills: z.array(expectedSkillSchema).optional(),
  expected_behavior: expectedBehaviorSchema.optional(),
  resolution_examples: z.array(resolutionExampleSchema).optional(),
});

export type ExpectedInput = z.infer<typeof expectedInputSchema>;
export type ExpectedSkill = z.infer<typeof expectedSkillSchema>;
export type ResolutionExample = z.infer<typeof resolutionExampleSchema>;
export type GroundTruthCase = z.infer<typeof groundTruthCaseSchema>;

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

export class GroundTruthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroundTruthError";
  }
}

/**
 * Parses Ground Truth JSONL text.
 *
 * Blank lines are ignored. Every other line must be valid JSON AND satisfy the
 * schema; the first failure throws with the 1-based line number and the schema
 * issue paths. The offending line itself is not echoed — the path is what makes
 * the failure actionable, and dumping a whole record adds noise, not signal.
 */
export function parseGroundTruth(text: string): GroundTruthCase[] {
  const cases: GroundTruthCase[] = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (line.trim() === "") continue;

    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      throw new GroundTruthError(
        `Ground Truth line ${lineNumber}: not valid JSON.`,
      );
    }

    const result = groundTruthCaseSchema.safeParse(json);
    if (!result.success) {
      const paths = result.error.issues
        .map((issue) => issue.path.join(".") || "(root)")
        .join(", ");
      throw new GroundTruthError(
        `Ground Truth line ${lineNumber}: schema violation at ${paths}.`,
      );
    }

    cases.push(result.data);
  }

  if (cases.length === 0) {
    throw new GroundTruthError("Ground Truth contains no cases.");
  }

  const seen = new Set<string>();
  for (const entry of cases) {
    if (seen.has(entry.document_id)) {
      throw new GroundTruthError(
        `Ground Truth contains duplicate document_id "${entry.document_id}".`,
      );
    }
    seen.add(entry.document_id);
  }

  for (const entry of cases) {
    const ids = new Set<string>();
    for (const input of entry.expected_inputs) {
      if (ids.has(input.id)) {
        throw new GroundTruthError(
          `Ground Truth "${entry.document_id}": duplicate expected input id "${input.id}".`,
        );
      }
      ids.add(input.id);
    }
    for (const skill of entry.expected_skills ?? []) {
      for (const reference of skill.inputs ?? []) {
        if (!ids.has(reference)) {
          throw new GroundTruthError(
            `Ground Truth "${entry.document_id}": skill ${skill.skill_id} references unknown expected input "${reference}".`,
          );
        }
      }
    }
    for (const example of entry.resolution_examples ?? []) {
      if (!ids.has(example.selected_input)) {
        throw new GroundTruthError(
          `Ground Truth "${entry.document_id}": resolution example references unknown expected input "${example.selected_input}".`,
        );
      }
    }
  }

  return cases;
}

/** Reads and validates the golden set from disk. */
export function loadGroundTruth(cwd: string = process.cwd()): GroundTruthCase[] {
  const path = join(cwd, GROUND_TRUTH_PATH);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new GroundTruthError(`Ground Truth not readable at ${GROUND_TRUTH_PATH}.`);
  }
  return parseGroundTruth(text);
}

/** Index by document id for lookup during scoring. */
export function indexGroundTruth(
  cases: GroundTruthCase[],
): Map<string, GroundTruthCase> {
  return new Map(cases.map((entry) => [entry.document_id, entry]));
}
