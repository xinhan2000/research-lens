---
artifact_id: claude_code_prompt_04_evidence_ui
product: Research Lens
version: 0.1
build_step: BUILD-4
---

# Claude Code Prompt — 04 Evidence UI

You are implementing BUILD-4 of the Research Lens prototype.

## Read first

Read:

- `01_Product_Brief/PRD.md`
- `05_Product_Decisions/Semantic_Input_Schema.md`
- `08_Build_Log/Prototype_Build_Plan.md`

Inspect current application behavior before changes.

## Objective

Make evidence traceability visible.

The user should be able to select an interpreted analytical input and immediately see where it came from in the original report.

This step is about trust, not visual polish.

## Required interaction

When an interpretation is selected:

1. make it visually active;
2. display the exact evidence snippet;
3. identify the source block in the original report;
4. scroll or focus the relevant source block where practical.

## Simplification allowed

The sample reports are short Markdown files.

Do not build a general document-highlighting engine.

A block-level evidence highlight is sufficient.

Recommended simple approach:

- split/render the source into stable blocks;
- match Claude's `source.text` / evidence string to the best containing block;
- apply a visible selected state to the matched block;
- scroll it into view.

For Report D, preserve table readability.

If exact inline matching is fragile, highlight the paragraph/table row/block containing the evidence rather than individual words.

## Interpretation card

When an input is active, show:

- Metric
- Value
- Unit
- Period
- Temporal Type
- Basis
- Precision
- Trust State
- Evidence text

The source evidence must be more visually prominent than model explanation.

## Failure behavior

If evidence text cannot be matched back to a source block:

- still show the returned evidence snippet;
- display a small `Source location not matched` warning;
- do not fabricate a source position.

This is preferable to pretending the source was found.

## Out of scope

Do not add:

- PDF coordinates;
- OCR;
- page-number engine;
- text embeddings;
- fuzzy-search infrastructure;
- persistent annotations;
- deterministic calculations.

## Acceptance criteria

1. Selecting Report A revenue visibly identifies its source.
2. Selecting Report C adjusted EBITDA identifies the adjusted EBITDA source.
3. Evidence mismatch is handled honestly.
4. Original report stays central in the layout.
5. No additional Claude call is required for evidence selection.
6. TypeScript/build checks pass.

## At completion

Report:

- evidence matching strategy;
- files changed;
- mismatch behavior;
- commands/checks run;
- any case where returned evidence was difficult to map.
