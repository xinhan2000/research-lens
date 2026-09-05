import { describe, expect, it } from "vitest";

import { IMPLEMENTED_BEHAVIORS } from "./behaviors";
import { evaluateReport } from "./evaluate";
import { loadGroundTruth } from "./ground-truth";
import type { GoldenDocumentId } from "./report-map";
import type { AnalysisResponse } from "../types/analytical-input";
import {
  addInput,
  cloneInput,
  fixtureAnalysis,
  goldenCase,
  patchInput,
  reportBody,
} from "./test-helpers";

/**
 * AT and AV — Report B and Report D behaviour predicates.
 *
 * Every predicate is tested in both directions: the correct interpretation
 * passes, and the specific failure the behaviour flag exists to catch fails.
 * A predicate that only ever passes is not a check.
 */

function behaviors(documentId: GoldenDocumentId, analysis: AnalysisResponse) {
  return evaluateReport({
    goldenCase: goldenCase(documentId),
    analysis,
    reportBody: reportBody(documentId),
    source: "saved",
  }).behaviorChecks;
}

function statusOf(
  documentId: GoldenDocumentId,
  analysis: AnalysisResponse,
  name: string,
) {
  return behaviors(documentId, analysis).find((check) => check.name === name)?.status;
}

describe("behaviour coverage", () => {
  it("covers every behaviour name the dataset asserts", () => {
    const asserted = new Set<string>();
    for (const entry of loadGroundTruth()) {
      for (const name of Object.keys(entry.expected_behavior ?? {})) {
        asserted.add(name);
      }
    }
    for (const name of asserted) {
      expect(IMPLEMENTED_BEHAVIORS, `missing predicate: ${name}`).toContain(name);
    }
  });

  it("reports an unknown behaviour name as unimplemented, never as a pass", () => {
    const checks = evaluateReport({
      goldenCase: {
        ...goldenCase("report_b_forecast"),
        expected_behavior: { some_future_behaviour: true },
      },
      analysis: fixtureAnalysis("report_b_forecast"),
      reportBody: reportBody("report_b_forecast"),
      source: "saved",
    }).behaviorChecks;
    expect(checks[0].status).toBe("unimplemented");
  });
});

describe("AT — Report B behaviours", () => {
  const base = () => fixtureAnalysis("report_b_forecast");
  const NAME_DISTINCT = "historical_and_forward_values_must_remain_distinct";
  const NAME_RANGE = "range_must_not_collapse_to_single_value";
  const NAME_TARGET = "target_must_not_be_treated_as_actual";

  it("38. historical/forecast separation passes", () => {
    expect(statusOf("report_b_forecast", base(), NAME_DISTINCT)).toBe("pass");
  });

  it("39. a forecast collapsed into an actual fails", () => {
    const analysis = patchInput(base(), "in_b3", { temporal_type: "actual" });
    expect(statusOf("report_b_forecast", analysis, NAME_DISTINCT)).toBe("fail");
  });

  it("40. a preserved range passes", () => {
    expect(statusOf("report_b_forecast", base(), NAME_RANGE)).toBe("pass");
  });

  it("41. a range collapsed to a scalar fails", () => {
    const analysis = patchInput(base(), "in_b4", {
      value: 25,
      range: null,
      precision: "approximate",
    });
    expect(statusOf("report_b_forecast", analysis, NAME_RANGE)).toBe("fail");
  });

  it("41b. a range that keeps its bounds but also carries a midpoint fails", () => {
    const analysis = patchInput(base(), "in_b4", { value: 25 });
    expect(statusOf("report_b_forecast", analysis, NAME_RANGE)).toBe("fail");
  });

  it("42. a preserved target passes", () => {
    expect(statusOf("report_b_forecast", base(), NAME_TARGET)).toBe("pass");
  });

  it("43. a target treated as actual fails", () => {
    const analysis = patchInput(base(), "in_b5", { temporal_type: "actual" });
    expect(statusOf("report_b_forecast", analysis, NAME_TARGET)).toBe("fail");
  });
});

