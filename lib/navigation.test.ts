import { describe, expect, it } from "vitest";

import { applyCorrections } from "./corrections/apply-corrections";
import { parseCorrection } from "./corrections/schema";
import { makeInput, reportAInputs, reportCInputs } from "./skills/fixtures";
import {
  buildNavigation,
  getLensContent,
  LENSES,
  LENS_IDS,
  NAVIGATION_GROUPS,
  primaryGroupForInput,
  primaryGroupForInsight,
  type LensId,
} from "./navigation";
import type { AnalysisResponse } from "@/types/analytical-input";

type Insight = AnalysisResponse["insights"][number];

function insight(
  id: string,
  category: Insight["category"],
  label = `${category} label`,
): Insight {
  return { id, category, label, summary: "s", sourceText: "evidence text" };
}

const INSIGHTS: Insight[] = [
  insight("in_business", "business"),
  insight("in_risk", "risk"),
  insight("in_timeline", "timeline"),
  insight("in_assumption", "assumption"),
];

/** Report-B-shaped fixture: historical actuals plus forward-looking values. */
function reportBInputs() {
  return [
    makeInput({ input_id: "b_rev25", metric: "Revenue", value: 101, period: "FY2025", temporal_type: "actual" }),
    makeInput({ input_id: "b_ebitda25", metric: "EBITDA", value: 18.6, period: "FY2025", temporal_type: "actual", basis: "adjusted" }),
    makeInput({ input_id: "b_rev26", metric: "Revenue", value: 128, period: "FY2026", temporal_type: "forecast", precision: "approximate" }),
    makeInput({ input_id: "b_ebitda26", metric: "EBITDA", value: 25, period: "FY2026", temporal_type: "guidance", basis: "adjusted" }),
    makeInput({ input_id: "b_target", metric: "Revenue", value: 150, period: "within two years", temporal_type: "target", precision: "approximate" }),
    makeInput({ input_id: "b_assume", metric: "EBITDA", value: 20, period: "FY2027", temporal_type: "assumption", basis: "adjusted" }),
  ];
}

const ids = (items: { target: { id: string } }[]) => items.map((i) => i.target.id);
const groupNames = (groups: { name: string }[]) => groups.map((g) => g.name);

/* ------------------------------------------------------------------ *
 * Lens catalog
 * ------------------------------------------------------------------ */

