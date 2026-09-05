import { metricFamily } from "./skills/metric-family";
import type { AnalysisResponse, AnalyticalInput } from "@/types/analytical-input";

type ReportInsight = AnalysisResponse["insights"][number];

/**
 * Lenses and semantic navigation.
 *
 * Purely presentational and deterministic: this module filters and groups the
 * current analytical workspace. It never participates in trusted execution —
 * no lens value reaches `runSkills`, `findResolvableBasisConflict`, or
 * `applyCorrections`, and nothing here makes a network call.
 *
 * > Navigation filters the current analytical workspace; it does not
 * > regenerate analysis.
 */

/* ------------------------------------------------------------------ *
 * Lens catalog
 * ------------------------------------------------------------------ */

export const LENS_IDS = [
  "all",
  "financials",
  "risks",
  "timeline",
  "assumptions",
] as const;

export type LensId = (typeof LENS_IDS)[number];

export const LENSES: { id: LensId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "financials", label: "Financials" },
  { id: "risks", label: "Risks" },
  { id: "timeline", label: "Timeline" },
  { id: "assumptions", label: "Assumptions" },
];

/** Temporal types the Assumptions lens surfaces. */
const FORWARD_LOOKING = new Set(["forecast", "guidance", "target", "assumption"]);

export type LensContent = {
  inputs: AnalyticalInput[];
  insights: ReportInsight[];
};

/**
 * Content visible under one lens.
 *
 * Inputs come from the EFFECTIVE inputs — the model interpretation plus analyst
 * corrections — so a corrected value is never displayed as the original.
 *
 * Insights come from the original AI narrative and are never rewritten:
 * corrections affect the current analytical inputs; narrative insights remain
 * source-derived AI interpretations.
 *
 * Returns new arrays; neither argument is mutated.
 */
export function getLensContent(
  lens: LensId,
  effectiveInputs: AnalyticalInput[],
  insights: ReportInsight[],
): LensContent {
  switch (lens) {
    case "all":
      return { inputs: [...effectiveInputs], insights: [...insights] };

    case "financials":
      // AnalyticalInput IS the structured analytical layer. No financial-metric
      // ontology is invented merely to exclude an edge metric.
      return { inputs: [...effectiveInputs], insights: [] };

    case "risks":
      return {
        inputs: [],
        insights: insights.filter((i) => i.category === "risk"),
      };

    case "timeline":
      return {
        inputs: [],
        insights: insights.filter((i) => i.category === "timeline"),
      };

    case "assumptions":
      // Forward-looking inputs plus assumption narrative. Historical actuals are
      // excluded even though they are financial.
      return {
        inputs: effectiveInputs.filter((input) =>
          FORWARD_LOOKING.has(input.temporal_type),
        ),
        insights: insights.filter((i) => i.category === "assumption"),
      };
  }
}

/** Message shown when a lens has no content. */
export function emptyLensMessage(lens: LensId): string {
  switch (lens) {
    case "risks":
      return "No risk insights found in this analysis.";
    case "timeline":
      return "No timeline insights found in this analysis.";
    case "assumptions":
      return "No assumption or forward-looking content found in this analysis.";
    case "financials":
      return "No analytical inputs found in this analysis.";
    case "all":
      return "No analytical content found in this analysis.";
  }
}

/* ------------------------------------------------------------------ *
 * Semantic navigation
 * ------------------------------------------------------------------ */

export const NAVIGATION_GROUPS = [
  "Business",
  "Financials",
  "Growth / Outlook",
  "Valuation",
  "Risks",
  "Timeline",
  "Assumptions",
] as const;

export type NavigationGroupName = (typeof NAVIGATION_GROUPS)[number];

/** A navigation item points at exactly one input or one insight, by id. */
export type NavigationTarget =
  | { kind: "input"; id: string }
  | { kind: "insight"; id: string };

export type NavigationItem = {
  target: NavigationTarget;
  label: string;
  /** Optional short qualifier, e.g. a period. */
  meta?: string;
};

export type NavigationGroup = {
  name: NavigationGroupName;
  items: NavigationItem[];
};

/**
 * Primary navigation group for one analytical input.
 *
 * Priority order matters: temporal semantics outrank the generic Financials
 * bucket, because a forecast is far easier to find under Growth / Outlook than
 * buried among historical actuals.
 *
 * Note this is NOT lens membership. A FY2026 forecast Revenue appears in the
 * Financials lens (which shows every input) and in the Assumptions lens (which
 * surfaces forward-looking content), while its primary navigation group is
 * Growth / Outlook. Lens membership and primary group are distinct concepts.
 */
export function primaryGroupForInput(
  input: AnalyticalInput,
): NavigationGroupName {
  if (input.temporal_type === "assumption") return "Assumptions";
  if (
    input.temporal_type === "forecast" ||
    input.temporal_type === "guidance" ||
    input.temporal_type === "target"
  ) {
    return "Growth / Outlook";
  }
  // Closed valuation set, matched by exact metric family — no substring or
  // fuzzy matching, and no ontology engine.
  if (metricFamily(input.metric) === "Enterprise Value") return "Valuation";
  return "Financials";
}

/** Primary navigation group for one narrative insight. */
export function primaryGroupForInsight(
  insight: ReportInsight,
): NavigationGroupName {
  switch (insight.category) {
    case "business":
      return "Business";
    case "risk":
      return "Risks";
    case "timeline":
      return "Timeline";
    case "assumption":
      return "Assumptions";
  }
}

function inputLabel(input: AnalyticalInput): NavigationItem {
  return {
    target: { kind: "input", id: input.input_id },
    label: input.metric,
    meta: input.period ?? undefined,
  };
}

/**
 * Builds semantic navigation for the CURRENT lens content.
 *
 * Deriving from lens content rather than the whole analysis keeps navigation
 * from pointing at items the active lens has hidden.
 *
 * Every item appears exactly once, under one primary group. Empty groups are
 * omitted, and group order is stable regardless of source array order.
 */
export function buildNavigation(content: LensContent): NavigationGroup[] {
  const byGroup = new Map<NavigationGroupName, NavigationItem[]>();

  const push = (name: NavigationGroupName, item: NavigationItem) => {
    const items = byGroup.get(name) ?? [];
    items.push(item);
    byGroup.set(name, items);
  };

  for (const input of content.inputs) {
    push(primaryGroupForInput(input), inputLabel(input));
  }

  for (const insight of content.insights) {
    push(primaryGroupForInsight(insight), {
      target: { kind: "insight", id: insight.id },
      label: insight.label,
    });
  }

  return NAVIGATION_GROUPS.filter((name) => (byGroup.get(name)?.length ?? 0) > 0)
    .map((name) => ({ name, items: byGroup.get(name)! }));
}
