import { describe, expect, it } from "vitest";

import {
  compareValues,
  comparePeriods,
  economicQuantity,
  MAGNITUDE_CATASTROPHE_FACTOR,
  normalizePeriod,
  unitFamily,
} from "./normalization";

/**
 * AQ — normalization.
 *
 * The two halves are independent and stay independent: a period may normalize
 * without a unit changing meaning, and a unit label may differ without the
 * economic quantity moving.
 */

describe("period normalization", () => {
  it("8. treats report_date and report date as the same period", () => {
    expect(normalizePeriod("report_date")).toBe("report date");
    expect(comparePeriods("report_date", "report date").compatible).toBe(true);
  });

  it("9. treats within_two_years and within two years as the same period", () => {
    expect(comparePeriods("within_two_years", "within two years").compatible).toBe(
      true,
    );
    expect(comparePeriods("next_year", "next year").compatible).toBe(true);
  });

  it("10. normalizes case, whitespace and separators", () => {
    expect(comparePeriods("  FY2025 ", "fy2025").compatible).toBe(true);
    expect(comparePeriods("Q4  FY2025", "q4 fy2025").compatible).toBe(true);
    expect(normalizePeriod("")).toBeNull();
    expect(normalizePeriod("unknown")).toBeNull();
    expect(normalizePeriod(null)).toBeNull();
  });

  it("11. keeps FY2025 distinct from Q4 FY2025", () => {
    expect(comparePeriods("FY2025", "Q4 FY2025").compatible).toBe(false);
    expect(comparePeriods("Q4 FY2025", "FY2025").compatible).toBe(false);
    // Even for a point-in-time family with no competing quarter.
    expect(
      comparePeriods("FY2025", "Q4 FY2025", { metric: "Cash" }).compatible,
    ).toBe(false);
  });

  it("12. allows FY2025 year-end only for point-in-time metrics with no competing quarter", () => {
    // Balance-sheet metric, no competing quarter: compatible.
    const cash = comparePeriods("FY2025", "FY2025 year-end", { metric: "Cash" });
    expect(cash.compatible).toBe(true);
    expect(cash.compatible && cash.basisOfMatch).toBe("fiscal_year_end");

    // Flow metric: never compatible, because year-end would be a granularity claim.
    expect(
      comparePeriods("FY2025", "FY2025 year-end", { metric: "Revenue" }).compatible,
    ).toBe(false);

    // Competing quarter present: refuse rather than guess.
    expect(
      comparePeriods("FY2025", "FY2025 year-end", {
        metric: "Cash",
        competingQuarterYears: new Set([2025]),
      }).compatible,
    ).toBe(false);

    // Different fiscal year: never compatible.
    expect(
      comparePeriods("FY2024", "FY2025 year-end", { metric: "Cash" }).compatible,
    ).toBe(false);
  });
});

/**
 * Report-date aliasing.
 *
 * `period` is a free string, so the model can spell the same instant several
 * ways. The alias table collapses the known spellings and nothing else — these
 * tests exist to prove the table is CLOSED, not fuzzy. The negative cases matter
 * more than the positive ones: they are what a prefix-stripping or stop-word
 * implementation would get wrong.
 */
