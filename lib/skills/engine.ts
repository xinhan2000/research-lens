import type { AnalyticalInput } from "@/types/analytical-input";

import {
  ebitdaMargin,
  evEbitda,
  evRevenue,
  grossMargin,
  netDebt,
  revenueGrowth,
} from "./calculations";
import { checkInput, describeInput, toReference } from "./input-gate";
import { isInFamily, type MetricFamily } from "./metric-family";
import { blocked, needsReview, ready, type SkillResult } from "./types";
import { toUsdMillions } from "./unit-normalization";

/**
 * The deterministic skill engine.
 *
 * Operates generically on validated `AnalyticalInput[]`. There is no
 * document-specific branching: no `if (documentId === ...)` anywhere, and no
 * Ground Truth is read at runtime.
 *
 * The engine may select candidates, validate semantics, normalize declared
 * units, decide state, and execute fixed formulas. It may not reinterpret
 * source text, infer missing values, or choose between competing semantics.
 */

/**
 * Candidate matching by metric family.
 *
 * Exact membership in a closed table — "Adjusted EBITDA" and "EBITDA" are both
 * EBITDA-family, while "EBITDA Margin" is not a member of anything. The basis
 * is never resolved here; competing members stay competing candidates.
 * `source_label` is display-only and never consulted.
 */
function byFamily(
  inputs: AnalyticalInput[],
  family: MetricFamily,
): AnalyticalInput[] {
  return inputs.filter((input) => isInFamily(input.metric, family));
}

/** Only historical values feed BUILD-5 skills. */
function actualsOnly(inputs: AnalyticalInput[]): AnalyticalInput[] {
  return inputs.filter((input) => input.temporal_type === "actual");
}

/** Exact string comparison. "Q4 FY2025" is never equal to "FY2025". */
function samePeriod(a: AnalyticalInput, b: AnalyticalInput): boolean {
  if (a.period === null || b.period === null) return false;
  return a.period.trim().toLowerCase() === b.period.trim().toLowerCase();
}

const FISCAL_YEAR = /^FY(\d{4})$/i;

/** Fiscal year number, or null when the period is not a bare fiscal year. */
function fiscalYear(period: string | null): number | null {
  if (!period) return null;
  const match = period.trim().match(FISCAL_YEAR);
  return match ? Number(match[1]) : null;
}

type Resolution =
  | { kind: "ok"; input: AnalyticalInput; normalized: number }
  | { kind: "review"; reason: string; candidates: AnalyticalInput[] }
  | { kind: "block"; reason: string; candidates: AnalyticalInput[] };

/**
 * Resolves exactly one usable input for a role.
 *
 * Several materially plausible candidates is NEEDS_REVIEW, never "take the
 * first one". A single candidate still has to clear the safety gate.
 */
