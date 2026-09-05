import type { AnalyticalInput } from "../types/analytical-input";

import { findEvidenceBlock, type EvidenceBlock } from "../lib/evidence-match";
import { metricFamily } from "../lib/skills/metric-family";

import type { ExpectedInput } from "./ground-truth";
import type { MatchResult } from "./matching";
import { compareValues, normalizePeriod, quantitiesEqual } from "./normalization";
import type { BehaviorCheck } from "./types";

/**
 * Behaviour predicates, keyed by the ACTUAL Ground Truth behaviour names.
 *
 * Ground Truth states some expectations as behaviour flags rather than as
 * expected Skill rows, because what matters is a property of the whole
 * interpretation ("the range did not collapse") rather than one field.
 *
 * These are EVAL-ONLY checks. No Report-B-specific or Report-D-specific logic
 * exists in the product: the predicates below read the model's output and the
 * dataset, and the deterministic engine never learns which report it is looking
 * at.
 *
 * An unrecognised behaviour name is reported as `unimplemented`, never as a
 * pass. A silently ignored expectation is an evaluation that passes by not
 * looking.
 */

export type BehaviorContext = {
  expectedInputs: readonly ExpectedInput[];
  actualInputs: readonly AnalyticalInput[];
  matchResult: MatchResult;
  blocks: EvidenceBlock[];
};

type Predicate = (context: BehaviorContext) => { pass: boolean; detail: string };

function matchedActual(
  context: BehaviorContext,
  expectedId: string,
): AnalyticalInput | null {
  const actualId = context.matchResult.expectedToActual.get(expectedId);
  if (!actualId) return null;
  return (
    context.actualInputs.find((input) => input.input_id === actualId) ?? null
  );
}

function verdict(problems: string[], okDetail: string) {
  return problems.length === 0
    ? { pass: true, detail: okDetail }
    : { pass: false, detail: problems.join("; ") };
}

/* ------------------------------------------------------------------ *
 * Report B
 * ------------------------------------------------------------------ */

/**
 * Historical and forward-looking values must remain separate interpretations
 * with their temporal types intact.
 *
 * Two failure shapes are caught: two expected inputs collapsing onto ONE actual
 * input, and an actual input carrying the wrong temporal type.
 */
const historicalAndForwardDistinct: Predicate = (context) => {
  const problems: string[] = [];
  const claimed = new Map<string, string>();

  for (const expected of context.expectedInputs) {
    if (expected.temporal_type === undefined) continue;
    const actual = matchedActual(context, expected.id);
    if (!actual) {
      problems.push(`${expected.id} (${expected.temporal_type}) was not matched`);
      continue;
    }
    const priorClaim = claimed.get(actual.input_id);
    if (priorClaim) {
      problems.push(
        `${expected.id} and ${priorClaim} both resolve to actual input ${actual.input_id}`,
      );
    }
    claimed.set(actual.input_id, expected.id);

    if (actual.temporal_type !== expected.temporal_type) {
      problems.push(
        `${expected.id} expected temporal type ${expected.temporal_type}, got ${actual.temporal_type}`,
      );
    }
  }

  return verdict(
    problems,
    "Historical, forecast and target interpretations are distinct and correctly typed.",
  );
};

/** A range stays a range: bounds preserved, no scalar, precision `range`. */
const rangeMustNotCollapse: Predicate = (context) => {
  const problems: string[] = [];
  let checked = 0;

  for (const expected of context.expectedInputs) {
    if (expected.range === undefined) continue;
    checked += 1;
    const actual = matchedActual(context, expected.id);
    if (!actual) {
      problems.push(`${expected.id} was not matched`);
      continue;
    }
    if (actual.precision !== "range") {
      problems.push(`${expected.id} precision is ${actual.precision}, not range`);
    }
    if (actual.value !== null) {
      problems.push(`${expected.id} carries scalar value ${actual.value}`);
    }
    if (actual.range === null) {
      problems.push(`${expected.id} carries no range bounds`);
      continue;
    }
    const min = compareValues(
      { value: expected.range.min, unit: expected.unit },
      { value: actual.range.min, unit: actual.unit },
    );
    const max = compareValues(
      { value: expected.range.max, unit: expected.unit },
      { value: actual.range.max, unit: actual.unit },
    );
    if (!min.economicMatch) problems.push(`${expected.id} range min differs`);
    if (!max.economicMatch) problems.push(`${expected.id} range max differs`);
  }

  if (checked === 0) {
    return { pass: false, detail: "Ground Truth asserts no range input to check." };
  }
  return verdict(problems, `${checked} range input(s) preserved as ranges.`);
};

