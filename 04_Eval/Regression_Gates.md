---
artifact_id: regression_gates
product: Research Lens
version: 0.2
status: provisional_baseline
last_updated: 2026-09-05
depends_on:
  - failure_taxonomy
  - eval_slices
  - eval_dataset_spec
  - ai_only_benchmark
used_by:
  - eval_scorecard
  - model_selection
  - prompt_iteration
  - prototype_validation
  - production_release_process
---

# Regression Gates

## 1. Purpose

This document defines the preliminary quality metrics and release gates for Research Lens.

The objective is not to maximize one aggregate benchmark score.

The objective is:

> **Prevent high-consequence semantic failures from being converted into trusted deterministic outputs.**

All numerical thresholds in this document are **provisional prototype targets**, not empirically validated production thresholds.

They should be refined after real eval data and user behavior are available.

---

# 2. Quality Hierarchy

Research Lens evaluates quality at five levels.

## Q1 — Extraction

Did the system identify the correct value?

---

## Q2 — Semantic Interpretation

Did it correctly understand:

- metric;
- period;
- temporal type;
- basis;
- unit;
- precision?

---

## Q3 — Evidence

Is the interpretation connected to the correct source evidence?

---

## Q4 — Trust Decision

Did the system correctly choose:

```text
AUTO
ASK
ABSTAIN
NEVER
```

---

## Q5 — Skill Safety

Did the Deterministic Skill correctly become:

```text
READY
NEEDS_REVIEW
BLOCKED
```

and execute only when safe?

The higher levels matter more than raw extraction.

---

# 3. Core Metrics

## RG-M1 — Value Extraction Accuracy

Definition:

> Percentage of numerical cases where the value is correctly extracted.

Prototype target:

```text
>= 95%
```

Not sufficient by itself for release.

---

## RG-M2 — Metric Identity Accuracy

Definition:

> Percentage of cases where the numerical value is assigned to the correct analytical metric.

Prototype target:

```text
>= 95%
```

Critical slices should be reviewed separately.

---

## RG-M3 — Period Accuracy

Definition:

> Percentage of period-bearing cases with correct fiscal/time period.

Prototype target:

```text
>= 95%
```

Critical financial inputs:

```text
>= 98% target
```

---

## RG-M4 — Temporal Type Accuracy

Correct classification of:

- actual;
- forecast;
- guidance;
- target;
- assumption.

Prototype target:

```text
>= 95%
```

For `actual vs forecast` critical slice:

```text
>= 98%
```

---

## RG-M5 — Basis Accuracy

Correct interpretation of:

- reported;
- adjusted;
- GAAP;
- non-GAAP;
- pro forma;
- management-defined.

Prototype target:

```text
>= 95%
```

Critical basis-sensitive cases:

```text
>= 98%
```

---

## RG-M6 — Unit / Magnitude Accuracy

Correct handling of:

- dollars;
- thousands;
- millions;
- billions;
- percentages;
- counts.

Prototype target:

```text
>= 99%
```

A magnitude error is treated as high severity.

---

## RG-M7 — Evidence Accuracy

Definition:

> Percentage of consequential interpretations connected to the correct source evidence.

Prototype target:

```text
>= 97%
```

A correct value with wrong evidence is not considered fully trustworthy.

---

## RG-M8 — Conflict Detection Recall

Definition:

> Of true material conflicts, percentage correctly detected.

Prototype target:

```text
>= 95%
```

Preferred production ambition:

```text
>= 98%
```

Missed conflicts are more dangerous than false conflicts.

---

## RG-M9 — Conflict Detection Precision

Definition:

> Of cases labeled as material conflicts, percentage that are genuine conflicts.

Prototype target:

```text
>= 85%
```

Why lower than recall:

False conflict causes extra review.

Missed conflict can cause unsafe automatic analysis.

---

## RG-M10 — Autonomy Decision Accuracy

Correct:

```text
AUTO / ASK / ABSTAIN / NEVER
```

Prototype target:

```text
>= 95%
```

But critical failures are evaluated separately.

---

## RG-M11 — Unnecessary ASK Rate

Definition:

> Percentage of safe AUTO cases where system unnecessarily asks the analyst.

Prototype target:

```text
< 10%
```

Purpose:

Prevent safety from degenerating into constant confirmation.

---

## RG-M12 — Skill Gate Accuracy

Correct:

```text
READY / NEEDS_REVIEW / BLOCKED
```

Prototype target:

```text
>= 97%
```

For high-consequence skills:

```text
>= 99%
```

---

# 4. Primary Safety Metric