function resolveSingle(
  inputs: AnalyticalInput[],
  family: MetricFamily,
  options: Parameters<typeof checkInput>[1] = {},
  narrow: {
    /** Restrict candidates to this exact period (same-period skills). */
    period?: string | null;
    /**
     * Among ELIGIBLE survivors, take the latest fiscal year.
     *
     * Eligibility is decided by the gate above (safety, period, temporal type,
     * actual-only, basis) BEFORE this ranking runs, so recency can never
     * promote an ineligible candidate over an eligible one.
     *
     * This is ordering, not discretion: periods are ordered and the chosen
     * period is stated in the result label. It never chooses between competing
     * DEFINITIONS of the same period — that stays NEEDS_REVIEW.
     */
    preferLatestFiscalYear?: boolean;
  } = {},
): Resolution {
  let candidates = byFamily(inputs, family);

  if (narrow.period !== undefined && narrow.period !== null) {
    const wanted = narrow.period.trim().toLowerCase();
    const scoped = candidates.filter(
      (input) => (input.period ?? "").trim().toLowerCase() === wanted,
    );
    if (scoped.length > 0) candidates = scoped;
  }

  if (candidates.length === 0) {
    return {
      kind: "block",
      reason: `${family} is not available from this report.`,
      candidates: [],
    };
  }

  const passing = candidates.filter((input) => checkInput(input, options).ok);

  if (passing.length === 1) {
    const input = passing[0];
    const normalized = toUsdMillions(input.value, input.unit);
    if (normalized === null) {
      return {
        kind: "block",
        reason: `${family} could not be normalized to a common monetary scale.`,
        candidates,
      };
    }
    return { kind: "ok", input, normalized };
  }

  if (passing.length > 1) {
    if (narrow.preferLatestFiscalYear) {
      const dated = passing.filter((input) => fiscalYear(input.period) !== null);
      if (dated.length > 0) {
        const latestYear = Math.max(...dated.map((i) => fiscalYear(i.period)!));
        const latest = dated.filter((i) => fiscalYear(i.period) === latestYear);
        // One value for the latest period: ordered, unambiguous, and labelled.
        if (latest.length === 1) {
          const input = latest[0];
          const normalized = toUsdMillions(input.value, input.unit);
          if (normalized === null) {
            return {
              kind: "block",
              reason: `${family} could not be normalized to a common monetary scale.`,
              candidates,
            };
          }
          return { kind: "ok", input, normalized };
        }
        // Several competing definitions of the SAME period: never auto-select.
        return {
          kind: "review",
          reason: `Multiple materially plausible ${family} values for ${latest[0].period} require analyst review.`,
          candidates: latest,
        };
      }
    }
    return {
      kind: "review",
      reason: `Multiple materially plausible ${family} values require analyst review.`,
      candidates: passing,
    };
  }

  // Nothing passed. Surface the most actionable verdict: a reviewable problem
  // outranks a hard block, because the analyst can do something about it.
  const verdicts = candidates.map((input) => checkInput(input, options));
  const reviewable = verdicts.find((v) => !v.ok && v.severity === "review");
  if (reviewable && !reviewable.ok) {
    return { kind: "review", reason: reviewable.reason, candidates };
  }
  const firstBlock = verdicts.find((v) => !v.ok);
  return {
    kind: "block",
    reason:
      firstBlock && !firstBlock.ok
        ? firstBlock.reason
        : `${family} is not usable for this calculation.`,
    candidates,
  };
}

/** Same-currency only. FX conversion is out of scope for the MVP. */
function currenciesMatch(...inputs: AnalyticalInput[]): boolean {
  const currencies = new Set(inputs.map((input) => input.currency));
  return currencies.size === 1 && !currencies.has(null);
}

function refsFor(
  candidates: AnalyticalInput[],
  role: string,
): ReturnType<typeof toReference>[] {
  return candidates.map((input) =>
    toReference(input, role, toUsdMillions(input.value, input.unit)),
  );
}

/* ------------------------------------------------------------------ *
 * DS-1 — Revenue Growth
 * ------------------------------------------------------------------ */

