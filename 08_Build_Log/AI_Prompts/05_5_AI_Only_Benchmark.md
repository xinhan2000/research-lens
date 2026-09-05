---
artifact_id: claude_code_prompt_05_5_ai_only_benchmark
product: Research Lens
version: 0.2
build_step: BUILD-5.5
---

# Claude Code Prompt — 05.5 AI-Only Benchmark

You are implementing BUILD-5.5 of the Research Lens prototype.

## Read first

- `01_Product_Brief/PRD.md`
- `05_Product_Decisions/AI_Only_Benchmark.md`
- `05_Product_Decisions/Deterministic_Skill_Spec.md`
- `08_Build_Log/Prototype_Build_Plan.md`

Inspect the BUILD-5 implementation before changing anything.

## Objective

Add a direct-model **AI-only benchmark** covering all six supported analytical
tasks, displayed beside the existing Deterministic Skill results, without
changing the trusted skill path.

## Scope — all six tasks

```text
revenue_growth
gross_margin
ebitda_margin
net_debt
ev_revenue
ev_ebitda
```

The benchmark catalog mirrors the MVP Skill catalog. Do not add CAGR or any
other task.

## Benchmark request

Create one separate server route, for example:

```text
POST /api/ai-benchmark
```

The request carries only what is needed:

- API key;
- document/report identifier if useful;
- original report text.

The benchmark must **NOT** receive:

- `AnalyticalInput` objects;
- `SkillResult` objects;
- trust states;
- conflict states;
- Ground Truth;
- analyst resolution;
- expected answers.

## Benchmark question

Ask a neutral analytical question over the original report — request all six
results where the report supports them, with the inputs used or an important
caveat, and an explicit "not enough information" where it does not.

Do not tell the model about AUTO / ASK / ABSTAIN, READY / NEEDS_REVIEW /
BLOCKED, Research Lens trust rules, or the schema. Do not instruct it to be
aggressive or conservative, to choose the first value, to manufacture
disagreement, or to flag ambiguity in a particular way.

Let the model answer naturally. A rigged control proves nothing.

## Response shape

Use a lightweight structured response so six answers stay comparable:

```text
items: [ { task_id, answer, explanation } ]
```

`answer` may be null when the model declines. Validate the response before use
and fail safely if it is malformed.

Benchmark items must **NOT** carry `READY`, `NEEDS_REVIEW`, `BLOCKED`,
`trust_state`, `resolved`, `conflict_state`, `inputIds`, `evidenceLineage`,
`SkillResult`, or `AnalyticalInput`. Structure is for comparability, not for
borrowed authority.

Label every item clearly:

```text
AI-only benchmark
UNVERIFIED
```

## On-demand

One button, wording such as:

```text
Compare with AI-only
```

```text
one click -> one benchmark request
```

Never run the benchmark automatically — not on analysis, not on skill
execution, not on report selection. Disable duplicate clicks while a request is
in flight. Use the existing BYOK session key handling.

## Report switch

Switching reports must clear the prior benchmark.

## Skill relationship

The six Deterministic Skill results already exist from BUILD-5. Render the
comparison so the analyst can scan all six rows:

```text
AI-only benchmark  |  Deterministic Skill
```

The benchmark must never:

- modify a `SkillResult`;
- alter `READY` / `NEEDS_REVIEW` / `BLOCKED`;
- provide missing skill inputs;
- resolve ambiguity;
- trigger deterministic execution;
- serve as a fallback.

## Explicitly prohibited

- six model calls;
- one model call per Skill card;
- reusing `/api/analyze` in a way that blurs the two responsibilities;
- seeding the benchmark with deterministic Skill results;
- calculating benchmark answers locally;
- assigning Skill states to benchmark items;
- BUILD-6 resolution controls.

## Clean

The benchmark may match all six deterministic values closely. **This is a PASS.**
Make the distinction about guarantees, not about manufactured numerical
disagreement.

## Conflict

The benchmark may choose adjusted, choose reported, show both, calculate both,
explain the ambiguity, or decline. Any of these is legitimate.

`EBITDA Margin` and `EV / EBITDA` must remain `NEEDS_REVIEW` until BUILD-6 user
resolution. Do not require the model to be wrong.

## Failure

Mixed skill states (READY, NEEDS_REVIEW, BLOCKED) must coexist with benchmark
answers. This report is where an overly aggressive model or an overly
conservative Skill becomes visible — surface the difference, do not resolve it.

## BUILD-6 boundary

Do not implement basis-selection controls. That remains BUILD-6.

## Security and cost

- existing `sessionStorage` BYOK;
- no key logging;
- no persistence;
- one request only;
- no retries or agent loop, beyond a user-initiated retry after a transport
  failure;
- no new model provider.

## Testing

Verify:

1. no benchmark request happens automatically;
2. one click produces exactly one benchmark request;
3. the response carries the six expected task IDs;
4. no duplicate task IDs;
5. the request payload contains no `AnalyticalInput` or `SkillResult`;
6. Ground Truth is absent from the request;
7. the benchmark is cleared on report switch;
8. the benchmark cannot mutate Skill results;
9. the Clean all-six comparison renders;
10. the Conflict benchmark coexists with `NEEDS_REVIEW`;
11. the Failure benchmark coexists with mixed READY / NEEDS_REVIEW / BLOCKED;
12. malformed benchmark output fails safely;
13. duplicate clicks are disabled during a request.

## Git

Do not commit until manual comparison testing is complete.

## Defer

- conflict resolution to BUILD-6;
- correction flow to BUILD-7.

## At completion

Report files created/changed, the route and question used, how isolation from
the trusted path is enforced, checks run, and the observed Clean, Conflict, and
Failure comparison behavior.

Stop after the implementation summary.
