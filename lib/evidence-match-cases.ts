import { findEvidenceBlock, type EvidenceBlock } from "./evidence-match";

/**
 * Deterministic assertions for evidence matching.
 *
 * The project has no test runner until BUILD-5, so these run during server
 * render and therefore on every `npm run build`. They use synthetic blocks —
 * no model call, no network, no API key.
 */

/** Blocks resembling rendered report content, without copying a real report. */
const BLOCKS: EvidenceBlock[] = [
  {
    id: "revenue-para",
    text: "Revenue increased from **$82.0 million in FY2024** to **$101 million in FY2025**.",
  },
  {
    id: "adjusted-para",
    text: "The company reported adjusted EBITDA of $18.6 million for the full year.",
  },
  {
    id: "reported-para",
    text: "Reported EBITDA after restructuring charges was $14.2 million for the full year.",
  },
  {
    id: "table-row-revenue",
    // Row text is built by joining cells, as ReportViewer does.
    text: "Revenue 101,000 29,000",
  },
  {
    id: "table-row-ebitda",
    // Footnote marker included, as the rendered cell carries it.
    text: "Adjusted EBITDA* 18,600 5,400",
  },
  {
    id: "table-row-debt",
    text: "Total Debt 125,000 —",
  },
];

type Case = {
  name: string;
  evidence: string;
  expected: string | null;
};

const CASES: Case[] = [
  {
    name: "markdown bold markers vs plain evidence",
    evidence: "$101 million in FY2025",
    expected: "revenue-para",
  },
  {
    name: "whitespace and newline differences still match",
    evidence: "Revenue   increased\n  from $82.0 million in FY2024",
    expected: "revenue-para",
  },
  {
    name: "adjusted evidence does not match the reported block",
    evidence: "adjusted EBITDA of $18.6 million",
    expected: "adjusted-para",
  },
  {
    name: "reported evidence does not match the adjusted block",
    evidence: "Reported EBITDA after restructuring charges was $14.2 million",
    expected: "reported-para",
  },
  {
    name: "unrelated evidence returns no match",
    evidence: "The board appointed a new chief financial officer in March.",
    expected: null,
  },
  {
    name: "table row matches on joined cell text",
    evidence: "Revenue 101,000 29,000",
    expected: "table-row-revenue",
  },
  {
    // Observed live model behaviour: table evidence is returned in Markdown
    // row form, with pipe separators the rendered DOM does not contain.
    name: "LIVE SHAPE: markdown table row with pipes matches rendered row",
    evidence: "Revenue | 101,000 | 29,000",
    expected: "table-row-revenue",
  },
  {
    name: "LIVE SHAPE: leading and trailing pipes also match",
    evidence: "| Revenue | 101,000 | 29,000 |",
    expected: "table-row-revenue",
  },
  {
    name: "piped EBITDA row resolves to the EBITDA row, not the Revenue row",
    evidence: "Adjusted EBITDA | 18,600 | 5,400",
    expected: "table-row-ebitda",
  },
  {
    name: "piped row with unrelated figures matches nothing",
    evidence: "Operating Cash Flow | 44,300 | 9,100",
    expected: null,
  },
  {
    name: "model excerpt wider than the block still resolves (reverse containment)",
    evidence:
      "As shown in the summary table, Reported EBITDA after restructuring charges was $14.2 million for the full year, which management discussed further below.",
    expected: "reported-para",
  },
  {
    name: "evidence too short to place is rejected",
    evidence: "$101",
    expected: null,
  },
  {
    name: "typographic quotes and dashes normalize",
    evidence: "Revenue increased from $82.0 million in FY2024",
    expected: "revenue-para",
  },
];

export type EvidenceCaseResult = {
  name: string;
  passed: boolean;
  detail: string;
};

/**
 * Runs every case. Throws if any fails, so a matching regression breaks the
 * build rather than silently mis-highlighting evidence.
 */
export function assertEvidenceMatching(): EvidenceCaseResult[] {
  const results = CASES.map(({ name, evidence, expected }) => {
    const actual = findEvidenceBlock(evidence, BLOCKS);
    return {
      name,
      passed: actual === expected,
      detail: `expected ${expected ?? "no match"}, got ${actual ?? "no match"}`,
    };
  });

  const failed = results.filter((result) => !result.passed);
  if (failed.length > 0) {
    throw new Error(
      `Evidence matching failed ${failed.length} case(s): ${failed
        .map((result) => `${result.name} (${result.detail})`)
        .join("; ")}`,
    );
  }

  return results;
}
