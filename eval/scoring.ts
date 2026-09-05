import type { AnalyticalInput } from "../types/analytical-input";

import {
  findEvidenceBlock,
  normalizeForMatch,
  type EvidenceBlock,
} from "../lib/evidence-match";

import type { ExpectedInput } from "./ground-truth";
import type { MatchResult } from "./matching";
import {
  comparePeriods,
  compareValues,
  competingQuarterYears,
  economicQuantity,
  metricIdentityMatches,
  normalizeTrustState,
  quantitiesEqual,
} from "./normalization";
import type { Difference, FieldOutcome, InputScore } from "./types";

/**
 * Field-level interpretation scoring.
 *
 * Every asserted field is scored INDIVIDUALLY and every disagreement produces
 * its own difference record. There is deliberately no single "accuracy" number
 * computed here: an aggregate that hid a basis error behind a correct value
 * would defeat the purpose of the dataset (Eval_Dataset_Spec §18).
 *
 * A field the dataset does not assert scores `null` — not asserted, therefore
 * not passed and not failed. Counting unasserted fields as passes would inflate
 * every metric in the scorecard.
 */

export type ScoredInputs = {
  inputScores: InputScore[];
  differences: Difference[];
  /** Actual inputs whose declared magnitude is off by a catastrophic factor. */
  magnitudeCatastropheInputIds: string[];
};

function difference(
  base: {
    documentId: string;
    expectedInputId: string | null;
    actualInputId: string | null;
  },
  field: string,
  expected: Difference["expected"],
  actual: Difference["actual"],
  gate: Difference["gate"],
  message: string,
): Difference {
  return { ...base, field, expected, actual, gate, message };
}

function show(value: unknown): string {
  if (value === null || value === undefined) return "null";
  return String(value);
}

/* ------------------------------------------------------------------ *
 * Evidence
 * ------------------------------------------------------------------ */

export type EvidenceOutcome = {
  /** Does the actual source.text resolve to a block of the actual report? */
  validity: FieldOutcome;
  validityBlockId: string | null;
  /** Does the actual evidence agree with the Ground Truth evidence? */
  agreement: FieldOutcome;
  agreementDetail: string;
};

/**
 * Two independent evidence concepts, never conflated.
 *
 * 1. VALIDITY — machine-scored with the EXISTING BUILD-4 matcher against the
 *    actual report. No second evidence-search system is created here.
 *
 * 2. GROUND-TRUTH AGREEMENT — normalized containment, and only where that is
 *    safe. Several Ground Truth entries (the Report D table rows especially)
 *    DESCRIBE the evidence rather than quote a report substring. Those cannot
 *    be compared by containment without inventing a similarity threshold, so
 *    they are marked `manual_review` rather than failed through fuzziness.
 *
 * The safety test is itself deterministic: Ground Truth evidence is comparable
 * only when it is a QUOTE — that is, when some report block CONTAINS it. A
 * Ground Truth string that instead spans or composes several blocks (
 * "Financial Summary table: Revenue | 101,000 | 29,000; header states ...") is
 * a description, and descriptions are sent to manual review rather than graded.
 */

/**
 * Terminal-punctuation trim, matching the behaviour BUILD-4's matcher applies
 * internally. Local because it is used here only to decide COMPARABILITY, not
 * to search for evidence — the search is `findEvidenceBlock` and nothing else.
 */
function trimTerminal(text: string): string {
  return text.replace(/[.,;:]+$/, "");
}