## RG-M13 — Unsafe Auto-Use Rate

### Definition

> Percentage of cases where a materially incorrect, unsupported, conflicting, or unresolved interpretation is automatically allowed to feed a Deterministic Skill.

Formula:

```text
Unsafe Auto-Use Cases
---------------------------
Eligible Consequential Cases
```

### Prototype target

```text
< 1%
```

### Desired production ambition

```text
as close to 0% as practical
```

For the initial small golden set:

> **Any SEV-4 unsafe auto-use case is a release blocker.**

This matters more than aggregate benchmark improvement.

---

# 5. Secondary System Metrics

## RG-M14 — Correct Abstention Rate

Among cases where evidence is insufficient:

> Did system correctly abstain?

Prototype target:

```text
>= 95%
```

---

## RG-M15 — Unsupported Input Rate

Percentage of system-created analytical inputs without valid evidence.

Prototype target:

```text
0% for consequential numerical inputs
```

Any unsupported consequential value is a critical failure.

---

## RG-M16 — Correction Propagation Accuracy

When user corrects an input:

- downstream stale results invalidated;
- skill revalidated;
- recalculated only if READY.

Prototype target:

```text
100% on eval cases
```

This is deterministic application logic and should not tolerate probabilistic failure.

---

## RG-M17 — Deterministic Calculation Accuracy

Given correct valid inputs:

Prototype target:

```text
100%
```

Arithmetic/formula errors are unacceptable because this layer is deterministic.

---

# 6. Hard Release Blockers

A candidate model/prompt/build should **not pass** if any of the following occurs on the golden set.

## BLOCK-1 — SEV-4 Unsafe Auto-Use

Any critical unresolved/incorrect interpretation automatically feeds a skill.

---

## BLOCK-2 — Hallucinated Consequential Input

Any unsupported numerical value is used in a skill.

---

## BLOCK-3 — Material Conflict Silently Resolved

A genuine material conflict is not surfaced and one candidate value is silently used.

---

## BLOCK-4 — Unit Catastrophe

A thousand/million/billion or major currency error reaches downstream analysis.

---

## BLOCK-5 — Skill Executes While BLOCKED

A Deterministic Skill produces a result despite missing or unsupported required inputs.

---

## BLOCK-6 — Stale Result Survives Correction

A corrected input does not invalidate an affected downstream result.

---

## BLOCK-7 — Deterministic Math Failure

A Deterministic Skill computes the wrong result from correct inputs.

---

# 7. Release Decision Logic

A release candidate passes only if:

### Gate A — No hard blocker

All `BLOCK-*` rules pass.

AND

### Gate B — Primary safety metric passes

```text
Unsafe Auto-Use Rate < 1%
```

AND

### Gate C — Critical semantic slices pass

No meaningful regression in:

- actual vs forecast;
- period;
- basis;
- unit/magnitude;
- material conflicts;
- unsupported inputs.

AND

### Gate D — Overall product usefulness remains acceptable

The system does not achieve safety only by asking or abstaining excessively.

---

# 8. Aggregate Improvement Does Not Override Critical Regression

Example:

Candidate B:

```text
Overall Semantic Accuracy
94% → 96%
```

but:

```text
Actual vs Forecast
98% → 92%

Unsafe Auto-Use
0.5% → 2.0%
```

Decision:

```text
REJECT
```

Despite improved aggregate performance.

Reason:

The regression increases consequential risk.

---

# 8A. Comparative Benchmark Metrics

These metrics describe the AI-only benchmark alongside the trusted path. See
`05_Product_Decisions/AI_Only_Benchmark.md`.

**None of them is a release gate.** Research Lens release gates continue to
measure the trusted path only.

Provisional metrics:

| Metric | Meaning |
|---|---|
| Benchmark Numerical Correctness | Share of benchmark answers matching Ground Truth |
| Benchmark Answer Coverage | Share of benchmark tasks the model answered at all |
| Benchmark Unsafe Direct-Answer Rate | Share of benchmark answers that are confidently wrong or silently resolve a material ambiguity |
| Trusted READY Coverage | Share of tasks Research Lens executed |
| Trusted False-Refusal Review Rate | Share of refusals human review judged unnecessary |
| Benchmark-vs-Trusted Disagreement Rate | Share of tasks where the two differ |

Interpretation rules:

- no production targets are required yet;
- four sample reports are not statistically meaningful — these metrics become
  useful over the 40–50-case eval set;
- disagreement rate is **diagnostic, not inherently bad**;
- a Skill refusal is **not automatically a failure**;
- benchmark correctness **cannot override** unsafe trusted behavior.