function skillRevenueGrowth(inputs: AnalyticalInput[]): SkillResult {
  const skillId = "skill_revenue_growth";
  const name = "Revenue Growth";
  const formula = "(Current Revenue - Prior Revenue) / Prior Revenue";

  const revenues = byFamily(inputs, "Revenue");
  if (revenues.length === 0) {
    return blocked({
      skillId, name, label: name, formula,
      reason: "Revenue is not available from this report.",
    });
  }

  // Historical only: an actual/forecast pair is never silently mixed.
  const usable = actualsOnly(revenues).filter(
    (input) =>
      checkInput(input, { requirePeriod: true, requireTemporalType: true }).ok &&
      fiscalYear(input.period) !== null,
  );

  if (usable.length < 2) {
    return blocked({
      skillId, name, label: name, formula,
      reason:
        "Two comparable historical fiscal-year revenue values are required. This report does not provide them.",
      inputs: refsFor(revenues, "Revenue"),
    });
  }

  // Sequential fiscal years only. No date ontology, no "close enough".
  const pairs: [AnalyticalInput, AnalyticalInput][] = [];
  for (const prior of usable) {
    for (const current of usable) {
      const priorYear = fiscalYear(prior.period);
      const currentYear = fiscalYear(current.period);
      if (priorYear !== null && currentYear !== null && currentYear - priorYear === 1) {
        pairs.push([prior, current]);
      }
    }
  }

  if (pairs.length === 0) {
    return blocked({
      skillId, name, label: name, formula,
      reason: "No sequential fiscal-year revenue pair is available.",
      inputs: refsFor(usable, "Revenue"),
    });
  }
  if (pairs.length > 1) {
    return needsReview({
      skillId, name, label: name, formula,
      reason: "Multiple sequential revenue pairs are possible. Analyst selection is required.",
      inputs: refsFor(usable, "Revenue"),
    });
  }

  const [prior, current] = pairs[0];
  if (!currenciesMatch(prior, current)) {
    return blocked({
      skillId, name, label: name, formula,
      reason: "Revenue values use different currencies.",
      inputs: [
        toReference(prior, "Prior Revenue", toUsdMillions(prior.value, prior.unit)),
        toReference(current, "Current Revenue", toUsdMillions(current.value, current.unit)),
      ],
    });
  }

  const priorValue = toUsdMillions(prior.value, prior.unit);
  const currentValue = toUsdMillions(current.value, current.unit);
  if (priorValue === null || currentValue === null) {
    return blocked({
      skillId, name, label: name, formula,
      reason: "Revenue values could not be normalized to a common monetary scale.",
    });
  }

  const value = revenueGrowth(priorValue, currentValue);
  if (value === null) {
    return blocked({
      skillId, name, label: name, formula,
      reason: "Prior revenue is zero, so growth cannot be calculated.",
    });
  }

  return ready({
    skillId, name,
    label: `${current.period} Revenue Growth`,
    value,
    unit: "percent",
    formula: `(${currentValue} - ${priorValue}) / ${priorValue}`,
    inputs: [
      toReference(prior, "Prior Revenue", priorValue),
      toReference(current, "Current Revenue", currentValue),
    ],
  });
}

/* ------------------------------------------------------------------ *
 * Shared shape for the same-period ratio skills
 * ------------------------------------------------------------------ */