describe("AV — Report D behaviours", () => {
  const base = () => fixtureAnalysis("report_d_failure");
  const NAME_UNIT = "table_header_unit_must_apply";
  const NAME_QUARTER = "q4_must_not_be_treated_as_fy2025";
  const NAME_FOOTNOTE = "footnote_must_preserve_adjusted_basis";
  const NAME_TARGET = "internal_target_must_not_be_treated_as_formal_forecast";
  const NAME_QUALITATIVE = "qualitative_margin_statement_must_not_create_numeric_input";

  it("52. thousand-scale semantics pass", () => {
    expect(statusOf("report_d_failure", base(), NAME_UNIT)).toBe("pass");
  });

  it("52b. a correctly rescaled value with a different label still passes", () => {
    const analysis = patchInput(base(), "in_d1", {
      value: 101,
      unit: "USD_millions",
    });
    expect(statusOf("report_d_failure", analysis, NAME_UNIT)).toBe("pass");
  });

  it("53. a thousand/million catastrophe fails", () => {
    const analysis = patchInput(base(), "in_d1", {
      value: 101000,
      unit: "USD_millions",
    });
    expect(statusOf("report_d_failure", analysis, NAME_UNIT)).toBe("fail");

    const evaluation = evaluateReport({
      goldenCase: goldenCase("report_d_failure"),
      analysis,
      reportBody: reportBody("report_d_failure"),
      source: "saved",
    });
    expect(evaluation.blockers.some((b) => b.id === "BLOCK-4")).toBe(true);
  });

  it("54. distinct FY and Q4 interpretations pass", () => {
    expect(statusOf("report_d_failure", base(), NAME_QUARTER)).toBe("pass");
  });

  it("55. collapsing Q4 into the fiscal year fails", () => {
    const analysis = patchInput(base(), "in_d2", { period: "FY2025" });
    expect(statusOf("report_d_failure", analysis, NAME_QUARTER)).toBe("fail");
  });

  it("56. a preserved adjusted basis passes", () => {
    expect(statusOf("report_d_failure", base(), NAME_FOOTNOTE)).toBe("pass");
  });

  it("56b. losing the footnote's adjusted basis fails", () => {
    const analysis = patchInput(base(), "in_d3", { basis: "reported" });
    expect(statusOf("report_d_failure", analysis, NAME_FOOTNOTE)).toBe("fail");
  });

  it("57. a preserved internal target passes", () => {
    expect(statusOf("report_d_failure", base(), NAME_TARGET)).toBe("pass");
  });

  it("58. an internal target promoted to a forecast fails", () => {
    const analysis = patchInput(base(), "in_d6", { temporal_type: "forecast" });
    expect(statusOf("report_d_failure", analysis, NAME_TARGET)).toBe("fail");
    // Also fails when promoted to guidance, which asserts the same formality.
    const guidance = patchInput(base(), "in_d6", { temporal_type: "guidance" });
    expect(statusOf("report_d_failure", guidance, NAME_TARGET)).toBe("fail");
  });

  it("59. no numeric input from the qualitative margin statement passes", () => {
    expect(statusOf("report_d_failure", base(), NAME_QUALITATIVE)).toBe("pass");
  });

  it("60. a fabricated numeric margin input fails", () => {
    const analysis = addInput(
      base(),
      cloneInput(base(), "in_d3", {
        input_id: "in_d_fabricated",
        metric: "EBITDA Margin",
        value: 18,
        unit: "percent",
        currency: null,
        period: "FY2026",
        temporal_type: "forecast",
        basis: "management_defined",
        precision: "approximate",
        source: {
          document_id: "failure",
          page: null,
          section: "Management Commentary",
          text: "Management also said margins should **improve meaningfully** as the enterprise business scales.",
        },
      }),
    );
    expect(statusOf("report_d_failure", analysis, NAME_QUALITATIVE)).toBe("fail");
  });
});
