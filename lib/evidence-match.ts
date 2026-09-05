/**
 * Deterministic evidence-to-source matching.
 *
 * Locates the block of a rendered report that supports an analytical input's
 * `source.text`. Entirely local: no model call, no embeddings, no fuzzy search,
 * no edit distance, no dependency.
 *
 * Kept free of React and the DOM so the logic is testable in isolation —
 * callers pass plain `{ id, text }` blocks.
 *
 * Design bias: a false highlight is worse than no highlight. When the evidence
 * cannot be placed unambiguously, this returns null and the UI says so.
 */

export type EvidenceBlock = {
  /** Caller-defined handle, returned on a match. */
  id: string;
  /** The block's plain text, as rendered. */
  text: string;
};

/**
 * Evidence shorter than this (after normalization) is too generic to place
 * safely — a bare "$101" could occur in several blocks.
 */
const MIN_EVIDENCE_LENGTH = 12;

/**
 * When the model returns an excerpt LARGER than one block, the block must
 * still be substantial before it counts as the source.
 */
const MIN_BLOCK_LENGTH = 20;

/**
 * Normalizes text for comparison.
 *
 * Removes only formatting noise — emphasis markers, table separators,
 * typographic variants and whitespace. Numeric and semantic content is preserved
 * exactly: decimal points, thousands separators, fiscal-period tokens and
 * words such as "adjusted" and "reported" all survive, so 18.6 never matches
 * 14.2 and 101,000 never matches 29,000.
 */
export function normalizeForMatch(text: string): string {
  return text
    // Markdown emphasis markers. Rendered text has none, but raw Markdown does.
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/__/g, "")
    // Typographic quotes and dashes -> ASCII equivalents.
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    // Markdown table cell separators are layout, not content. The model may
    // quote a row as "Revenue | 101,000 | 29,000" (optionally with leading and
    // trailing pipes) while the rendered row reads "Revenue 101,000 29,000".
    // Turning pipes into whitespace makes the two comparable; the collapse and
    // trim below remove the edge whitespace leading/trailing pipes leave behind.
    .replace(/\|/g, " ")
    // Collapse every run of whitespace, newlines included.
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Trims sentence-terminal punctuation.
 *
 * An excerpt boundary is arbitrary: the model may end a quote with "," where
 * the block ends with ".". Only the final characters are affected, so numeric
 * and semantic content is untouched.
 */
function stripTerminalPunctuation(text: string): string {
  return text.replace(/[.,;:]+$/, "");
}

type Candidate = { id: string; length: number; normalized: string };

/**
 * Picks the single best candidate.
 *
 * `preferShortest` selects the most specific containing block; otherwise the
 * longest block covered by the evidence. If two candidates tie at the best
 * score and their text genuinely differs, the result is ambiguous and no match
 * is returned — never an arbitrary first hit.
 */
function resolve(candidates: Candidate[], preferShortest: boolean): string | null {
  if (candidates.length === 0) return null;

  const best = candidates.reduce((winner, candidate) =>
    preferShortest
      ? candidate.length < winner.length
        ? candidate
        : winner
      : candidate.length > winner.length
        ? candidate
        : winner,
  );

  const tied = candidates.filter(
    (candidate) =>
      candidate.length === best.length && candidate.normalized !== best.normalized,
  );
  if (tied.length > 0) return null;

  return best.id;
}

/**
 * Returns the id of the block supporting `evidence`, or null when no block can
 * be identified with confidence.
 *
 * 1. Forward containment — a block contains the evidence. Smallest wins.
 * 2. Reverse containment — the evidence spans a block (the model returned a
 *    wider excerpt). Longest wins.
 * 3. Otherwise: no match.
 */
export function findEvidenceBlock(
  evidence: string,
  blocks: EvidenceBlock[],
): string | null {
  const needle = stripTerminalPunctuation(normalizeForMatch(evidence));
  if (needle.length < MIN_EVIDENCE_LENGTH) return null;

  const normalized = blocks.map((block) => ({
    id: block.id,
    normalized: normalizeForMatch(block.text),
  }));

  const containing = normalized
    .filter((block) => block.normalized.length > 0 && block.normalized.includes(needle))
    .map((block) => ({ ...block, length: block.normalized.length }));

  const forward = resolve(containing, true);
  if (forward !== null) return forward;

  const contained = normalized
    .filter(
      (block) =>
        block.normalized.length >= MIN_BLOCK_LENGTH &&
        needle.includes(stripTerminalPunctuation(block.normalized)),
    )
    .map((block) => ({ ...block, length: block.normalized.length }));

  return resolve(contained, false);
}
