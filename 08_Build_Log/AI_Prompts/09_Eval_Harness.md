---
artifact_id: claude_code_prompt_09_eval_harness
product: Research Lens
version: 0.1
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

## At completion

Report:

- eval command;
- output format;
- which metrics are implemented now;
- actual results from one run if a key is available;
- gaps intentionally deferred to the future 40-case eval set.
