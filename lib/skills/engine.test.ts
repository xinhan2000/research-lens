import { describe, expect, it } from "vitest";

import { runSkills } from "./engine";
import { metricFamily } from "./metric-family";
import { makeInput, reportAInputs, reportCInputs } from "./fixtures";
import type { SkillResult } from "./types";

function bySkill(results: SkillResult[], skillId: string): SkillResult {
  const result = results.find((r) => r.skillId === skillId);
  if (!result) throw new Error(`missing skill ${skillId}`);
  return result;
}

/* ------------------------------------------------------------------ *
 * Report A — happy path
 * ------------------------------------------------------------------ */

describe("Report A (Clean) deterministic results", () => {
  const results = runSkills(reportAInputs());

  it("Revenue Growth is READY at ~23.17%", () => {
    const r = bySkill(results, "skill_revenue_growth");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(0.2317073171, 9);
    expect(r.unit).toBe("percent");
    expect(r.inputIds).toEqual(["a_rev24", "a_rev25"]);
  });

  it("Gross Margin is READY at ~61.39%", () => {
    const r = bySkill(results, "skill_gross_margin");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(0.6138613861, 9);
  });

  it("EBITDA Margin is READY at ~18.42% and preserves the adjusted basis", () => {
    const r = bySkill(results, "skill_ebitda_margin");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(0.1841584158, 9);
    expect(r.label).toContain("Adjusted");
  });

  it("Net Debt is READY at 95 USD millions", () => {
    const r = bySkill(results, "skill_net_debt");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(95, 9);
    expect(r.unit).toBe("USD_millions");
  });

  it("EV / Revenue is READY at ~6.44x and preserves the period", () => {
    const r = bySkill(results, "skill_ev_revenue");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(6.4356435644, 9);
    expect(r.label).toBe("EV / FY2025 Revenue");
  });

  it("EV / EBITDA is READY at ~34.95x and preserves period plus basis", () => {
    const r = bySkill(results, "skill_ev_ebitda");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(34.9462365591, 9);
    expect(r.label).toBe("EV / FY2025 Adjusted EBITDA");
  });

  it("every READY result exposes formula and lineage", () => {
    for (const r of results) {
      expect(r.status).toBe("READY");
      expect(r.formula.length).toBeGreaterThan(0);
      expect(r.inputIds.length).toBeGreaterThan(0);
      expect(r.inputs.every((i) => i.label.length > 0)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Report C — the hero safety case
 * ------------------------------------------------------------------ */

describe("Report C (Conflict) EV / EBITDA safety", () => {
  const results = runSkills(reportCInputs());
  const evEbitda = bySkill(results, "skill_ev_ebitda");

  it("is NEEDS_REVIEW", () => {
    expect(evEbitda.status).toBe("NEEDS_REVIEW");
  });

  it("carries no numerical value", () => {
    expect(evEbitda.value).toBeUndefined();
  });

  it("does not compute either candidate multiple", () => {
    const serialized = JSON.stringify(evEbitda);
    expect(serialized).not.toContain("34.94");
    expect(serialized).not.toContain("45.77");
  });

  it("selects neither EBITDA basis automatically", () => {
    const bases = evEbitda.inputs
      .filter((i) => i.role === "EBITDA")
      .map((i) => i.basis);
    expect(bases).toContain("adjusted");
    expect(bases).toContain("reported");
  });

  it("explains that analyst review is required", () => {
    expect(evEbitda.reason ?? "").toMatch(/review/i);
  });
});

/* ------------------------------------------------------------------ *
 * Common gate behaviour
 * ------------------------------------------------------------------ */

describe("common safety gate", () => {
  it("missing required input is BLOCKED", () => {
    const inputs = reportAInputs().filter((i) => i.metric !== "Enterprise Value");
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("BLOCKED");
    expect(r.value).toBeUndefined();
  });

  it("trust_state ask produces NEEDS_REVIEW", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Gross Profit" ? { ...i, trust_state: "ask" as const } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_gross_margin");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
  });

  it("trust_state abstain produces BLOCKED", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Gross Profit" ? { ...i, trust_state: "abstain" as const } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_gross_margin");
    expect(r.status).toBe("BLOCKED");
  });

  it("evidence_type none produces BLOCKED", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Cash"
        ? { ...i, evidence_type: "none" as const, resolved: false }
        : i,
    );
    const r = bySkill(runSkills(inputs), "skill_net_debt");
    expect(r.status).toBe("BLOCKED");
  });

  it("material_conflict produces NEEDS_REVIEW", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Revenue" && i.period === "FY2025"
        ? { ...i, conflict_state: "material_conflict" as const }
        : i,
    );
    const r = bySkill(runSkills(inputs), "skill_gross_margin");
    expect(r.status).toBe("NEEDS_REVIEW");
  });

  it("no non-READY result ever carries a numerical value", () => {
    const scenarios = [
      runSkills(reportCInputs()),
      runSkills([]),
      runSkills(reportAInputs().filter((i) => i.metric !== "Revenue")),
    ];
    for (const results of scenarios) {
      for (const r of results) {
        if (r.status !== "READY") {
          expect(r.value).toBeUndefined();
          expect(r.unit).toBeUndefined();
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * Semantic compatibility
 * ------------------------------------------------------------------ */

describe("semantic compatibility", () => {
  it("FY2025 + Q4 FY2025 is not READY for a same-period skill", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Gross Profit" ? { ...i, period: "Q4 FY2025" } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_gross_margin");
    expect(r.status).not.toBe("READY");
    expect(r.value).toBeUndefined();
  });

  it("actual + forecast mismatch is not READY", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Gross Profit" ? { ...i, temporal_type: "forecast" as const } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_gross_margin");
    expect(r.status).not.toBe("READY");
  });

  it("currency mismatch is BLOCKED", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Cash" ? { ...i, currency: "EUR" } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_net_debt");
    expect(r.status).toBe("BLOCKED");
    expect(r.reason ?? "").toMatch(/currenc/i);
  });

  it("approximate input is not consumed as exact", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Gross Profit" ? { ...i, precision: "approximate" as const } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_gross_margin");
    expect(r.status).not.toBe("READY");
  });

  it("a range input is never collapsed to a midpoint", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "EBITDA"
        ? {
            ...i,
            value: null,
            precision: "range" as const,
            range: { min: 24, max: 26 },
          }
        : i,
    );
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).not.toBe("READY");
    expect(r.value).toBeUndefined();
    // 650 / 25 = 26 would be the midpoint result. It must not appear.
    expect(JSON.stringify(r)).not.toContain("\"value\":26");
  });

  it("unresolved EBITDA basis is not silently used", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "EBITDA" ? { ...i, basis: "unknown" as const } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).not.toBe("READY");
  });

  it("a forward-looking denominator is skipped in favour of an eligible actual", () => {
    // Updated for the eligibility-before-recency policy. Previously this
    // asserted BLOCKED, which encoded the old mechanism: the later forecast
    // won the recency ranking and was only rejected afterwards. Eligibility
    // now runs first, so the FY2024 actual is used and the forecast is never
    // a candidate.
    const inputs = reportAInputs().map((i) =>
      i.metric === "Revenue" && i.period === "FY2025"
        ? { ...i, temporal_type: "forecast" as const }
        : i,
    );
    const r = bySkill(runSkills(inputs), "skill_ev_revenue");
    expect(r.status).toBe("READY");
    expect(r.label).toBe("EV / FY2024 Revenue");
    expect(r.value).toBeCloseTo(650 / 82, 9);
    // The forecast value must not appear in the lineage.
    expect(r.inputs.every((i) => i.temporalType === "actual")).toBe(true);
  });

  it("blocks when every denominator candidate is forward-looking", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Revenue" ? { ...i, temporal_type: "forecast" as const } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_ev_revenue");
    expect(r.status).toBe("BLOCKED");
    expect(r.value).toBeUndefined();
    expect(r.reason ?? "").toMatch(/not actual/i);
  });

  it("zero denominator is BLOCKED rather than Infinity", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Revenue" && i.period === "FY2025" ? { ...i, value: 0 } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_gross_margin");
    expect(r.status).toBe("BLOCKED");
  });
});

