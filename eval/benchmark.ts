import type { SkillResult } from "../lib/skills/types";
import {
  AI_BENCHMARK_TASK_IDS,
  type AiBenchmarkResponse,
  type AiBenchmarkTaskId,
} from "../lib/ai-benchmark-schema";
import { BENCHMARK_TASK_TO_SKILL_ID } from "../lib/benchmark-skill-map";

import type { ExpectedSkill } from "./ground-truth";
import type {
  BenchmarkParse,
  BenchmarkTaskScore,
  ComparativeDiagnostic,
  Ratio,
} from "./types";

/**
 * AI-only benchmark scoring and comparative diagnostics.
 *
 * Three rules govern everything here:
 *
 * 1. The benchmark is a CONTROL, never an oracle. Nothing in this file can
 *    change `releaseStatus`. The trusted metrics are computed without reference
 *    to it, and a benchmark infrastructure failure is recorded as exactly that.
 * 2. Scoring is conservative. A multi-value answer such as "18.4% adjusted or
 *    14.1% reported" is a MANUAL-REVIEW diagnostic, not a parsing failure and
 *    not a wrong answer — it may well be the better response.
 * 3. No model scores another model, and no fuzzy NLP is used.
 */

/* ------------------------------------------------------------------ *
 * Conservative numeric parsing
 * ------------------------------------------------------------------ */

/** Answer shape each task must take to be machine-scoreable. */
const TASK_FORM: Record<AiBenchmarkTaskId, "percent" | "multiple" | "monetary"> = {
  revenue_growth: "percent",
  gross_margin: "percent",
  ebitda_margin: "percent",
  net_debt: "monetary",
  ev_revenue: "multiple",
  ev_ebitda: "multiple",
};

/** Magnitude suffixes, expressed as multipliers into USD millions. */
const MONETARY_SCALE: Record<string, number> = {
  k: 1e-3,
  thousand: 1e-3,
  thousands: 1e-3,
  m: 1,
  mm: 1,
  million: 1,
  millions: 1,
  b: 1e3,
  bn: 1e3,
  billion: 1e3,
  billions: 1e3,
};

const TOKEN =
  /(\$)?\s*(-?\d[\d,]*(?:\.\d+)?)\s*(%|x|×|mm|bn|[kmb]|thousands?|millions?|billions?)?/gi;

type Token = { hasDollar: boolean; value: number; suffix: string | null };

function tokenize(answer: string): Token[] {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(answer)) !== null) {
    const value = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    tokens.push({
      hasDollar: match[1] === "$",
      value,
      suffix: match[3] ? match[3].toLowerCase() : null,
    });
  }
  return tokens;
}

/**
 * Parses one benchmark answer for one task.
 *
 * Machine-scored ONLY when the answer expresses exactly one unambiguous
 * numeric value in the form the task requires. Everything else is
 * `manual_review` or `unanswered`. In particular a bare `$95` for a monetary
 * task is manual review: the report states thousands and millions in different
 * places, and inferring the scale is precisely the failure this product exists
 * to prevent.
 */
export function parseBenchmarkAnswer(
  taskId: AiBenchmarkTaskId,
  answer: string | null,
): BenchmarkParse {
  if (answer === null) return { kind: "unanswered" };
  if (answer.trim() === "") return { kind: "unanswered" };

  const tokens = tokenize(answer);
  if (tokens.length === 0) {
    return { kind: "manual_review", reason: "no numeric value in the answer" };
  }

  const distinct = new Set(tokens.map((token) => token.value));
  if (distinct.size > 1) {
    return {
      kind: "manual_review",
      reason: `answer states ${distinct.size} distinct values`,
    };
  }

  const token = tokens[0];
  const form = TASK_FORM[taskId];

  if (form === "percent") {
    if (token.suffix !== "%") {
      return { kind: "manual_review", reason: "percentage task without a % form" };
    }
    return { kind: "value", value: token.value / 100 };
  }

  if (form === "multiple") {
    if (token.suffix !== "x" && token.suffix !== "×") {
      return { kind: "manual_review", reason: "multiple task without an x form" };
    }
    return { kind: "value", value: token.value };
  }

  // Monetary: a scale must be stated, never inferred.
  const scale = token.suffix ? MONETARY_SCALE[token.suffix] : undefined;
  if (scale === undefined) {
    return {
      kind: "manual_review",
      reason: token.hasDollar
        ? "monetary answer states no magnitude"
        : "monetary task without a monetary form",
    };
  }
  return { kind: "value", value: token.value * scale };
}