describe("lens catalog", () => {
  it("has exactly five lens ids", () => {
    expect(LENS_IDS).toHaveLength(5);
    expect(LENSES).toHaveLength(5);
  });

  it("has no duplicates", () => {
    expect(new Set(LENS_IDS).size).toBe(5);
  });

  it("is in the expected order", () => {
    expect([...LENS_IDS]).toEqual([
      "all",
      "financials",
      "risks",
      "timeline",
      "assumptions",
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * Lens filtering
 * ------------------------------------------------------------------ */

describe("lens filtering", () => {
  const inputs = reportBInputs();

  it("All returns every effective input and every insight", () => {
    const c = getLensContent("all", inputs, INSIGHTS);
    expect(c.inputs).toHaveLength(inputs.length);
    expect(c.insights).toHaveLength(INSIGHTS.length);
  });

  it("Financials returns every effective input and no insights", () => {
    const c = getLensContent("financials", inputs, INSIGHTS);
    expect(c.inputs).toHaveLength(inputs.length);
    expect(c.insights).toHaveLength(0);
  });

  it("Risks returns only risk insights and no inputs", () => {
    const c = getLensContent("risks", inputs, INSIGHTS);
    expect(c.inputs).toHaveLength(0);
    expect(c.insights.map((i) => i.id)).toEqual(["in_risk"]);
  });

  it("Timeline returns only timeline insights and no inputs", () => {
    const c = getLensContent("timeline", inputs, INSIGHTS);
    expect(c.inputs).toHaveLength(0);
    expect(c.insights.map((i) => i.id)).toEqual(["in_timeline"]);
  });

  it("Assumptions returns assumption insights", () => {
    const c = getLensContent("assumptions", inputs, INSIGHTS);
    expect(c.insights.map((i) => i.id)).toEqual(["in_assumption"]);
  });

  it("Assumptions returns forecast, guidance, target and assumption inputs", () => {
    const c = getLensContent("assumptions", inputs, INSIGHTS);
    expect(c.inputs.map((i) => i.input_id).sort()).toEqual(
      ["b_assume", "b_ebitda26", "b_rev26", "b_target"].sort(),
    );
  });

  it("Assumptions excludes historical actual inputs", () => {
    const c = getLensContent("assumptions", inputs, INSIGHTS);
    expect(c.inputs.every((i) => i.temporal_type !== "actual")).toBe(true);
    expect(c.inputs.map((i) => i.input_id)).not.toContain("b_rev25");
  });

  it("does not mutate the input or insight arrays", () => {
    const beforeInputs = JSON.stringify(inputs);
    const beforeInsights = JSON.stringify(INSIGHTS);
    for (const lens of LENS_IDS) getLensContent(lens as LensId, inputs, INSIGHTS);
    expect(JSON.stringify(inputs)).toBe(beforeInputs);
    expect(JSON.stringify(INSIGHTS)).toBe(beforeInsights);
  });
});

/* ------------------------------------------------------------------ *
 * Corrections are reflected
 * ------------------------------------------------------------------ */

describe("corrected values flow through lenses", () => {
  const original = reportAInputs();
  const corrected = applyCorrections(original, {
    a_rev25: parseCorrection({
      inputId: "a_rev25",
      changes: { value: 100 },
      correctedAt: "t",
    })!,
  });

  it("Financials shows the corrected effective value", () => {
    const c = getLensContent("financials", corrected, []);
    expect(c.inputs.find((i) => i.input_id === "a_rev25")!.value).toBe(100);
  });

  it("All shows the corrected effective value", () => {
    const c = getLensContent("all", corrected, []);
    expect(c.inputs.find((i) => i.input_id === "a_rev25")!.value).toBe(100);
  });

  it("the original input object remains unchanged", () => {
    expect(original.find((i) => i.input_id === "a_rev25")!.value).toBe(101);
  });

  it("navigation targets the same input id after correction", () => {
    const nav = buildNavigation(getLensContent("financials", corrected, []));
    const all = nav.flatMap((g) => ids(g.items));
    expect(all).toContain("a_rev25");
  });
});

/* ------------------------------------------------------------------ *
 * Primary grouping
 * ------------------------------------------------------------------ */

describe("primary grouping", () => {
  it("maps insight categories to their groups", () => {
    expect(primaryGroupForInsight(insight("a", "business"))).toBe("Business");
    expect(primaryGroupForInsight(insight("b", "risk"))).toBe("Risks");
    expect(primaryGroupForInsight(insight("c", "timeline"))).toBe("Timeline");
    expect(primaryGroupForInsight(insight("d", "assumption"))).toBe("Assumptions");
  });

  it("assumption temporal input goes to Assumptions", () => {
    expect(
      primaryGroupForInput(
        makeInput({ metric: "EBITDA", temporal_type: "assumption" }),
      ),
    ).toBe("Assumptions");
  });

  it("forecast, guidance and target inputs go to Growth / Outlook", () => {
    for (const t of ["forecast", "guidance", "target"] as const) {
      expect(
        primaryGroupForInput(makeInput({ metric: "Revenue", temporal_type: t })),
      ).toBe("Growth / Outlook");
    }
  });

  it("Enterprise Value goes to Valuation", () => {
    expect(
      primaryGroupForInput(
        makeInput({ metric: "Enterprise Value", basis: "not_applicable" }),
      ),
    ).toBe("Valuation");
  });

  it("historical Revenue and EBITDA go to Financials", () => {
    expect(primaryGroupForInput(makeInput({ metric: "Revenue" }))).toBe("Financials");
    expect(
      primaryGroupForInput(makeInput({ metric: "Adjusted EBITDA", basis: "adjusted" })),
    ).toBe("Financials");
  });

  it("each item appears exactly once across all groups", () => {
    const nav = buildNavigation(getLensContent("all", reportBInputs(), INSIGHTS));
    const all = nav.flatMap((g) => ids(g.items));
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(reportBInputs().length + INSIGHTS.length);
  });

  it("omits empty groups", () => {
    const nav = buildNavigation(getLensContent("risks", reportBInputs(), INSIGHTS));
    expect(groupNames(nav)).toEqual(["Risks"]);
  });

  it("emits groups in stable order regardless of source order", () => {
    const forward = buildNavigation(
      getLensContent("all", reportBInputs(), INSIGHTS),
    );
    const reversed = buildNavigation(
      getLensContent("all", [...reportBInputs()].reverse(), [...INSIGHTS].reverse()),
    );
    expect(groupNames(reversed)).toEqual(groupNames(forward));
    for (const group of groupNames(forward)) {
      const a = forward.find((g) => g.name === group)!;
      const b = reversed.find((g) => g.name === group)!;
      expect(ids(b.items).sort()).toEqual(ids(a.items).sort());
    }
  });

  it("group order follows the canonical catalog", () => {
    const nav = buildNavigation(getLensContent("all", reportBInputs(), INSIGHTS));
    const canonical = NAVIGATION_GROUPS.filter((n) =>
      groupNames(nav).includes(n),
    );
    expect(groupNames(nav)).toEqual([...canonical]);
  });
});

/* ------------------------------------------------------------------ *
 * Navigation follows the active lens
 * ------------------------------------------------------------------ */

describe("navigation follows the current lens", () => {
  const inputs = reportBInputs();

  it("Risks navigation contains only risk content", () => {
    const nav = buildNavigation(getLensContent("risks", inputs, INSIGHTS));
    expect(groupNames(nav)).toEqual(["Risks"]);
    expect(nav[0].items.every((i) => i.target.kind === "insight")).toBe(true);
  });

  it("Timeline navigation contains only timeline content", () => {
    const nav = buildNavigation(getLensContent("timeline", inputs, INSIGHTS));
    expect(groupNames(nav)).toEqual(["Timeline"]);
  });

  it("Assumptions navigation contains only assumption and outlook content", () => {
    const nav = buildNavigation(getLensContent("assumptions", inputs, INSIGHTS));
    expect(groupNames(nav).sort()).toEqual(["Assumptions", "Growth / Outlook"]);
  });

  it("Financials navigation contains no insight items", () => {
    const nav = buildNavigation(getLensContent("financials", inputs, INSIGHTS));
    const targets = nav.flatMap((g) => g.items.map((i) => i.target.kind));
    expect(targets).not.toContain("insight");
  });

  it("All navigation contains every applicable non-empty group", () => {
    const nav = buildNavigation(getLensContent("all", inputs, INSIGHTS));
    expect(groupNames(nav)).toEqual([
      "Business",
      "Financials",
      "Growth / Outlook",
      "Risks",
      "Timeline",
      "Assumptions",
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * Report-shaped behaviour
 * ------------------------------------------------------------------ */

describe("Report B shape", () => {
  const inputs = reportBInputs();

  it("FY2025 actual Revenue groups under Financials", () => {
    expect(
      primaryGroupForInput(inputs.find((i) => i.input_id === "b_rev25")!),
    ).toBe("Financials");
  });

  it("FY2026 forecast Revenue groups under Growth / Outlook", () => {
    expect(
      primaryGroupForInput(inputs.find((i) => i.input_id === "b_rev26")!),
    ).toBe("Growth / Outlook");
  });

  it("FY2026 forward EBITDA groups under Growth / Outlook", () => {
    expect(
      primaryGroupForInput(inputs.find((i) => i.input_id === "b_ebitda26")!),
    ).toBe("Growth / Outlook");
  });

  it("longer-term target Revenue groups under Growth / Outlook", () => {
    expect(
      primaryGroupForInput(inputs.find((i) => i.input_id === "b_target")!),
    ).toBe("Growth / Outlook");
  });

  it("the Assumptions lens surfaces the forward-looking inputs", () => {
    const c = getLensContent("assumptions", inputs, INSIGHTS);
    for (const id of ["b_rev26", "b_ebitda26", "b_target", "b_assume"]) {
      expect(c.inputs.map((i) => i.input_id)).toContain(id);
    }
  });

  it("forward-looking inputs still appear in the Financials lens", () => {
    // Lens membership and primary navigation group are distinct concepts.
    const c = getLensContent("financials", inputs, INSIGHTS);
    expect(c.inputs.map((i) => i.input_id)).toContain("b_rev26");
  });
});

describe("Report C conflict shape", () => {
  const inputs = reportCInputs();

  it("both competing EBITDA definitions appear in Financials content", () => {
    const c = getLensContent("financials", inputs, []);
    const found = c.inputs.map((i) => i.input_id);
    expect(found).toContain("c_ebitda_adj");
    expect(found).toContain("c_ebitda_reported");
  });

  it("each gets a distinct navigation target", () => {
    const nav = buildNavigation(getLensContent("financials", inputs, []));
    const all = nav.flatMap((g) => ids(g.items));
    expect(all.filter((id) => id === "c_ebitda_adj")).toHaveLength(1);
    expect(all.filter((id) => id === "c_ebitda_reported")).toHaveLength(1);
  });

  it("filtering does not mutate conflict or trust state", () => {
    const before = JSON.stringify(inputs);
    for (const lens of LENS_IDS) {
      buildNavigation(getLensContent(lens as LensId, inputs, []));
    }
    expect(JSON.stringify(inputs)).toBe(before);
    const adj = inputs.find((i) => i.input_id === "c_ebitda_adj")!;
    expect(adj.conflict_state).toBe("material_conflict");
    expect(adj.trust_state).toBe("ask");
  });
});
