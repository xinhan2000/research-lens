import { describe, expect, it } from "vitest";

import {
  GroundTruthError,
  loadGroundTruth,
  parseGroundTruth,
} from "./ground-truth";
import { GOLDEN_DOCUMENT_IDS } from "./report-map";

/**
 * AP — Ground Truth loading.
 *
 * Malformed Ground Truth must fail loudly. A skipped line is an expectation
 * that silently stops being checked, which is worse than a crash.
 */

const VALID_LINE = JSON.stringify({
  document_id: "report_x",
  scenario: "test",
  expected_inputs: [{ id: "x1", metric: "Revenue", value: 1, unit: "USD_millions" }],
});

describe("ground truth loading", () => {
  it("1. loads all four golden-set lines", () => {
    const cases = loadGroundTruth();
    expect(cases).toHaveLength(4);
    expect(cases.map((entry) => entry.document_id)).toEqual([
      ...GOLDEN_DOCUMENT_IDS,
    ]);
  });

  it("2. rejects duplicate document ids", () => {
    expect(() => parseGroundTruth(`${VALID_LINE}\n${VALID_LINE}`)).toThrow(
      /duplicate document_id/,
    );
  });

  it("3. reports the line number for malformed JSON", () => {
    const text = `${VALID_LINE}\n\n{ not json }`;
    expect(() => parseGroundTruth(text)).toThrow(/line 3: not valid JSON/);
  });

  it("4. reports the schema issue path for an invalid record", () => {
    const invalid = JSON.stringify({
      document_id: "report_y",
      scenario: "test",
      expected_inputs: [{ id: "y1", metric: "Revenue", unit: 42 }],
    });
    expect(() => parseGroundTruth(invalid)).toThrow(
      /line 1: schema violation at expected_inputs\.0\.unit/,
    );
  });

  it("4b. rejects an unrecognised key rather than ignoring it", () => {
    const extra = JSON.stringify({
      document_id: "report_z",
      scenario: "test",
      expected_inputs: [{ id: "z1", metric: "Revenue", unit: "USD_millions" }],
      expected_something_new: true,
    });
    expect(() => parseGroundTruth(extra)).toThrow(/schema violation/);
  });

  it("5. handles optional expected_skills, including input references", () => {
    const cases = loadGroundTruth();
    const reportA = cases.find((entry) => entry.document_id === "report_a_clean")!;
    expect(reportA.expected_skills).toHaveLength(6);
    expect(reportA.expected_skills![0].inputs).toEqual(["a_rev24", "a_rev25"]);

    const reportB = cases.find((entry) => entry.document_id === "report_b_forecast")!;
    expect(reportB.expected_skills).toBeUndefined();
  });

  it("5b. rejects a skill referencing an unknown expected input", () => {
    const dangling = JSON.stringify({
      document_id: "report_w",
      scenario: "test",
      expected_inputs: [{ id: "w1", metric: "Revenue", unit: "USD_millions" }],
      expected_skills: [
        { skill_id: "skill_revenue_growth", state: "READY", inputs: ["w9"] },
      ],
    });
    expect(() => parseGroundTruth(dangling)).toThrow(/unknown expected input "w9"/);
  });

  it("6. handles optional expected_behavior", () => {
    const cases = loadGroundTruth();
    const reportB = cases.find((entry) => entry.document_id === "report_b_forecast")!;
    expect(reportB.expected_behavior).toEqual({
      historical_and_forward_values_must_remain_distinct: true,
      range_must_not_collapse_to_single_value: true,
      target_must_not_be_treated_as_actual: true,
    });

    const reportA = cases.find((entry) => entry.document_id === "report_a_clean")!;
    expect(reportA.expected_behavior).toBeUndefined();
  });

  it("7. handles optional resolution_examples", () => {
    const cases = loadGroundTruth();
    const reportC = cases.find((entry) => entry.document_id === "report_c_conflict")!;
    expect(reportC.resolution_examples).toHaveLength(2);
    expect(reportC.resolution_examples![0].selected_input).toBe("c_ebitda_adj");

    const reportD = cases.find((entry) => entry.document_id === "report_d_failure")!;
    expect(reportD.resolution_examples).toBeUndefined();
  });

  it("7b. rejects an empty dataset rather than reporting a vacuous pass", () => {
    expect(() => parseGroundTruth("\n\n")).toThrow(GroundTruthError);
  });
});
