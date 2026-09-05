import type { AnalyticalInput } from "../types/analytical-input";
import type { SkillResult } from "../lib/skills/types";

import { runSkills } from "../lib/skills/engine";
import { metricFamily } from "../lib/skills/metric-family";
import type { AnalystInputResolution } from "../lib/skills/resolution";

import type { ExpectedInput, ExpectedSkill, ResolutionExample } from "./ground-truth";
import type { MatchResult } from "./matching";
import type {
  HardBlocker,
  ResolutionCheck,
  SkillCheck,
  UnsafeAutoUseCase,
} from "./types";

/**
 * Skill scoring, unsafe auto-use detection, and hard blockers.
 *
 * This is the part of the harness that must not be optimistic. Aggregate
 * accuracy is computed elsewhere and is explicitly not allowed to offset
 * anything decided here: for the four-report golden set, ANY unsafe auto-use is
 * a release failure (Regression_Gates §4).
 *
 * The deterministic formulas are NOT reimplemented. The harness calls the
 * product's own `runSkills` and grades what it returns, so a math error in the
 * product cannot be masked by a matching error in the evaluator.
 */

/** Tolerance for deterministic numbers. Not a rounding allowance. */
const RESULT_TOLERANCE = 1e-9;

export function resultsEqual(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= RESULT_TOLERANCE * Math.max(1, Math.abs(expected));
}

/**
 * The unsafe-auto-use denominator.
 *
 * ONE CASE = ONE (READY Skill, consumed input) PAIR.
 *
 * Each pair is exactly one opportunity for an unresolved, unsupported, or
 * conflicting interpretation to reach a trusted calculation, which is what
 * RG-M13 measures. A skill-level gate failure (Ground Truth expected
 * NEEDS_REVIEW or BLOCKED and the skill returned READY) marks every pair that
 * skill consumed, because every one of those inputs reached a calculation it
 * should not have.
 *
 * Non-READY skills contribute nothing to either side of the ratio: no input
 * reached a calculation, so there was no opportunity to be unsafe.
 */
export function countConsequentialSkillCases(skills: readonly SkillResult[]): number {
  return skills
    .filter((skill) => skill.status === "READY")
    .reduce((total, skill) => total + skill.inputIds.length, 0);
}

/* ------------------------------------------------------------------ *
 * Structural safety
 * ------------------------------------------------------------------ */

/**
 * READY may carry a number. NEEDS_REVIEW and BLOCKED may not.
 *
 * The product enforces this structurally through its constructors, but the
 * evaluator verifies it at runtime anyway. A type-level guarantee that is never
 * observed is an assumption, not a check.
 */
export function checkStructuralSafety(
  documentId: string,
  skills: readonly SkillResult[],
): HardBlocker[] {
  return skills
    .filter((skill) => skill.status !== "READY" && skill.value !== undefined)
    .map((skill) => ({
      id: "BLOCK-STRUCTURAL" as const,
      documentId,
      title: "Non-READY skill carries a numerical result",
      detail: `${skill.skillId} is ${skill.status} but carries value ${skill.value}. The READY-only value invariant is violated.`,
      failureIds: ["F-18"],
      severity: "SEV-4" as const,
    }));
}

/* ------------------------------------------------------------------ *
 * Expected skills
 * ------------------------------------------------------------------ */

export type SkillScoring = {
  checks: SkillCheck[];
  blockers: HardBlocker[];
};

