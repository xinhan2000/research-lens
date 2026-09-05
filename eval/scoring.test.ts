import { describe, expect, it } from "vitest";

import { evaluateReport } from "./evaluate";
import type { GoldenDocumentId } from "./report-map";
import type { AnalysisResponse } from "../types/analytical-input";
import {
  addInput,
  cloneInput,
  dropInput,
  fixtureAnalysis,
  goldenCase,
  patchInput,
  reportBody,
} from "./test-helpers";

/**
 * AS — field-level scoring.
 *
 * Each test breaks exactly one field of an otherwise-passing interpretation and
 * asserts that the harness produces the corresponding difference. Fields are
 * never collapsed into one accuracy number, so each failure has to surface on
 * its own.
 */

function evaluate(documentId: GoldenDocumentId, analysis: AnalysisResponse) {
  return evaluateReport({
    goldenCase: goldenCase(documentId),
    analysis,
    reportBody: reportBody(documentId),
    source: "saved",
  });
}

function fieldsFor(
  documentId: GoldenDocumentId,
  analysis: AnalysisResponse,
  expectedInputId: string,
) {
  const evaluation = evaluate(documentId, analysis);
  const score = evaluation.inputScores.find(
    (entry) => entry.expectedInputId === expectedInputId,
  )!;
  return { evaluation, score };
}

