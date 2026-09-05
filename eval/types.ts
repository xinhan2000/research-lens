import type { AnalysisResponse } from "../types/analytical-input";
import type { SkillResult } from "../lib/skills/types";
import type { AiBenchmarkResponse } from "../lib/ai-benchmark-schema";

import type { InputMatch } from "./matching";

/**
 * Result shapes for the eval harness.
 *
 * The structure is deliberately not a single accuracy number. Aggregate
 * accuracy is allowed to exist, but it may never be the only thing a reader
 * sees, because an aggregate can hide exactly the failures this product exists
 * to prevent (Eval_Dataset_Spec §18).
 */

/** Which release gate a difference bears on. */
export type GateRelevance = "hard_gate" | "critical" | "monitor" | "diagnostic";

/**
 * One field-level disagreement.
 *
 * Carries enough to debug and nothing more. The full AnalysisResponse is never
 * embedded in a difference record.
 */
export type Difference = {
  documentId: string;
  expectedInputId: string | null;
  actualInputId: string | null;
  field: string;
  expected: string | number | boolean | null;
  actual: string | number | boolean | null;
  gate: GateRelevance;
  message: string;
};

/** Blocker identifiers from Regression_Gates §6. */
export type BlockerId =
  | "BLOCK-1"
  | "BLOCK-2"
  | "BLOCK-3"
  | "BLOCK-4"
  | "BLOCK-5"
  | "BLOCK-7"
  | "BLOCK-STRUCTURAL";

export type HardBlocker = {
  id: BlockerId;
  documentId: string;
  title: string;
  detail: string;
  /** Failure taxonomy ids this instance corresponds to. */
  failureIds: string[];
  severity: "SEV-3" | "SEV-4";
};

/** Per-expected-input scoring outcome. */
export type InputScore = {
  expectedInputId: string;
  actualInputId: string | null;
  match: InputMatch;
  /** Field name -> outcome. `null` means the dataset did not assert it. */
  fields: Record<string, FieldOutcome | null>;
};

export type FieldOutcome = "pass" | "fail" | "manual_review";

/** Behaviour predicate result, keyed by the Ground Truth behaviour name. */
export type BehaviorCheck = {
  name: string;
  status: "pass" | "fail" | "unimplemented";
  detail: string;
};

/** Expected-skill scoring outcome. */
export type SkillCheck = {
  skillId: string;
  expectedState: string;
  actualState: string | null;
  stateMatch: boolean;
  /** Consumed inputs matched the expected (mapped) input ids. */
  inputsMatch: FieldOutcome | null;
  resultMatch: FieldOutcome | null;
  expectedResult: number | null;
  actualResult: number | null;
  detail: string;
};

/** Report C resolution-example outcome. */
export type ResolutionCheck = {
  selectedExpectedInputId: string;
  selectedActualInputId: string | null;
  expectedResult: number;
  actualResult: number | null;
  expectedLabel: string;
  actualLabel: string | null;
  status: "pass" | "fail" | "unresolvable";
  detail: string;
};

export type UnsafeAutoUseCase = {
  documentId: string;
  skillId: string;
  actualInputId: string | null;
  reason: string;
};

export type ReportEvaluation = {
  documentId: string;
  displayName: string;
  scenario: string;
  /** Where the AnalysisResponse came from. */
  source: "live" | "saved";
  analysis: AnalysisResponse;
  skills: SkillResult[];
  inputScores: InputScore[];
  extraActualInputIds: string[];
  differences: Difference[];
  behaviorChecks: BehaviorCheck[];
  skillChecks: SkillCheck[];
  resolutionChecks: ResolutionCheck[];
  unsafeAutoUse: UnsafeAutoUseCase[];
  /** Consequential skill cases inspected — the unsafe-auto-use denominator. */
  checkedConsequentialSkillCases: number;
  blockers: HardBlocker[];
  benchmark: AiBenchmarkResponse | null;
  benchmarkError: string | null;
  pass: boolean;
};

/** Aggregate trusted metrics. Every one is a ratio with a stated denominator. */
export type Ratio = {
  passed: number;
  total: number;
  manualReview?: number;
};

export type TrustedMetrics = {
  expectedInputMatchCoverage: Ratio;
  metricIdentityAccuracy: Ratio;
  economicValueAccuracy: Ratio;
  rangeAccuracy: Ratio;
  unitAccuracy: Ratio;
  currencyAccuracy: Ratio;
  periodAccuracy: Ratio;
  temporalTypeAccuracy: Ratio;
  basisAccuracy: Ratio;
  precisionAccuracy: Ratio;
  evidenceValidity: Ratio;
  groundTruthEvidenceAgreement: Ratio;
  trustDecisionAccuracy: Ratio;
  conflictDetectionChecks: Ratio;
  skillGateAccuracy: Ratio;
  deterministicResultAccuracy: Ratio;
  behaviorChecks: Ratio;
  resolutionChecks: Ratio;
  unsafeAutoUseCount: number;
  checkedConsequentialSkillCases: number;
  /** unsafeAutoUseCount / checkedConsequentialSkillCases, or null when 0/0. */
  unsafeAutoUseRate: number | null;
  unsupportedConsequentialInputCount: number;
  extraActualInputCount: number;
};

export type ReleaseStatus = "PASS" | "FAIL";

export type EvalRun = {
  schemaVersion: number;
  runAt: string;
  mode: "live" | "saved";
  model: string;
  benchmarkEnabled: boolean;
  datasetNote: string;
  reports: ReportEvaluation[];
  trustedMetrics: TrustedMetrics;
  hardBlockers: HardBlocker[];
  releaseStatus: ReleaseStatus;
  benchmark: BenchmarkSummary | null;
  comparativeDiagnostics: ComparativeDiagnostic[];
  benchmarkInfrastructureFailures: string[];
};

/* ------------------------------------------------------------------ *
 * Benchmark
 * ------------------------------------------------------------------ */

export type BenchmarkParse =
  | { kind: "unanswered" }
  | { kind: "manual_review"; reason: string }
  | { kind: "value"; value: number };

export type BenchmarkTaskScore = {
  documentId: string;
  taskId: string;
  answer: string | null;
  parse: BenchmarkParse;
  /** Authoritative target derived from Ground Truth, when one exists safely. */
  target: number | null;
  outcome: "correct" | "incorrect" | "manual_review" | "unanswered" | "unscored";
};

export type BenchmarkSummary = {
  answerCoverage: Ratio;
  numericalCorrectness: Ratio;
  manualReviewCases: number;
  unsafeDirectAnswerCases: number;
  disagreementCases: number;
  taskScores: BenchmarkTaskScore[];
};

export type ComparativeDiagnostic = {
  documentId: string;
  taskId: string;
  skillId: string;
  /** SL-C1 .. SL-C6 style classification, or a plain descriptor. */
  category:
    | "agreement_ready"
    | "answered_while_needs_review"
    | "answered_while_blocked"
    | "declined_while_ready"
    | "different_numeric_answers"
    | "multi_answer_ambiguity"
    | "no_disagreement";
  detail: string;
};
