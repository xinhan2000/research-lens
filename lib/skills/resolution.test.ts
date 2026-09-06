import { describe, expect, it } from "vitest";

import { runSkills } from "./engine";
import { makeInput, reportAInputs, reportCInputs } from "./fixtures";
import {
  findResolvableBasisConflict,
  type AnalystInputResolution,
} from "./resolution";
import type { SkillResult } from "./types";

function bySkill(results: SkillResult[], skillId: string): SkillResult {
  const r = results.find((x) => x.skillId === skillId);
  if (!r) throw new Error(`missing ${skillId}`);
  return r;
}

const adjusted: AnalystInputResolution = {
  family: "EBITDA",
  period: "FY2025",
  selectedInputId: "c_ebitda_adj",
};
const reported: AnalystInputResolution = {
  family: "EBITDA",
  period: "FY2025",
  selectedInputId: "c_ebitda_reported",
};

/**
 * The exact structural shape observed in a public run: the model classified an
 * explicitly "reported" EBITDA as `gaap`. Only the comparator's basis differs
 * from the standard conflict fixture — same ids, values, period, trust and
 * conflict states — so these tests isolate that one field.
 */
function adjustedGaapConflictInputs() {
  return reportCInputs().map((input) =>
    input.input_id === "c_ebitda_reported"
      ? { ...input, basis: "gaap" as const }
      : input,
  );
}

const gaapComparator: AnalystInputResolution = {
  family: "EBITDA",
  period: "FY2025",
  selectedInputId: "c_ebitda_reported",
};

/* ------------------------------------------------------------------ *
 * Engine resolution — the hero transition
 * ------------------------------------------------------------------ */

describe("analyst resolution of an EBITDA basis conflict", () => {
  it("unresolved: EBITDA Margin is NEEDS_REVIEW with no value", () => {
    const r = bySkill(runSkills(reportCInputs()), "skill_ebitda_margin");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
  });

  it("unresolved: EV / EBITDA is NEEDS_REVIEW with no value", () => {
    const r = bySkill(runSkills(reportCInputs()), "skill_ev_ebitda");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
  });

  it("adjusted selection: EBITDA Margin READY ~18.42%", () => {
    const r = bySkill(runSkills(reportCInputs(), adjusted), "skill_ebitda_margin");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(18.6 / 101, 9);
    expect(r.label).toContain("Adjusted");
  });

  it("adjusted selection: EV / EBITDA READY ~34.95x", () => {
    const r = bySkill(runSkills(reportCInputs(), adjusted), "skill_ev_ebitda");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(650 / 18.6, 9);
    expect(r.label).toBe("EV / FY2025 Adjusted EBITDA");
  });

  it("reported selection: EBITDA Margin READY ~14.06%", () => {
    const r = bySkill(runSkills(reportCInputs(), reported), "skill_ebitda_margin");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(14.2 / 101, 9);
    expect(r.label).toContain("Reported");
  });

  it("reported selection: EV / EBITDA READY ~45.77x", () => {
    const r = bySkill(runSkills(reportCInputs(), reported), "skill_ev_ebitda");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(650 / 14.2, 9);
    expect(r.label).toBe("EV / FY2025 Reported EBITDA");
  });

  it("one selection updates BOTH dependent skills", () => {
    for (const [resolution, ebitda] of [
      [adjusted, 18.6],
      [reported, 14.2],
    ] as const) {
      const results = runSkills(reportCInputs(), resolution);
      const margin = bySkill(results, "skill_ebitda_margin");
      const multiple = bySkill(results, "skill_ev_ebitda");
      expect(margin.status).toBe("READY");
      expect(multiple.status).toBe("READY");
      expect(margin.value).toBeCloseTo(ebitda / 101, 9);
      expect(multiple.value).toBeCloseTo(650 / ebitda, 9);
      expect(margin.inputIds).toContain(resolution.selectedInputId);
      expect(multiple.inputIds).toContain(resolution.selectedInputId);
    }
  });

  it("does not disturb the other Report C skills", () => {
    const before = runSkills(reportCInputs());
    const after = runSkills(reportCInputs(), adjusted);
    for (const id of [
      "skill_revenue_growth",
      "skill_gross_margin",
      "skill_net_debt",
      "skill_ev_revenue",
    ]) {
      const a = bySkill(before, id);
      const b = bySkill(after, id);
      expect(b.status).toBe(a.status);
      expect(b.value).toBe(a.value);
    }
  });

  it("omitting the resolution reproduces BUILD-5 behaviour exactly", () => {
    expect(JSON.stringify(runSkills(reportCInputs(), null))).toBe(
      JSON.stringify(runSkills(reportCInputs())),
    );
    expect(JSON.stringify(runSkills(reportAInputs(), null))).toBe(
      JSON.stringify(runSkills(reportAInputs())),
    );
  });

  it("is deterministic across repeated execution", () => {
    const first = JSON.stringify(runSkills(reportCInputs(), adjusted));
    const second = JSON.stringify(runSkills(reportCInputs(), adjusted));
    expect(second).toBe(first);
  });

  it("does not mutate the input array or its objects", () => {
    const inputs = reportCInputs();
    const before = JSON.stringify(inputs);
    runSkills(inputs, adjusted);
    runSkills(inputs, reported);
    expect(JSON.stringify(inputs)).toBe(before);
  });
});

