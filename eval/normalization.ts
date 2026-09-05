import type { AnalyticalInput } from "../types/analytical-input";

import { metricFamily, type MetricFamily } from "../lib/skills/metric-family";
import { isMonetaryUnit, toUsdMillions } from "../lib/skills/unit-normalization";

/**
 * Deterministic normalization for evaluation comparisons.
 *
 * Two independent concerns live here, kept apart on purpose:
 *
 * 1. PERIOD — conservative equivalence between spelling variants of the same
 *    period, with granularity strictly preserved.
 * 2. VALUE / UNIT — economic quantity correctness separated from unit-label
 *    correctness, so a unit-label mismatch is never reported as a magnitude
 *    catastrophe and a magnitude catastrophe is never normalized away.
 *
 * No date ontology, no fiscal-calendar inference, no fuzzy matching.
 */

/* ------------------------------------------------------------------ *
 * Period
 * ------------------------------------------------------------------ */

/**
 * Closed alias table for the point-in-time report date.
 *
 * `period` is a free string in the schema, not an enum, and no product artifact
 * defines a canonical token for "the report date" — `report_date` is a Ground
 * Truth convention. The model therefore has no stated form to conform to, and
 * has been observed writing both "report date" and "as of report date" for the
 * same instant. These are the same point in time, so the evaluator treats them
 * as one period.
 *
 * Membership is an EXACT lookup in a closed table, the same mechanism
 * `lib/skills/metric-family.ts` uses and for the same reason. There is no
 * substring test, no prefix stripping, no stop-word or token deletion, no
 * regex accepting an arbitrary prefix, no edit distance, and no embedding.
 *
 * That closure is the safety property. "after report date", "before report
 * date", and "subsequent to report date" name DIFFERENT instants, and
 * "report date estimate" is a precision claim rather than a timing one. None of
 * them is a key, so none of them can collapse. A rule that stripped "as of" or
 * deleted "the" would reach all four.
 *
 * Keys are already-normalized forms: lookup happens after lowercasing,
 * underscore/hyphen conversion, whitespace collapse and trim, so `report_date`
 * arrives here as "report date".
 */
const REPORT_DATE_ALIASES = new Map<string, string>([
  ["report date", "report date"],
  ["as of report date", "report date"],
  ["as of the report date", "report date"],
  ["at report date", "report date"],
  ["at the report date", "report date"],
]);

/**
 * Canonical form of a period label.
 *
 * Four generic operations, all reversible in meaning:
 *   - lowercase;
 *   - underscores and hyphens become spaces;
 *   - runs of whitespace collapse to one space;
 *   - leading/trailing whitespace is trimmed.
 *
 * So `report_date` == `report date`, `within_two_years` == `within two years`,
 * `next_year` == `next year`, and `  FY2025 ` == `FY2025`.
 *
 * Then one closed exact-alias lookup (`REPORT_DATE_ALIASES`) collapses the
 * known spellings of the report date. A period that is not an exact key is
 * returned unchanged.
 *
 * Nothing else is dropped, expanded, or reordered. `FY2025` and `Q4 FY2025`
 * remain different strings, which is the whole point.
 */
export function normalizePeriod(period: string | null | undefined): string | null {
  if (period === null || period === undefined) return null;
  const normalized = period
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized === "" || normalized === "unknown") return null;
  return REPORT_DATE_ALIASES.get(normalized) ?? normalized;
}

const FISCAL_YEAR_ONLY = /^fy\s?(\d{4})$/;
const FISCAL_YEAR_END = /^(?:fy\s?(\d{4})\s+year\s?end|year\s?end\s+fy\s?(\d{4}))$/;
const QUARTER = /^q([1-4])\s+fy\s?(\d{4})$/;

/** Fiscal year of a bare `FY####` period, else null. */
export function fiscalYearOf(period: string | null | undefined): number | null {
  const normalized = normalizePeriod(period);
  if (normalized === null) return null;
  const match = normalized.match(FISCAL_YEAR_ONLY);
  return match ? Number(match[1]) : null;
}

/** Fiscal year of a `FY#### year-end` style period, else null. */
function fiscalYearEndOf(normalized: string): number | null {
  const match = normalized.match(FISCAL_YEAR_END);
  if (!match) return null;
  return Number(match[1] ?? match[2]);
}

/** Quarter descriptor of a `Q# FY####` period, else null. */
export function quarterOf(
  period: string | null | undefined,
): { quarter: number; year: number } | null {
  const normalized = normalizePeriod(period);
  if (normalized === null) return null;
  const match = normalized.match(QUARTER);
  if (!match) return null;
  return { quarter: Number(match[1]), year: Number(match[2]) };
}

/**
 * Metric families whose values are stated AT a point in time rather than FOR a
 * span. Only these may treat `FY2025 year-end` as compatible with `FY2025`,
 * because for a balance-sheet item the two phrases describe the same instant.
 *
 * Flow metrics (Revenue, Gross Profit, EBITDA) are deliberately excluded: for
 * them, a year-end qualifier would be a granularity claim, not a restatement.
 */