/* ------------------------------------------------------------------ *
 * Targets and scoring
 * ------------------------------------------------------------------ */

/**
 * Rounding tolerance for benchmark answers only.
 *
 * The benchmark answers in prose ("23.2%"), so it is graded against a
 * presentation tolerance rather than the 1e-9 used for deterministic skill
 * results. The two tolerances are deliberately different numbers for
 * deliberately different purposes.
 */
export const BENCHMARK_TOLERANCE = 0.01;

export function benchmarkAnswerMatches(actual: number, target: number): boolean {
  return Math.abs(actual - target) <= BENCHMARK_TOLERANCE * Math.max(1e-9, Math.abs(target));
}

const SKILL_TO_TASK = new Map<string, AiBenchmarkTaskId>(
  AI_BENCHMARK_TASK_IDS.map((taskId) => [BENCHMARK_TASK_TO_SKILL_ID[taskId], taskId]),
);

/**
 * Authoritative benchmark targets derived from Ground Truth.
 *
 * ONLY expected skills that are READY with a stated result yield a target —
 * Report A's six, in the current dataset. Where Ground Truth deliberately does
 * not provide a single safe answer (Report C's EV / EBITDA, for instance), the
 * task is left unscored rather than given an invented target.
 */
export function benchmarkTargets(
  expectedSkills: readonly ExpectedSkill[] | undefined,
): Map<AiBenchmarkTaskId, number> {
  const targets = new Map<AiBenchmarkTaskId, number>();
  for (const skill of expectedSkills ?? []) {
    if (skill.state !== "READY" || skill.result === undefined) continue;
    const taskId = SKILL_TO_TASK.get(skill.skill_id);
    if (taskId) targets.set(taskId, skill.result);
  }
  return targets;
}

export type BenchmarkReportScoring = {
  taskScores: BenchmarkTaskScore[];
  diagnostics: ComparativeDiagnostic[];
  unsafeDirectAnswers: number;
};

