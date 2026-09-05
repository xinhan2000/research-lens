import { describe, expect, it } from "vitest";

import { runSkills } from "../lib/skills/engine";
import type { AnalysisResponse } from "../types/analytical-input";

import {
  aggregateTrustedMetrics,
  decideReleaseStatus,
  evaluateReport,
} from "./evaluate";
import { checkStructuralSafety, countConsequentialSkillCases } from "./safety";
import type { GoldenDocumentId } from "./report-map";
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
 * AU and AW — Report C safety, skill scoring, and unsafe auto-use.
 *
 * The hero case: two materially different EBITDA definitions must not be
 * silently resolved. Every test here breaks that property in a different way
 * and asserts the harness refuses to call the run a pass.
 */

function evaluate(documentId: GoldenDocumentId, analysis: AnalysisResponse) {
  return evaluateReport({
    goldenCase: goldenCase(documentId),
    analysis,
    reportBody: reportBody(documentId),
    source: "saved",
  });
}

describe("AU — Report C safety", () => {
  const base = () => fixtureAnalysis("report_c_conflict");

  it("44. EV / EBITDA NEEDS_REVIEW passes", () => {
    const evaluation = evaluate("report_c_conflict", base());
    const check = evaluation.skillChecks.find((c) => c.skillId === "skill_ev_ebitda")!;
    expect(check.actualState).toBe("NEEDS_REVIEW");
    expect(check.stateMatch).toBe(true);
    expect(evaluation.blockers).toHaveLength(0);
    expect(evaluation.pass).toBe(true);
  });

  it("45. READY under an unresolved expected conflict is a hard blocker", () => {
    // The model flattens the conflict: both candidates look safe and the
    // reported one is dropped, so the gate never fires.
    const analysis = dropInput(
      patchInput(base(), "in_c2", {
        trust_state: "auto",
        conflict_state: "none",
        resolved: true,
      }),
      "in_c3",
    );
    const evaluation = evaluate("report_c_conflict", analysis);

    const check = evaluation.skillChecks.find((c) => c.skillId === "skill_ev_ebitda")!;
    expect(check.actualState).toBe("READY");
    expect(check.stateMatch).toBe(false);
    expect(evaluation.blockers.some((b) => b.id === "BLOCK-3")).toBe(true);
    expect(evaluation.blockers.some((b) => b.id === "BLOCK-1")).toBe(true);
    expect(evaluation.pass).toBe(false);
    expect(decideReleaseStatus([evaluation])).toBe("FAIL");
  });

  it("46. both conflict candidates present passes", () => {
    const evaluation = evaluate("report_c_conflict", base());
    expect(evaluation.inputScores.every((s) => s.match.status === "matched")).toBe(true);
    const adjusted = evaluation.inputScores.find(
      (s) => s.expectedInputId === "c_ebitda_adj",
    )!;
    const reported = evaluation.inputScores.find(
      (s) => s.expectedInputId === "c_ebitda_reported",
    )!;
    expect(adjusted.actualInputId).not.toBe(reported.actualInputId);
  });

  it("47. a missing conflict candidate fails", () => {
    const evaluation = evaluate("report_c_conflict", dropInput(base(), "in_c3"));
    const reported = evaluation.inputScores.find(
      (s) => s.expectedInputId === "c_ebitda_reported",
    )!;
    expect(reported.match.status).toBe("missing");
    expect(evaluation.pass).toBe(false);
  });

  it("48. conflict trust ASK preserved passes", () => {
    const evaluation = evaluate("report_c_conflict", base());
    for (const id of ["c_ebitda_adj", "c_ebitda_reported"]) {
      const score = evaluation.inputScores.find((s) => s.expectedInputId === id)!;
      expect(score.fields.trust_state).toBe("pass");
      expect(score.fields.conflict_state).toBe("pass");
    }
  });

  it("49. AUTO on an unresolved material candidate fails the trust expectation", () => {
    const analysis = patchInput(base(), "in_c2", { trust_state: "auto" });
    const evaluation = evaluate("report_c_conflict", analysis);
    const score = evaluation.inputScores.find(
      (s) => s.expectedInputId === "c_ebitda_adj",
    )!;
    expect(score.fields.trust_state).toBe("fail");
    expect(evaluation.pass).toBe(false);
  });

  it("50. the adjusted resolution example replays to its expected result and label", () => {
    const evaluation = evaluate("report_c_conflict", base());
    const check = evaluation.resolutionChecks.find(
      (c) => c.selectedExpectedInputId === "c_ebitda_adj",
    )!;
    expect(check.status).toBe("pass");
    expect(check.selectedActualInputId).toBe("in_c2");
    expect(check.actualLabel).toBe("EV / FY2025 Adjusted EBITDA");
    expect(check.actualResult).toBeCloseTo(check.expectedResult, 8);
  });

  it("51. the reported resolution example replays to its expected result and label", () => {
    const evaluation = evaluate("report_c_conflict", base());
    const check = evaluation.resolutionChecks.find(
      (c) => c.selectedExpectedInputId === "c_ebitda_reported",
    )!;
    expect(check.status).toBe("pass");
    expect(check.selectedActualInputId).toBe("in_c3");
    expect(check.actualLabel).toBe("EV / FY2025 Reported EBITDA");
    expect(check.actualResult).toBeCloseTo(check.expectedResult, 8);
  });

  it("51b. a resolution example that cannot be mapped is reported, not skipped", () => {
    const evaluation = evaluate("report_c_conflict", dropInput(base(), "in_c3"));
    const check = evaluation.resolutionChecks.find(
      (c) => c.selectedExpectedInputId === "c_ebitda_reported",
    )!;
    expect(check.status).toBe("unresolvable");
    expect(evaluation.pass).toBe(false);
  });
});

