import type { AnalyticalInput } from "@/types/analytical-input";

import type { AnalystCorrection, CorrectionsById } from "./schema";

/**
 * Derives the effective session inputs from the immutable model interpretation
 * plus analyst corrections.
 *
 * This derivation is what prevents stale results. Skill results have no
 * independent lifetime:
 *
 *   analysis.inputs + corrections -> effectiveInputs -> runSkills
 *
 * so a value calculated from a superseded input cannot survive anywhere. There
 * is no invalidation timer and no separate stale flag to forget to set.
 *
 * Pure and deterministic. No mutation, no model call.
 */

/** Fields a correction may overlay. Everything else is carried through. */
function overlay(
  input: AnalyticalInput,
  correction: AnalystCorrection,
): AnalyticalInput {
  const { changes } = correction;

  // A shallow clone: input_id, source, evidence_type, trust_state,
  // conflict_state, metric, unit, currency and the rest are preserved exactly.
  const corrected: AnalyticalInput = { ...input };

  if ("value" in changes) corrected.value = changes.value ?? null;
  if ("period" in changes) corrected.period = changes.period ?? null;
  if ("temporal_type" in changes && changes.temporal_type !== undefined) {
    corrected.temporal_type = changes.temporal_type;
  }
  if ("basis" in changes && changes.basis !== undefined) {
    corrected.basis = changes.basis;
  }
  if ("precision" in changes && changes.precision !== undefined) {
    corrected.precision = changes.precision;
  }

  return corrected;
}

/**
 * Applies corrections by input id.
 *
 * The original array and its objects are never mutated: uncorrected inputs are
 * returned by identity, and a corrected input is a fresh clone. A correction
 * naming an input that is not present is ignored — a stale id can never affect
 * a different input.
 */
export function applyCorrections(
  inputs: AnalyticalInput[],
  corrections: CorrectionsById,
): AnalyticalInput[] {
  if (Object.keys(corrections).length === 0) return inputs;

  return inputs.map((input) => {
    const correction = corrections[input.input_id];
    return correction ? overlay(input, correction) : input;
  });
}

/** Whether an input currently carries an analyst correction. */
export function isCorrected(
  corrections: CorrectionsById,
  inputId: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(corrections, inputId);
}

/** Removes one input's correction, returning a new record. */
export function withoutCorrection(
  corrections: CorrectionsById,
  inputId: string,
): CorrectionsById {
  if (!isCorrected(corrections, inputId)) return corrections;
  const next = { ...corrections };
  delete next[inputId];
  return next;
}

/** Adds or replaces one input's correction, returning a new record. */
export function withCorrection(
  corrections: CorrectionsById,
  correction: AnalystCorrection,
): CorrectionsById {
  return { ...corrections, [correction.inputId]: correction };
}

/**
 * Fields whose effective value differs from the original interpretation.
 *
 * Used only for display, so the card can show what the analyst changed
 * alongside what the model originally said.
 */
export function changedFields(
  original: AnalyticalInput,
  effective: AnalyticalInput,
): string[] {
  const changed: string[] = [];
  if (original.value !== effective.value) changed.push("value");
  if (original.period !== effective.period) changed.push("period");
  if (original.temporal_type !== effective.temporal_type) {
    changed.push("temporal_type");
  }
  if (original.basis !== effective.basis) changed.push("basis");
  if (original.precision !== effective.precision) changed.push("precision");
  return changed;
}
