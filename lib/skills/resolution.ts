import type { AnalyticalInput } from "@/types/analytical-input";

import { isInFamily } from "./metric-family";

/**
 * Analyst resolution of a reviewable semantic conflict (BUILD-6).
 *
 * The analyst resolves ONE semantic question — "which EBITDA definition should
 * dependent calculations use?" — and that single decision feeds every skill
 * requiring that EBITDA context.
 *
 * Resolution is an overlay. No `AnalyticalInput` is ever mutated: the model's
 * interpretation is preserved exactly as received, and the selection is held
 * separately as a reference to an existing candidate.
 *
 * Scope is deliberately narrow. EBITDA accounting basis is the only resolvable
 * family for the MVP. Period ambiguity is NOT resolvable here — that is a
 * different product question, and conflating the two would let a period guess
 * ride in on a basis control.
 */

/** The analyst's selection. `selectedInputId` is authoritative. */
export type AnalystInputResolution = {
  family: "EBITDA";
  /** Period the conflict belongs to, used to reject a misapplied selection. */
  period: string;
  /** Id of an existing AnalyticalInput. Never a reconstructed label. */
  selectedInputId: string;
};

/**
 * Bases that may form the non-adjusted side of a two-way EBITDA choice.
 *
 * `reported` is the expected comparator. `gaap` is accepted for RECOVERY
 * ROBUSTNESS, not because the two mean the same thing: a live run classified an
 * explicitly "reported EBITDA" figure as `gaap`, which left the analyst with a
 * correctly blocked EV / EBITDA and no way to resolve it. Both are explicit,
 * non-adjusted accounting bases, so either forms a bounded two-way choice
 * against one adjusted figure.
 *
 * The set is deliberately closed. `unknown` and `not_applicable` are not
 * bases at all; `management_defined`, `pro_forma`, `consensus` and `non_gaap`
 * describe materially different measures whose comparison against adjusted
 * EBITDA is not a simple two-way question.
 *
 * Accepting a basis here only makes the choice OFFERABLE. It never rewrites a
 * basis, never selects a candidate, and never relaxes an execution gate.
 */
const COMPARATOR_BASES: ReadonlySet<AnalyticalInput["basis"]> = new Set([
  "reported",
  "gaap",
]);

/** A detected, resolvable accounting-basis conflict. */
export type BasisConflictGroup = {
  family: "EBITDA";
  period: string;
  /** The competing candidates, in document order. Never reordered by value. */
  candidates: AnalyticalInput[];
};

function normalizePeriod(period: string | null): string | null {
  if (period === null) return null;
  const trimmed = period.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "unknown") return null;
  return trimmed;
}

/**
 * Finds a resolvable EBITDA basis conflict, or null.
 *
 * A group qualifies only when, for one explicit period, there is exactly one
 * `adjusted` candidate and exactly one explicit reported-or-GAAP comparator,
 * both carrying a numeric value, and nothing else in that period. Anything else
 * returns null.
 *
 * `reported` and `gaap` are NOT treated as equivalent. Each candidate keeps its
 * own basis, and the returned group holds the original input objects unmodified.
 *
 * Detection is purely structural: no source-text parsing, no fuzzy matching,
 * no model call, no document id, no hard-coded period or amount.
 */
export function findResolvableBasisConflict(
  inputs: AnalyticalInput[],
): BasisConflictGroup | null {
  const ebitda = inputs.filter(
    (input) =>
      isInFamily(input.metric, "EBITDA") &&
      input.value !== null &&
      normalizePeriod(input.period) !== null,
  );

  // Group by period, preserving document order within each group.
  const byPeriod = new Map<string, AnalyticalInput[]>();
  for (const input of ebitda) {
    const period = normalizePeriod(input.period)!;
    const group = byPeriod.get(period) ?? [];
    group.push(input);
    byPeriod.set(period, group);
  }

  const groups: BasisConflictGroup[] = [];
  for (const [period, candidates] of byPeriod) {
    const adjusted = candidates.filter((i) => i.basis === "adjusted");
    const comparator = candidates.filter((i) => COMPARATOR_BASES.has(i.basis));

    // Exactly one of each, and nothing else in the group. A third basis or a
    // duplicate would make the choice ambiguous beyond a two-way selection.
    if (
      adjusted.length === 1 &&
      comparator.length === 1 &&
      candidates.length === 2
    ) {
      groups.push({ family: "EBITDA", period, candidates });
    }
  }

  // Fail closed rather than guess which conflict the analyst is looking at.
  if (groups.length !== 1) return null;
  return groups[0];
}

/**
 * Whether a resolution applies to a given family and candidate set.
 *
 * The selected id must belong to the candidates actually under consideration
 * for that skill role — a resolution is never trusted on its own word.
 */
export function resolutionAppliesTo(
  resolution: AnalystInputResolution | null | undefined,
  family: string,
  candidates: AnalyticalInput[],
): AnalyticalInput | null {
  if (!resolution) return null;
  if (resolution.family !== family) return null;

  const selected = candidates.find(
    (input) => input.input_id === resolution.selectedInputId,
  );
  if (!selected) return null;

  // Guards against a stale selection surviving into a different period context.
  if (normalizePeriod(selected.period) !== normalizePeriod(resolution.period)) {
    return null;
  }

  return selected;
}
