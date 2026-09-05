import type { AnalysisResponse } from "../types/analytical-input";
import type { AiBenchmarkResponse } from "../lib/ai-benchmark-schema";
import { runSkills } from "../lib/skills/engine";

import { runBehaviorChecks } from "./behaviors";
import type { GroundTruthCase } from "./ground-truth";
import { matchInputs } from "./matching";
import { extractEvidenceBlocks } from "./report-blocks";
import { displayNameForGoldenId, type GoldenDocumentId } from "./report-map";
import {
  checkStructuralSafety,
  countConsequentialSkillCases,
  detectUnitCatastrophe,
  detectUnsafeAutoUse,
  evaluateResolutionExamples,
  scoreExpectedSkills,
} from "./safety";
import { scoreInputs } from "./scoring";
import type {
  Difference,
  FieldOutcome,
  HardBlocker,
  Ratio,
  ReleaseStatus,
  ReportEvaluation,
  TrustedMetrics,
} from "./types";

/**
 * Per-report evaluation and run-level aggregation.
 *
 * Pure: no file reads, no network, no process exit. Everything it needs is
 * passed in, which is what makes the whole scoring path testable without an API
 * key and without a saved run.
 *
 * Ground Truth arrives here and nowhere earlier. Inference has already
 * completed by the time this function is called.
 */

export function evaluateReport(params: {
  goldenCase: GroundTruthCase;
  analysis: AnalysisResponse;
  /** Markdown body of the report, used for evidence-block extraction. */
  reportBody: string;
  source: "live" | "saved";
  benchmark?: AiBenchmarkResponse | null;
  benchmarkError?: string | null;
}): ReportEvaluation {
  const { goldenCase, analysis, reportBody, source } = params;
  const documentId = goldenCase.document_id;

  const blocks = extractEvidenceBlocks(reportBody);
  const matchResult = matchInputs(goldenCase.expected_inputs, analysis.inputs);

  // The product's own engine, with no analyst resolution. This is the
  // pre-resolution trusted state the golden set describes.
  const skills = runSkills(analysis.inputs);

  const { inputScores, differences, magnitudeCatastropheInputIds } = scoreInputs({
    documentId,
    expectedInputs: goldenCase.expected_inputs,
    actualInputs: analysis.inputs,
    matchResult,
    blocks,
  });

  const valueCorrectByActualId = new Map<string, boolean>();
  for (const score of inputScores) {
    if (score.actualInputId === null) continue;
    valueCorrectByActualId.set(
      score.actualInputId,
      score.fields.economic_value !== "fail",
    );
  }

  const skillScoring = scoreExpectedSkills({
    documentId,
    expectedSkills: goldenCase.expected_skills ?? [],
    expectedInputs: goldenCase.expected_inputs,
    skills,
    matchResult,
    inputValueCorrect: (actualInputId) =>
      valueCorrectByActualId.get(actualInputId) ?? false,
  });

  const unsafe = detectUnsafeAutoUse({
    documentId,
    skills,
    actualInputs: analysis.inputs,
    expectedInputs: goldenCase.expected_inputs,
    matchResult,
    skillChecks: skillScoring.checks,
  });

  const behaviorChecks = runBehaviorChecks(goldenCase.expected_behavior, {
    expectedInputs: goldenCase.expected_inputs,
    actualInputs: analysis.inputs,
    matchResult,
    blocks,
  });

  const resolutionChecks = evaluateResolutionExamples({
    examples: goldenCase.resolution_examples ?? [],
    actualInputs: analysis.inputs,
    matchResult,
  });

  const blockers: HardBlocker[] = [
    ...checkStructuralSafety(documentId, skills),
    ...skillScoring.blockers,
    ...unsafe.blockers,
    ...detectUnitCatastrophe({
      documentId,
      magnitudeCatastropheInputIds,
      skills,
    }),
  ];

  const blockingDifferences = differences.filter(
    (entry) => entry.gate === "hard_gate" || entry.gate === "critical",
  );

  const pass =
    blockers.length === 0 &&
    blockingDifferences.length === 0 &&
    inputScores.every((score) => score.match.status === "matched") &&
    behaviorChecks.every((check) => check.status === "pass") &&
    skillScoring.checks.every(
      (check) =>
        check.stateMatch &&
        check.inputsMatch !== "fail" &&
        check.resultMatch !== "fail",
    ) &&
    resolutionChecks.every((check) => check.status === "pass");

  return {
    documentId,
    displayName: displayNameForGoldenId(documentId as GoldenDocumentId),
    scenario: goldenCase.scenario,
    source,
    analysis,
    skills,
    inputScores,
    extraActualInputIds: matchResult.extraActualInputIds,
    differences,
    behaviorChecks,
    skillChecks: skillScoring.checks,
    resolutionChecks,
    unsafeAutoUse: unsafe.cases,
    checkedConsequentialSkillCases: countConsequentialSkillCases(skills),
    blockers,
    benchmark: params.benchmark ?? null,
    benchmarkError: params.benchmarkError ?? null,
    pass,
  };
}

