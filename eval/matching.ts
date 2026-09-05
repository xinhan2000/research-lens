import type { AnalyticalInput } from "../types/analytical-input";

import type { ExpectedInput } from "./ground-truth";
import {
  comparePeriods,
  competingQuarterYears,
  metricIdentityMatches,
} from "./normalization";

/**
 * Deterministic expected -> actual input matching.
 *
 * Ground Truth ids such as `a_rev25` and `c_ebitda_adj` are LABEL ids for
 * evaluation. The live model produces its own `input_id`. The two are never
 * required to be equal; this module builds the mapping that lets expected skill
 * input references and resolution examples be evaluated against real inference.
 *
 * Matching is structural. There is no LLM, no embedding, no edit distance, no
 * semantic search, and no fuzzy library. Identity comes from the qualifiers
 * that make an analytical input what it is:
 *
 *     metric family -> period -> temporal type -> basis
 *
 * VALUE IS NEVER USED AS IDENTITY. That is the point: a wrong number must still
 * match its correct expected field so the harness can report VALUE MISMATCH
 * rather than the far less useful INPUT MISSING. Using value to disambiguate
 * would let a wrong value quietly become a missing input.
 *
 * Matching is one-to-one. One actual input can satisfy at most one expected
 * input, and when two candidates remain materially tied the result is
 * `ambiguous` — never a guess.
 */

/** Match quality, best first. Lower is stronger. */
export const MATCH_TIERS = [1, 2, 3, 4] as const;
export type MatchTier = (typeof MATCH_TIERS)[number];

export const TIER_DESCRIPTION: Record<MatchTier, string> = {
  1: "metric family, period, temporal type and basis all agree",
  2: "metric family, period and temporal type agree; basis differs",
  3: "metric family and period agree; temporal type differs",
  4: "metric family agrees only",
};

export type InputMatch =
  | {
      status: "matched";
      expectedId: string;
      actualInputId: string;
      tier: MatchTier;
    }
  | {
      status: "ambiguous";
      expectedId: string;
      tier: MatchTier;
      candidateInputIds: string[];
    }
  | { status: "missing"; expectedId: string };

export type MatchResult = {
  matches: InputMatch[];
  /** expected LABEL id -> actual model input id, for resolved matches only. */
  expectedToActual: Map<string, string>;
  /** actual model input id -> expected LABEL id. */
  actualToExpected: Map<string, string>;
  /** Actual inputs that matched no expected input. Diagnostic by default. */
  extraActualInputIds: string[];
};

/**
 * Tier of an (expected, actual) pair, or null when they are not the same
 * analytical concept at all.
 *
 * An expected field the dataset omits does not constrain the tier — it was
 * never asserted, so it cannot disagree.
 */
export function tierFor(
  expected: ExpectedInput,
  actual: AnalyticalInput,
  quarterYears: ReadonlySet<number>,
): MatchTier | null {
  if (!metricIdentityMatches(expected.metric, actual.metric)) return null;

  const periodAgrees =
    expected.period === undefined
      ? true
      : comparePeriods(expected.period, actual.period, {
          metric: expected.metric,
          competingQuarterYears: quarterYears,
        }).compatible;

  const temporalAgrees =
    expected.temporal_type === undefined
      ? true
      : expected.temporal_type === actual.temporal_type;

  const basisAgrees =
    expected.basis === undefined ? true : expected.basis === actual.basis;

  if (periodAgrees && temporalAgrees && basisAgrees) return 1;
  if (periodAgrees && temporalAgrees) return 2;
  if (periodAgrees) return 3;
  return 4;
}

/**
 * Matches a report's expected inputs against its actual inputs.
 *
 * Assignment runs tier by tier, strongest first. Within a tier a pair is only
 * assigned when the choice is mutually forced: the expected input has exactly
 * one available candidate at that tier AND that candidate is the sole
 * unassigned claim on it. The pass repeats until it stops making progress, so
 * resolving one pair can unlock another.
 *
 * Anything still contested at that tier is `ambiguous` and stops there. It is
 * deliberately NOT retried at a weaker tier: a weaker match would be a guess
 * dressed as a result.
 */
export function matchInputs(
  expectedInputs: readonly ExpectedInput[],
  actualInputs: readonly AnalyticalInput[],
): MatchResult {
  const quarterYears = competingQuarterYears(actualInputs);

  const tiers = new Map<string, Map<string, MatchTier>>();
  for (const expected of expectedInputs) {
    const row = new Map<string, MatchTier>();
    for (const actual of actualInputs) {
      const tier = tierFor(expected, actual, quarterYears);
      if (tier !== null) row.set(actual.input_id, tier);
    }
    tiers.set(expected.id, row);
  }

  const expectedToActual = new Map<string, string>();
  const actualToExpected = new Map<string, string>();
  const resolved = new Map<string, InputMatch>();

  const isExpectedOpen = (id: string) => !resolved.has(id);
  const isActualFree = (id: string) => !actualToExpected.has(id);

  for (const tier of MATCH_TIERS) {
    const candidatesAt = (expectedId: string): string[] =>
      [...(tiers.get(expectedId) ?? new Map())]
        .filter(([actualId, value]) => value === tier && isActualFree(actualId))
        .map(([actualId]) => actualId);

    let progressed = true;
    while (progressed) {
      progressed = false;

      for (const expected of expectedInputs) {
        if (!isExpectedOpen(expected.id)) continue;

        const candidates = candidatesAt(expected.id);
        if (candidates.length !== 1) continue;

        const actualId = candidates[0];

        // Mutual uniqueness: no other open expected input may also be waiting
        // on this same actual input at this tier.
        const contested = expectedInputs.some(
          (other) =>
            other.id !== expected.id &&
            isExpectedOpen(other.id) &&
            candidatesAt(other.id).includes(actualId),
        );
        if (contested) continue;

        expectedToActual.set(expected.id, actualId);
        actualToExpected.set(actualId, expected.id);
        resolved.set(expected.id, {
          status: "matched",
          expectedId: expected.id,
          actualInputId: actualId,
          tier,
        });
        progressed = true;
      }
    }

    // Whatever is still contested at this tier is genuinely ambiguous.
    for (const expected of expectedInputs) {
      if (!isExpectedOpen(expected.id)) continue;
      const candidates = candidatesAt(expected.id);
      if (candidates.length === 0) continue;
      resolved.set(expected.id, {
        status: "ambiguous",
        expectedId: expected.id,
        tier,
        candidateInputIds: candidates,
      });
    }
  }

  const matches: InputMatch[] = expectedInputs.map(
    (expected) =>
      resolved.get(expected.id) ?? {
        status: "missing" as const,
        expectedId: expected.id,
      },
  );

  const extraActualInputIds = actualInputs
    .map((input) => input.input_id)
    .filter((id) => !actualToExpected.has(id));

  return { matches, expectedToActual, actualToExpected, extraActualInputIds };
}
