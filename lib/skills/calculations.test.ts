import { describe, expect, it } from "vitest";

import {
  ebitdaMargin,
  evEbitda,
  evRevenue,
  grossMargin,
  netDebt,
  revenueGrowth,
} from "./calculations";
import { isMonetaryUnit, toUsdMillions } from "./unit-normalization";

describe("formulas", () => {
  it("revenue growth", () => {
    expect(revenueGrowth(82, 101)).toBeCloseTo(0.2317073171, 9);
  });
  it("gross margin", () => {
    expect(grossMargin(62, 101)).toBeCloseTo(0.6138613861, 9);
  });
  it("ebitda margin", () => {
    expect(ebitdaMargin(18.6, 101)).toBeCloseTo(0.1841584158, 9);
  });
  it("net debt", () => {
    expect(netDebt(125, 30)).toBe(95);
  });
  it("ev / revenue", () => {
    expect(evRevenue(650, 101)).toBeCloseTo(6.4356435644, 9);
  });
  it("ev / ebitda", () => {
    expect(evEbitda(650, 18.6)).toBeCloseTo(34.9462365591, 9);
  });

  it("returns null on a zero or invalid denominator", () => {
    expect(revenueGrowth(0, 101)).toBeNull();
    expect(grossMargin(62, 0)).toBeNull();
    expect(ebitdaMargin(18.6, 0)).toBeNull();
    expect(evRevenue(650, 0)).toBeNull();
    expect(evEbitda(650, 0)).toBeNull();
    expect(evEbitda(650, Number.NaN)).toBeNull();
  });
});

describe("monetary unit normalization", () => {
  it("USD_millions passes through", () => {
    expect(toUsdMillions(101, "USD_millions")).toBe(101);
  });
  it("USD_thousands converts to millions", () => {
    expect(toUsdMillions(101000, "USD_thousands")).toBeCloseTo(101, 9);
  });
  it("USD_billions converts to millions", () => {
    expect(toUsdMillions(0.101, "USD_billions")).toBeCloseTo(101, 9);
  });
  it("base USD converts to millions", () => {
    expect(toUsdMillions(101_000_000, "USD")).toBeCloseTo(101, 9);
  });
  it("all four scales agree on the same underlying amount", () => {
    const millions = toUsdMillions(101, "USD_millions");
    expect(toUsdMillions(101000, "USD_thousands")).toBeCloseTo(millions!, 9);
    expect(toUsdMillions(0.101, "USD_billions")).toBeCloseTo(millions!, 9);
    expect(toUsdMillions(101_000_000, "USD")).toBeCloseTo(millions!, 9);
  });
  it("rejects non-monetary units and null values", () => {
    expect(toUsdMillions(12, "percent")).toBeNull();
    expect(toUsdMillions(12, "multiple")).toBeNull();
    expect(toUsdMillions(null, "USD_millions")).toBeNull();
    expect(isMonetaryUnit("percent")).toBe(false);
    expect(isMonetaryUnit("USD_thousands")).toBe(true);
  });
});