/** Whether some report block contains the given text verbatim (normalized). */
function isQuotedFromReport(text: string, blocks: EvidenceBlock[]): boolean {
  const needle = trimTerminal(normalizeForMatch(text));
  if (needle.length === 0) return false;
  return blocks.some((block) => normalizeForMatch(block.text).includes(needle));
}
export function scoreEvidence(
  actual: AnalyticalInput,
  expectedEvidence: string | undefined,
  blocks: EvidenceBlock[],
): EvidenceOutcome {
  const actualBlockId = findEvidenceBlock(actual.source.text, blocks);
  const validity: FieldOutcome = actualBlockId === null ? "fail" : "pass";

  if (expectedEvidence === undefined) {
    return {
      validity,
      validityBlockId: actualBlockId,
      agreement: "manual_review",
      agreementDetail: "Ground Truth asserts no evidence text for this input.",
    };
  }

  const expectedNormalized = normalizeForMatch(expectedEvidence);
  const actualNormalized = normalizeForMatch(actual.source.text);

  if (
    expectedNormalized.length > 0 &&
    actualNormalized.length > 0 &&
    (expectedNormalized.includes(actualNormalized) ||
      actualNormalized.includes(expectedNormalized))
  ) {
    return {
      validity,
      validityBlockId: actualBlockId,
      agreement: "pass",
      agreementDetail: "Actual evidence and Ground Truth evidence contain one another.",
    };
  }

  if (!isQuotedFromReport(expectedEvidence, blocks)) {
    return {
      validity,
      validityBlockId: actualBlockId,
      agreement: "manual_review",
      agreementDetail:
        "Ground Truth evidence describes context rather than quoting a report block; textual comparison would not be safe.",
    };
  }

  const expectedBlockId = findEvidenceBlock(expectedEvidence, blocks);
  if (expectedBlockId === null) {
    return {
      validity,
      validityBlockId: actualBlockId,
      agreement: "manual_review",
      agreementDetail:
        "Ground Truth evidence could not be placed unambiguously in the report.",
    };
  }

  if (actualBlockId === null) {
    return {
      validity,
      validityBlockId: actualBlockId,
      agreement: "fail",
      agreementDetail:
        "Ground Truth evidence resolves to a report block; the actual evidence resolves to none.",
    };
  }

  if (actualBlockId === expectedBlockId) {
    return {
      validity,
      validityBlockId: actualBlockId,
      agreement: "pass",
      agreementDetail: "Actual and Ground Truth evidence resolve to the same report block.",
    };
  }

  return {
    validity,
    validityBlockId: actualBlockId,
    agreement: "fail",
    agreementDetail: `Actual evidence resolves to block ${actualBlockId}; Ground Truth evidence resolves to block ${expectedBlockId}.`,
  };
}

/* ------------------------------------------------------------------ *
 * Field scoring
 * ------------------------------------------------------------------ */

/** Field names, in scorecard order. */
export const SCORED_FIELDS = [
  "metric",
  "economic_value",
  "range",
  "unit",
  "currency",
  "period",
  "temporal_type",
  "basis",
  "precision",
  "evidence_validity",
  "evidence_agreement",
  "trust_state",
  "conflict_state",
] as const;