/** A management target must not be recorded as a historical actual. */
const targetMustNotBeActual: Predicate = (context) => {
  const problems: string[] = [];
  let checked = 0;

  for (const expected of context.expectedInputs) {
    if (expected.temporal_type !== "target") continue;
    checked += 1;
    const actual = matchedActual(context, expected.id);
    if (!actual) {
      problems.push(`${expected.id} was not matched`);
      continue;
    }
    if (actual.temporal_type === "actual") {
      problems.push(`${expected.id} was interpreted as actual`);
    } else if (actual.temporal_type !== "target") {
      problems.push(
        `${expected.id} was interpreted as ${actual.temporal_type}, not target`,
      );
    }
  }

  if (checked === 0) {
    return { pass: false, detail: "Ground Truth asserts no target input to check." };
  }
  return verdict(problems, `${checked} target input(s) remained targets.`);
};

/* ------------------------------------------------------------------ *
 * Report D
 * ------------------------------------------------------------------ */

/**
 * The table's "$ in thousands" header must apply to the table's values.
 *
 * Scored on ECONOMIC QUANTITY, not on the unit label. A model that reports 101
 * `USD_millions` for a 101,000-thousand cell has applied the header correctly
 * and simply chose a different label; a model that reports 101,000
 * `USD_millions` has not.
 */
const tableHeaderUnitMustApply: Predicate = (context) => {
  const problems: string[] = [];
  let checked = 0;

  for (const expected of context.expectedInputs) {
    if (expected.unit !== "USD_thousands") continue;
    if (expected.value === undefined || expected.value === null) continue;
    checked += 1;
    const actual = matchedActual(context, expected.id);
    if (!actual) {
      problems.push(`${expected.id} was not matched`);
      continue;
    }
    const comparison = compareValues(
      { value: expected.value, unit: expected.unit },
      { value: actual.value, unit: actual.unit },
    );
    if (!comparison.economicMatch) {
      problems.push(
        comparison.magnitudeCatastrophe
          ? `${expected.id} magnitude is off by ~${Math.round(comparison.magnitudeRatio ?? 0)}x`
          : `${expected.id} economic quantity differs`,
      );
    }
  }

  if (checked === 0) {
    return {
      pass: false,
      detail: "Ground Truth asserts no thousand-scale table input to check.",
    };
  }
  return verdict(problems, `${checked} table input(s) preserved thousand-scale semantics.`);
};

/** `Q4 FY2025` and `FY2025` must remain distinct interpretations. */
const quarterMustNotBecomeFiscalYear: Predicate = (context) => {
  const problems: string[] = [];
  let checked = 0;

  for (const expected of context.expectedInputs) {
    const expectedPeriod = normalizePeriod(expected.period);
    if (expectedPeriod === null || !/^q[1-4]\s/.test(expectedPeriod)) continue;
    checked += 1;

    const actual = matchedActual(context, expected.id);
    if (!actual) {
      problems.push(`${expected.id} (${expected.period}) was not matched`);
      continue;
    }
    const actualPeriod = normalizePeriod(actual.period);
    if (actualPeriod !== expectedPeriod) {
      problems.push(
        `${expected.id} expected period ${expected.period}, got ${actual.period}`,
      );
    }

    // The annual sibling must be a different interpretation entirely.
    const family = metricFamily(expected.metric);
    for (const sibling of context.expectedInputs) {
      if (sibling.id === expected.id) continue;
      if (metricFamily(sibling.metric) !== family) continue;
      const siblingActual = matchedActual(context, sibling.id);
      if (siblingActual && siblingActual.input_id === actual.input_id) {
        problems.push(
          `${expected.id} and ${sibling.id} collapsed onto actual input ${actual.input_id}`,
        );
      }
    }
  }

  if (checked === 0) {
    return { pass: false, detail: "Ground Truth asserts no quarterly input to check." };
  }
  return verdict(problems, `${checked} quarterly input(s) stayed distinct from the fiscal year.`);
};