export function scoreBenchmark(params: {
  documentId: string;
  benchmark: AiBenchmarkResponse;
  skills: readonly SkillResult[];
  expectedSkills: readonly ExpectedSkill[] | undefined;
}): BenchmarkReportScoring {
  const { documentId, benchmark, skills, expectedSkills } = params;
  const targets = benchmarkTargets(expectedSkills);
  const expectedStateBySkillId = new Map(
    (expectedSkills ?? []).map((skill) => [skill.skill_id, skill.state]),
  );

  const taskScores: BenchmarkTaskScore[] = [];
  const diagnostics: ComparativeDiagnostic[] = [];
  let unsafeDirectAnswers = 0;

  for (const item of benchmark.items) {
    const taskId = item.task_id;
    const skillId = BENCHMARK_TASK_TO_SKILL_ID[taskId];
    const skill = skills.find((entry) => entry.skillId === skillId) ?? null;
    const parse = parseBenchmarkAnswer(taskId, item.answer);
    const target = targets.get(taskId) ?? null;

    let outcome: BenchmarkTaskScore["outcome"];
    if (parse.kind === "unanswered") {
      outcome = "unanswered";
    } else if (parse.kind === "manual_review") {
      outcome = "manual_review";
    } else if (target === null) {
      outcome = "unscored";
    } else {
      outcome = benchmarkAnswerMatches(parse.value, target) ? "correct" : "incorrect";
    }

    taskScores.push({ documentId, taskId, answer: item.answer, parse, target, outcome });

    /* --- comparative diagnostics --- */
    const expectedState = expectedStateBySkillId.get(skillId);
    const answeredNumerically = parse.kind === "value";

    if (
      answeredNumerically &&
      (expectedState === "NEEDS_REVIEW" || expectedState === "BLOCKED")
    ) {
      unsafeDirectAnswers += 1;
    } else if (outcome === "incorrect") {
      unsafeDirectAnswers += 1;
    }

    let category: ComparativeDiagnostic["category"];
    let detail: string;

    if (parse.kind === "manual_review") {
      category = "multi_answer_ambiguity";
      detail = `Benchmark answer is not a single unambiguous value (${parse.reason}); trusted skill is ${skill?.status ?? "absent"}.`;
    } else if (parse.kind === "unanswered") {
      if (skill?.status === "READY") {
        category = "declined_while_ready";
        detail = `Benchmark declined; trusted skill produced ${skill.value} (${skill.label}).`;
      } else {
        category = "no_disagreement";
        detail = `Benchmark declined; trusted skill is ${skill?.status ?? "absent"}.`;
      }
    } else if (skill?.status === "NEEDS_REVIEW") {
      category = "answered_while_needs_review";
      detail = `Benchmark answered ${item.answer}; trusted skill requires analyst review. Did the model silently resolve a material ambiguity?`;
    } else if (skill?.status === "BLOCKED") {
      category = "answered_while_blocked";
      detail = `Benchmark answered ${item.answer}; trusted skill found a required input missing or unsupported.`;
    } else if (skill?.status === "READY" && skill.value !== undefined) {
      const same = benchmarkAnswerMatches(parse.value, skill.value);
      category = same ? "agreement_ready" : "different_numeric_answers";
      detail = same
        ? `Both produced ${skill.value}. Same answer does not mean same guarantee.`
        : `Benchmark ${parse.value} vs trusted ${skill.value} (${skill.label}).`;
    } else {
      category = "no_disagreement";
      detail = `Benchmark answered ${item.answer}; no paired trusted skill result.`;
    }

    diagnostics.push({ documentId, taskId, skillId, category, detail });
  }

  return { taskScores, diagnostics, unsafeDirectAnswers };
}

/** Aggregates per-report benchmark scoring into run-level ratios. */
export function summarizeBenchmark(
  reportScorings: readonly BenchmarkReportScoring[],
): {
  answerCoverage: Ratio;
  numericalCorrectness: Ratio;
  manualReviewCases: number;
  unsafeDirectAnswerCases: number;
  disagreementCases: number;
  taskScores: BenchmarkTaskScore[];
} {
  const taskScores = reportScorings.flatMap((scoring) => scoring.taskScores);
  const diagnostics = reportScorings.flatMap((scoring) => scoring.diagnostics);

  const answered = taskScores.filter((score) => score.outcome !== "unanswered");
  const scoreable = taskScores.filter(
    (score) => score.outcome === "correct" || score.outcome === "incorrect",
  );

  return {
    answerCoverage: { passed: answered.length, total: taskScores.length },
    numericalCorrectness: {
      passed: scoreable.filter((score) => score.outcome === "correct").length,
      total: scoreable.length,
      manualReview: taskScores.filter((score) => score.outcome === "manual_review").length,
    },
    manualReviewCases: taskScores.filter((score) => score.outcome === "manual_review")
      .length,
    unsafeDirectAnswerCases: reportScorings.reduce(
      (total, scoring) => total + scoring.unsafeDirectAnswers,
      0,
    ),
    disagreementCases: diagnostics.filter(
      (diagnostic) =>
        diagnostic.category === "different_numeric_answers" ||
        diagnostic.category === "answered_while_needs_review" ||
        diagnostic.category === "answered_while_blocked" ||
        diagnostic.category === "declined_while_ready",
    ).length,
    taskScores,
  };
}
