---
artifact_id: claude_code_prompt_08_lenses_navigation
product: Research Lens
version: 0.1
build_step: BUILD-8
---

# Claude Code Prompt — 08 Lenses and Navigation

You are implementing BUILD-8 of the Research Lens prototype.

## Read first

Read:

- `01_Product_Brief/PRD.md`
- `08_Build_Log/Prototype_Build_Plan.md`

Inspect the existing `AnalyticalInput` and `ReportInsight` data structures.

## Objective

Add lightweight analytical lenses and semantic navigation without introducing additional model calls or new infrastructure.

This is a usability/presentation step, not a new reasoning layer.

## Lenses

Implement:

- All
- Financials
- Risks
- Timeline
- Assumptions

Expected behavior:

### All
Show all interpreted content.

### Financials
Focus on `AnalyticalInput` financial metrics.

### Risks
Show `ReportInsight.category = risk`.

### Timeline
Show `ReportInsight.category = timeline`.

### Assumptions
Show:
- assumption insights;
- forward-looking/target inputs where useful.

No additional Claude request should occur when switching lenses.

## Semantic navigation

Build the left navigation dynamically from the current analysis response.

Use only sections with content.

Suggested grouping:

```text
Business
Financials
Growth / Outlook
Valuation
Risks
Timeline
Assumptions
```

Do not force empty categories.

Clicking a navigation item should select the associated input/insight and focus its evidence where practical.

## Simplification

Do not build a taxonomy engine.

Simple deterministic grouping rules based on:

- metric name;
- temporal type;
- ReportInsight category;

are sufficient.

Example:

- Revenue/Gross Profit/EBITDA/Cash/Debt → Financials
- Enterprise Value + valuation-related items → Valuation
- forecast/guidance/target → Growth / Outlook

## UI priority

Keep the report center panel dominant.

The navigation should help orientation, not become a dashboard.

Avoid adding charts or KPI tiles.

## Acceptance criteria

1. Lens switching is instant and local.
2. No extra Anthropic call occurs on lens switch.
3. Report A shows meaningful Financials/Risks/Timeline content.
4. Report B makes forecast/target information easy to find.
5. Report C does not hide the EBITDA conflict.
6. Empty categories are not shown.
7. Existing conflict and skill behavior remains unchanged.

## At completion

Report:

- grouping logic;
- files changed;
- whether any category required manual rule tuning;
- checks run;
- anything intentionally kept simple.