/** A footnote-defined adjusted basis must survive into the interpretation. */
const footnoteMustPreserveAdjustedBasis: Predicate = (context) => {
  const problems: string[] = [];
  let checked = 0;

  for (const expected of context.expectedInputs) {
    if (expected.basis !== "adjusted") continue;
    checked += 1;
    const actual = matchedActual(context, expected.id);
    if (!actual) {
      problems.push(`${expected.id} was not matched`);
      continue;
    }
    if (actual.basis !== "adjusted") {
      problems.push(`${expected.id} basis is ${actual.basis}, not adjusted`);
    }
  }

  if (checked === 0) {
    return { pass: false, detail: "Ground Truth asserts no adjusted-basis input to check." };
  }
  return verdict(problems, `${checked} adjusted-basis input(s) preserved.`);
};

/**
 * An internal planning objective must not be promoted to a formal forecast.
 *
 * Stricter than `target_must_not_be_treated_as_actual`: `forecast` and
 * `guidance` are also failures, because both assert a formality the report
 * explicitly denies.
 */
const internalTargetMustNotBecomeForecast: Predicate = (context) => {
  const problems: string[] = [];
  let checked = 0;

  for (const expected of context.expectedInputs) {
    if (expected.temporal_type !== "target") continue;
    checked += 1;
    const actual = matchedActual(context, expected.id);
    if (!actual) {
      problems.push(`${expected.id} was not matched`);
      continue;
    }
    if (actual.temporal_type !== "target") {
      problems.push(
        `${expected.id} was interpreted as ${actual.temporal_type}, not target`,
      );
    }
  }

  if (checked === 0) {
    return { pass: false, detail: "Ground Truth asserts no internal-target input to check." };
  }
  return verdict(problems, `${checked} internal target(s) remained targets.`);
};

/**
 * Qualitative language must not become a numeric analytical input.
 *
 * Structural and report-agnostic: an input carrying a number (scalar or range)
 * whose source evidence resolves to a report block containing NO digits was
 * derived from prose that states no quantity. "Margins should improve
 * meaningfully" is such a block.
 *
 * No metric-name heuristics, no keyword list, no model judging.
 */
const qualitativeMustNotCreateNumericInput: Predicate = (context) => {
  const problems: string[] = [];

  const digitFreeBlockIds = new Set(
    context.blocks.filter((block) => !/\d/.test(block.text)).map((block) => block.id),
  );

  for (const actual of context.actualInputs) {
    const hasNumber = actual.value !== null || actual.range !== null;
    if (!hasNumber) continue;

    const blockId = findEvidenceBlock(actual.source.text, context.blocks);
    if (blockId === null) continue;
    if (digitFreeBlockIds.has(blockId)) {
      problems.push(
        `${actual.input_id} (${actual.metric}) carries a number sourced from a block that states none`,
      );
    }
  }

  return verdict(
    problems,
    "No numerical input was derived from a report block that states no quantity.",
  );
};

/* ------------------------------------------------------------------ *
 * Registry
 * ------------------------------------------------------------------ */

const PREDICATES: Record<string, Predicate> = {
  historical_and_forward_values_must_remain_distinct: historicalAndForwardDistinct,
  range_must_not_collapse_to_single_value: rangeMustNotCollapse,
  target_must_not_be_treated_as_actual: targetMustNotBeActual,
  table_header_unit_must_apply: tableHeaderUnitMustApply,
  q4_must_not_be_treated_as_fy2025: quarterMustNotBecomeFiscalYear,
  footnote_must_preserve_adjusted_basis: footnoteMustPreserveAdjustedBasis,
  internal_target_must_not_be_treated_as_formal_forecast:
    internalTargetMustNotBecomeForecast,
  qualitative_margin_statement_must_not_create_numeric_input:
    qualitativeMustNotCreateNumericInput,
};

/** Names this harness can score. Exported so tests can assert coverage. */
export const IMPLEMENTED_BEHAVIORS = Object.keys(PREDICATES).sort();

export function runBehaviorChecks(
  expectedBehavior: Record<string, boolean> | undefined,
  context: BehaviorContext,
): BehaviorCheck[] {
  if (!expectedBehavior) return [];

  return Object.entries(expectedBehavior).map(([name, asserted]) => {
    if (!asserted) {
      return {
        name,
        status: "pass" as const,
        detail: "Ground Truth records this behaviour as not asserted.",
      };
    }
    const predicate = PREDICATES[name];
    if (!predicate) {
      return {
        name,
        status: "unimplemented" as const,
        detail: "No predicate implemented for this behaviour name.",
      };
    }
    const result = predicate(context);
    return {
      name,
      status: result.pass ? ("pass" as const) : ("fail" as const),
      detail: result.detail,
    };
  });
}

/** Re-exported for tests that need the tolerance used by range comparison. */
export { quantitiesEqual };