describe("field scoring", () => {
  it("27. an exact semantic match passes every asserted field", () => {
    const evaluation = evaluate("report_a_clean", fixtureAnalysis("report_a_clean"));
    expect(evaluation.pass).toBe(true);
    expect(evaluation.differences).toHaveLength(0);

    const score = evaluation.inputScores.find((s) => s.expectedInputId === "a_rev25")!;
    for (const [field, outcome] of Object.entries(score.fields)) {
      expect(outcome === null || outcome === "pass", `${field} = ${outcome}`).toBe(true);
    }
  });

  it("28. a value mismatch produces an economic_value difference", () => {
    const analysis = patchInput(fixtureAnalysis("report_a_clean"), "in_a2", {
      value: 110,
    });
    const { evaluation, score } = fieldsFor("report_a_clean", analysis, "a_rev25");
    expect(score.fields.economic_value).toBe("fail");
    expect(score.fields.unit).toBe("pass");
    expect(
      evaluation.differences.some((d) => d.field === "economic_value"),
    ).toBe(true);
    expect(evaluation.pass).toBe(false);
  });

  it("29. a unit-label mismatch with a correct quantity is reported separately", () => {
    // 101000 USD_thousands is the same money as 101 USD_millions.
    const analysis = patchInput(fixtureAnalysis("report_d_failure"), "in_d1", {
      value: 101,
      unit: "USD_millions",
    });
    const { evaluation, score } = fieldsFor("report_d_failure", analysis, "d_rev25");
    expect(score.fields.economic_value).toBe("pass");
    expect(score.fields.unit).toBe("fail");

    const difference = evaluation.differences.find((d) => d.field === "unit")!;
    expect(difference.gate).toBe("monitor");
    expect(difference.message).toMatch(/economic quantity is correct/);
    expect(evaluation.differences.some((d) => d.field === "magnitude")).toBe(false);
  });

  it("30. a period mismatch produces a period difference", () => {
    const analysis = patchInput(fixtureAnalysis("report_d_failure"), "in_d2", {
      period: "FY2025",
    });
    const { evaluation } = fieldsFor("report_d_failure", analysis, "d_rev_q4");
    expect(evaluation.differences.some((d) => d.field === "period" || d.field === "match")).toBe(
      true,
    );
    expect(evaluation.pass).toBe(false);
  });

  it("31. a temporal-type mismatch produces a temporal_type difference", () => {
    const analysis = patchInput(fixtureAnalysis("report_b_forecast"), "in_b3", {
      temporal_type: "actual",
    });
    const evaluation = evaluate("report_b_forecast", analysis);
    expect(
      evaluation.differences.some(
        (d) => d.field === "temporal_type" || d.field === "match",
      ),
    ).toBe(true);
    expect(evaluation.pass).toBe(false);
  });

  it("32. a basis mismatch produces a basis difference", () => {
    const analysis = patchInput(fixtureAnalysis("report_a_clean"), "in_a4", {
      basis: "reported",
    });
    const { evaluation, score } = fieldsFor("report_a_clean", analysis, "a_ebitda25");
    expect(score.fields.basis).toBe("fail");
    expect(evaluation.differences.some((d) => d.field === "basis")).toBe(true);
  });

  it("33. a precision mismatch produces a precision difference", () => {
    const analysis = patchInput(fixtureAnalysis("report_b_forecast"), "in_b3", {
      precision: "exact",
    });
    const { score } = fieldsFor("report_b_forecast", analysis, "b_rev26");
    expect(score.fields.precision).toBe("fail");
  });

  it("34. a trust mismatch produces a trust_state difference", () => {
    const analysis = patchInput(fixtureAnalysis("report_c_conflict"), "in_c2", {
      trust_state: "auto",
    });
    const { evaluation, score } = fieldsFor("report_c_conflict", analysis, "c_ebitda_adj");
    expect(score.fields.trust_state).toBe("fail");
    const difference = evaluation.differences.find((d) => d.field === "trust_state")!;
    expect(difference.gate).toBe("hard_gate");
  });

  it("35. a material-conflict mismatch produces a conflict_state difference", () => {
    const analysis = patchInput(fixtureAnalysis("report_c_conflict"), "in_c3", {
      conflict_state: "none",
    });
    const { evaluation, score } = fieldsFor(
      "report_c_conflict",
      analysis,
      "c_ebitda_reported",
    );
    expect(score.fields.conflict_state).toBe("fail");
    expect(
      evaluation.differences.find((d) => d.field === "conflict_state")?.gate,
    ).toBe("hard_gate");
  });

  it("35b. an absent expected conflict_state is never asserted", () => {
    const evaluation = evaluate("report_a_clean", fixtureAnalysis("report_a_clean"));
    for (const score of evaluation.inputScores) {
      expect(score.fields.conflict_state).toBeNull();
    }
  });

  it("36. a missing expected input fails the report", () => {
    const analysis = dropInput(fixtureAnalysis("report_a_clean"), "in_a3");
    const evaluation = evaluate("report_a_clean", analysis);
    const match = evaluation.inputScores.find((s) => s.expectedInputId === "a_gp25")!;
    expect(match.match.status).toBe("missing");
    expect(evaluation.differences.some((d) => d.field === "match")).toBe(true);
    expect(evaluation.pass).toBe(false);
  });

  it("37. a harmless extra actual input is diagnostic only", () => {
    const base = fixtureAnalysis("report_a_clean");
    const extra = cloneInput(base, "in_a2", {
      input_id: "in_a_extra",
      metric: "Recurring Revenue Share",
      value: 72,
      unit: "percent",
      currency: null,
      source: {
        document_id: "clean",
        page: null,
        section: "Business",
        text: "Approximately 72% of FY2025 revenue was recurring.",
      },
    });
    const evaluation = evaluate("report_a_clean", addInput(base, extra));

    expect(evaluation.extraActualInputIds).toEqual(["in_a_extra"]);
    const difference = evaluation.differences.find(
      (d) => d.field === "extra_actual_input",
    )!;
    expect(difference.gate).toBe("diagnostic");
    // Diagnostic, not a failure: no skill consumed it.
    expect(evaluation.pass).toBe(true);
    expect(evaluation.blockers).toHaveLength(0);
  });

  it("37b. evidence validity fails when the source text is not in the report", () => {
    const analysis = patchInput(fixtureAnalysis("report_a_clean"), "in_a2", {
      source: {
        document_id: "clean",
        page: null,
        section: "Financial Performance",
        text: "Revenue reached one hundred and one million dollars in the 2025 fiscal year.",
      },
    });
    const { evaluation, score } = fieldsFor("report_a_clean", analysis, "a_rev25");
    expect(score.fields.evidence_validity).toBe("fail");
    expect(
      evaluation.differences.some((d) => d.field === "evidence_validity"),
    ).toBe(true);
  });

  it("37c. descriptive Ground Truth evidence goes to manual review, not failure", () => {
    // Report D's table entries DESCRIBE context rather than quoting a block.
    // Here the model cites a real but unrelated block: evidence validity still
    // passes, and agreement must not be failed through fuzzy similarity.
    const analysis = patchInput(fixtureAnalysis("report_d_failure"), "in_d4", {
      source: {
        document_id: "failure",
        page: null,
        section: "Management Commentary",
        text: "Management is working toward **roughly $25 million of EBITDA next year**, but described this as an **internal planning objective rather than formal guidance**.",
      },
    });
    const { score } = fieldsFor("report_d_failure", analysis, "d_debt");
    expect(score.fields.evidence_validity).toBe("pass");
    expect(score.fields.evidence_agreement).toBe("manual_review");
  });
});
