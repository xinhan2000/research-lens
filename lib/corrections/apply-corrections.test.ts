import { describe, expect, it } from "vitest";

import { parseBenchmarkResponse } from "../ai-benchmark-schema";
import { runSkills } from "../skills/engine";
import { makeInput, reportAInputs, reportCInputs } from "../skills/fixtures";
import { findResolvableBasisConflict } from "../skills/resolution";
import type { SkillResult } from "../skills/types";

import {
  applyCorrections,
  changedFields,
  isCorrected,
  withCorrection,
  withoutCorrection,
} from "./apply-corrections";
import {
  analystCorrectionSchema,
  parseCorrection,
  type AnalystCorrection,
  type CorrectionsById,
} from "./schema";

const AT = "2026-09-05T10:00:00.000Z";

function correction(
  inputId: string,
  changes: Record<string, unknown>,
): AnalystCorrection {
  const parsed = parseCorrection({ inputId, changes, correctedAt: AT });
  if (!parsed) throw new Error("fixture correction failed validation");
  return parsed;
}

function bySkill(results: SkillResult[], skillId: string): SkillResult {
  const r = results.find((x) => x.skillId === skillId);
  if (!r) throw new Error(`missing ${skillId}`);
  return r;
}

/** Clean-style fixture: FY2025 Revenue is the input under correction. */
const REVENUE_25 = "a_rev25";

/* ------------------------------------------------------------------ *
 * Correction schema
 * ------------------------------------------------------------------ */

