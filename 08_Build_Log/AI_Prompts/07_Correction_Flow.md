---
artifact_id: claude_code_prompt_07_correction_flow
product: Research Lens
version: 0.1
build_step: BUILD-7
---

# Claude Code Prompt — 07 Correction Flow

You are implementing BUILD-7 of Research Lens.

## Read first

Read:

- `01_Product_Brief/PRD.md`
- `05_Product_Decisions/Autonomy_Policy.md`
- `05_Product_Decisions/Semantic_Input_Schema.md`
- `05_Product_Decisions/Deterministic_Skill_Spec.md`
- `04_Eval/Failure_Taxonomy.md`

Inspect the existing skill dependency/state logic.

## Objective

Allow the analyst to correct consequential AI interpretation fields and make downstream deterministic results respond safely.

This is an in-session demo workflow.

No persistence is required.

## Editable fields

Support editing only fields that materially help the demo:

- value;
- period;
- temporal type;
- basis;
- precision.

Metric may be editable if straightforward, but do not expand scope solely to support it.

## Required behavior

When the user edits a consumed analytical input:

```text
old interpretation
      ↓
user correction
      ↓
replace session interpretation
      ↓
invalidate dependent results
      ↓
re-run skill validation
      ↓
READY → recalculate
NEEDS_REVIEW/BLOCKED → no value
```

Do not keep displaying a result calculated from the old input.

## Stale-result rule

The UI should never display a numerical result if its current inputs no longer match the inputs that produced it.

The simplest implementation is preferred:

- derive skill results from current interpretation state;
- avoid separately cached result state where possible.

If results are derived, invalidation can happen naturally through recomputation.

## Correction UI

Use a simple modal/popover/form.

Show:

- current interpretation;
- evidence snippet;
- editable fields;
- Save;
- Cancel.

No correction history UI required.

Optionally mark edited inputs:

```text
Corrected by analyst
```

for the current session.

## Trust behavior after correction

A user correction can resolve ambiguity.

Do not automatically mark every correction safe without validation.

The skill engine must still validate:

- required fields;
- units;
- periods;
- basis;
- compatibility.

## Demo case

Create at least one easy correction demonstration.

Example:

- change EBITDA basis or value;
- confirm EBITDA Margin / EV/EBITDA updates correctly.

## Tests

At minimum verify:

1. a corrected input changes dependent result;
2. invalid corrected input can make a skill BLOCKED or NEEDS_REVIEW;
3. no stale previous result remains visible.

This corresponds to failure `F-20 — Stale Result After Correction`.

## Out of scope

Do not add:

- database history;
- audit log backend;
- user identity;
- undo stack;
- cross-session persistence.

## Acceptance criteria

1. User can edit a consequential input.
2. Evidence remains visible during correction.
3. Dependent skills immediately revalidate.
4. Numerical result reflects current inputs only.
5. Relevant tests pass.

## At completion

Report:

- state design;
- how stale results are prevented;
- files changed;
- tests/checks run;
- any edge case still deferred.
