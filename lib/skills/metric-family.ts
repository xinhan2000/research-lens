/**
 * Metric families for deterministic skill candidate selection.
 *
 * The schema legitimately allows a canonical metric name to carry its
 * accounting basis in the label — "Adjusted EBITDA" as well as "EBITDA" — while
 * `input.basis` records the basis separately. Skills therefore select
 * candidates by FAMILY, not by one exact spelling.
 *
 * Two hard boundaries:
 *
 * 1. Family matching NEVER resolves the basis. "Adjusted EBITDA" and
 *    "Reported EBITDA" are two members of one family, and they remain two
 *    distinct AnalyticalInputs with their own basis, value, period, trust
 *    state, conflict state, and evidence. Competing members for the same
 *    period stay NEEDS_REVIEW.
 * 2. Membership is an EXACT lookup in a closed table. There is no substring
 *    test, no fuzzy match, no edit distance, no embedding, no model call, and
 *    `source.text` / `source_label` are never consulted. A label outside the
 *    table has no family and is not a candidate for anything.
 */

export type MetricFamily =
  | "Revenue"
  | "Gross Profit"
  | "EBITDA"
  | "Cash"
  | "Total Debt"
  | "Enterprise Value";

/**
 * Closed alias table. Keys are normalized labels; every entry is a name the
 * product artifacts already treat as canonical for that concept.
 */
const FAMILY_BY_LABEL: Record<string, MetricFamily> = {
  // Canonical names used throughout Ground_Truth.jsonl.
  revenue: "Revenue",
  "gross profit": "Gross Profit",
  ebitda: "EBITDA",
  cash: "Cash",
  "total debt": "Total Debt",
  "enterprise value": "Enterprise Value",

  // Basis-qualified EBITDA labels. Semantic_Input_Schema SI-2 normalizes the
  // metric while SI-8 records the basis separately, so both spellings are
  // valid model output for the same concept. Observed live on the Clean report.
  "adjusted ebitda": "EBITDA",
  "reported ebitda": "EBITDA",

  // Deterministic_Skill_Spec DS-5 names this required input verbatim as
  // "Cash and Cash Equivalents", so that exact label is also valid.
  "cash and cash equivalents": "Cash",

  // Observed live on the Clean report: a naming variant of the same balance
  // -sheet concept. Added as an exact key, not by loosening the mechanism.
  "cash and equivalents": "Cash",
};

/** trim, collapse internal whitespace, lowercase. Nothing else. */
function normalizeLabel(metric: string): string {
  return metric.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The family for a metric label, or null when the label is not a known member. */
export function metricFamily(metric: string): MetricFamily | null {
  return FAMILY_BY_LABEL[normalizeLabel(metric)] ?? null;
}

/** Whether a metric label belongs to the given family. */
export function isInFamily(metric: string, family: MetricFamily): boolean {
  return metricFamily(metric) === family;
}