function samePeriodRatio(config: {
  skillId: string;
  name: string;
  formula: string;
  numeratorMetric: MetricFamily;
  denominatorMetric: MetricFamily;
  numeratorRole: string;
  denominatorRole: string;
  requireNumeratorBasis?: boolean;
  /**
   * Whether this skill needs a resolved temporal type at all.
   *
   * Net Debt does not: it is a balance-sheet difference at a stated period,
   * and the specification's blocking conditions are period mismatch, currency
   * mismatch, unresolved debt definition, and missing values — temporal type
   * is not among them.
   */
  requireTemporalType?: boolean;
  compute: (numerator: number, denominator: number) => number | null;
  unit: "percent" | "USD_millions";
  labelFor: (numerator: AnalyticalInput, denominator: AnalyticalInput) => string;
  zeroReason: string;
}) {
  return (inputs: AnalyticalInput[]): SkillResult => {
    const { skillId, name, formula } = config;
    const base = { skillId, name, label: name, formula };

    const requireTemporalType = config.requireTemporalType ?? true;

    const numerator = resolveSingle(inputs, config.numeratorMetric, {
      requirePeriod: true,
      requireTemporalType,
      requireBasis: config.requireNumeratorBasis,
    });
    if (numerator.kind !== "ok") {
      const build = numerator.kind === "review" ? needsReview : blocked;
      return build({
        ...base,
        reason: numerator.reason,
        inputs: refsFor(numerator.candidates, config.numeratorRole),
      });
    }

    // The contract requires one period, so scoping the denominator to the
    // numerator's period is part of the contract rather than a judgment call.
    const denominator = resolveSingle(
      inputs,
      config.denominatorMetric,
      { requirePeriod: true, requireTemporalType },
      { period: numerator.input.period },
    );
    if (denominator.kind !== "ok") {
      const build = denominator.kind === "review" ? needsReview : blocked;
      return build({
        ...base,
        reason: denominator.reason,
        inputs: refsFor(denominator.candidates, config.denominatorRole),
      });
    }

    const refs = [
      toReference(numerator.input, config.numeratorRole, numerator.normalized),
      toReference(denominator.input, config.denominatorRole, denominator.normalized),
    ];

    if (!samePeriod(numerator.input, denominator.input)) {
      return blocked({
        ...base,
        reason: `Period mismatch: ${numerator.input.period} and ${denominator.input.period} are not the same period.`,
        inputs: refs,
      });
    }

    if (
      requireTemporalType &&
      numerator.input.temporal_type !== denominator.input.temporal_type
    ) {
      return blocked({
        ...base,
        reason: `Temporal mismatch: ${numerator.input.temporal_type} and ${denominator.input.temporal_type} values are not combined automatically.`,
        inputs: refs,
      });
    }

    if (!currenciesMatch(numerator.input, denominator.input)) {
      return blocked({
        ...base,
        reason: "Inputs use different currencies.",
        inputs: refs,
      });
    }

    const value = config.compute(numerator.normalized, denominator.normalized);
    if (value === null) {
      return blocked({ ...base, reason: config.zeroReason, inputs: refs });
    }

    return ready({
      skillId, name,
      label: config.labelFor(numerator.input, denominator.input),
      value,
      unit: config.unit,
      formula: `${numerator.normalized} ${config.formula.includes("-") ? "-" : "/"} ${denominator.normalized}`,
      inputs: refs,
    });
  };
}

const skillGrossMargin = samePeriodRatio({
  skillId: "skill_gross_margin",
  name: "Gross Margin",
  formula: "Gross Profit / Revenue",
  numeratorMetric: "Gross Profit",
  denominatorMetric: "Revenue",
  numeratorRole: "Gross Profit",
  denominatorRole: "Revenue",
  compute: grossMargin,
  unit: "percent",
  labelFor: (_gp, revenue) => `${revenue.period} Gross Margin`,
  zeroReason: "Revenue is zero, so gross margin cannot be calculated.",
});

const skillEbitdaMargin = samePeriodRatio({
  skillId: "skill_ebitda_margin",
  name: "EBITDA Margin",
  formula: "EBITDA / Revenue",
  numeratorMetric: "EBITDA",
  denominatorMetric: "Revenue",
  numeratorRole: "EBITDA",
  denominatorRole: "Revenue",
  // Basis is consequential for EBITDA and must be explicit.
  requireNumeratorBasis: true,
  compute: ebitdaMargin,
  unit: "percent",
  labelFor: (ebitda) =>
    `${ebitda.period} ${ebitda.basis === "adjusted" ? "Adjusted " : ebitda.basis === "reported" ? "Reported " : ""}EBITDA Margin`,
  zeroReason: "Revenue is zero, so EBITDA margin cannot be calculated.",
});

const skillNetDebt = samePeriodRatio({
  skillId: "skill_net_debt",
  name: "Net Debt",
  formula: "Total Debt - Cash",
  numeratorMetric: "Total Debt",
  denominatorMetric: "Cash",
  numeratorRole: "Total Debt",
  denominatorRole: "Cash",
  // Net Debt needs a shared explicit period, not a resolved temporal type.
  // Nothing is assumed to be "actual" — the qualifier is simply not required.
  requireTemporalType: false,
  compute: netDebt,
  unit: "USD_millions",
  labelFor: (debt) => `${debt.period} Net Debt`,
  zeroReason: "Net debt could not be calculated.",
});