const POINT_IN_TIME_FAMILIES: ReadonlySet<MetricFamily> = new Set<MetricFamily>([
  "Cash",
  "Total Debt",
  "Enterprise Value",
]);

export function isPointInTimeFamily(metric: string): boolean {
  const family = metricFamily(metric);
  return family !== null && POINT_IN_TIME_FAMILIES.has(family);
}

export type PeriodCompatibility =
  | { compatible: true; basisOfMatch: "exact" | "fiscal_year_end" }
  | { compatible: false; reason: string };

/**
 * Conservative period compatibility.
 *
 * RULE 1 — exact normalized equality is compatible. Normalization includes the
 *          closed report-date alias table above, so "report_date" and "as of
 *          report date" meet here; nothing else about the phrase is relaxed.
 *
 * RULE 2 — `FY####` and `FY#### year-end` are compatible when ALL of:
 *          a) the fiscal years are equal;
 *          b) the metric is a point-in-time family (Cash, Total Debt,
 *             Enterprise Value);
 *          c) no competing quarter of the same fiscal year exists in the
 *             candidate pool (`competingQuarterYears`).
 *
 * Everything else is incompatible. In particular `FY2025` is NEVER compatible
 * with `Q4 FY2025`: rule 1 fails on the string and rule 2 does not accept a
 * quarter on either side.
 */
export function comparePeriods(
  expected: string | null | undefined,
  actual: string | null | undefined,
  options: {
    /** Metric label, used only to decide point-in-time eligibility. */
    metric?: string;
    /** Fiscal years for which a competing quarter exists in the pool. */
    competingQuarterYears?: ReadonlySet<number>;
  } = {},
): PeriodCompatibility {
  const left = normalizePeriod(expected);
  const right = normalizePeriod(actual);

  if (left === null || right === null) {
    return {
      compatible: false,
      reason: left === null ? "expected period is absent" : "actual period is absent",
    };
  }

  if (left === right) return { compatible: true, basisOfMatch: "exact" };

  // Rule 2. Both sides must reduce to the same fiscal year, with exactly one
  // side carrying the year-end qualifier.
  const leftYear = left.match(FISCAL_YEAR_ONLY)
    ? Number(left.match(FISCAL_YEAR_ONLY)![1])
    : fiscalYearEndOf(left);
  const rightYear = right.match(FISCAL_YEAR_ONLY)
    ? Number(right.match(FISCAL_YEAR_ONLY)![1])
    : fiscalYearEndOf(right);

  const leftIsYearEnd = fiscalYearEndOf(left) !== null;
  const rightIsYearEnd = fiscalYearEndOf(right) !== null;

  if (
    leftYear !== null &&
    rightYear !== null &&
    leftYear === rightYear &&
    leftIsYearEnd !== rightIsYearEnd
  ) {
    if (!options.metric || !isPointInTimeFamily(options.metric)) {
      return {
        compatible: false,
        reason: "year-end equivalence applies only to point-in-time metrics",
      };
    }
    if (options.competingQuarterYears?.has(leftYear)) {
      return {
        compatible: false,
        reason: `a competing quarter exists for FY${leftYear}`,
      };
    }
    return { compatible: true, basisOfMatch: "fiscal_year_end" };
  }

  return { compatible: false, reason: `"${left}" and "${right}" differ` };
}

/** Fiscal years for which the pool contains a quarterly period. */
export function competingQuarterYears(
  inputs: readonly { period: string | null }[],
): Set<number> {
  const years = new Set<number>();
  for (const input of inputs) {
    const quarter = quarterOf(input.period);
    if (quarter) years.add(quarter.year);
  }
  return years;
}

/* ------------------------------------------------------------------ *
 * Value / unit
 * ------------------------------------------------------------------ */

/**
 * Unit families. A comparison is only meaningful inside one family — a percent
 * is never normalized into a monetary quantity, and a multiple is never
 * normalized into a count.
 */
export type UnitFamily = "monetary" | "percent" | "multiple" | "count" | "other";

export function unitFamily(unit: string): UnitFamily {
  switch (unit) {
    case "USD":
    case "USD_thousands":
    case "USD_millions":
    case "USD_billions":
      return "monetary";
    case "percent":
      return "percent";
    case "multiple":
      return "multiple";
    case "count":
      return "count";
    default:
      return "other";
  }
}

/**
 * Economic quantity of a value, in the canonical scale for its unit family.
 *
 * Monetary values reuse the product's `toUsdMillions`, so 101000
 * `USD_thousands` and 101 `USD_millions` both resolve to 101 — the same
 * economic quantity expressed with different labels. Non-monetary units carry
 * no scale, so the value passes through unchanged.
 *
 * Returns null when the quantity cannot be established. Callers treat null as
 * "not comparable", never as zero.
 */