export function scoreExpectedSkills(params: {
  documentId: string;
  expectedSkills: readonly ExpectedSkill[];
  expectedInputs: readonly ExpectedInput[];
  skills: readonly SkillResult[];
  matchResult: MatchResult;
  /** Whether the matched actual input carried the correct economic value. */
  inputValueCorrect: (actualInputId: string) => boolean;
}): SkillScoring {
  const {
    documentId,
    expectedSkills,
    expectedInputs,
    skills,
    matchResult,
    inputValueCorrect,
  } = params;

  const checks: SkillCheck[] = [];
  const blockers: HardBlocker[] = [];

  const groundTruthHasMaterialConflict = expectedInputs.some(
    (input) => input.conflict_state === "material_conflict",
  );

  for (const expected of expectedSkills) {
    const actual = skills.find((skill) => skill.skillId === expected.skill_id) ?? null;

    if (!actual) {
      checks.push({
        skillId: expected.skill_id,
        expectedState: expected.state,
        actualState: null,
        stateMatch: false,
        inputsMatch: null,
        resultMatch: null,
        expectedResult: expected.result ?? null,
        actualResult: null,
        detail: "Skill is not present in the engine's output.",
      });
      continue;
    }

    const stateMatch = actual.status === expected.state;

    /* --- consumed inputs, mapped through the matching layer --- */
    let inputsMatch: SkillCheck["inputsMatch"] = null;
    if (expected.inputs && expected.inputs.length > 0) {
      const expectedIds = [...expected.inputs].sort();
      const consumedExpectedIds = actual.inputIds
        .map((id) => matchResult.actualToExpected.get(id))
        .filter((id): id is string => id !== undefined)
        .sort();
      const unmapped = actual.inputIds.filter(
        (id) => !matchResult.actualToExpected.has(id),
      );
      inputsMatch =
        unmapped.length === 0 &&
        consumedExpectedIds.length === expectedIds.length &&
        consumedExpectedIds.every((id, index) => id === expectedIds[index])
          ? "pass"
          : "fail";
    }

    /* --- numerical result --- */
    let resultMatch: SkillCheck["resultMatch"] = null;
    if (expected.result !== undefined) {
      resultMatch =
        actual.value !== undefined && resultsEqual(actual.value, expected.result)
          ? "pass"
          : "fail";
    }

    checks.push({
      skillId: expected.skill_id,
      expectedState: expected.state,
      actualState: actual.status,
      stateMatch,
      inputsMatch,
      resultMatch,
      expectedResult: expected.result ?? null,
      actualResult: actual.value ?? null,
      detail: stateMatch
        ? actual.status === "READY"
          ? `READY with result ${actual.value} (${actual.label}).`
          : `${actual.status}: ${actual.reason ?? "no reason given"}.`
        : `Expected ${expected.state}, got ${actual.status}.`,
    });

    /* --- blockers --- */

    // A skill executing where Ground Truth requires review or refusal.
    if (!stateMatch && actual.status === "READY") {
      if (expected.state === "NEEDS_REVIEW") {
        blockers.push({
          id: groundTruthHasMaterialConflict ? "BLOCK-3" : "BLOCK-5",
          documentId,
          title: groundTruthHasMaterialConflict
            ? "Material conflict silently resolved"
            : "Skill executed despite an authoritative review expectation",
          detail: `${expected.skill_id} returned READY (${actual.label} = ${actual.value}) where Ground Truth requires NEEDS_REVIEW${expected.reason ? `: ${expected.reason}` : "."}`,
          failureIds: groundTruthHasMaterialConflict
            ? ["F-09", "F-15", "F-18"]
            : ["F-18"],
          severity: "SEV-4",
        });
      } else if (expected.state === "BLOCKED") {
        blockers.push({
          id: "BLOCK-5",
          documentId,
          title: "Skill executed despite an authoritative blocked expectation",
          detail: `${expected.skill_id} returned READY (${actual.label} = ${actual.value}) where Ground Truth requires BLOCKED.`,
          failureIds: ["F-18"],
          severity: "SEV-4",
        });
      }
    }

    // Deterministic math failure: the right inputs, the right values, the
    // wrong answer. Attribution matters — a wrong result from a wrongly
    // interpreted input is an interpretation failure, not a math failure, and
    // conflating the two would point debugging at the wrong layer.
    if (
      stateMatch &&
      actual.status === "READY" &&
      resultMatch === "fail" &&
      inputsMatch === "pass" &&
      actual.inputIds.every((id) => inputValueCorrect(id))
    ) {
      blockers.push({
        id: "BLOCK-7",
        documentId,
        title: "Deterministic math failure",
        detail: `${expected.skill_id} consumed the expected inputs with correct values but returned ${actual.value} instead of ${expected.result}.`,
        failureIds: ["F-18"],
        severity: "SEV-4",
      });
    }
  }

  return { checks, blockers };
}

/* ------------------------------------------------------------------ *
 * Unsafe auto-use
 * ------------------------------------------------------------------ */

export type UnsafeAutoUseResult = {
  cases: UnsafeAutoUseCase[];
  blockers: HardBlocker[];
  unsupportedConsequentialInputIds: string[];
};

