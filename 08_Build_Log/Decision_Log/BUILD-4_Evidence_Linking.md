---
artifact_id: build_4_evidence_linking_log
product: Research Lens
build_step: BUILD-4
status: completed
date: 2026-09-04
---

# BUILD-4 — Evidence Linking

## Objective

BUILD-4 makes provenance visible. Selecting an interpreted analytical input
shows where in the original report it came from:

```text
AnalyticalInput
    ↓
source.text evidence
    ↓
deterministic source matching
    ↓
highlighted original-report block
```

Three properties define this step:

- **No additional Claude call occurs on selection.** Clicking an interpretation
  card triggers no network request at all; the only runtime fetch remains the
  explicit `Analyze Report` flow.
- **Evidence linking is local and deterministic.** The same input always
  resolves to the same block.
- **No embeddings, vector search, PDF coordinates, OCR, or fuzzy semantic
  retrieval were introduced.** The `AnalysisResponse` already carries the
  evidence; BUILD-4 only locates it.

## Core Implementation

- Selected-interpretation state was lifted to `ResearchLensShell` so the right
  panel and the report viewer can both respond to it.
- `ReportViewer` treats rendered paragraphs, blockquotes, list items, and table
  rows as evidence blocks. Headings are excluded.
- The evidence matcher lives outside React components, in `lib/evidence-match.ts`,
  so it is testable without a DOM.
- Matching uses the **rendered DOM text** rather than building a second Markdown
  parser. The document is already rendered; re-parsing it would duplicate logic
  and invite divergence.
- Interpretation cards display the exact `source.text` snippet. Nothing is
  summarized or regenerated, and the evidence is styled to outrank any
  model-generated label.
- A matched source block receives exactly one active visual highlight.
- The previous highlight is cleared before a new one is applied, so two blocks
  are never marked at once.
- Report switching and re-analysis clear stale evidence selection and highlight.
- When nothing matches, the UI shows **"Source location not matched"** beside
  the evidence snippet rather than fabricating a location.

## Deterministic Matching Strategy

### Normalization

Applied to both the evidence and each candidate block:

- remove Markdown emphasis formatting where relevant;
- normalize typographic quotes and dashes to ASCII;
- normalize non-breaking spaces;
- collapse repeated whitespace and line breaks;
- lowercase for comparison;
- normalize Markdown table pipe characters to whitespace.

Deliberately preserved, because these carry meaning:

- numbers and decimals;
- thousands separators;
- fiscal periods;
- adjusted vs reported wording.

So `18.6` never matches `14.2`, `101,000` never matches `29,000`, and
`FY2025` never matches `Q4 FY2025`.

### Matching

1. A normalized block contains the normalized evidence.
2. Otherwise, the normalized evidence may contain sufficiently substantive
   block text — the case where the model quotes a wider excerpt.
3. Choose the most specific unambiguous match: the smallest containing block,
   or the longest contained block.
4. Reject evidence too short to be generic-safe.
5. If several materially different candidates tie, return no match.
6. Otherwise return no match.

> False highlight is considered worse than no highlight.

There is no similarity score, no threshold, and no edit-distance library.

## Manual Test Results

### Conflict

Adjusted EBITDA $18.6M:

- correct interpretation card selected;
- exact evidence displayed;
- $18.6M source sentence highlighted.

Reported EBITDA $14.2M:

- previous highlight cleared;
- correct card selected;
- $14.2M source sentence highlighted.

Switching between the two was visually immediate and required no model call.
Enterprise Value also linked independently.

Analyze latency observed for this manual run: **~9 seconds**. That latency
belongs entirely to Claude inference. Evidence selection itself is local and
perceptibly instant.

### Failure

The initial manual table test exposed a matching failure.

**Before the fix:**

```text
Claude evidence:   Revenue | 101,000 | 29,000
Rendered DOM row:  Revenue 101,000 29,000
Result:            Source location not matched
```

**After pipe normalization:**

- FY2025 Revenue -> Revenue row highlighted
- Q4 FY2025 Revenue -> same Revenue row highlighted
- Adjusted EBITDA -> Adjusted EBITDA row highlighted
- Total Debt -> Total Debt row highlighted
- Cash -> Cash row highlighted

Two revenue inputs resolving to the same row is correct at row-level evidence
granularity; both values genuinely live in that row.

Also verified earlier in manual testing:

- ~$25M internal planning objective -> management-commentary paragraph
- qualitative margin statement -> its commentary paragraph

Analyze latency observed for the final Failure run: **~14 seconds**. Again,
that is inference time; evidence-card selection was immediate.

## Issue Found and Human Correction

### Unrealistic table test fixture

**Problem.** The original deterministic test represented table evidence as:

```text
Revenue 101,000 29,000
```

which matched the rendered DOM representation. Real Claude output returned:

```text
Revenue | 101,000 | 29,000
```

The test therefore validated the implementation against an evidence shape
derived from the implementation itself rather than from the actual model
boundary. It passed while the feature was broken.

**Root cause.** The matcher did not normalize Markdown pipe separators. The
matching algorithm was correct; its input normalization was incomplete.

**Fix.** Normalize pipe characters to whitespace before collapsing whitespace.
Punctuation is not broadly stripped — the change is one character class, and
leading/trailing pipes fall out naturally through the existing collapse and
trim.

**Regression cases added:**

- piped Revenue evidence matches the Revenue DOM row;
- leading/trailing pipes also match;
- piped Adjusted EBITDA matches its own row, not the Revenue row;
- an unrelated piped financial row returns no match.

Final deterministic evidence suite: **13/13 cases passing.**

## Product Learning

- Evidence traceability must be tested end-to-end against actual model output,
  not only synthetic fixtures. A fixture authored from the implementation tests
  the implementation against itself.
- Deterministic code can still fail at the representation boundary even when
  its algorithm is correct. The bug lived in the seam between two correct
  components.
- Conservative provenance behavior is preferable: no source match is safer than
  a false highlight. The failure surfaced as an honest "not matched" rather
  than a confident wrong answer, which is why it was diagnosable.
- Block-level evidence is sufficient for this prototype. Word- or cell-level
  coordinates would add complexity without changing the trust decision the
  analyst makes.
- Evidence selection should remain local and immediate. Inference cost and
  latency belong to analysis, not to inspection.
- The original report remains the source of truth; AI interpretations are
  inspectable overlays on top of it.

The table-matching bug was not fixed by changing the Claude prompt. The product
adapted deterministically to a legitimate evidence representation returned by
the model. Reaching for the prompt would have been the easier fix and the wrong
one — the model was not misbehaving.

> AI interprets. Deterministic Skills execute. Evidence connects both.
