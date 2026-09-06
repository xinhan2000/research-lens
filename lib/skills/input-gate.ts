import type { AnalyticalInput } from "@/types/analytical-input";

import { metricFamily } from "./metric-family";
import { isMonetaryUnit } from "./unit-normalization";
import type { SkillInputReference } from "./types";

/**
 * Input safety gate.
 *
 * Two distinct layers, deliberately separated:
 *
 * 1. UNIVERSAL safety — trust state, conflict state, evidence, scalar value,
 *    supported precision, monetary unit, currency. Every consequential input
 *    must satisfy these regardless of its role.
 *
 * 2. SKILL-SPECIFIC semantics — period, temporal type, basis. These are
 *    required only where the CONSUMING SKILL CONTRACT makes them material to
 *    that input's role, so they are opt-in.
 *
 * The distinction matters. Enterprise Value legitimately carries no fiscal
 * period and no meaningful temporal type: it is stated as of the report date.
 * Requiring those of every monetary input would wrongly block EV / Revenue and
 * EV / EBITDA. The correct response is to ask each input only for the
 * qualifiers material to its role — never to fabricate the missing ones.
 *
 * `resolved` is deliberately NOT used as the gate. Resolution is contextual
 * (Semantic_Input_Schema SI-15): an input may be resolved enough to display and
 * still be unfit for a high-consequence calculation.
 */

export type GateVerdict =
  | { ok: true }
  | { ok: false; severity: "review" | "block"; reason: string };

export type GateOptions = {
  /* --- universal, on by default --- */
  /** A scalar number is required (all six MVP skills). */
  requireScalar?: boolean;
  /** Value must be monetary and convertible. */
  requireMonetary?: boolean;
  /** Set only where a skill specification explicitly permits it. */
  allowApproximate?: boolean;
  allowRange?: boolean;

  /* --- skill-specific semantics, OFF by default --- */
  /** Period must be explicit. Off for Enterprise Value. */
  requirePeriod?: boolean;
  /** Temporal type must be resolved. Off for Enterprise Value and Net Debt. */
  requireTemporalType?: boolean;
  /**
   * Only historical values are eligible.
   *
   * Applied as ELIGIBILITY, before any recency ranking, so a forward-looking
   * value can never outrank an eligible actual one.
   */
  requireActual?: boolean;
  /** Basis must be explicit. On for EBITDA only. */
  requireBasis?: boolean;

  /* --- analyst resolution (BUILD-6), OFF by default --- */
  /**
   * The analyst has explicitly selected THIS candidate to resolve a reviewable
   * semantic conflict.
   *
   * Relaxes exactly three reviewable conditions and nothing else:
   *
   *   trust_state === "ask"
   *   conflict_state === "material_conflict"
   *   conflict_state === "possible_conflict"
   *
   * Every hard safety gate below still applies — abstain, never, missing
   * evidence, unsupported precision, missing value, unsupported unit, missing
   * currency, and all period/temporal/basis requirements. An analyst may
   * resolve ambiguity; an analyst may not vouch for an unsafe input.
   */
  analystResolvedReview?: boolean;
};

/**
 * Checks one input against the gate.
 *
 * "review" means an analyst could reasonably resolve it; "block" means the
 * input is missing, unsupported, or unsafe in a way selection cannot fix.
 */
