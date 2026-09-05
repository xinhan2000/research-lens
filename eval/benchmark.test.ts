import { describe, expect, it } from "vitest";

import type { AiBenchmarkResponse } from "../lib/ai-benchmark-schema";

import {
  benchmarkTargets,
  parseBenchmarkAnswer,
  scoreBenchmark,
  summarizeBenchmark,
} from "./benchmark";
import { decideReleaseStatus, evaluateReport } from "./evaluate";
import { goldenCase, fixtureAnalysis, patchInput, reportBody, dropInput } from "./test-helpers";

/**
 * AX — AI-only benchmark.
 *
 * Two properties matter more than the numbers: a multi-value answer is a
 * manual-review diagnostic rather than a parsing failure, and nothing here can
 * move the trusted release status.
 */

function benchmarkOf(answers: Partial<Record<string, string | null>>): AiBenchmarkResponse {
  const ids = [
    "revenue_growth",
    "gross_margin",
    "ebitda_margin",
    "net_debt",
    "ev_revenue",
    "ev_ebitda",
  ] as const;
  return {
    items: ids.map((task_id) => ({
      task_id,
      answer: answers[task_id] ?? null,
      explanation: "test",
    })),
  };
}

describe("benchmark answer parsing", () => {
  it("69. a null answer is unanswered", () => {
    expect(parseBenchmarkAnswer("net_debt", null)).toEqual({ kind: "unanswered" });
    expect(parseBenchmarkAnswer("net_debt", "   ")).toEqual({ kind: "unanswered" });
  });

  it("70. one percentage is machine-scoreable and converted to a decimal", () => {
    const growth = parseBenchmarkAnswer("revenue_growth", "23.2%");
    expect(growth.kind).toBe("value");
    expect(growth.kind === "value" && growth.value).toBeCloseTo(0.232, 12);

    const margin = parseBenchmarkAnswer("gross_margin", "61.4 %");
    expect(margin.kind).toBe("value");
    expect(margin.kind === "value" && margin.value).toBeCloseTo(0.614, 12);
  });

  it("71. one multiple is machine-scoreable", () => {
    expect(parseBenchmarkAnswer("ev_revenue", "6.44x")).toEqual({
      kind: "value",
      value: 6.44,
    });
    expect(parseBenchmarkAnswer("ev_ebitda", "34.9×")).toEqual({
      kind: "value",
      value: 34.9,
    });
  });

  it("72. one monetary amount is machine-scoreable in USD millions", () => {
    expect(parseBenchmarkAnswer("net_debt", "$95M")).toEqual({
      kind: "value",
      value: 95,
    });
    expect(parseBenchmarkAnswer("net_debt", "$95.0 million")).toEqual({
      kind: "value",
      value: 95,
    });
    expect(parseBenchmarkAnswer("net_debt", "95,000 thousand")).toEqual({
      kind: "value",
      value: 95,
    });
  });

  it("72b. a monetary answer with no stated magnitude goes to manual review", () => {
    const parse = parseBenchmarkAnswer("net_debt", "$95");
    expect(parse.kind).toBe("manual_review");
  });

  it("72c. a wrong-form answer goes to manual review, not to a wrong score", () => {
    expect(parseBenchmarkAnswer("revenue_growth", "0.232").kind).toBe("manual_review");
    expect(parseBenchmarkAnswer("ev_ebitda", "34.9").kind).toBe("manual_review");
    expect(parseBenchmarkAnswer("net_debt", "cannot be determined").kind).toBe(
      "manual_review",
    );
  });

  it("73. two alternative values are manual review", () => {
    const parse = parseBenchmarkAnswer("ebitda_margin", "18.4% adjusted or 14.1% reported");
    expect(parse.kind).toBe("manual_review");
    expect(parse.kind === "manual_review" && parse.reason).toMatch(/2 distinct values/);
  });

  it("73b. the same value stated twice is still one answer", () => {
    expect(parseBenchmarkAnswer("net_debt", "$95M (that is, $95M)")).toEqual({
      kind: "value",
      value: 95,
    });
  });
});