describe("correction schema", () => {
  const ok = (changes: Record<string, unknown>) =>
    analystCorrectionSchema.safeParse({ inputId: "x", changes, correctedAt: AT })
      .success;

  it("accepts a value correction", () => {
    expect(ok({ value: 100 })).toBe(true);
  });

  it("accepts a null value", () => {
    expect(ok({ value: null })).toBe(true);
  });

  it("accepts a negative value", () => {
    expect(ok({ value: -12.5 })).toBe(true);
  });

  it("rejects NaN and infinities", () => {
    expect(ok({ value: Number.NaN })).toBe(false);
    expect(ok({ value: Number.POSITIVE_INFINITY })).toBe(false);
    expect(ok({ value: Number.NEGATIVE_INFINITY })).toBe(false);
  });

  it("rejects non-numeric text as a value", () => {
    expect(ok({ value: "$100M" })).toBe(false);
  });

  it("uses the canonical temporal type enum", () => {
    expect(ok({ temporal_type: "forecast" })).toBe(true);
    expect(ok({ temporal_type: "probably_actual" })).toBe(false);
  });

  it("uses the canonical basis enum", () => {
    expect(ok({ basis: "adjusted" })).toBe(true);
    expect(ok({ basis: "made_up" })).toBe(false);
  });

  it("allows exact, approximate, qualitative, unknown precision", () => {
    for (const p of ["exact", "approximate", "qualitative", "unknown"]) {
      expect(ok({ precision: p })).toBe(true);
    }
  });

  it("rejects precision range — BUILD-7 has no bounds editor", () => {
    expect(ok({ precision: "range" })).toBe(false);
  });

  it("trims a period and maps blank to null", () => {
    const trimmed = parseCorrection({
      inputId: "x", changes: { period: "  FY2026  " }, correctedAt: AT,
    });
    expect(trimmed!.changes.period).toBe("FY2026");
    const blank = parseCorrection({
      inputId: "x", changes: { period: "   " }, correctedAt: AT,
    });
    expect(blank!.changes.period).toBeNull();
  });

  it("rejects safety and identity fields", () => {
    for (const field of [
      "unit",
      "currency",
      "trust_state",
      "conflict_state",
      "evidence_type",
      "source",
      "metric",
      "input_id",
      "resolved",
      "materiality",
    ]) {
      expect(ok({ value: 100, [field]: "anything" })).toBe(false);
    }
  });

  it("rejects an empty change set and unknown fields", () => {
    expect(ok({})).toBe(false);
    expect(ok({ nonsense: 1 })).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Pure application
 * ------------------------------------------------------------------ */

describe("applyCorrections", () => {
  const inputs = reportAInputs();
  const corrections: CorrectionsById = {
    [REVENUE_25]: correction(REVENUE_25, { value: 100 }),
  };

  it("overlays the corrected field by input id", () => {
    const effective = applyCorrections(inputs, corrections);
    expect(effective.find((i) => i.input_id === REVENUE_25)!.value).toBe(100);
  });

  it("preserves input_id, source, evidence and trust fields", () => {
    const original = inputs.find((i) => i.input_id === REVENUE_25)!;
    const corrected = applyCorrections(inputs, corrections).find(
      (i) => i.input_id === REVENUE_25,
    )!;
    expect(corrected.input_id).toBe(original.input_id);
    expect(corrected.source).toEqual(original.source);
    expect(corrected.source.text).toBe(original.source.text);
    expect(corrected.evidence_type).toBe(original.evidence_type);
    expect(corrected.trust_state).toBe(original.trust_state);
    expect(corrected.conflict_state).toBe(original.conflict_state);
    expect(corrected.metric).toBe(original.metric);
    expect(corrected.unit).toBe(original.unit);
    expect(corrected.currency).toBe(original.currency);
  });

  it("leaves non-corrected fields untouched", () => {
    const original = inputs.find((i) => i.input_id === REVENUE_25)!;
    const corrected = applyCorrections(inputs, corrections).find(
      (i) => i.input_id === REVENUE_25,
    )!;
    expect(corrected.period).toBe(original.period);
    expect(corrected.temporal_type).toBe(original.temporal_type);
    expect(corrected.basis).toBe(original.basis);
    expect(corrected.precision).toBe(original.precision);
  });

  it("never mutates the original array or its objects", () => {
    const fresh = reportAInputs();
    const before = JSON.stringify(fresh);
    applyCorrections(fresh, corrections);
    applyCorrections(fresh, {
      [REVENUE_25]: correction(REVENUE_25, { value: 7, precision: "approximate" }),
    });
    expect(JSON.stringify(fresh)).toBe(before);
  });

  it("ignores a correction for an input that does not exist", () => {
    const before = JSON.stringify(inputs);
    const effective = applyCorrections(inputs, {
      ghost: correction("ghost", { value: 999 }),
    });
    expect(JSON.stringify(effective)).toBe(before);
  });

  it("is deterministic across repeated application", () => {
    const a = JSON.stringify(applyCorrections(inputs, corrections));
    const b = JSON.stringify(applyCorrections(inputs, corrections));
    expect(b).toBe(a);
  });

  it("supports corrections on two different inputs", () => {
    const two: CorrectionsById = {
      [REVENUE_25]: correction(REVENUE_25, { value: 100 }),
      a_gp25: correction("a_gp25", { value: 60 }),
    };
    const effective = applyCorrections(inputs, two);
    expect(effective.find((i) => i.input_id === REVENUE_25)!.value).toBe(100);
    expect(effective.find((i) => i.input_id === "a_gp25")!.value).toBe(60);
    expect(effective.find((i) => i.input_id === "a_rev24")!.value).toBe(82);
  });

  it("replacing one correction updates only that input", () => {
    const next = withCorrection(corrections, correction(REVENUE_25, { value: 90 }));
    const effective = applyCorrections(inputs, next);
    expect(effective.find((i) => i.input_id === REVENUE_25)!.value).toBe(90);
    expect(effective.find((i) => i.input_id === "a_gp25")!.value).toBe(62);
  });

  it("removing a correction restores the original effective input", () => {
    const cleared = withoutCorrection(corrections, REVENUE_25);
    expect(isCorrected(cleared, REVENUE_25)).toBe(false);
    const effective = applyCorrections(inputs, cleared);
    expect(effective.find((i) => i.input_id === REVENUE_25)!.value).toBe(101);
  });

  it("reports which fields changed, for display only", () => {
    const original = inputs.find((i) => i.input_id === REVENUE_25)!;
    const effective = applyCorrections(inputs, {
      [REVENUE_25]: correction(REVENUE_25, { value: 100, precision: "approximate" }),
    }).find((i) => i.input_id === REVENUE_25)!;
    expect(changedFields(original, effective).sort()).toEqual([
      "precision",
      "value",
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * Downstream propagation — the stale-result guarantee
 * ------------------------------------------------------------------ */

describe("downstream skill propagation", () => {
  const inputs = reportAInputs();

  it("original inputs give the established BUILD-5 results", () => {
    const r = runSkills(inputs);
    expect(bySkill(r, "skill_revenue_growth").value).toBeCloseTo((101 - 82) / 82, 9);
    expect(bySkill(r, "skill_gross_margin").value).toBeCloseTo(62 / 101, 9);
    expect(bySkill(r, "skill_ebitda_margin").value).toBeCloseTo(18.6 / 101, 9);
    expect(bySkill(r, "skill_ev_revenue").value).toBeCloseTo(650 / 101, 9);
  });

  describe("value corrected 101 -> 100", () => {
    const effective = applyCorrections(inputs, {
      [REVENUE_25]: correction(REVENUE_25, { value: 100 }),
    });
    const results = runSkills(effective);

    it("Revenue Growth recalculates to ~21.95%", () => {
      const r = bySkill(results, "skill_revenue_growth");
      expect(r.status).toBe("READY");
      expect(r.value).toBeCloseTo((100 - 82) / 82, 9);
    });

    it("Gross Margin recalculates to 62%", () => {
      expect(bySkill(results, "skill_gross_margin").value).toBeCloseTo(62 / 100, 9);
    });

    it("EBITDA Margin recalculates to 18.6%", () => {
      expect(bySkill(results, "skill_ebitda_margin").value).toBeCloseTo(18.6 / 100, 9);
    });

    it("EV / Revenue recalculates to 6.5x", () => {
      expect(bySkill(results, "skill_ev_revenue").value).toBeCloseTo(650 / 100, 9);
    });

    it("Net Debt is unchanged", () => {
      expect(bySkill(results, "skill_net_debt").value).toBeCloseTo(95, 9);
    });

    it("EV / EBITDA is unchanged", () => {
      expect(bySkill(results, "skill_ev_ebitda").value).toBeCloseTo(650 / 18.6, 9);
    });

    it("no pre-correction value survives anywhere in the results", () => {
      const serialized = JSON.stringify(results);
      for (const stale of [(101 - 82) / 82, 62 / 101, 18.6 / 101, 650 / 101]) {
        expect(serialized).not.toContain(String(stale));
      }
    });
  });

  describe("precision corrected to approximate", () => {
    const effective = applyCorrections(inputs, {
      [REVENUE_25]: correction(REVENUE_25, {
        value: 100,
        precision: "approximate",
      }),
    });
    const results = runSkills(effective);

    for (const skillId of [
      "skill_revenue_growth",
      "skill_gross_margin",
      "skill_ebitda_margin",
    ]) {
      it(`${skillId} is not READY and carries no value`, () => {
        const r = bySkill(results, skillId);
        expect(r.status).not.toBe("READY");
        expect(r.value).toBeUndefined();
      });
    }

    it("EV / Revenue falls back to the latest ELIGIBLE actual, not a stale value", () => {
      // The corrected FY2025 revenue is no longer eligible (approximate), so
      // the BUILD-5 eligibility-before-recency policy selects the FY2024 actual
      // and says so in the label. This is a fresh, correctly-attributed result
      // on a different period — not a surviving pre-correction number.
      const r = bySkill(results, "skill_ev_revenue");
      expect(r.status).toBe("READY");
      expect(r.label).toBe("EV / FY2024 Revenue");
      expect(r.value).toBeCloseTo(650 / 82, 9);
      expect(r.value).not.toBeCloseTo(6.5, 6);
      expect(r.inputIds).not.toContain(REVENUE_25);
    });

    it("EV / Revenue IS blocked when no other eligible revenue exists", () => {
      const soleRevenue = reportAInputs().filter(
        (i) => !(i.metric === "Revenue" && i.period === "FY2024"),
      );
      const effectiveOnly = applyCorrections(soleRevenue, {
        [REVENUE_25]: correction(REVENUE_25, { precision: "approximate" }),
      });
      const r = bySkill(runSkills(effectiveOnly), "skill_ev_revenue");
      expect(r.status).toBe("BLOCKED");
      expect(r.value).toBeUndefined();
    });

    it("Net Debt remains READY and unchanged", () => {
      const r = bySkill(results, "skill_net_debt");
      expect(r.status).toBe("READY");
      expect(r.value).toBeCloseTo(95, 9);
    });

    it("EV / EBITDA remains READY and unchanged", () => {
      const r = bySkill(results, "skill_ev_ebitda");
      expect(r.status).toBe("READY");
      expect(r.value).toBeCloseTo(650 / 18.6, 9);
    });

    it("no stale numerical result remains on the invalidated skills", () => {
      const serialized = JSON.stringify(results);
      // None of the pre-invalidation numbers may survive anywhere.
      for (const stale of [(100 - 82) / 82, 62 / 100, 18.6 / 100, 6.5]) {
        expect(serialized).not.toContain(String(stale));
      }
    });

    it("this comes from the existing gate, with no Revenue special case", () => {
      // The same precision change on Gross Profit blocks Gross Margin too.
      const gpApprox = applyCorrections(inputs, {
        a_gp25: correction("a_gp25", { precision: "approximate" }),
      });
      expect(bySkill(runSkills(gpApprox), "skill_gross_margin").status).not.toBe(
        "READY",
      );
    });
  });

  it("removing the correction restores every original result", () => {
    const corrected = applyCorrections(inputs, {
      [REVENUE_25]: correction(REVENUE_25, { value: 100, precision: "approximate" }),
    });
    expect(bySkill(runSkills(corrected), "skill_revenue_growth").status).not.toBe(
      "READY",
    );
    const restored = runSkills(applyCorrections(inputs, {}));
    expect(JSON.stringify(restored)).toBe(JSON.stringify(runSkills(inputs)));
  });
});

/* ------------------------------------------------------------------ *
 * Composition with BUILD-6 and BUILD-5.5
 * ------------------------------------------------------------------ */

describe("interaction with resolution and benchmark", () => {
  it("does not mutate an AnalystInputResolution object", () => {
    const resolution = {
      family: "EBITDA" as const,
      period: "FY2025",
      selectedInputId: "c_ebitda_adj",
    };
    const before = JSON.stringify(resolution);
    const effective = applyCorrections(reportCInputs(), {
      c_rev25: correction("c_rev25", { value: 100 }),
    });
    runSkills(effective, resolution);
    expect(JSON.stringify(resolution)).toBe(before);
  });

  it("a corrected input still participates in basis-conflict detection", () => {
    const effective = applyCorrections(reportCInputs(), {
      c_ebitda_adj: correction("c_ebitda_adj", { value: 19.0 }),
    });
    const group = findResolvableBasisConflict(effective);
    expect(group).not.toBeNull();
    expect(group!.candidates.map((c) => c.input_id)).toEqual([
      "c_ebitda_adj",
      "c_ebitda_reported",
    ]);
    expect(group!.candidates[0].value).toBe(19.0);
  });

  it("correction alone does not bypass ASK or material conflict", () => {
    const effective = applyCorrections(reportCInputs(), {
      c_ebitda_adj: correction("c_ebitda_adj", { value: 19.0 }),
    });
    const r = bySkill(runSkills(effective), "skill_ev_ebitda");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
  });

  it("resolution can still select a corrected candidate afterwards", () => {
    const effective = applyCorrections(reportCInputs(), {
      c_ebitda_adj: correction("c_ebitda_adj", { value: 20.0 }),
    });
    const r = bySkill(
      runSkills(effective, {
        family: "EBITDA",
        period: "FY2025",
        selectedInputId: "c_ebitda_adj",
      }),
      "skill_ev_ebitda",
    );
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(650 / 20.0, 9);
  });

  it("does not mutate an AiBenchmarkResponse", () => {
    const benchmark = parseBenchmarkResponse({
      items: [
        "revenue_growth", "gross_margin", "ebitda_margin",
        "net_debt", "ev_revenue", "ev_ebitda",
      ].map((task_id) => ({ task_id, answer: "x", explanation: "y" })),
    });
    const before = JSON.stringify(benchmark);
    const effective = applyCorrections(reportAInputs(), {
      [REVENUE_25]: correction(REVENUE_25, { value: 100 }),
    });
    runSkills(effective);
    expect(JSON.stringify(benchmark)).toBe(before);
  });

  it("corrected skill results are independent of benchmark presence", () => {
    const effective = applyCorrections(reportAInputs(), {
      [REVENUE_25]: correction(REVENUE_25, { value: 100 }),
    });
    const withoutBenchmark = JSON.stringify(runSkills(effective));
    parseBenchmarkResponse({
      items: [
        "revenue_growth", "gross_margin", "ebitda_margin",
        "net_debt", "ev_revenue", "ev_ebitda",
      ].map((task_id) => ({ task_id, answer: "z", explanation: "w" })),
    });
    expect(JSON.stringify(runSkills(effective))).toBe(withoutBenchmark);
  });
});