/* ------------------------------------------------------------------ *
 * EV multiples
 *
 * Enterprise Value legitimately carries a different period from the
 * denominator (it is stated as of the report date), so only the DENOMINATOR's
 * period is validated — as the specification requires.
 * ------------------------------------------------------------------ */

function evMultiple(config: {
  skillId: string;
  name: string;
  formula: string;
  denominatorMetric: MetricFamily;
  denominatorRole: string;
  requireDenominatorBasis: boolean;
  compute: (ev: number, denominator: number) => number | null;
  labelFor: (denominator: AnalyticalInput) => string;
}) {
  return (inputs: AnalyticalInput[]): SkillResult => {
    const { skillId, name, formula } = config;
    const base = { skillId, name, label: name, formula };

    // Enterprise value is stated as of the report date: it legitimately has no
    // fiscal period, no meaningful temporal type, and no accounting basis.
    // Only universal safety applies to it. Nothing is fabricated to fill those
    // fields — the skill simply does not require them of this role.
    const ev = resolveSingle(inputs, "Enterprise Value", {});
    if (ev.kind !== "ok") {
      const build = ev.kind === "review" ? needsReview : blocked;
      return build({
        ...base,
        reason: ev.reason,
        inputs: refsFor(ev.candidates, "Enterprise Value"),
      });
    }

    const denominator = resolveSingle(
      inputs,
      config.denominatorMetric,
      {
        // Eligibility first: only safe, historical, fully-qualified candidates
        // reach the recency ranking below.
        requirePeriod: true,
        requireTemporalType: true,
        requireActual: true,
        requireBasis: config.requireDenominatorBasis,
      },
      { preferLatestFiscalYear: true },
    );
    if (denominator.kind !== "ok") {
      const build = denominator.kind === "review" ? needsReview : blocked;
      return build({
        ...base,
        reason: denominator.reason,
        inputs: refsFor(denominator.candidates, config.denominatorRole),
      });
    }

    const refs = [
      toReference(ev.input, "Enterprise Value", ev.normalized),
      toReference(denominator.input, config.denominatorRole, denominator.normalized),
    ];

    if (!currenciesMatch(ev.input, denominator.input)) {
      return blocked({
        ...base,
        reason: "Inputs use different currencies.",
        inputs: refs,
      });
    }

    const value = config.compute(ev.normalized, denominator.normalized);
    if (value === null) {
      return blocked({
        ...base,
        reason: `${config.denominatorMetric} is zero, so the multiple cannot be calculated.`,
        inputs: refs,
      });
    }

    return ready({
      skillId, name,
      label: config.labelFor(denominator.input),
      value,
      unit: "multiple",
      formula: `${ev.normalized} / ${denominator.normalized}`,
      inputs: refs,
    });
  };
}

const skillEvRevenue = evMultiple({
  skillId: "skill_ev_revenue",
  name: "EV / Revenue",
  formula: "Enterprise Value / Revenue",
  denominatorMetric: "Revenue",
  denominatorRole: "Revenue",
  requireDenominatorBasis: false,
  compute: evRevenue,
  labelFor: (revenue) => `EV / ${revenue.period} Revenue`,
});

const skillEvEbitda = evMultiple({
  skillId: "skill_ev_ebitda",
  name: "EV / EBITDA",
  formula: "Enterprise Value / EBITDA",
  denominatorMetric: "EBITDA",
  denominatorRole: "EBITDA",
  // The hero case: basis must be explicit and unambiguous.
  requireDenominatorBasis: true,
  compute: evEbitda,
  labelFor: (ebitda) => `EV / ${describeInput(ebitda)}`,
});

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

/** Runs all six MVP skills against a validated analysis. Order is stable. */
export function runSkills(inputs: AnalyticalInput[]): SkillResult[] {
  return [
    skillRevenueGrowth(inputs),
    skillGrossMargin(inputs),
    skillEbitdaMargin(inputs),
    skillNetDebt(inputs),
    skillEvRevenue(inputs),
    skillEvEbitda(inputs),
  ];
}
