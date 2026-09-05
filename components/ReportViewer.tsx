"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { findEvidenceBlock, type EvidenceBlock } from "@/lib/evidence-match";
import type { SampleReport } from "@/types/report";

/**
 * Center panel: the source-of-truth view of the selected report.
 *
 * `remark-gfm` is required so Report D's financial table renders as a table
 * rather than literal pipe characters.
 *
 * Evidence highlighting reads the ALREADY-RENDERED document rather than
 * parsing the Markdown a second time. Matching itself lives in
 * `lib/evidence-match.ts` so it stays testable without a DOM.
 */

/** Elements treated as evidence blocks. Headings are deliberately excluded. */
const BLOCK_SELECTOR = "p, blockquote, tbody tr, li";

const ACTIVE_CLASS = "evidence-active";

/**
 * Plain text of one block.
 *
 * `textContent` on a table row concatenates cells with no separator
 * ("Revenue101,00029,000"), which could never match a model excerpt, so cells
 * are joined with spaces instead.
 */
function blockText(element: Element): string {
  if (element.tagName === "TR") {
    return Array.from(element.children)
      .map((cell) => cell.textContent ?? "")
      .join(" ");
  }
  return element.textContent ?? "";
}

export default function ReportViewer({
  report,
  evidenceText,
  onMatchResult,
}: {
  report: SampleReport;
  /** `source.text` of the active interpretation, or null when none is active. */
  evidenceText: string | null;
  /** Reports whether a source block was located. null = nothing active. */
  onMatchResult: (matched: boolean | null) => void;
}) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Always clear the previous highlight first, so selecting a different
    // interpretation never leaves two blocks marked.
    for (const marked of Array.from(
      container.querySelectorAll(`.${ACTIVE_CLASS}`),
    )) {
      marked.classList.remove(ACTIVE_CLASS);
    }

    if (!evidenceText) {
      onMatchResult(null);
      return;
    }

    const elements = Array.from(container.querySelectorAll(BLOCK_SELECTOR));
    const blocks: EvidenceBlock[] = elements.map((element, index) => ({
      id: String(index),
      text: blockText(element),
    }));

    const matchId = findEvidenceBlock(evidenceText, blocks);
    if (matchId === null) {
      // Honest failure: highlight nothing rather than the nearest-looking block.
      onMatchResult(false);
      return;
    }

    const matched = elements[Number(matchId)];
    matched.classList.add(ACTIVE_CLASS);
    // `nearest` scrolls only when the block is outside the visible panel.
    matched.scrollIntoView({ behavior: "smooth", block: "nearest" });
    onMatchResult(true);
  }, [evidenceText, report.content, onMatchResult]);

  return (
    <article
      ref={containerRef}
      className="report"
      aria-label={`${report.label} report`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
    </article>
  );
}