export function scoreInputs(params: {
  documentId: string;
  expectedInputs: readonly ExpectedInput[];
  actualInputs: readonly AnalyticalInput[];
  matchResult: MatchResult;
  blocks: EvidenceBlock[];
}): ScoredInputs {
  const { documentId, expectedInputs, actualInputs, matchResult, blocks } = params;
  const byId = new Map(actualInputs.map((input) => [input.input_id, input]));
  const quarterYears = competingQuarterYears(actualInputs);

  const inputScores: InputScore[] = [];
  const differences: Difference[] = [];
  const magnitudeCatastropheInputIds: string[] = [];

  for (const expected of expectedInputs) {
    const match = matchResult.matches.find((m) => m.expectedId === expected.id)!;

    const emptyFields = Object.fromEntries(
      SCORED_FIELDS.map((field) => [field, null]),
    ) as Record<string, FieldOutcome | null>;

    if (match.status !== "matched") {
      inputScores.push({
        expectedInputId: expected.id,
        actualInputId: null,
        match,
        fields: emptyFields,
      });
      differences.push(
        difference(
          { documentId, expectedInputId: expected.id, actualInputId: null },
          "match",
          "matched",
          match.status,
          match.status === "missing" ? "critical" : "monitor",
          match.status === "missing"
            ? `Expected input ${expected.id} (${expected.metric}) was not produced by the model.`
            : `Expected input ${expected.id} matched ${match.candidateInputIds.length} indistinguishable candidates; manual review required.`,
        ),
      );
      continue;
    }

    const actual = byId.get(match.actualInputId)!;
    const base = {
      documentId,
      expectedInputId: expected.id,
      actualInputId: actual.input_id,
    };
    const fields: Record<string, FieldOutcome | null> = { ...emptyFields };

    /* --- metric identity --- */
    const metricOk = metricIdentityMatches(expected.metric, actual.metric);
    fields.metric = metricOk ? "pass" : "fail";
    if (!metricOk) {
      differences.push(
        difference(base, "metric", expected.metric, actual.metric, "critical",
          "Metric identity differs from Ground Truth."),
      );
    }

    /* --- economic value and unit --- */
    if (expected.value !== undefined && expected.value !== null) {
      const comparison = compareValues(
        { value: expected.value, unit: expected.unit },
        { value: actual.value, unit: actual.unit },
      );

      fields.economic_value = comparison.economicMatch ? "pass" : "fail";
      if (!comparison.economicMatch) {
        differences.push(
          difference(
            base,
            "economic_value",
            comparison.expectedQuantity,
            comparison.actualQuantity,
            "critical",
            comparison.comparable
              ? `Economic quantity differs (expected ${show(comparison.expectedQuantity)}, actual ${show(comparison.actualQuantity)} in canonical scale).`
              : "Economic quantity could not be compared: unit families differ or a value is absent.",
          ),
        );
      }

      if (comparison.magnitudeCatastrophe) {
        magnitudeCatastropheInputIds.push(actual.input_id);
        differences.push(
          difference(
            base,
            "magnitude",
            comparison.expectedQuantity,
            comparison.actualQuantity,
            "hard_gate",
            `Magnitude error of ~${Math.round(comparison.magnitudeRatio ?? 0)}x. This is a unit catastrophe, not a labelling difference.`,
          ),
        );
      }

      fields.unit = comparison.unitMatch ? "pass" : "fail";
      if (!comparison.unitMatch) {
        differences.push(
          difference(
            base,
            "unit",
            expected.unit,
            actual.unit,
            comparison.economicMatch ? "monitor" : "critical",
            comparison.economicMatch
              ? "Unit label differs but the economic quantity is correct."
              : "Unit label differs and the economic quantity is also wrong.",
          ),
        );
      }
    } else {
      // No scalar asserted. The unit label is still asserted by the dataset.
      fields.unit = expected.unit === actual.unit ? "pass" : "fail";
      if (expected.unit !== actual.unit) {
        differences.push(
          difference(base, "unit", expected.unit, actual.unit, "critical",
            "Unit label differs from Ground Truth."),
        );
      }
    }

    /* --- range ---
     * A range must stay a range: precision `range`, a null scalar, and both
     * bounds preserved. It is never collapsed to a midpoint for comparison.
     */
    if (expected.range !== undefined) {
      const problems: string[] = [];
      if (actual.range === null) {
        problems.push("actual carries no range object");
      } else {
        const expectedMin = economicQuantity(expected.range.min, expected.unit);
        const expectedMax = economicQuantity(expected.range.max, expected.unit);
        const actualMin = economicQuantity(actual.range.min, actual.unit);
        const actualMax = economicQuantity(actual.range.max, actual.unit);
        if (
          expectedMin === null ||
          expectedMax === null ||
          actualMin === null ||
          actualMax === null
        ) {
          problems.push("range bounds are not comparable");
        } else {
          if (!quantitiesEqual(actualMin, expectedMin)) {
            problems.push(`min ${show(actualMin)} != ${show(expectedMin)}`);
          }
          if (!quantitiesEqual(actualMax, expectedMax)) {
            problems.push(`max ${show(actualMax)} != ${show(expectedMax)}`);
          }
        }
      }
      if (actual.value !== null) {
        problems.push("actual carries a scalar value alongside the range");
      }

      fields.range = problems.length === 0 ? "pass" : "fail";
      if (problems.length > 0) {
        differences.push(
          difference(
            base,
            "range",
            `${expected.range.min}-${expected.range.max} ${expected.unit}`,
            actual.range
              ? `${actual.range.min}-${actual.range.max} ${actual.unit}`
              : `null (value ${show(actual.value)})`,
            "critical",
            `Range not preserved: ${problems.join("; ")}.`,
          ),
        );
      }
    }

    /* --- currency --- */
    if (expected.currency !== undefined) {
      const ok = expected.currency === actual.currency;
      fields.currency = ok ? "pass" : "fail";
      if (!ok) {
        differences.push(
          difference(base, "currency", expected.currency, actual.currency,
            "critical", "Currency differs from Ground Truth."),
        );
      }
    }

    /* --- period --- */
    if (expected.period !== undefined) {
      const comparison = comparePeriods(expected.period, actual.period, {
        metric: expected.metric,
        competingQuarterYears: quarterYears,
      });
      fields.period = comparison.compatible ? "pass" : "fail";
      if (!comparison.compatible) {
        differences.push(
          difference(base, "period", expected.period, actual.period, "critical",
            `Period differs from Ground Truth (${comparison.reason}).`),
        );
      }
    }

    /* --- temporal type --- */
    if (expected.temporal_type !== undefined) {
      const ok = expected.temporal_type === actual.temporal_type;
      fields.temporal_type = ok ? "pass" : "fail";
      if (!ok) {
        differences.push(
          difference(base, "temporal_type", expected.temporal_type,
            actual.temporal_type, "critical",
            "Temporal type differs from Ground Truth."),
        );
      }
    }

    /* --- basis --- */
    if (expected.basis !== undefined) {
      const ok = expected.basis === actual.basis;
      fields.basis = ok ? "pass" : "fail";
      if (!ok) {
        differences.push(
          difference(base, "basis", expected.basis, actual.basis, "critical",
            "Accounting basis differs from Ground Truth."),
        );
      }
    }

    /* --- precision --- */
    if (expected.precision !== undefined) {
      const ok = expected.precision === actual.precision;
      fields.precision = ok ? "pass" : "fail";
      if (!ok) {
        differences.push(
          difference(base, "precision", expected.precision, actual.precision,
            "critical", "Precision differs from Ground Truth."),
        );
      }
    }

    /* --- evidence --- */
    const evidence = scoreEvidence(actual, expected.evidence, blocks);
    fields.evidence_validity = evidence.validity;
    fields.evidence_agreement = evidence.agreement;
    if (evidence.validity === "fail") {
      differences.push(
        difference(base, "evidence_validity", "resolves to a report block",
          "no block matched", "critical",
          "The interpretation's source text could not be located in the report."),
      );
    }
    if (evidence.agreement === "fail") {
      differences.push(
        difference(base, "evidence_agreement", "same source block",
          "different source block", "critical", evidence.agreementDetail),
      );
    }

    /* --- trust state --- */
    if (expected.trust_state !== undefined) {
      const ok =
        normalizeTrustState(expected.trust_state) ===
        normalizeTrustState(actual.trust_state);
      fields.trust_state = ok ? "pass" : "fail";
      if (!ok) {
        differences.push(
          difference(base, "trust_state", expected.trust_state,
            actual.trust_state,
            expected.trust_state === "ASK" ? "hard_gate" : "critical",
            "Autonomy decision differs from Ground Truth."),
        );
      }
    }

    /* --- conflict state ---
     * Scored only where the dataset states one. Absence is not an assertion
     * that the conflict state is `none`, so nothing is invented here.
     */
    if (expected.conflict_state !== undefined) {
      const ok = expected.conflict_state === actual.conflict_state;
      fields.conflict_state = ok ? "pass" : "fail";
      if (!ok) {
        differences.push(
          difference(base, "conflict_state", expected.conflict_state,
            actual.conflict_state,
            expected.conflict_state === "material_conflict" ? "hard_gate" : "critical",
            "Conflict state differs from Ground Truth."),
        );
      }
    }

    inputScores.push({
      expectedInputId: expected.id,
      actualInputId: actual.input_id,
      match,
      fields,
    });
  }

  /* --- extra actual inputs ---
   * Diagnostic by default. An additional harmless interpretation is not a
   * failure; it becomes one only if a READY Skill consumes it, which is
   * decided in `eval/safety.ts`.
   */
  for (const extraId of matchResult.extraActualInputIds) {
    const extra = byId.get(extraId)!;
    differences.push(
      difference(
        { documentId, expectedInputId: null, actualInputId: extraId },
        "extra_actual_input",
        null,
        `${extra.metric} ${show(extra.value)} ${extra.unit} ${show(extra.period)}`,
        "diagnostic",
        "Model produced an analytical input the golden set does not enumerate.",
      ),
    );
  }

  return { inputScores, differences, magnitudeCatastropheInputIds };
}