/* ------------------------------------------------------------------ *
 * Aggregation
 * ------------------------------------------------------------------ */

function ratioOf(
  reports: readonly ReportEvaluation[],
  field: string,
): Ratio {
  let passed = 0;
  let total = 0;
  let manualReview = 0;
  for (const report of reports) {
    for (const score of report.inputScores) {
      const outcome: FieldOutcome | null = score.fields[field] ?? null;
      if (outcome === null) continue;
      if (outcome === "manual_review") {
        manualReview += 1;
        continue;
      }
      total += 1;
      if (outcome === "pass") passed += 1;
    }
  }
  return manualReview > 0 ? { passed, total, manualReview } : { passed, total };
}

export function aggregateTrustedMetrics(
  reports: readonly ReportEvaluation[],
): TrustedMetrics {
  const allInputScores = reports.flatMap((report) => report.inputScores);
  const allSkillChecks = reports.flatMap((report) => report.skillChecks);
  const allBehaviorChecks = reports.flatMap((report) => report.behaviorChecks);
  const allResolutionChecks = reports.flatMap((report) => report.resolutionChecks);

  const unsafeAutoUseCount = reports.reduce(
    (total, report) => total + report.unsafeAutoUse.length,
    0,
  );
  const checkedConsequentialSkillCases = reports.reduce(
    (total, report) => total + report.checkedConsequentialSkillCases,
    0,
  );

  const unsupportedConsequentialInputCount = reports.reduce(
    (total, report) =>
      total + report.blockers.filter((blocker) => blocker.id === "BLOCK-2").length,
    0,
  );

  return {
    expectedInputMatchCoverage: {
      passed: allInputScores.filter((score) => score.match.status === "matched").length,
      total: allInputScores.length,
    },
    metricIdentityAccuracy: ratioOf(reports, "metric"),
    economicValueAccuracy: ratioOf(reports, "economic_value"),
    rangeAccuracy: ratioOf(reports, "range"),
    unitAccuracy: ratioOf(reports, "unit"),
    currencyAccuracy: ratioOf(reports, "currency"),
    periodAccuracy: ratioOf(reports, "period"),
    temporalTypeAccuracy: ratioOf(reports, "temporal_type"),
    basisAccuracy: ratioOf(reports, "basis"),
    precisionAccuracy: ratioOf(reports, "precision"),
    evidenceValidity: ratioOf(reports, "evidence_validity"),
    groundTruthEvidenceAgreement: ratioOf(reports, "evidence_agreement"),
    trustDecisionAccuracy: ratioOf(reports, "trust_state"),
    conflictDetectionChecks: ratioOf(reports, "conflict_state"),
    skillGateAccuracy: {
      passed: allSkillChecks.filter((check) => check.stateMatch).length,
      total: allSkillChecks.length,
    },
    deterministicResultAccuracy: {
      passed: allSkillChecks.filter((check) => check.resultMatch === "pass").length,
      total: allSkillChecks.filter((check) => check.resultMatch !== null).length,
    },
    behaviorChecks: {
      passed: allBehaviorChecks.filter((check) => check.status === "pass").length,
      total: allBehaviorChecks.length,
    },
    resolutionChecks: {
      passed: allResolutionChecks.filter((check) => check.status === "pass").length,
      total: allResolutionChecks.length,
    },
    unsafeAutoUseCount,
    checkedConsequentialSkillCases,
    unsafeAutoUseRate:
      checkedConsequentialSkillCases === 0
        ? null
        : unsafeAutoUseCount / checkedConsequentialSkillCases,
    unsupportedConsequentialInputCount,
    extraActualInputCount: reports.reduce(
      (total, report) => total + report.extraActualInputIds.length,
      0,
    ),
  };
}

export function collectHardBlockers(
  reports: readonly ReportEvaluation[],
): HardBlocker[] {
  return reports.flatMap((report) => report.blockers);
}

export function collectDifferences(
  reports: readonly ReportEvaluation[],
): Difference[] {
  return reports.flatMap((report) => report.differences);
}

/**
 * Release decision for the trusted Research Lens path.
 *
 * FAIL if any hard blocker occurred or any required golden-set assertion
 * failed. Aggregate accuracy cannot override a blocker, and the AI-only
 * benchmark is not an input to this function at all — it is not in the
 * signature, so it cannot become one by accident.
 */
export function decideReleaseStatus(
  reports: readonly ReportEvaluation[],
): ReleaseStatus {
  if (reports.length === 0) return "FAIL";
  if (collectHardBlockers(reports).length > 0) return "FAIL";
  return reports.every((report) => report.pass) ? "PASS" : "FAIL";
}