describe("benchmark scoring", () => {
  it("derives targets only from READY expected skills with a stated result", () => {
    const targets = benchmarkTargets(goldenCase("report_a_clean").expected_skills);
    expect(targets.size).toBe(6);
    expect(targets.get("net_debt")).toBe(95);

    // Report C's expected skill is NEEDS_REVIEW: no safe single answer exists.
    expect(benchmarkTargets(goldenCase("report_c_conflict").expected_skills).size).toBe(0);
  });

  it("leaves a task unscored where Ground Truth provides no safe target", () => {
    const evaluation = evaluateReport({
      goldenCase: goldenCase("report_c_conflict"),
      analysis: fixtureAnalysis("report_c_conflict"),
      reportBody: reportBody("report_c_conflict"),
      source: "saved",
    });
    const scoring = scoreBenchmark({
      documentId: "report_c_conflict",
      benchmark: benchmarkOf({ ev_ebitda: "34.9x" }),
      skills: evaluation.skills,
      expectedSkills: goldenCase("report_c_conflict").expected_skills,
    });
    const evEbitda = scoring.taskScores.find((s) => s.taskId === "ev_ebitda")!;
    expect(evEbitda.outcome).toBe("unscored");
    // The direct model answered where the trusted path requires review.
    expect(
      scoring.diagnostics.find((d) => d.taskId === "ev_ebitda")!.category,
    ).toBe("answered_while_needs_review");
    expect(scoring.unsafeDirectAnswers).toBeGreaterThan(0);
  });

  it("classifies agreement, disagreement and refusal on the clean report", () => {
    const evaluation = evaluateReport({
      goldenCase: goldenCase("report_a_clean"),
      analysis: fixtureAnalysis("report_a_clean"),
      reportBody: reportBody("report_a_clean"),
      source: "saved",
    });
    const scoring = scoreBenchmark({
      documentId: "report_a_clean",
      benchmark: benchmarkOf({
        revenue_growth: "23.2%",
        gross_margin: "61.4%",
        ebitda_margin: "18.4%",
        net_debt: "$95 million",
        ev_revenue: "6.44x",
        ev_ebitda: "12.0x",
      }),
      skills: evaluation.skills,
      expectedSkills: goldenCase("report_a_clean").expected_skills,
    });

    const byTask = new Map(scoring.diagnostics.map((d) => [d.taskId, d.category]));
    expect(byTask.get("net_debt")).toBe("agreement_ready");
    expect(byTask.get("ev_ebitda")).toBe("different_numeric_answers");

    const summary = summarizeBenchmark([scoring]);
    expect(summary.answerCoverage).toEqual({ passed: 6, total: 6 });
    expect(summary.numericalCorrectness.passed).toBe(5);
    expect(summary.numericalCorrectness.total).toBe(6);
    expect(summary.disagreementCases).toBe(1);
  });

  it("74. a benchmark disagreement does not change Research Lens PASS/FAIL", () => {
    const evaluation = evaluateReport({
      goldenCase: goldenCase("report_a_clean"),
      analysis: fixtureAnalysis("report_a_clean"),
      reportBody: reportBody("report_a_clean"),
      source: "saved",
      benchmark: benchmarkOf({ net_debt: "$1M", ev_ebitda: "2.0x" }),
    });
    expect(evaluation.pass).toBe(true);
    expect(decideReleaseStatus([evaluation])).toBe("PASS");
  });

  it("75. benchmark success cannot erase a trusted hard blocker", () => {
    const unsafe = evaluateReport({
      goldenCase: goldenCase("report_c_conflict"),
      analysis: dropInput(
        patchInput(fixtureAnalysis("report_c_conflict"), "in_c2", {
          trust_state: "auto",
          conflict_state: "none",
          resolved: true,
        }),
        "in_c3",
      ),
      reportBody: reportBody("report_c_conflict"),
      source: "saved",
      benchmark: benchmarkOf({
        revenue_growth: "23.2%",
        gross_margin: "61.4%",
        ebitda_margin: "18.4%",
        net_debt: "$95 million",
        ev_revenue: "6.44x",
        ev_ebitda: "34.9x",
      }),
    });
    expect(unsafe.blockers.length).toBeGreaterThan(0);
    expect(unsafe.pass).toBe(false);
    expect(decideReleaseStatus([unsafe])).toBe("FAIL");
  });
});
