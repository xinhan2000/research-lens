import type { EvidenceBlock } from "../lib/evidence-match";

/**
 * Splits a sample report's Markdown body into evidence blocks.
 *
 * This exists because `ReportViewer` derives its blocks from the RENDERED DOM
 * (`p, blockquote, tbody tr, li`) and the eval CLI has no DOM. The rules below
 * reproduce that block set from the Markdown source:
 *
 *   - headings are excluded, as they are in the UI;
 *   - a table's header row and delimiter row are excluded (they render into
 *     `thead`, not `tbody tr`);
 *   - a table body row becomes one block with cells joined by spaces, exactly
 *     as `ReportViewer.blockText` joins a `<tr>`'s cells;
 *   - a blockquote becomes one block with its `>` markers removed;
 *   - each list item becomes its own block;
 *   - everything else is a paragraph delimited by blank lines.
 *
 * It is an approximation of the rendered DOM, not a second matcher. Matching
 * itself is the existing `findEvidenceBlock` from BUILD-4, unchanged and not
 * duplicated. Where this splitter and the DOM disagree, the UI is authoritative
 * and the harness under-reports evidence validity rather than over-reporting it.
 */

const HEADING = /^#{1,6}\s/;
const LIST_ITEM = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/;
const TABLE_ROW = /^\s*\|/;
const TABLE_DELIMITER = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;
const BLOCKQUOTE = /^\s*>\s?/;

/** Splits a Markdown table row into cell texts. */
function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function extractEvidenceBlocks(markdown: string): EvidenceBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: EvidenceBlock[] = [];
  let index = 0;

  const push = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    blocks.push({ id: String(blocks.length), text: trimmed });
  };

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "" || HEADING.test(line)) {
      index += 1;
      continue;
    }

    // Table: header row, delimiter row, then body rows.
    if (TABLE_ROW.test(line)) {
      const table: string[] = [];
      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        table.push(lines[index]);
        index += 1;
      }
      // Drop the header row and the delimiter row; they render into `thead`.
      const bodyStart =
        table.length > 1 && TABLE_DELIMITER.test(table[1]) ? 2 : 1;
      for (const row of table.slice(bodyStart)) {
        push(tableCells(row).join(" "));
      }
      continue;
    }

    // Blockquote: consecutive `>` lines collapse into one block.
    if (BLOCKQUOTE.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && BLOCKQUOTE.test(lines[index])) {
        quoted.push(lines[index].replace(BLOCKQUOTE, ""));
        index += 1;
      }
      push(quoted.join(" "));
      continue;
    }

    // List item: one block per item, including its lazy continuation lines.
    if (LIST_ITEM.test(line)) {
      const item: string[] = [line.replace(LIST_ITEM, "")];
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() !== "" &&
        !LIST_ITEM.test(lines[index]) &&
        !TABLE_ROW.test(lines[index]) &&
        !HEADING.test(lines[index]) &&
        !BLOCKQUOTE.test(lines[index])
      ) {
        item.push(lines[index]);
        index += 1;
      }
      push(item.join(" "));
      continue;
    }

    // Paragraph: runs until a blank line or a structural line.
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !HEADING.test(lines[index]) &&
      !TABLE_ROW.test(lines[index]) &&
      !BLOCKQUOTE.test(lines[index]) &&
      !LIST_ITEM.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    push(paragraph.join(" "));
  }

  return blocks;
}