/* ------------------------------------------------------------------ *
 * A resolution is never trusted on its own word
 * ------------------------------------------------------------------ */

describe("invalid or stale resolutions do not resolve anything", () => {
  it("a nonexistent input id resolves nothing", () => {
    const r = bySkill(
      runSkills(reportCInputs(), { ...adjusted, selectedInputId: "nope" }),
      "skill_ev_ebitda",
    );
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
  });

  it("a wrong-family input id resolves nothing", () => {
    const r = bySkill(
      runSkills(reportCInputs(), { ...adjusted, selectedInputId: "c_ev" }),
      "skill_ev_ebitda",
    );
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
  });

  it("a mismatched period resolves nothing", () => {
    const r = bySkill(
      runSkills(reportCInputs(), { ...adjusted, period: "FY2024" }),
      "skill_ev_ebitda",
    );
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * Hard gates survive analyst selection — the most important boundary
 * ------------------------------------------------------------------ */

describe("hard gates can never be bypassed by analyst selection", () => {
  function conflictWith(overrides: Record<string, unknown>) {
    return reportCInputs().map((i) =>
      i.input_id === "c_ebitda_adj" ? { ...i, ...overrides } : i,
    );
  }

  const cases: [string, Record<string, unknown>][] = [
    ["trust_state abstain", { trust_state: "abstain", resolved: false }],
    ["trust_state never", { trust_state: "never", resolved: false }],
    ["evidence_type none", { evidence_type: "none", resolved: false }],
    ["precision qualitative", { precision: "qualitative", value: null }],
    ["precision range", { precision: "range", value: null, range: { min: 18, max: 19 } }],
    ["precision approximate", { precision: "approximate" }],
    ["precision unknown", { precision: "unknown" }],
    ["missing value", { value: null }],
    ["unsupported unit", { unit: "percent" }],
    ["missing currency", { currency: null }],
    ["missing period", { period: null }],
    ["unknown temporal type", { temporal_type: "unknown" }],
    ["non-actual when actual required", { temporal_type: "forecast" }],
    ["unresolved basis", { basis: "unknown" }],
  ];

  for (const [name, overrides] of cases) {
    it(`${name} still prevents a READY EV / EBITDA`, () => {
      const r = bySkill(
        runSkills(conflictWith(overrides), adjusted),
        "skill_ev_ebitda",
      );
      expect(r.status).not.toBe("READY");
      expect(r.value).toBeUndefined();
    });
  }

  it("relaxes ONLY the reviewable conditions: ask alone becomes usable", () => {
    // A single clean EBITDA marked `ask` — no conflict, all hard gates pass.
    const inputs = [
      makeInput({ input_id: "rev", metric: "Revenue", value: 101, period: "FY2025" }),
      makeInput({ input_id: "ev", metric: "Enterprise Value", value: 650, period: null, temporal_type: "unknown", basis: "not_applicable" }),
      makeInput({
        input_id: "e_ask", metric: "EBITDA", value: 18.6, period: "FY2025",
        basis: "adjusted", trust_state: "ask", resolved: false,
      }),
    ];
    const unresolved = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(unresolved.status).toBe("NEEDS_REVIEW");

    const resolved = bySkill(
      runSkills(inputs, { family: "EBITDA", period: "FY2025", selectedInputId: "e_ask" }),
      "skill_ev_ebitda",
    );
    expect(resolved.status).toBe("READY");
    expect(resolved.value).toBeCloseTo(650 / 18.6, 9);
  });
});

/* ------------------------------------------------------------------ *
 * Conflict detection
 * ------------------------------------------------------------------ */

describe("resolvable basis conflict detection", () => {
  it("detects same-period adjusted vs reported EBITDA", () => {
    const group = findResolvableBasisConflict(reportCInputs());
    expect(group).not.toBeNull();
    expect(group!.family).toBe("EBITDA");
    expect(group!.period).toBe("FY2025");
    expect(group!.candidates).toHaveLength(2);
  });

  it("preserves candidate ids exactly, in document order", () => {
    const group = findResolvableBasisConflict(reportCInputs())!;
    expect(group.candidates.map((c) => c.input_id)).toEqual([
      "c_ebitda_adj",
      "c_ebitda_reported",
    ]);
  });

  it("preselects nothing — detection returns candidates only", () => {
    const group = findResolvableBasisConflict(reportCInputs())!;
    expect(Object.keys(group)).toEqual(["family", "period", "candidates"]);
    expect(JSON.stringify(group)).not.toContain("selected");
  });

  it("Clean report shape has no basis conflict", () => {
    expect(findResolvableBasisConflict(reportAInputs())).toBeNull();
  });

  it("REPORT D SHAPE: FY2025 + Q4 FY2025 adjusted is NOT a basis conflict", () => {
    // Period ambiguity, not basis ambiguity. BUILD-6 must offer no control.
    const inputs = [
      makeInput({ input_id: "d_rev", metric: "Revenue", value: 101, period: "FY2025" }),
      makeInput({ input_id: "d_fy", metric: "Adjusted EBITDA", value: 18.6, period: "FY2025", basis: "adjusted" }),
      makeInput({ input_id: "d_q4", metric: "Adjusted EBITDA", value: 5.4, period: "Q4 FY2025", basis: "adjusted" }),
    ];
    expect(findResolvableBasisConflict(inputs)).toBeNull();
    const r = bySkill(runSkills(inputs), "skill_ebitda_margin");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
  });

  it("same period and same basis is not a resolvable conflict", () => {
    const inputs = [
      makeInput({ input_id: "a", metric: "EBITDA", value: 18.6, period: "FY2025", basis: "adjusted" }),
      makeInput({ input_id: "b", metric: "EBITDA", value: 18.7, period: "FY2025", basis: "adjusted" }),
    ];
    expect(findResolvableBasisConflict(inputs)).toBeNull();
  });

  it("unknown basis produces no resolvable pair", () => {
    const inputs = [
      makeInput({ input_id: "a", metric: "EBITDA", value: 18.6, period: "FY2025", basis: "unknown" }),
      makeInput({ input_id: "b", metric: "EBITDA", value: 14.2, period: "FY2025", basis: "reported" }),
    ];
    expect(findResolvableBasisConflict(inputs)).toBeNull();
  });

  it("multiple ambiguous basis groups fail closed", () => {
    const inputs = [
      makeInput({ input_id: "a1", metric: "EBITDA", value: 18.6, period: "FY2025", basis: "adjusted" }),
      makeInput({ input_id: "a2", metric: "EBITDA", value: 14.2, period: "FY2025", basis: "reported" }),
      makeInput({ input_id: "b1", metric: "EBITDA", value: 16.0, period: "FY2024", basis: "adjusted" }),
      makeInput({ input_id: "b2", metric: "EBITDA", value: 12.0, period: "FY2024", basis: "reported" }),
    ];
    expect(findResolvableBasisConflict(inputs)).toBeNull();
  });

  it("a three-way same-period group is not a two-way choice", () => {
    const inputs = [
      makeInput({ input_id: "a", metric: "EBITDA", value: 18.6, period: "FY2025", basis: "adjusted" }),
      makeInput({ input_id: "b", metric: "EBITDA", value: 14.2, period: "FY2025", basis: "reported" }),
      makeInput({ input_id: "c", metric: "EBITDA", value: 16.0, period: "FY2025", basis: "pro_forma" }),
    ];
    expect(findResolvableBasisConflict(inputs)).toBeNull();
  });

  it("a candidate with no value is excluded", () => {
    const inputs = [
      makeInput({ input_id: "a", metric: "EBITDA", value: null, precision: "qualitative", period: "FY2025", basis: "adjusted" }),
      makeInput({ input_id: "b", metric: "EBITDA", value: 14.2, period: "FY2025", basis: "reported" }),
    ];
    expect(findResolvableBasisConflict(inputs)).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Recovery robustness — adjusted vs an explicit GAAP comparator
 *
 * A live run classified an explicitly "reported EBITDA" figure as `gaap`. The
 * skill gate behaved correctly (EV / EBITDA stayed NEEDS_REVIEW) but the
 * detector required `reported` exactly, so the analyst lost the control that
 * resolves it — fail-safe, but unrecoverable. These tests pin the recovery
 * without loosening execution safety or rewriting anyone's basis.
 * ------------------------------------------------------------------ */

describe("adjusted vs GAAP comparator recovery", () => {
  it("A. the original adjusted + reported contract still detects", () => {
    const group = findResolvableBasisConflict(reportCInputs());
    expect(group).not.toBeNull();
    expect(group!.candidates.map((c) => c.basis)).toEqual([
      "adjusted",
      "reported",
    ]);
  });

  it("B. adjusted + gaap in one period is now detected", () => {
    const group = findResolvableBasisConflict(adjustedGaapConflictInputs());
    expect(group).not.toBeNull();
    expect(group!.family).toBe("EBITDA");
    expect(group!.period).toBe("FY2025");
    expect(group!.candidates).toHaveLength(2);
  });

  it("C. candidate semantics are preserved — no gaap -> reported rewrite", () => {
    const inputs = adjustedGaapConflictInputs();
    const group = findResolvableBasisConflict(inputs)!;

    // Bases are returned exactly as the model emitted them, in document order.
    expect(group.candidates.map((c) => c.basis)).toEqual(["adjusted", "gaap"]);
    expect(group.candidates.map((c) => c.input_id)).toEqual([
      "c_ebitda_adj",
      "c_ebitda_reported",
    ]);
    expect(JSON.stringify(group)).not.toContain('"reported"');

    // The source array and its objects are untouched.
    expect(inputs.find((i) => i.input_id === "c_ebitda_reported")!.basis).toBe(
      "gaap",
    );
  });

  it("D. detection alone does not execute anything", () => {
    const results = runSkills(adjustedGaapConflictInputs());
    for (const skillId of ["skill_ev_ebitda", "skill_ebitda_margin"]) {
      const r = bySkill(results, skillId);
      expect(r.status).toBe("NEEDS_REVIEW");
      expect(r.value).toBeUndefined();
    }
  });

  it("E. selecting adjusted computes EV / EBITDA from 18.6", () => {
    const r = bySkill(
      runSkills(adjustedGaapConflictInputs(), adjusted),
      "skill_ev_ebitda",
    );
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(650 / 18.6, 9);
    expect(r.label).toBe("EV / FY2025 Adjusted EBITDA");
  });

  it("F. selecting the GAAP comparator computes from 14.2 and says GAAP", () => {
    const inputs = adjustedGaapConflictInputs();

    const ev = bySkill(runSkills(inputs, gaapComparator), "skill_ev_ebitda");
    expect(ev.status).toBe("READY");
    expect(ev.value).toBeCloseTo(650 / 14.2, 9);
    // The label must name the basis actually used, never "Reported".
    expect(ev.label).toBe("EV / FY2025 GAAP EBITDA");
    expect(ev.label).not.toContain("Reported");
    expect(ev.label).not.toContain("Gaap");

    const margin = bySkill(
      runSkills(inputs, gaapComparator),
      "skill_ebitda_margin",
    );
    expect(margin.status).toBe("READY");
    expect(margin.value).toBeCloseTo(14.2 / 101, 9);
    expect(margin.inputs.some((i) => i.label.includes("GAAP"))).toBe(true);
  });

  it("G. the comparator set stays closed: unknown and non_gaap do not qualify", () => {
    for (const basis of ["unknown", "non_gaap", "management_defined", "pro_forma", "consensus", "not_applicable"] as const) {
      const inputs = [
        makeInput({ input_id: "a", metric: "EBITDA", value: 18.6, period: "FY2025", basis: "adjusted" }),
        makeInput({ input_id: "b", metric: "EBITDA", value: 14.2, period: "FY2025", basis }),
      ];
      expect(findResolvableBasisConflict(inputs), basis).toBeNull();
    }
  });

  it("H. adjusted + reported + gaap fails closed — three ways is not two", () => {
    const inputs = [
      makeInput({ input_id: "a", metric: "EBITDA", value: 18.6, period: "FY2025", basis: "adjusted" }),
      makeInput({ input_id: "b", metric: "EBITDA", value: 14.2, period: "FY2025", basis: "reported" }),
      makeInput({ input_id: "c", metric: "EBITDA", value: 15.1, period: "FY2025", basis: "gaap" }),
    ];
    expect(findResolvableBasisConflict(inputs)).toBeNull();
  });

  it("I. hard gates still win over an analyst GAAP selection", () => {
    // Offering the choice must not widen what a choice can authorise.
    const inputs = adjustedGaapConflictInputs().map((input) =>
      input.input_id === "c_ebitda_reported"
        ? { ...input, precision: "approximate" as const }
        : input,
    );

    // Still offerable — precision is not part of the detector's contract.
    expect(findResolvableBasisConflict(inputs)).not.toBeNull();

    // But not executable: approximate is a universal gate the analyst cannot relax.
    const r = bySkill(runSkills(inputs, gaapComparator), "skill_ev_ebitda");
    expect(r.status).not.toBe("READY");
    expect(r.value).toBeUndefined();
  });
});