That last rule matters most. A release in which the benchmark scores well and
Research Lens auto-uses an unresolved input is a failed release. `RG-M13 —
Unsafe Auto-Use Rate` remains the primary Research Lens safety metric, and no
comparative metric may be traded against it.

---

# 9. Regression Comparison Table

Each candidate model/prompt should produce:

| Metric | Baseline | Candidate | Delta | Gate |
|---|---:|---:|---:|---|
| Semantic Accuracy | — | — | — | Monitor |
| Period Accuracy | — | — | — | Critical |
| Temporal Type Accuracy | — | — | — | Critical |
| Basis Accuracy | — | — | — | Critical |
| Unit Accuracy | — | — | — | Critical |
| Evidence Accuracy | — | — | — | Critical |
| Conflict Recall | — | — | — | Critical |
| Conflict Precision | — | — | — | Monitor |
| Unnecessary ASK | — | — | — | Usability |
| Skill Gate Accuracy | — | — | — | Critical |
| Unsafe Auto-Use | — | — | — | Hard Gate |

---

# 10. Slice-Level Regression Rule

For critical slices:

```text
SL-02 Actual vs Forecast
SL-03 Basis
SL-04 Period
SL-05 Unit
SL-10 Material Conflict
SL-16 Unsupported Candidate
SL-26 NEEDS_REVIEW
SL-27 BLOCKED
SL-39 Unsafe Automation
```

A meaningful regression should block release even when overall results improve.

For the small prototype dataset, inspect individual failures manually rather than relying only on statistical deltas.

---

# 11. Prototype vs Production Thresholds

The current thresholds are:

> **Evaluation design targets, not proven production SLAs.**

For production, thresholds should be determined through:

- larger labeled datasets;
- real analyst correction behavior;
- consequence weighting;
- cost/latency tradeoffs;
- domain expert review;
- downstream business outcomes.

Do not claim the prototype thresholds are universally correct.

---

# 12. Offline Quality vs Production Quality

## Offline benchmark answers:

> Can the system correctly handle labeled cases we understand?

Metrics include:

- semantic accuracy;
- evidence accuracy;
- conflict detection;
- autonomy decisions;
- skill gating.

---

## Production quality answers:

> Do analysts successfully rely on the product during real work?

Potential production signals:

- correction rate;
- corrections by severity;
- evidence inspection rate;
- repeated evidence re-checking;
- calculation abandonment;
- manual replacement of AI inputs;
- frequency of `NEEDS_REVIEW`;
- time to review-ready analysis;
- repeat weekly usage.

---

# 13. Production Regression Signals

Possible alerts:

### PR-1 — Correction spike

Example:

```text
EBITDA basis corrections +3x
```

after model release.

---

### PR-2 — Evidence verification spike

Users suddenly inspect source evidence much more often before using results.

Possible trust regression.

---

### PR-3 — Calculation abandonment spike

Users start calculations but do not accept/use them.

---

### PR-4 — NEEDS_REVIEW spike

May indicate model became overly cautious.

---

### PR-5 — Manual replacement spike

Users replace automatically interpreted values with manually entered values.

---

### PR-6 — Repeat usage decline

Technical benchmark may pass while user trust/usefulness falls.

---

# 14. Release Process

Prototype release process:

```text
Prompt/model change
      ↓
Run full eval
      ↓
Check hard blockers
      ↓
Check critical slices
      ↓
Check Unsafe Auto-Use
      ↓
Review new failures manually
      ↓
Approve / Reject
```

Future production process adds:

```text
Shadow / beta
      ↓
Online monitoring
      ↓
Production rollout
```

---

# 15. Quality Tradeoff Principle

Research Lens intentionally treats error costs asymmetrically.

In many cases:

> **Failing to calculate is preferable to confidently calculating from the wrong semantic input.**

But:

> **Asking on every case is also product failure.**

Therefore quality must optimize both:

1. safety;
2. useful automation.

---

# 16. Decision Summary

| Area | Decision |
|---|---|
| Primary safety metric | Unsafe Auto-Use Rate |
| Prototype unsafe-auto target | <1% |
| SEV-4 unsafe auto-use | Hard blocker |
| Deterministic math | 100% required |
| Unsupported consequential values | 0% allowed |
| Conflict priority | Recall > precision |
| Safety vs usability | Both measured |
| Critical slice regression | Can override aggregate improvement |
| Threshold status | Provisional until real data exists |
| Production validation | Requires online behavior, not offline eval alone |