export function checkInput(
  input: AnalyticalInput,
  options: GateOptions = {},
): GateVerdict {
  const {
    allowApproximate = false,
    allowRange = false,
    requireScalar = true,
    requireMonetary = true,
    // Skill-specific semantics are opt-in: a role that does not need a
    // qualifier must not be blocked for lacking it.
    requirePeriod = false,
    requireTemporalType = false,
    requireActual = false,
    requireBasis = false,
    analystResolvedReview = false,
  } = options;

  // ---- Universal safety (always enforced) ----

  // Trust state (Autonomy_Policy).
  if (input.trust_state === "ask" && !analystResolvedReview) {
    return {
      ok: false,
      severity: "review",
      reason: `${input.metric} requires analyst review before it can be used.`,
    };
  }
  if (input.trust_state === "abstain") {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} has insufficient evidence to support a calculation.`,
    };
  }
  if (input.trust_state === "never") {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} is not permitted as a calculation input.`,
    };
  }

  // Conflict state (SV-5).
  if (input.conflict_state === "material_conflict" && !analystResolvedReview) {
    return {
      ok: false,
      severity: "review",
      reason: `${input.metric} has a material conflict that must be resolved first.`,
    };
  }
  if (input.conflict_state === "possible_conflict" && !analystResolvedReview) {
    return {
      ok: false,
      severity: "review",
      reason: `${input.metric} has a possible conflict that must be reviewed first.`,
    };
  }

  // Evidence (SV-6).
  if (input.evidence_type === "none") {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} has no supporting evidence in the report.`,
    };
  }

  // Precision (SV-9). Approximation and ranges must not become false precision.
  if (input.precision === "qualitative") {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} is qualitative and has no numerical value.`,
    };
  }
  if (input.precision === "range" && !allowRange) {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} is a range. This skill does not consume range values, and a range is never collapsed to a midpoint.`,
    };
  }
  if (input.precision === "approximate" && !allowApproximate) {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} is approximate. This skill requires an exact value.`,
    };
  }
  if (input.precision === "unknown") {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} has unknown precision.`,
    };
  }

  // Scalar value.
  if (requireScalar && input.value === null) {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} has no numerical value.`,
    };
  }

  // Units and currency.
  if (requireMonetary) {
    if (!isMonetaryUnit(input.unit)) {
      return {
        ok: false,
        severity: "block",
        reason: `${input.metric} is not expressed in a supported monetary unit.`,
      };
    }
    if (input.currency === null) {
      return {
        ok: false,
        severity: "block",
        reason: `${input.metric} has no currency.`,
      };
    }
  }

  // ---- Skill-specific semantics (opt-in) ----
  if (
    requirePeriod &&
    (input.period === null ||
      input.period.trim() === "" ||
      input.period.trim().toLowerCase() === "unknown")
  ) {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} has no resolved period, which this calculation requires.`,
    };
  }
  if (requireTemporalType && input.temporal_type === "unknown") {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} has an unresolved temporal type, which this calculation requires.`,
    };
  }
  if (requireActual && input.temporal_type !== "actual") {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} is ${input.temporal_type}, not actual. Forward-looking multiples are not calculated automatically.`,
    };
  }
  if (requireBasis && (input.basis === "unknown" || input.basis === "not_applicable")) {
    return {
      ok: false,
      severity: "block",
      reason: `${input.metric} has an unresolved accounting basis.`,
    };
  }

  return { ok: true };
}

/**
 * Bases named explicitly in a result label.
 *
 * Only the bases a consuming skill can actually distinguish between are shown,
 * so a label never implies a distinction the input does not carry. `gaap`
 * renders as "GAAP" rather than "Gaap", and is never displayed as "Reported":
 * a result computed from a GAAP figure must say so.
 */
const BASIS_LABEL: Partial<Record<AnalyticalInput["basis"], string>> = {
  adjusted: "Adjusted",
  reported: "Reported",
  gaap: "GAAP",
};

/** Human-readable label preserving the semantics that matter. */
export function describeInput(input: AnalyticalInput): string {
  const parts: string[] = [];
  if (input.period) parts.push(input.period);
  const basis = BASIS_LABEL[input.basis];
  if (basis) parts.push(basis);
  // Use the family's canonical noun so a basis-qualified metric label such as
  // "Adjusted EBITDA" does not render as "Adjusted Adjusted EBITDA".
  parts.push(metricFamily(input.metric) ?? input.metric);
  return parts.join(" ");
}

/** Builds the lineage reference carried on a SkillResult. */
export function toReference(
  input: AnalyticalInput,
  role: string,
  normalizedValue: number | null,
): SkillInputReference {
  return {
    inputId: input.input_id,
    role,
    label: describeInput(input),
    value: normalizedValue,
    unit: input.unit,
    currency: input.currency,
    period: input.period,
    temporalType: input.temporal_type,
    basis: input.basis,
  };
}