/* ------------------------------------------------------------------ *
 * Enterprise Value semantics
 *
 * EV is stated as of the report date, so live inference may legitimately
 * return it with an unresolved period and temporal type. Requiring those of
 * every monetary input would wrongly block the two EV multiples.
 * ------------------------------------------------------------------ */

describe("Enterprise Value with unresolved period semantics", () => {
  /** EV as live inference may reasonably return it. */
  function unresolvedEv(period: string | null) {
    return makeInput({
      input_id: "ev_unresolved",
      metric: "Enterprise Value",
      value: 650.0,
      period,
      temporal_type: "unknown",
      basis: "not_applicable",
    });
  }

  it("EV / Revenue is READY when only the EV period is unresolved (null)", () => {
    const inputs = [
      ...reportAInputs().filter((i) => i.metric !== "Enterprise Value"),
      unresolvedEv(null),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_revenue");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(6.4356435644, 9);
    expect(r.label).toBe("EV / FY2025 Revenue");
  });

  it('EV / Revenue is READY when the EV period is the string "unknown"', () => {
    const inputs = [
      ...reportAInputs().filter((i) => i.metric !== "Enterprise Value"),
      unresolvedEv("unknown"),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_revenue");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(6.4356435644, 9);
  });

  it("EV / EBITDA is READY with an unresolved EV period and preserves the denominator semantics", () => {
    const inputs = [
      ...reportAInputs().filter((i) => i.metric !== "Enterprise Value"),
      unresolvedEv(null),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(34.9462365591, 9);
    expect(r.label).toBe("EV / FY2025 Adjusted EBITDA");
  });

  it("Report C stays NEEDS_REVIEW with an unresolved EV period, not BLOCKED", () => {
    const inputs = [
      ...reportCInputs().filter((i) => i.metric !== "Enterprise Value"),
      unresolvedEv(null),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain("34.94");
    expect(JSON.stringify(r)).not.toContain("45.77");
  });

  it("a missing Revenue period still BLOCKS EV / Revenue", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "Revenue" ? { ...i, period: null } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_ev_revenue");
    expect(r.status).toBe("BLOCKED");
    expect(r.value).toBeUndefined();
  });

  it("a missing EBITDA period still BLOCKS EV / EBITDA", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "EBITDA" ? { ...i, period: null } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("BLOCKED");
    expect(r.value).toBeUndefined();
  });

  it("an unresolved EBITDA basis still BLOCKS EV / EBITDA", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "EBITDA" ? { ...i, basis: "unknown" as const } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("BLOCKED");
    expect(r.value).toBeUndefined();
  });

  it("an unresolved EBITDA temporal type still BLOCKS EV / EBITDA", () => {
    const inputs = reportAInputs().map((i) =>
      i.metric === "EBITDA" ? { ...i, temporal_type: "unknown" as const } : i,
    );
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("BLOCKED");
  });

  it("universal safety still applies to EV: abstain trust is BLOCKED", () => {
    const inputs = [
      ...reportAInputs().filter((i) => i.metric !== "Enterprise Value"),
      makeInput({
        input_id: "ev_abstain",
        metric: "Enterprise Value",
        value: 650.0,
        period: null,
        temporal_type: "unknown",
        trust_state: "abstain",
        resolved: false,
      }),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_revenue");
    expect(r.status).toBe("BLOCKED");
  });

  it("universal safety still applies to EV: no evidence is BLOCKED", () => {
    const inputs = [
      ...reportAInputs().filter((i) => i.metric !== "Enterprise Value"),
      makeInput({
        input_id: "ev_noevidence",
        metric: "Enterprise Value",
        value: 650.0,
        period: null,
        temporal_type: "unknown",
        evidence_type: "none",
        resolved: false,
      }),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_revenue");
    expect(r.status).toBe("BLOCKED");
  });
});

/* ------------------------------------------------------------------ *
 * Eligibility before recency, and Net Debt qualifier scope
 * ------------------------------------------------------------------ */

describe("eligibility precedes latest-period ranking", () => {
  const ev = () =>
    makeInput({ input_id: "ev", metric: "Enterprise Value", value: 650, period: null, temporal_type: "unknown", basis: "not_applicable" });

  const rev25 = () =>
    makeInput({ input_id: "rev25", metric: "Revenue", value: 101, period: "FY2025", temporal_type: "actual" });
  const rev26Forecast = () =>
    makeInput({ input_id: "rev26", metric: "Revenue", value: 128, period: "FY2026", temporal_type: "forecast" });

  it("uses FY2025 actual rather than the later FY2026 forecast", () => {
    const r = bySkill(runSkills([ev(), rev25(), rev26Forecast()]), "skill_ev_revenue");
    expect(r.status).toBe("READY");
    expect(r.label).toBe("EV / FY2025 Revenue");
    expect(r.value).toBeCloseTo(650 / 101, 9);
    expect(r.inputIds).toContain("rev25");
    expect(r.inputIds).not.toContain("rev26");
  });

  it("gives the identical result with the input array reversed", () => {
    const forward = bySkill(runSkills([ev(), rev25(), rev26Forecast()]), "skill_ev_revenue");
    const reversed = bySkill(runSkills([rev26Forecast(), rev25(), ev()]), "skill_ev_revenue");
    expect(reversed.status).toBe(forward.status);
    expect(reversed.label).toBe(forward.label);
    expect(reversed.value).toBeCloseTo(forward.value!, 12);
    expect(reversed.inputIds).toEqual(forward.inputIds);
  });

  it("same-period competing Revenue definitions are NEEDS_REVIEW, not escaped via the forecast", () => {
    const competing = makeInput({
      input_id: "rev25_alt", metric: "Revenue", value: 96, period: "FY2025",
      temporal_type: "actual", basis: "pro_forma",
    });
    const r = bySkill(
      runSkills([ev(), rev25(), competing, rev26Forecast()]),
      "skill_ev_revenue",
    );
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
    // Must not resolve the ambiguity by reaching for the forecast.
    expect(r.inputIds).not.toContain("rev26");
  });

  it("EV / EBITDA uses FY2025 actual adjusted rather than the FY2026 forecast", () => {
    const inputs = [
      ev(),
      makeInput({ input_id: "e25", metric: "EBITDA", value: 18.6, period: "FY2025", temporal_type: "actual", basis: "adjusted" }),
      makeInput({ input_id: "e26", metric: "EBITDA", value: 25, period: "FY2026", temporal_type: "forecast", basis: "adjusted" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("READY");
    expect(r.label).toBe("EV / FY2025 Adjusted EBITDA");
    expect(r.value).toBeCloseTo(650 / 18.6, 9);
    expect(r.inputIds).not.toContain("e26");
  });

  it("same-period competing EBITDA definitions stay NEEDS_REVIEW despite a later forecast", () => {
    const inputs = [
      ev(),
      makeInput({ input_id: "e_adj", metric: "EBITDA", value: 18.6, period: "FY2025", temporal_type: "actual", basis: "adjusted" }),
      makeInput({ input_id: "e_rep", metric: "EBITDA", value: 14.2, period: "FY2025", temporal_type: "actual", basis: "reported" }),
      makeInput({ input_id: "e26", metric: "EBITDA", value: 25, period: "FY2026", temporal_type: "forecast", basis: "adjusted" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
    expect(r.inputIds).not.toContain("e26");
  });
});

describe("Net Debt qualifier scope", () => {
  const debt = (over = {}) =>
    makeInput({ input_id: "debt", metric: "Total Debt", value: 125, period: "FY2025", temporal_type: "unknown", ...over });
  const cash = (over = {}) =>
    makeInput({ input_id: "cash", metric: "Cash", value: 30, period: "FY2025", temporal_type: "unknown", ...over });

  it("is READY with a shared period even when temporal type is unresolved", () => {
    const r = bySkill(runSkills([debt(), cash()]), "skill_net_debt");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(95, 9);
    expect(r.unit).toBe("USD_millions");
    // Nothing was promoted to "actual" to make this work.
    expect(r.inputs.every((i) => i.temporalType === "unknown")).toBe(true);
  });

  it("is BLOCKED when the periods differ", () => {
    const r = bySkill(
      runSkills([debt(), cash({ period: "Q4 FY2025" })]),
      "skill_net_debt",
    );
    expect(r.status).toBe("BLOCKED");
    expect(r.value).toBeUndefined();
  });

  it("is BLOCKED when universal safety fails (no evidence)", () => {
    const r = bySkill(
      runSkills([debt(), cash({ evidence_type: "none", resolved: false })]),
      "skill_net_debt",
    );
    expect(r.status).toBe("BLOCKED");
    expect(r.value).toBeUndefined();
  });

  it("is BLOCKED when currencies differ", () => {
    const r = bySkill(runSkills([debt(), cash({ currency: "EUR" })]), "skill_net_debt");
    expect(r.status).toBe("BLOCKED");
  });

  it("is BLOCKED when a period is missing entirely", () => {
    const r = bySkill(runSkills([debt({ period: null }), cash()]), "skill_net_debt");
    expect(r.status).toBe("BLOCKED");
  });
});

/* ------------------------------------------------------------------ *
 * Metric families — basis-qualified labels from live inference
 *
 * Live Clean output returned metric = "Adjusted EBITDA" (with basis
 * "adjusted"), which is valid per SI-2/SI-8. These tests use that real shape.
 * ------------------------------------------------------------------ */

describe("EBITDA metric family", () => {
  const revenue = () =>
    makeInput({ input_id: "rev", metric: "Revenue", value: 101, period: "FY2025" });
  const ev = () =>
    makeInput({ input_id: "ev", metric: "Enterprise Value", value: 650, period: null, temporal_type: "unknown", basis: "not_applicable" });
  /** Exactly the live shape observed on the Clean report. */
  const adjustedEbitda = (over = {}) =>
    makeInput({ input_id: "ebitda_adj", metric: "Adjusted EBITDA", value: 18.6, period: "FY2025", temporal_type: "actual", basis: "adjusted", ...over });

  it('EBITDA Margin is READY from metric "Adjusted EBITDA"', () => {
    const r = bySkill(runSkills([revenue(), adjustedEbitda()]), "skill_ebitda_margin");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(0.1841584158, 9);
    expect(r.label).toBe("FY2025 Adjusted EBITDA Margin");
  });

  it('EV / EBITDA is READY from metric "Adjusted EBITDA"', () => {
    const r = bySkill(runSkills([ev(), adjustedEbitda()]), "skill_ev_ebitda");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(34.9462365591, 9);
    // The basis must appear exactly once, not doubled by the metric label.
    expect(r.label).toBe("EV / FY2025 Adjusted EBITDA");
  });

  it('plain metric "EBITDA" with basis adjusted still works', () => {
    const plain = makeInput({ input_id: "ebitda_plain", metric: "EBITDA", value: 18.6, period: "FY2025", temporal_type: "actual", basis: "adjusted" });
    const margin = bySkill(runSkills([revenue(), plain]), "skill_ebitda_margin");
    const multiple = bySkill(runSkills([ev(), plain]), "skill_ev_ebitda");
    expect(margin.status).toBe("READY");
    expect(margin.label).toBe("FY2025 Adjusted EBITDA Margin");
    expect(multiple.status).toBe("READY");
    expect(multiple.label).toBe("EV / FY2025 Adjusted EBITDA");
  });

  it('competing "Adjusted EBITDA" and "Reported EBITDA" stay NEEDS_REVIEW', () => {
    const inputs = [
      ev(),
      makeInput({ input_id: "c_adj", metric: "Adjusted EBITDA", value: 18.6, period: "FY2025", temporal_type: "actual", basis: "adjusted" }),
      makeInput({ input_id: "c_rep", metric: "Reported EBITDA", value: 14.2, period: "FY2025", temporal_type: "actual", basis: "reported" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain("34.94");
    expect(JSON.stringify(r)).not.toContain("45.77");
    expect(r.inputIds).toEqual(expect.arrayContaining(["c_adj", "c_rep"]));
  });

  it("Report C live shape with conflict flags stays NEEDS_REVIEW", () => {
    const inputs = [
      ev(),
      makeInput({ input_id: "c_adj", metric: "Adjusted EBITDA", value: 18.6, period: "FY2025", temporal_type: "actual", basis: "adjusted", conflict_state: "material_conflict", trust_state: "ask", resolved: false }),
      makeInput({ input_id: "c_rep", metric: "Reported EBITDA", value: 14.2, period: "FY2025", temporal_type: "actual", basis: "reported", conflict_state: "material_conflict", trust_state: "ask", resolved: false }),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.value).toBeUndefined();
  });

  it('"EBITDA Margin" is not an EBITDA scalar candidate', () => {
    const inputs = [
      ev(),
      makeInput({ input_id: "not_ebitda", metric: "EBITDA Margin", value: 18.4, period: "FY2025", temporal_type: "actual", basis: "adjusted" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("BLOCKED");
    expect(r.value).toBeUndefined();
    expect(r.inputIds).not.toContain("not_ebitda");
  });

  it('"EBITDA Guidance Commentary" is not an EBITDA candidate (no substring matching)', () => {
    const inputs = [
      ev(),
      makeInput({ input_id: "commentary", metric: "EBITDA Guidance Commentary", value: 25, period: "FY2025", temporal_type: "actual", basis: "adjusted" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_ev_ebitda");
    expect(r.status).toBe("BLOCKED");
    expect(r.inputIds).not.toContain("commentary");
  });

  it("family lookup is exact, not substring", () => {
    expect(metricFamily("Adjusted EBITDA")).toBe("EBITDA");
    expect(metricFamily("  reported   ebitda  ")).toBe("EBITDA");
    expect(metricFamily("EBITDA Margin")).toBeNull();
    expect(metricFamily("EBITDA Guidance Commentary")).toBeNull();
    expect(metricFamily("Adjusted EBITDA Margin")).toBeNull();
    expect(metricFamily("Revenue Growth")).toBeNull();
    expect(metricFamily("Cash and Cash Equivalents")).toBe("Cash");
  });
});

/* ------------------------------------------------------------------ *
 * Cash metric family — live naming variants
 *
 * Live Clean output returned metric = "Cash and Equivalents" with
 * period = "FY2025 year-end". Both are legitimate structured-output
 * representations of the same balance-sheet concept.
 * ------------------------------------------------------------------ */

describe("Cash metric family", () => {
  it('metricFamily("Cash and Equivalents") is Cash', () => {
    expect(metricFamily("Cash and Equivalents")).toBe("Cash");
  });

  it("all three Cash spellings map to the same family", () => {
    expect(metricFamily("Cash")).toBe("Cash");
    expect(metricFamily("Cash and Cash Equivalents")).toBe("Cash");
    expect(metricFamily("  cash   and   equivalents  ")).toBe("Cash");
  });

  it("Net Debt is READY from the exact live shape", () => {
    const inputs = [
      makeInput({
        input_id: "live_cash",
        metric: "Cash and Equivalents",
        value: 30,
        period: "FY2025 year-end",
        temporal_type: "actual",
        basis: "reported",
      }),
      makeInput({
        input_id: "live_debt",
        metric: "Total Debt",
        value: 125,
        period: "FY2025 year-end",
        temporal_type: "actual",
        basis: "reported",
      }),
    ];
    const r = bySkill(runSkills(inputs), "skill_net_debt");
    expect(r.status).toBe("READY");
    expect(r.value).toBeCloseTo(95, 9);
    expect(r.unit).toBe("USD_millions");
    expect(r.label).toBe("FY2025 year-end Net Debt");
  });

  it("lineage retains the actual Cash input id and raw label", () => {
    const inputs = [
      makeInput({ input_id: "live_cash", metric: "Cash and Equivalents", value: 30, period: "FY2025 year-end", temporal_type: "actual", basis: "reported" }),
      makeInput({ input_id: "live_debt", metric: "Total Debt", value: 125, period: "FY2025 year-end", temporal_type: "actual", basis: "reported" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_net_debt");
    expect(r.inputIds).toEqual(expect.arrayContaining(["live_cash", "live_debt"]));
    const cashRef = r.inputs.find((i) => i.inputId === "live_cash")!;
    expect(cashRef.role).toBe("Cash");
    expect(cashRef.value).toBeCloseTo(30, 9);
    expect(cashRef.period).toBe("FY2025 year-end");
    expect(cashRef.basis).toBe("reported");
  });

  it("family membership alone does not make an input executable", () => {
    // Same live label, but the input fails universal safety.
    const inputs = [
      makeInput({ input_id: "live_cash", metric: "Cash and Equivalents", value: 30, period: "FY2025 year-end", temporal_type: "actual", basis: "reported", evidence_type: "none", resolved: false }),
      makeInput({ input_id: "live_debt", metric: "Total Debt", value: 125, period: "FY2025 year-end", temporal_type: "actual", basis: "reported" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_net_debt");
    expect(r.status).toBe("BLOCKED");
    expect(r.value).toBeUndefined();
  });

  it("mismatched periods still BLOCK despite the alias resolving", () => {
    const inputs = [
      makeInput({ input_id: "live_cash", metric: "Cash and Equivalents", value: 30, period: "Q4 FY2025", temporal_type: "actual", basis: "reported" }),
      makeInput({ input_id: "live_debt", metric: "Total Debt", value: 125, period: "FY2025 year-end", temporal_type: "actual", basis: "reported" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_net_debt");
    expect(r.status).toBe("BLOCKED");
  });

  it('"Cash Flow" does not map to the Cash family', () => {
    expect(metricFamily("Cash Flow")).toBeNull();
    const inputs = [
      makeInput({ input_id: "cf", metric: "Cash Flow", value: 30, period: "FY2025", temporal_type: "actual" }),
      makeInput({ input_id: "debt", metric: "Total Debt", value: 125, period: "FY2025", temporal_type: "actual" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_net_debt");
    expect(r.status).toBe("BLOCKED");
    expect(r.inputIds).not.toContain("cf");
  });

  it('"Cash Margin" does not map to the Cash family', () => {
    expect(metricFamily("Cash Margin")).toBeNull();
    const inputs = [
      makeInput({ input_id: "cm", metric: "Cash Margin", value: 30, period: "FY2025", temporal_type: "actual" }),
      makeInput({ input_id: "debt", metric: "Total Debt", value: 125, period: "FY2025", temporal_type: "actual" }),
    ];
    const r = bySkill(runSkills(inputs), "skill_net_debt");
    expect(r.status).toBe("BLOCKED");
    expect(r.inputIds).not.toContain("cm");
  });

  it("other near-miss Cash labels remain unmapped", () => {
    for (const label of [
      "Cash Equivalents",
      "Net Cash",
      "Cash Balance",
      "Free Cash Flow",
      "Cash and Equivalents Margin",
    ]) {
      expect(metricFamily(label)).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ *
 * Scale and determinism
 * ------------------------------------------------------------------ */

describe("scale handling and determinism", () => {
  it("USD_thousands inputs produce the same results as USD_millions", () => {
    const thousands = reportAInputs().map((i) => ({
      ...i,
      value: i.value === null ? null : i.value * 1000,
      unit: "USD_thousands" as const,
    }));
    const millions = runSkills(reportAInputs());
    const scaled = runSkills(thousands);

    for (const skillId of [
      "skill_revenue_growth",
      "skill_gross_margin",
      "skill_ebitda_margin",
      "skill_net_debt",
      "skill_ev_revenue",
      "skill_ev_ebitda",
    ]) {
      const a = bySkill(millions, skillId);
      const b = bySkill(scaled, skillId);
      expect(b.status).toBe(a.status);
      expect(b.value).toBeCloseTo(a.value!, 9);
    }
  });

  it("identical inputs produce identical output twice", () => {
    const first = runSkills(reportAInputs());
    const second = runSkills(reportAInputs());
    expect(JSON.stringify(second.map(({ inputs, ...r }) => r))).toBe(
      JSON.stringify(first.map(({ inputs, ...r }) => r)),
    );
  });

  it("always returns the six MVP skills in a stable order", () => {
    expect(runSkills([]).map((r) => r.skillId)).toEqual([
      "skill_revenue_growth",
      "skill_gross_margin",
      "skill_ebitda_margin",
      "skill_net_debt",
      "skill_ev_revenue",
      "skill_ev_ebitda",
    ]);
  });

  it("does not implement CAGR", () => {
    expect(runSkills(reportAInputs()).some((r) => /cagr/i.test(r.skillId))).toBe(false);
  });
});
