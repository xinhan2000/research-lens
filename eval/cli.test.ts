import { describe, expect, it } from "vitest";

import { parseArgs } from "./cli";
import { GOLDEN_DOCUMENT_IDS, goldenIdForProductId, productIdForGoldenId } from "./report-map";
import { analysisFileName, benchmarkFileName } from "./saved-output";

/**
 * G and H — CLI modes and the eval-only report-id mapping.
 */

describe("argument parsing", () => {
  it("defaults to all four reports with the benchmark off", () => {
    const parsed = parseArgs([]);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.options).toEqual({
      reports: [...GOLDEN_DOCUMENT_IDS],
      fromDir: null,
      benchmark: false,
      output: null,
      help: false,
    });
  });

  it("selects a single report", () => {
    const parsed = parseArgs(["--report", "report_a_clean"]);
    expect(parsed.ok && parsed.options.reports).toEqual(["report_a_clean"]);
  });

  it("accepts repeated --report flags without duplicating", () => {
    const parsed = parseArgs([
      "--report",
      "report_a_clean",
      "--report",
      "report_c_conflict",
      "--report",
      "report_a_clean",
    ]);
    expect(parsed.ok && parsed.options.reports).toEqual([
      "report_a_clean",
      "report_c_conflict",
    ]);
  });

  it("rejects an unknown report id", () => {
    const parsed = parseArgs(["--report", "report_e"]);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toMatch(/Unknown report id/);
  });

  it("rejects a flag that is missing its value", () => {
    expect(parseArgs(["--report"]).ok).toBe(false);
    expect(parseArgs(["--from-dir", "--benchmark"]).ok).toBe(false);
    expect(parseArgs(["--output"]).ok).toBe(false);
  });

  it("rejects an unrecognised argument rather than ignoring it", () => {
    const parsed = parseArgs(["--verbose"]);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toMatch(/Unrecognised argument/);
  });

  it("parses saved-output, benchmark and output flags together", () => {
    const parsed = parseArgs([
      "--from-dir",
      "eval/fixtures/smoke",
      "--benchmark",
      "--output",
      "eval/results/run.json",
    ]);
    expect(parsed.ok && parsed.options.fromDir).toBe("eval/fixtures/smoke");
    expect(parsed.ok && parsed.options.benchmark).toBe(true);
    expect(parsed.ok && parsed.options.output).toBe("eval/results/run.json");
  });
});

describe("eval-only report mapping", () => {
  it("maps every golden-set id to a product registry id and back", () => {
    for (const goldenId of GOLDEN_DOCUMENT_IDS) {
      const productId = productIdForGoldenId(goldenId);
      expect(productId).not.toBe(goldenId);
      expect(goldenIdForProductId(productId)).toBe(goldenId);
    }
  });

  it("returns null for an unmapped product id", () => {
    expect(goldenIdForProductId("something_else")).toBeNull();
  });

  it("uses one saved-output file convention", () => {
    expect(analysisFileName("report_a_clean")).toBe("report_a_clean.analysis.json");
    expect(benchmarkFileName("report_a_clean")).toBe("report_a_clean.benchmark.json");
  });
});