describe("report-date period aliasing", () => {
  const ALIASES = [
    "report_date",
    "report date",
    "Report Date",
    "as of report date",
    "as of the report date",
    "at report date",
    "at the report date",
    "  as   of   the   report-date  ",
  ];

  it.each(ALIASES)("normalizes %j to the canonical report date", (spelling) => {
    expect(normalizePeriod(spelling)).toBe("report date");
  });

  it("treats every alias pair as compatible, in both directions", () => {
    for (const left of ALIASES) {
      for (const right of ALIASES) {
        const forward = comparePeriods(left, right);
        expect(forward.compatible, `${left} vs ${right}`).toBe(true);
        expect(forward.compatible && forward.basisOfMatch).toBe("exact");
      }
    }
  });

  it("aliases without needing a metric family, unlike the year-end rule", () => {
    // The year-end rule is gated on a point-in-time family; this one is not,
    // because the phrases denote the same instant regardless of the metric.
    expect(comparePeriods("report_date", "as of report date").compatible).toBe(true);
    expect(
      comparePeriods("report_date", "as of report date", { metric: "Revenue" })
        .compatible,
    ).toBe(true);
  });

  const NOT_ALIASES = [
    // Different instants — a prefix-stripping rule would wrongly collapse these.
    "after report date",
    "before report date",
    "subsequent to report date",
    "prior to the report date",
    // A precision claim, not a timing one.
    "report date estimate",
    // A different concept that merely shares vocabulary.
    "date of report publication",
    // Substring traps.
    "report date fy2025",
    "fy2025 report date",
  ];

  it.each(NOT_ALIASES)("leaves %j distinct from the report date", (phrase) => {
    expect(normalizePeriod(phrase)).not.toBe("report date");
    expect(comparePeriods("report_date", phrase).compatible).toBe(false);
    expect(comparePeriods(phrase, "report date").compatible).toBe(false);
  });

  it("leaves unrelated periods untouched by the alias lookup", () => {
    expect(normalizePeriod("FY2025")).toBe("fy2025");
    expect(normalizePeriod("Q4 FY2025")).toBe("q4 fy2025");
    expect(normalizePeriod("within_two_years")).toBe("within two years");
    expect(normalizePeriod("next_year")).toBe("next year");
    expect(normalizePeriod("FY2025 year-end")).toBe("fy2025 year end");
  });
});

describe("value and unit normalization", () => {
  it("13. normalizes USD_thousands", () => {
    expect(economicQuantity(101000, "USD_thousands")).toBeCloseTo(101, 12);
  });

  it("14. normalizes USD_millions and USD_billions", () => {
    expect(economicQuantity(101, "USD_millions")).toBe(101);
    expect(economicQuantity(0.65, "USD_billions")).toBeCloseTo(650, 12);
    expect(economicQuantity(101_000_000, "USD")).toBeCloseTo(101, 6);
  });

  it("15. treats 101000 thousands and 101 millions as the same economic quantity", () => {
    const comparison = compareValues(
      { value: 101000, unit: "USD_thousands" },
      { value: 101, unit: "USD_millions" },
    );
    expect(comparison.economicMatch).toBe(true);
    expect(comparison.unitMatch).toBe(false);
    expect(comparison.magnitudeCatastrophe).toBe(false);
  });

  it("16. flags 101000 millions against 101 millions as a magnitude catastrophe", () => {
    const comparison = compareValues(
      { value: 101, unit: "USD_millions" },
      { value: 101000, unit: "USD_millions" },
    );
    expect(comparison.economicMatch).toBe(false);
    expect(comparison.unitMatch).toBe(true);
    expect(comparison.magnitudeRatio).toBeCloseTo(1000, 6);
    expect(comparison.magnitudeCatastrophe).toBe(true);
  });

  it("16b. does not call a merely inaccurate number a catastrophe", () => {
    const comparison = compareValues(
      { value: 101, unit: "USD_millions" },
      { value: 110, unit: "USD_millions" },
    );
    expect(comparison.economicMatch).toBe(false);
    expect(comparison.magnitudeCatastrophe).toBe(false);
    expect(MAGNITUDE_CATASTROPHE_FACTOR).toBe(100);
  });

  it("17. never normalizes across unit families", () => {
    expect(unitFamily("percent")).toBe("percent");
    expect(unitFamily("multiple")).toBe("multiple");
    expect(unitFamily("USD_thousands")).toBe("monetary");

    const crossFamily = compareValues(
      { value: 23.2, unit: "percent" },
      { value: 23.2, unit: "USD_millions" },
    );
    expect(crossFamily.comparable).toBe(false);
    expect(crossFamily.economicMatch).toBe(false);
    expect(crossFamily.unitFamilyMatch).toBe(false);
    expect(crossFamily.magnitudeCatastrophe).toBe(false);

    // Within a non-monetary family, no scale is applied.
    const percent = compareValues(
      { value: 23.2, unit: "percent" },
      { value: 23.2, unit: "percent" },
    );
    expect(percent.economicMatch).toBe(true);
  });
});