export function economicQuantity(
  value: number | null | undefined,
  unit: string,
): number | null {
  if (value === null || value === undefined) return null;
  if (isMonetaryUnit(unit as AnalyticalInput["unit"])) {
    return toUsdMillions(value, unit as AnalyticalInput["unit"]);
  }
  if (unitFamily(unit) === "other") return null;
  return value;
}

/** Relative tolerance for deterministic quantities. Not a rounding allowance. */
const QUANTITY_TOLERANCE = 1e-9;

export function quantitiesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= QUANTITY_TOLERANCE * Math.max(1, Math.abs(b));
}

/**
 * Magnitude-catastrophe threshold.
 *
 * A unit LABEL difference is not a catastrophe: `USD_thousands` vs
 * `USD_millions` on the same economic quantity is a labelling diff. A
 * catastrophe is the quantity itself being off by a scale factor — the
 * thousand/million/billion class of error described by F-05 and BLOCK-4.
 *
 * 100x is deliberately conservative: it sits far above any rounding or
 * approximation difference and far below the 1000x error the taxonomy names,
 * so it cannot fire on a merely inaccurate number.
 */
export const MAGNITUDE_CATASTROPHE_FACTOR = 100;

export type ValueComparison = {
  /** Both sides yielded a comparable quantity. */
  comparable: boolean;
  /** Economic quantities agree within deterministic tolerance. */
  economicMatch: boolean;
  /** Unit labels are identical strings. */
  unitMatch: boolean;
  /** Unit families agree (percent vs monetary vs multiple). */
  unitFamilyMatch: boolean;
  /** |actual / expected| or its reciprocal, whichever is >= 1. Null if N/A. */
  magnitudeRatio: number | null;
  /** Quantity differs by at least MAGNITUDE_CATASTROPHE_FACTOR. */
  magnitudeCatastrophe: boolean;
  expectedQuantity: number | null;
  actualQuantity: number | null;
};

/**
 * Compares an expected value/unit pair with an actual one.
 *
 * Economic correctness and unit-label correctness are reported separately and
 * never collapsed, so the harness can say "same money, wrong label" without
 * either hiding a 1000x error or inventing one.
 */
export function compareValues(
  expected: { value: number | null | undefined; unit: string },
  actual: { value: number | null | undefined; unit: string },
): ValueComparison {
  const expectedQuantity = economicQuantity(expected.value, expected.unit);
  const actualQuantity = economicQuantity(actual.value, actual.unit);
  const unitMatch = expected.unit === actual.unit;
  const unitFamilyMatch = unitFamily(expected.unit) === unitFamily(actual.unit);

  if (
    expectedQuantity === null ||
    actualQuantity === null ||
    !unitFamilyMatch
  ) {
    return {
      comparable: false,
      economicMatch: false,
      unitMatch,
      unitFamilyMatch,
      magnitudeRatio: null,
      magnitudeCatastrophe: false,
      expectedQuantity,
      actualQuantity,
    };
  }

  const economicMatch = quantitiesEqual(actualQuantity, expectedQuantity);

  let magnitudeRatio: number | null = null;
  if (expectedQuantity !== 0 && actualQuantity !== 0) {
    const ratio = Math.abs(actualQuantity / expectedQuantity);
    magnitudeRatio = ratio >= 1 ? ratio : 1 / ratio;
  } else if (expectedQuantity !== actualQuantity) {
    // One side is exactly zero and the other is not: unbounded ratio.
    magnitudeRatio = Number.POSITIVE_INFINITY;
  }

  return {
    comparable: true,
    economicMatch,
    unitMatch,
    unitFamilyMatch,
    magnitudeRatio,
    magnitudeCatastrophe:
      !economicMatch &&
      magnitudeRatio !== null &&
      magnitudeRatio >= MAGNITUDE_CATASTROPHE_FACTOR,
    expectedQuantity,
    actualQuantity,
  };
}

/* ------------------------------------------------------------------ *
 * Trust / conflict
 * ------------------------------------------------------------------ */

/**
 * Ground Truth writes `AUTO`/`ASK`; the production schema uses `auto`/`ask`.
 * Case is normalized for COMPARISON only. The production schema is untouched
 * and the dataset keeps its own spelling.
 */
export function normalizeTrustState(state: string): string {
  return state.trim().toLowerCase();
}

/** Metric labels compare through the product's exact family table first. */
export function normalizeMetricLabel(metric: string): string {
  return metric.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Metric identity for evaluation.
 *
 * Family membership is the primary test, reusing the product's closed exact
 * lookup so "Adjusted EBITDA" and "EBITDA" are one identity. A metric outside
 * the table falls back to normalized exact label equality — never substring,
 * edit distance, embeddings, or a model call.
 */
export function metricIdentityMatches(expected: string, actual: string): boolean {
  const expectedFamily = metricFamily(expected);
  const actualFamily = metricFamily(actual);
  if (expectedFamily !== null || actualFamily !== null) {
    return expectedFamily !== null && expectedFamily === actualFamily;
  }
  return normalizeMetricLabel(expected) === normalizeMetricLabel(actual);
}
