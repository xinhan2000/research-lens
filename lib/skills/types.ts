import type { AnalyticalInput } from "@/types/analytical-input";

/**
 * Deterministic Skill contract.
 *
 * A Deterministic Skill never resolves semantic ambiguity. Claude interprets;
 * this layer validates and calculates. If the required semantics are
 * unresolved, no numerical result may be produced.
 */

export type SkillStatus = "READY" | "NEEDS_REVIEW" | "BLOCKED";

/** Result units. Percent values are stored as decimals (0.2317 = 23.17%). */
export type SkillUnit = "percent" | "USD_millions" | "multiple";

/** One consumed (or candidate) analytical input, kept for lineage. */
export type SkillInputReference = {
  inputId: string;
  /** Role in the formula, e.g. "Prior Revenue", "EBITDA". */
  role: string;
  /** Display label preserving semantics, e.g. "FY2025 Adjusted EBITDA". */
  label: string;
  /** Value normalized to the skill's internal scale (USD millions for money). */
  value: number | null;
  unit: AnalyticalInput["unit"];
  currency: string | null;
  period: string | null;
  temporalType: AnalyticalInput["temporal_type"];
  basis: AnalyticalInput["basis"];
};

export type SkillResult = {
  skillId: string;
  name: string;
  status: SkillStatus;
  /** Present ONLY when status is READY. Enforced by the constructors below. */
  value?: number;
  unit?: SkillUnit;
  /** Semantic label, e.g. "EV / FY2025 Adjusted EBITDA". */
  label: string;
  /** Why the skill did not execute. Present when status is not READY. */
  reason?: string;
  formula: string;
  /** IDs of the inputs consumed (READY) or considered (otherwise). */
  inputIds: string[];
  inputs: SkillInputReference[];
  warnings?: string[];
};

/**
 * Constructors.
 *
 * The value-carrying path exists only for READY. A NEEDS_REVIEW or BLOCKED
 * result has no code path that can attach a number, so the invariant is
 * structural rather than a convention someone can forget.
 */

export function ready(fields: {
  skillId: string;
  name: string;
  label: string;
  value: number;
  unit: SkillUnit;
  formula: string;
  inputs: SkillInputReference[];
  warnings?: string[];
}): SkillResult {
  return {
    skillId: fields.skillId,
    name: fields.name,
    status: "READY",
    value: fields.value,
    unit: fields.unit,
    label: fields.label,
    formula: fields.formula,
    inputIds: fields.inputs.map((input) => input.inputId),
    inputs: fields.inputs,
    ...(fields.warnings && fields.warnings.length > 0
      ? { warnings: fields.warnings }
      : {}),
  };
}

export function needsReview(fields: {
  skillId: string;
  name: string;
  label: string;
  reason: string;
  formula: string;
  /** Candidate inputs shown so the analyst can see what is competing. */
  inputs?: SkillInputReference[];
}): SkillResult {
  const inputs = fields.inputs ?? [];
  return {
    skillId: fields.skillId,
    name: fields.name,
    status: "NEEDS_REVIEW",
    label: fields.label,
    reason: fields.reason,
    formula: fields.formula,
    inputIds: inputs.map((input) => input.inputId),
    inputs,
  };
}

export function blocked(fields: {
  skillId: string;
  name: string;
  label: string;
  reason: string;
  formula: string;
  inputs?: SkillInputReference[];
}): SkillResult {
  const inputs = fields.inputs ?? [];
  return {
    skillId: fields.skillId,
    name: fields.name,
    status: "BLOCKED",
    label: fields.label,
    reason: fields.reason,
    formula: fields.formula,
    inputIds: inputs.map((input) => input.inputId),
    inputs,
  };
}