describe("AW — skills and safety", () => {
  it("61. Report A READY skills match their expected results", () => {
    const evaluation = evaluate("report_a_clean", fixtureAnalysis("report_a_clean"));
    expect(evaluation.skillChecks).toHaveLength(6);
    for (const check of evaluation.skillChecks) {
      expect(check.stateMatch, check.skillId).toBe(true);
      expect(check.inputsMatch, check.skillId).toBe("pass");
      expect(check.resultMatch, check.skillId).toBe("pass");
    }
    expect(evaluation.blockers).toHaveLength(0);
  });

  it("62. a wrong READY result from correct inputs is a deterministic math blocker", () => {
    // The evaluator grades the product's own engine, so a math failure is
    // simulated by changing what Ground Truth expects the answer to be.
    const analysis = fixtureAnalysis("report_a_clean");
    const golden = goldenCase("report_a_clean");
    const evaluation = evaluateReport({
      goldenCase: {
        ...golden,
        expected_skills: golden.expected_skills!.map((skill) =>
          skill.skill_id === "skill_net_debt" ? { ...skill, result: 999 } : skill,
        ),
      },
      analysis,
      reportBody: reportBody("report_a_clean"),
      source: "saved",
    });
    const blocker = evaluation.blockers.find((b) => b.id === "BLOCK-7");
    expect(blocker).toBeDefined();
    expect(blocker!.detail).toMatch(/skill_net_debt/);
    expect(evaluation.pass).toBe(false);
  });

  it("62b. a wrong result from a wrongly interpreted input is not a math blocker", () => {
    // Total Debt misread as 135: the arithmetic is right, the input is not.
    const analysis = patchInput(fixtureAnalysis("report_a_clean"), "in_a6", {
      value: 135,
    });
    const evaluation = evaluate("report_a_clean", analysis);
    expect(evaluation.blockers.some((b) => b.id === "BLOCK-7")).toBe(false);
    expect(
      evaluation.skillChecks.find((c) => c.skillId === "skill_net_debt")!.resultMatch,
    ).toBe("fail");
    expect(evaluation.pass).toBe(false);
  });

  it("63. expected NEEDS_REVIEW but actual READY triggers unsafe auto-use", () => {
    const analysis = dropInput(
      patchInput(fixtureAnalysis("report_c_conflict"), "in_c2", {
        trust_state: "auto",
        conflict_state: "none",
        resolved: true,
      }),
      "in_c3",
    );
    const evaluation = evaluate("report_c_conflict", analysis);
    expect(evaluation.unsafeAutoUse.length).toBeGreaterThan(0);
    expect(
      evaluation.unsafeAutoUse.some((entry) =>
        entry.reason.includes("Ground Truth requires NEEDS_REVIEW"),
      ),
    ).toBe(true);
  });

  it("64. a READY skill consuming an unmatched consequential input is BLOCK-2", () => {
    // A fabricated Enterprise Value the golden set does not enumerate.
    const base = fixtureAnalysis("report_d_failure");
    const fabricated = cloneInput(base, "in_d4", {
      input_id: "in_d_ev",
      metric: "Enterprise Value",
      value: 500000,
      period: "report_date",
      source: {
        document_id: "failure",
        page: null,
        section: "Financial Summary",
        text: "| Total Debt | 125,000 | — |",
      },
    });
    const evaluation = evaluate("report_d_failure", addInput(base, fabricated));

    expect(evaluation.extraActualInputIds).toContain("in_d_ev");
    const blocker = evaluation.blockers.find((b) => b.id === "BLOCK-2");
    expect(blocker).toBeDefined();
    expect(blocker!.detail).toMatch(/in_d_ev/);
    expect(evaluation.pass).toBe(false);
  });

  it("65. a READY skill consuming a material-conflict input is unsafe auto-use", () => {
    // The model marks the conflict but the trust state lets it through.
    const analysis = dropInput(
      patchInput(fixtureAnalysis("report_c_conflict"), "in_c2", {
        trust_state: "auto",
        resolved: true,
      }),
      "in_c3",
    );
    const evaluation = evaluate("report_c_conflict", analysis);
    // The product's gate correctly refuses on material_conflict, so no input
    // reaches a calculation — which is the safe outcome, and it is what the
    // harness must observe rather than assume.
    const check = evaluation.skillChecks.find((c) => c.skillId === "skill_ev_ebitda")!;
    expect(check.actualState).toBe("NEEDS_REVIEW");

    // If the gate is bypassed by clearing the conflict too, it becomes unsafe.
    const flattened = patchInput(analysis, "in_c2", { conflict_state: "none" });
    const unsafeEvaluation = evaluate("report_c_conflict", flattened);
    expect(unsafeEvaluation.unsafeAutoUse.length).toBeGreaterThan(0);
    expect(
      unsafeEvaluation.unsafeAutoUse.some((entry) =>
        entry.reason.includes("material conflict"),
      ),
    ).toBe(true);
  });

  it("66. a non-READY skill carrying a value is a structural hard fail", () => {
    const skills = runSkills(fixtureAnalysis("report_c_conflict").inputs);
    expect(checkStructuralSafety("report_c_conflict", skills)).toHaveLength(0);

    // Synthetic violation of the READY-only value invariant.
    const violating = skills.map((skill) =>
      skill.skillId === "skill_ev_ebitda" ? { ...skill, value: 34.9 } : skill,
    );
    const blockers = checkStructuralSafety("report_c_conflict", violating);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].id).toBe("BLOCK-STRUCTURAL");
    expect(blockers[0].severity).toBe("SEV-4");
  });

  it("67. an unsafe-auto-use count forces a FAIL release status", () => {
    const clean = evaluate("report_a_clean", fixtureAnalysis("report_a_clean"));
    expect(decideReleaseStatus([clean])).toBe("PASS");

    const unsafe = evaluate(
      "report_c_conflict",
      dropInput(
        patchInput(fixtureAnalysis("report_c_conflict"), "in_c2", {
          trust_state: "auto",
          conflict_state: "none",
          resolved: true,
        }),
        "in_c3",
      ),
    );
    // Aggregate accuracy on the clean report cannot offset the unsafe one.
    const metrics = aggregateTrustedMetrics([clean, unsafe]);
    expect(metrics.unsafeAutoUseCount).toBeGreaterThan(0);
    expect(metrics.checkedConsequentialSkillCases).toBeGreaterThan(0);
    expect(metrics.unsafeAutoUseRate).toBeGreaterThan(0);
    expect(decideReleaseStatus([clean, unsafe])).toBe("FAIL");
  });

  it("67b. the unsafe-auto-use denominator counts READY skill/input pairs only", () => {
    const clean = evaluate("report_a_clean", fixtureAnalysis("report_a_clean"));
    const skills = runSkills(fixtureAnalysis("report_a_clean").inputs);
    const expected = skills
      .filter((skill) => skill.status === "READY")
      .reduce((total, skill) => total + skill.inputIds.length, 0);
    expect(clean.checkedConsequentialSkillCases).toBe(expected);
    expect(countConsequentialSkillCases(skills)).toBe(expected);

    // Report C's NEEDS_REVIEW skill contributes nothing to either side.
    const conflict = evaluate("report_c_conflict", fixtureAnalysis("report_c_conflict"));
    const conflictSkills = runSkills(fixtureAnalysis("report_c_conflict").inputs);
    expect(conflictSkills.some((skill) => skill.status === "NEEDS_REVIEW")).toBe(true);
    expect(conflict.checkedConsequentialSkillCases).toBe(
      countConsequentialSkillCases(conflictSkills),
    );
  });

  it("68. benchmark data is not an argument to the release decision", () => {
    // `decideReleaseStatus` takes reports only. There is no parameter through
    // which a benchmark result could reach it.
    expect(decideReleaseStatus.length).toBe(1);

    const clean = evaluate("report_a_clean", fixtureAnalysis("report_a_clean"));
    const withBenchmarkFailure = evaluateReport({
      goldenCase: goldenCase("report_a_clean"),
      analysis: fixtureAnalysis("report_a_clean"),
      reportBody: reportBody("report_a_clean"),
      source: "saved",
      benchmarkError: "Anthropic request failed with status 500.",
    });
    expect(withBenchmarkFailure.pass).toBe(clean.pass);
    expect(decideReleaseStatus([withBenchmarkFailure])).toBe("PASS");
  });
});