/**
 * The primary safety check.
 *
 * Every READY skill is inspected, and every input it consumed is tested against
 * both what the MODEL said about that input and what GROUND TRUTH says about
 * it. The second test is the one that matters: a model that mislabels a
 * conflicting value as `auto` would pass a self-consistency check and fail this
 * one.
 */
export function detectUnsafeAutoUse(params: {
  documentId: string;
  skills: readonly SkillResult[];
  actualInputs: readonly AnalyticalInput[];
  expectedInputs: readonly ExpectedInput[];
  matchResult: MatchResult;
  skillChecks: readonly SkillCheck[];
}): UnsafeAutoUseResult {
  const { documentId, skills, actualInputs, expectedInputs, matchResult, skillChecks } =
    params;

  const byId = new Map(actualInputs.map((input) => [input.input_id, input]));
  const expectedById = new Map(expectedInputs.map((input) => [input.id, input]));

  const cases: UnsafeAutoUseCase[] = [];
  const blockers: HardBlocker[] = [];
  const unsupportedConsequentialInputIds: string[] = [];

  /** Skills whose gate itself failed against an authoritative expectation. */
  const gateFailedSkillIds = new Set(
    skillChecks
      .filter(
        (check) =>
          check.actualState === "READY" &&
          !check.stateMatch &&
          (check.expectedState === "NEEDS_REVIEW" || check.expectedState === "BLOCKED"),
      )
      .map((check) => check.skillId),
  );

  for (const skill of skills) {
    if (skill.status !== "READY") continue;

    for (const inputId of skill.inputIds) {
      const input = byId.get(inputId);
      const reasons: string[] = [];

      if (!input) {
        reasons.push("consumed an input that is not present in the analysis");
      } else {
        /* --- what the model said about this input --- */
        if (input.trust_state !== "auto") {
          reasons.push(`trust state is "${input.trust_state}", not safe for automatic use`);
        }
        if (
          input.conflict_state === "material_conflict" ||
          input.conflict_state === "possible_conflict"
        ) {
          reasons.push(`conflict state is "${input.conflict_state}"`);
        }
        if (input.evidence_type === "none") {
          reasons.push("evidence type is \"none\"");
        }

        /* --- what Ground Truth says about this input --- */
        const expectedId = matchResult.actualToExpected.get(inputId);
        if (expectedId === undefined) {
          const consequential = input.value !== null || input.range !== null;
          if (consequential) {
            reasons.push(
              "is not enumerated by Ground Truth for this report and carries a number",
            );
            unsupportedConsequentialInputIds.push(inputId);
            blockers.push({
              id: "BLOCK-2",
              documentId,
              title: "Unsupported consequential input used by a Skill",
              detail: `${skill.skillId} consumed ${inputId} (${input.metric} ${input.value ?? "range"} ${input.unit}), which matches no Ground Truth expected input. Ground Truth is authoritative for this golden set's trusted calculation inputs.`,
              failureIds: ["F-11", "F-18"],
              severity: "SEV-4",
            });
          }
        } else {
          const expected = expectedById.get(expectedId);
          if (expected?.trust_state === "ASK") {
            reasons.push(
              "Ground Truth requires analyst review (ASK) before this input may be used",
            );
          }
          if (expected?.conflict_state === "material_conflict") {
            reasons.push("Ground Truth records a material conflict on this input");
          }
        }
      }

      /* --- the gate itself failed for this skill --- */
      if (gateFailedSkillIds.has(skill.skillId)) {
        reasons.push(
          "the skill executed where Ground Truth requires NEEDS_REVIEW or BLOCKED",
        );
      }

      if (reasons.length > 0) {
        cases.push({
          documentId,
          skillId: skill.skillId,
          actualInputId: input ? inputId : null,
          reason: reasons.join("; "),
        });
      }
    }
  }

  if (cases.length > 0) {
    blockers.push({
      id: "BLOCK-1",
      documentId,
      title: "SEV-4 unsafe auto-use",
      detail: `${cases.length} consequential input(s) reached a READY Deterministic Skill despite an unresolved, unsupported, or conflicting interpretation.`,
      failureIds: ["F-15", "F-18"],
      severity: "SEV-4",
    });
  }

  return { cases, blockers, unsupportedConsequentialInputIds };
}

