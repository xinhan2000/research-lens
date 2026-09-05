import { describe, expect, it } from "vitest";

import { matchInputs } from "./matching";
import {
  cloneInput,
  addInput,
  fixtureAnalysis,
  goldenCase,
  patchInput,
} from "./test-helpers";

/**
 * AR — expected-to-actual matching.
 *
 * The load-bearing property: identity comes from metric family, period,
 * temporal type and basis — never from the value. A wrong number must still
 * find its expected field so the harness can say VALUE MISMATCH.
 */

function matchFor(documentId: Parameters<typeof goldenCase>[0], analysis = fixtureAnalysis(documentId)) {
  return matchInputs(goldenCase(documentId).expected_inputs, analysis.inputs);
}

describe("input matching", () => {
  it("18. matches expected FY2025 Revenue among several Revenue inputs", () => {
    const result = matchFor("report_a_clean");
    expect(result.expectedToActual.get("a_rev25")).toBe("in_a2");
    expect(result.expectedToActual.get("a_rev24")).toBe("in_a1");
    expect(result.extraActualInputIds).toEqual([]);
  });

  it("19. still matches when the value is wrong, so the diff is VALUE MISMATCH not MISSING", () => {
    const analysis = patchInput(fixtureAnalysis("report_a_clean"), "in_a2", {
      value: 1010,
    });
    const result = matchFor("report_a_clean", analysis);
    expect(result.expectedToActual.get("a_rev25")).toBe("in_a2");
    expect(result.matches.find((m) => m.expectedId === "a_rev25")?.status).toBe(
      "matched",
    );
  });

  it("20. keeps Report B actual, forecast and target separately matchable", () => {
    const result = matchFor("report_b_forecast");
    expect(result.expectedToActual.get("b_rev25")).toBe("in_b1");
    expect(result.expectedToActual.get("b_rev26")).toBe("in_b3");
    expect(result.expectedToActual.get("b_rev_target")).toBe("in_b5");
    expect(new Set([...result.expectedToActual.values()]).size).toBe(5);
  });

  it("21. keeps Report C adjusted and reported EBITDA separately matchable", () => {
    const result = matchFor("report_c_conflict");
    expect(result.expectedToActual.get("c_ebitda_adj")).toBe("in_c2");
    expect(result.expectedToActual.get("c_ebitda_reported")).toBe("in_c3");
  });

  it("22. keeps Report D FY2025 and Q4 FY2025 Revenue separately matchable", () => {
    const result = matchFor("report_d_failure");
    expect(result.expectedToActual.get("d_rev25")).toBe("in_d1");
    expect(result.expectedToActual.get("d_rev_q4")).toBe("in_d2");
  });

  it("23. never lets one actual input satisfy two expected inputs", () => {
    // Drop the FY2024 Revenue entirely; FY2025 must not stand in for it.
    const analysis = {
      ...fixtureAnalysis("report_a_clean"),
      inputs: fixtureAnalysis("report_a_clean").inputs.filter(
        (input) => input.input_id !== "in_a1",
      ),
    };
    const result = matchFor("report_a_clean", analysis);
    expect(result.expectedToActual.get("a_rev25")).toBe("in_a2");
    expect(result.expectedToActual.has("a_rev24")).toBe(false);
    expect(result.matches.find((m) => m.expectedId === "a_rev24")?.status).toBe(
      "missing",
    );
    expect([...result.actualToExpected.keys()]).not.toContain("in_a1");
  });

  it("24. returns ambiguous rather than guessing between tied candidates", () => {
    const base = fixtureAnalysis("report_a_clean");
    // A second FY2025 Revenue identical in every identity-bearing field.
    const twin = cloneInput(base, "in_a2", { input_id: "in_a2_twin", value: 99 });
    const result = matchFor("report_a_clean", addInput(base, twin));

    const match = result.matches.find((m) => m.expectedId === "a_rev25")!;
    expect(match.status).toBe("ambiguous");
    expect(match.status === "ambiguous" && match.candidateInputIds.sort()).toEqual([
      "in_a2",
      "in_a2_twin",
    ]);
    expect(result.expectedToActual.has("a_rev25")).toBe(false);
  });

  it("25. maps the Adjusted EBITDA alias onto the EBITDA family", () => {
    const result = matchFor("report_a_clean");
    // Ground Truth says "EBITDA"; the fixture says "Adjusted EBITDA".
    expect(result.expectedToActual.get("a_ebitda25")).toBe("in_a4");

    const reported = matchFor("report_c_conflict");
    // Ground Truth says "EBITDA"; the fixture says "Reported EBITDA".
    expect(reported.expectedToActual.get("c_ebitda_reported")).toBe("in_c3");
  });

  it("26. matches Cash variants only through the exact family table", () => {
    // "Cash and Equivalents" is a known family member.
    expect(matchFor("report_a_clean").expectedToActual.get("a_cash25")).toBe("in_a5");

    // A label outside the closed table has no family and matches nothing.
    const analysis = patchInput(fixtureAnalysis("report_a_clean"), "in_a5", {
      metric: "Unrestricted Cash Balance",
    });
    const result = matchFor("report_a_clean", analysis);
    expect(result.matches.find((m) => m.expectedId === "a_cash25")?.status).toBe(
      "missing",
    );
    expect(result.extraActualInputIds).toContain("in_a5");
  });

  it("26b. falls back to a weaker tier only when no stronger match exists", () => {
    // Basis flipped: no tier-1 match, but tier 2 still identifies the field.
    const analysis = patchInput(fixtureAnalysis("report_c_conflict"), "in_c2", {
      basis: "gaap",
    });
    const result = matchFor("report_c_conflict", analysis);
    const match = result.matches.find((m) => m.expectedId === "c_ebitda_adj")!;
    expect(match.status).toBe("matched");
    expect(match.status === "matched" && match.tier).toBe(2);
  });
});
