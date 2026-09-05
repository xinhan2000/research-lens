---
artifact_id: claude_code_prompt_09_eval_harness
product: Research Lens
version: 0.2
build_step: BUILD-9
---

# Claude Code Prompt — 09 Eval Harness

You are implementing BUILD-9 of Research Lens.

## Read first

Read:

- `04_Eval/Eval_Dataset_Spec.md`
- `04_Eval/Regression_Gates.md`
- `04_Eval/Failure_Taxonomy.md`
- `04_Eval/Eval_Slices.md`
- `05_Product_Decisions/AI_Only_Benchmark.md`
- `03_Sample_Data/Ground_Truth.jsonl`
- `08_Build_Log/Prototype_Build_Plan.md`

Inspect the live analyze function and deterministic skill engine.

## Objective

Create a small local eval harness that repeatedly tests the current implementation against the four built-in sample reports and ground truth.

This is not yet the full 40-case production-style eval set.

It is a prototype regression harness.

## Developer key handling

For command-line eval only, allow the developer to supply:

```text
ANTHROPIC_API_KEY
```

through the local environment.

Never commit the key.

Never print it.

This does not change the deployed BYOK UI architecture.

## Recommended command

Create a command such as:

```text
npm run eval
```

It should:

1. load each built-in report;
2. call the same interpretation logic used by the app where practical;
3. validate the response;
4. compare key semantic fields with `Ground_Truth.jsonl`;
5. run the deterministic skill engine;
6. report failures.

## Initial scoring

At minimum report:

- metric identity;
- value;
- unit;
- period;
- temporal type;
- basis;
- conflict state;
- trust/autonomy state;
- expected skill state;
- deterministic result where applicable;
- unsafe auto-use flag.

Do not overbuild fuzzy semantic scoring.

For this small set, exact/normalized comparisons plus clear manual-review output are acceptable.

## Report-level expectations

### Report A
Should demonstrate safe successful automation.

### Report B
Must preserve:
- actual;
- forecast;
- target;
- range;
- approximate.

### Report C
Must detect competing EBITDA basis and prevent automatic EV/EBITDA execution.

### Report D
Must be checked carefully for:
- thousands unit;
- FY vs Q4;
- adjusted footnote;
- internal target vs formal forecast;
- no numeric value fabricated from qualitative margin language.

## Optional three-way evaluation

The harness should support an **optional** comparison of three distinct things:

```text
Ground Truth
    vs
Research Lens trusted path
    vs
AI-only benchmark
```

Ground Truth is authoritative. Research Lens is the system under evaluation. The
AI-only benchmark is a control.

Benchmark evaluation must be **configurable and off by default**, because it
costs an additional model call per report. Do not require every eval case to run
it — a flag such as `--benchmark` is appropriate.

Where enabled:

- use the same six benchmark task catalog as BUILD-5.5 (`revenue_growth`,
  `gross_margin`, `ebitda_margin`, `net_debt`, `ev_revenue`, `ev_ebitda`);
- make **one benchmark call per applicable document/report**, never one per
  Skill;
- never provide Ground Truth to the benchmark;
- never provide Research Lens output — interpretations, skill results, trust or
  conflict states — to the benchmark;
- store benchmark outputs separately from trusted outputs;
- score benchmark correctness separately;
- report comparative disagreements.

Critically:

> A benchmark result must never alter Research Lens pass/fail.

The benchmark is comparative evidence, not a release oracle. A well-scoring
benchmark cannot excuse unsafe trusted behavior, and a Skill refusal the
benchmark answered is not automatically a failure — it may be a correctly
underspecified request, which is a question for human review.

## Suggested scorecard sections

Keep the three concerns visually separate so they are never conflated:

```text
Research Lens trusted metrics
AI-only benchmark metrics
Comparative diagnostics
```

Comparative diagnostics may include disagreement cases, possible false
refusals, and unsafe direct answers — reported for review rather than scored
automatically.

## Output

Console output should be readable.

Optionally write a non-secret result file such as:

```text
eval/results/latest.json
```

If generated result files are noisy, add them to `.gitignore`.

Do not build a database or dashboard.

## Safety gate

Flag clearly if any of these occur:

- SEV-4 unsafe auto-use;
- unsupported consequential numerical input;
- material conflict silently resolved;
- unit catastrophe;
- skill executes while blocked;
- deterministic math error.

## Deterministic tests

Reuse existing skill tests rather than duplicate them.

The eval harness should focus on end-to-end behavior.

## Acceptance criteria

1. `npm run eval` exists.
2. It can evaluate all four reports.
3. It reports field-level differences.
4. Report C unsafe automatic calculation is a clear failure.
5. No API key is exposed.
6. Eval failures do not crash without useful diagnostics.
7. Benchmark evaluation is optional, off by default, and never changes Research
   Lens pass/fail.

## At completion

Report:

- eval command;
- output format;
- which metrics are implemented now;
- actual results from one run if a key is available;
- gaps intentionally deferred to the future 40-case eval set.