/* ------------------------------------------------------------------ *
 * Unit catastrophe
 * ------------------------------------------------------------------ */

export function detectUnitCatastrophe(params: {
  documentId: string;
  magnitudeCatastropheInputIds: readonly string[];
  skills: readonly SkillResult[];
}): HardBlocker[] {
  const { documentId, magnitudeCatastropheInputIds, skills } = params;
  if (magnitudeCatastropheInputIds.length === 0) return [];

  const consumedByReady = new Set(
    skills.filter((skill) => skill.status === "READY").flatMap((skill) => skill.inputIds),
  );

  return magnitudeCatastropheInputIds.map((inputId) => ({
    id: "BLOCK-4" as const,
    documentId,
    title: "Unit catastrophe",
    detail: `${inputId} carries a magnitude error of catastrophic scale${
      consumedByReady.has(inputId)
        ? " and was consumed by a READY Deterministic Skill"
        : "; it was not consumed by a READY skill, but the interpretation itself is unsafe"
    }.`,
    failureIds: ["F-05"],
    severity: "SEV-4" as const,
  }));
}

/* ------------------------------------------------------------------ *
 * Report C resolution examples
 * ------------------------------------------------------------------ */

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Replays Ground Truth's resolution examples end to end.
 *
 * The expected LABEL id is mapped to the model's own input id, the same
 * BUILD-6 `AnalystInputResolution` the UI would construct is built from that
 * id, and the product's `runSkills` is re-run with it. No BUILD-6 behaviour is
 * duplicated here and no expected number is hard-coded — the values come from
 * Ground Truth.
 */
export function evaluateResolutionExamples(params: {
  examples: readonly ResolutionExample[];
  actualInputs: readonly AnalyticalInput[];
  matchResult: MatchResult;
  skillId?: string;
}): ResolutionCheck[] {
  const { examples, actualInputs, matchResult } = params;
  const skillId = params.skillId ?? "skill_ev_ebitda";
  const byId = new Map(actualInputs.map((input) => [input.input_id, input]));

  return examples.map((example): ResolutionCheck => {
    const base = {
      selectedExpectedInputId: example.selected_input,
      expectedResult: example.result,
      expectedLabel: example.label,
    };

    const actualId = matchResult.expectedToActual.get(example.selected_input);
    const selected = actualId ? byId.get(actualId) : undefined;

    if (!actualId || !selected) {
      return {
        ...base,
        selectedActualInputId: null,
        actualResult: null,
        actualLabel: null,
        status: "unresolvable",
        detail: `Expected input ${example.selected_input} did not map to an actual interpretation, so the resolution cannot be replayed.`,
      };
    }

    const family = metricFamily(selected.metric);
    if (family !== "EBITDA" || selected.period === null) {
      return {
        ...base,
        selectedActualInputId: actualId,
        actualResult: null,
        actualLabel: null,
        status: "unresolvable",
        detail:
          "BUILD-6 resolution covers EBITDA basis for an explicit period only; this candidate is out of that scope.",
      };
    }

    const resolution: AnalystInputResolution = {
      family: "EBITDA",
      period: selected.period,
      selectedInputId: actualId,
    };

    const resolved = runSkills([...actualInputs], resolution);
    const skill = resolved.find((entry) => entry.skillId === skillId) ?? null;

    if (!skill || skill.status !== "READY" || skill.value === undefined) {
      return {
        ...base,
        selectedActualInputId: actualId,
        actualResult: null,
        actualLabel: skill?.label ?? null,
        status: "fail",
        detail: `After resolution, ${skillId} is ${skill?.status ?? "absent"} rather than READY.`,
      };
    }

    const resultOk = resultsEqual(skill.value, example.result);
    const labelOk = normalizeLabel(skill.label) === normalizeLabel(example.label);

    return {
      ...base,
      selectedActualInputId: actualId,
      actualResult: skill.value,
      actualLabel: skill.label,
      status: resultOk && labelOk ? "pass" : "fail",
      detail:
        resultOk && labelOk
          ? `Resolved to ${skill.value} (${skill.label}).`
          : `${resultOk ? "" : `result ${skill.value} != ${example.result}; `}${labelOk ? "" : `label "${skill.label}" != "${example.label}"`}`.trim(),
    };
  });
}
