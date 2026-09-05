---
artifact_id: build_3_live_inference_log
product: Research Lens
build_step: BUILD-3
status: completed
date: 2026-09-04
---

# BUILD-3 — Live Claude Inference

## Objective

BUILD-3 replaced the BUILD-2 development fixture as the normal runtime path
with live model inference:

```text
browser BYOK
    ↓
Next.js /api/analyze
    ↓
Claude Sonnet 5
    ↓
structured JSON
    ↓
Zod validation
    ↓
rendered AnalysisResponse
```

No Deterministic Skills were introduced in this step. The application still
performs no financial arithmetic.

## Core Implementation

- SDK: `@anthropic-ai/sdk`
- Model: `claude-sonnet-5`
- One model call per `Analyze Report` click — no retries, no agent loop, no
  automatic analysis on report selection
- Structured output via `output_config.format` with a JSON Schema generated
  from the existing Zod schema
- Application-level Zod validation remains mandatory: structured-output
  enforcement is never treated as sufficient
- API key stored only in browser `sessionStorage`
- No database
- No server-side key persistence — the client is constructed per request and
  discarded when the handler returns
- `Ground_Truth.jsonl` is not used during inference; it remains eval-only

## Manual Test Results

Informal prototype observations from manual browser testing, not benchmark
statistics. Single runs on a laptop over a home connection; no warm-up, no
repetition, no controlled measurement.

Initial tests:

| Report | Approx. latency |
|---|---|
| Clean | ~3 s |
| Forecast | ~12 s |
| Conflict | ~8 s |
| Failure | ~12 s |

Retests:

| Test | Approx. latency |
|---|---|
| Forecast, after range-display fix | ~10 s |
| Failure, relative-period test #1 | ~14 s |
| Failure, relative-period test #2 | ~15 s |
| Conflict, after prompt decontamination | ~7 s |

The pattern is directionally useful — the clean report is fastest and the
harder semantic cases take noticeably longer — but the sample is far too small
to treat as a latency measurement.

## What Worked

### Clean

- Historical values extracted correctly
- Adjusted EBITDA basis preserved
- Clear facts returned AUTO / Resolved
- No financial calculations generated

### Forecast

- Actual vs forward-looking semantics preserved
- Approximate values remained approximate
- $24M–$26M EBITDA range preserved with both bounds, no midpoint invented
- Longer-term revenue objective classified as Target
- "within two years" preserved as a relative period

### Conflict

- Adjusted and reported EBITDA preserved as two separate analytical inputs
- Both marked ASK / Needs Review
- Neither selected automatically
- Enterprise Value remained independently usable
- No EV / EBITDA calculation produced

### Failure

- "$ in thousands" table scale normalized correctly
- Full-year and Q4 values kept separate
- Adjusted EBITDA basis preserved
- Internal planning objective classified as Target / Management Defined /
  Approximate
- "next year" preserved rather than silently converted to FY2026
- Qualitative margin statement remained non-numeric and ABSTAIN
- No invented margin percentage

## Issues Found and Human Corrections

### 1. Range UI bug

**Problem.** A valid ranged input carried `value = null` with `range.min` and
`range.max` populated. The interpretation card checked `value` first and
returned early, displaying "No value" for an input that held a perfectly good
range.

**Fix.** Render the range before checking the scalar value. Presentation-only;
the underlying `AnalyticalInput` was not changed.

**Learning.** Valid structured semantics can still be misrepresented by
presentation logic. The schema was right, the model was right, and the screen
was still wrong — which is the failure mode an analyst would actually see.

### 2. Relative-period over-resolution

**Problem.** "next year" was silently normalized by the model to FY2026 based
on nearby fiscal-year context. The document never stated that mapping.

**Fix.** Added generic prompt guidance to preserve relative period expressions
unless the source explicitly anchors them. No date-resolution code and no
deterministic period inference were added.

**Learning.** More normalized is not always more correct. Semantic precision
must not exceed evidence precision. A plausible inference presented as a stated
fact is exactly the class of error this product exists to prevent.

### 3. Prompt test leakage

**Problem.** The initial production prompt used several exact sample-report
examples as illustrations, including values corresponding to the Forecast,
Conflict, and Failure test cases. The prompt was, in effect, carrying the
answers to the graded cases.

**Fix.** Replaced them with generic placeholder examples that teach the same
semantic rules, then re-ran the difficult cases unassisted.

**Final validation after decontamination:**

- Forecast still preserved the range
- Failure preserved "next year" on two independent runs
- Conflict still returned both EBITDA definitions as ASK / Needs Review

**Learning.** An eval is not trustworthy if the prompt contains the answers.
Prompt examples and eval fixtures need deliberate separation, and the check has
to be explicit — the leakage arrived by ordinary convenience, not by mistake,
because the sample reports were the nearest examples to hand.

## Product Learning

- AI interpretation quality must be evaluated at the semantic-field level, not
  only on whether the extracted number is right.
- Structured output does not eliminate the need for application validation.
  Schema-level enforcement is strictly weaker than the application contract.
- Correct arithmetic later would be dangerous if period, basis, precision, or
  conflict semantics are wrong. A precise result computed from a
  misinterpreted input is worse than no result.
- Preserving uncertainty can be better than normalizing it away.
- Human review of AI-generated implementation remains necessary even when the
  code compiles and schema validation passes. All three issues above passed
  typecheck, build, and Zod validation.

> AI interprets. Deterministic Skills execute. Evidence connects both.
