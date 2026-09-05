---
artifact_id: claude_code_prompt_05_5_ai_only_comparison
product: Research Lens
version: 0.1
build_step: BUILD-5.5
---

# Claude Code Prompt — 05.5 AI-Only Baseline Comparison

You are implementing BUILD-5.5 of the Research Lens prototype.

## Read first

- `01_Product_Brief/PRD.md`
- `05_Product_Decisions/AI_Only_Baseline_Comparison.md`
- `05_Product_Decisions/Deterministic_Skill_Spec.md`
- `08_Build_Log/Prototype_Build_Plan.md`

Inspect the BUILD-5 implementation before changing anything.

## Objective

Add a visual EV / EBITDA comparison:

```text
AI-only baseline
      vs
Deterministic Skill
```

without changing the trusted skill path.

## Scope

EV / EBITDA only.

Do not add comparisons for the other skills to make the panel look complete.

## Baseline request

Create one separate server route with a clear name such as:

```text
POST /api/ai-baseline
```

or another equally clear path.

Do not reuse `/api/analyze` in a way that mixes the two responsibilities.

The request should contain only what is needed:

- API key;
- document/report identifier if useful;
- original report text.

The baseline must **NOT** receive:

- `AnalyticalInput` objects;
- skill outputs;
- trust states;
- conflict states;
- Ground Truth;
- analyst resolution.

## Baseline question

Use a neutral, ordinary question similar to:

> Using only this report, what is the company's EV / EBITDA? Briefly state the
> inputs you used and any important caveat.

Do not deliberately make the baseline fail.

Do not force the model to choose one EBITDA.

Do not force it to identify ambiguity.

Let the model answer naturally. A strawman comparison proves nothing.

## Response

Prefer displaying the raw, concise model text rather than transforming it into
trusted `AnalyticalInput` or `SkillResult` objects.

Do not assign `READY`, `NEEDS_REVIEW`, or `BLOCKED` to the baseline. Those
states belong to Deterministic Skills.

Label it clearly:

```text
AI-only baseline
UNVERIFIED
```

## On-demand

Add a button:

```text
Compare with AI-only
```

or similarly concise wording.

Do not run the baseline automatically — not on analysis, not on skill
execution, not on report selection.

```text
one click -> one model request
```

Disable duplicate clicks while a request is running.

Use the existing BYOK session key handling.

Do not persist the baseline across reports.

## Report switch

Switching reports must clear the prior baseline.

## Skill relationship

The Deterministic Skill result already exists from BUILD-5.

Render the comparison so the analyst can visually compare:

```text
AI-only baseline  |  Deterministic Skill
```

The baseline must never:

- modify `SkillResult`;
- alter `READY` / `NEEDS_REVIEW` / `BLOCKED`;
- provide missing skill inputs;
- resolve ambiguity;
- trigger deterministic execution;
- serve as a fallback.

## Clean

A clean report may show numerically similar answers.

**This is a PASS.**

The UI should make the distinction about guarantees, not manufacture numerical
disagreement.

## Conflict

The raw model may:

- choose adjusted;
- choose reported;
- show both;
- mention the ambiguity.

Any of these can be legitimate baseline behavior.

The Deterministic Skill must remain `NEEDS_REVIEW` until BUILD-6 user
resolution.

Do not require the model to be wrong.

## BUILD-6 boundary

Do not implement basis-selection controls in BUILD-5.5. That remains BUILD-6.

## Security and cost

- existing `sessionStorage` BYOK;
- no key logging;
- no persistence;
- one request only;
- no retries or agent loop, unless a normal transport failure requires a user
  retry;
- no new model provider.

## Testing

Verify:

1. no baseline request happens automatically;
2. the baseline request contains no `AnalyticalInput` objects or `SkillResult`;
3. the baseline is cleared on report switch;
4. the baseline result is labeled `UNVERIFIED`;
5. the baseline cannot mutate skill state;
6. the Clean comparison works;
7. the Conflict comparison can coexist with deterministic `NEEDS_REVIEW`;
8. no Ground Truth enters the request.

## Git

Do not commit until manual comparison testing is complete.

## Defer

- conflict resolution to BUILD-6;
- correction flow to BUILD-7.

## At completion

Report:

- files created/changed;
- the baseline route and question used;
- how isolation from the trusted path is enforced;
- checks run;
- observed Clean and Conflict comparison behavior.

Stop after the implementation summary.
