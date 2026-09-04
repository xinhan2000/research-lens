import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { SampleReport } from "@/types/report";

/** Existing product-artifact folder. Reports are read from here, not copied. */
const SAMPLE_DATA_DIR = "03_Sample_Data";

/** File names and selector labels only — no report text lives in source. */
const REPORT_REGISTRY = [
  { id: "clean", label: "Clean", fileName: "Report_A_Clean.md" },
  { id: "forecast", label: "Forecast", fileName: "Report_B_Forecast.md" },
  { id: "conflict", label: "Conflict", fileName: "Report_C_Conflict.md" },
  { id: "failure", label: "Failure", fileName: "Report_D_Failure.md" },
] as const;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Splits simple `key: value` YAML frontmatter from the Markdown body. */
function splitFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = raw.match(FRONTMATTER);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return { meta, body: raw.slice(match[0].length).trim() };
}

function firstHeading(body: string, fallback: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

/**
 * Reads the four built-in sample reports from `03_Sample_Data/`.
 *
 * Server-side only: called from a Server Component so the read happens at
 * build time rather than in the browser.
 */
export function loadSampleReports(): SampleReport[] {
  return REPORT_REGISTRY.map((entry) => {
    const raw = readFileSync(
      join(process.cwd(), SAMPLE_DATA_DIR, entry.fileName),
      "utf8",
    );
    const { meta, body } = splitFrontmatter(raw);

    return {
      id: entry.id,
      label: entry.label,
      fileName: entry.fileName,
      title: firstHeading(body, entry.label),
      company: meta.company ?? "",
      scenario: meta.scenario ?? "",
      content: body,
    };
  });
}
