---
artifact_id: failure_taxonomy
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - product_thesis_and_hypothesis
  - autonomy_policy
  - semantic_input_schema
  - deterministic_skill_spec
used_by:
  - eval_slices
  - eval_dataset
  - eval_scorecard
  - prototype
  - prd
  - failure_recovery_design
---

# Failure Taxonomy

## 1. Purpose

This document defines the failure modes that matter for Research Lens.

The objective is not simply to measure whether the AI extracted the correct number.

The more important question is:

> **Can an incorrect interpretation become a trusted analytical input and silently flow into a Deterministic Skill?**

The highest-risk failures are therefore those that:

1. look plausible;
2. are difficult for the analyst to notice;
3. affect consequential calculations;
4. appear precise after deterministic execution.

---

# 2. Severity Levels

## SEV-1 — Low

Error affects convenience or presentation but is unlikely to change analytical conclusions.

Examples:

- wrong navigation category;
- missed non-critical highlight;
- minor wording classification error.

Expected behavior:

- log;
- allow correction;
- does not block broader workflow.

---

## SEV-2 — Moderate

Error reduces usefulness or creates additional analyst work but is usually recoverable before a major analytical decision.

Examples:

- misclassified risk;
- missed assumption;
- incorrect section assignment;
- minor period labeling that does not feed a skill.

Expected behavior:

- surface correction path;
- monitor in production;
- include in eval set.

---

## SEV-3 — High

Error can materially change a downstream analytical result or cause significant analyst rework.

Examples:

- FY2026 forecast treated as FY2025 actual;
- Adjusted EBITDA treated as reported EBITDA;
- wrong fiscal period used in growth calculation;
- missed material conflict.

Expected behavior:

- should usually cause `ASK`, `NEEDS_REVIEW`, or `BLOCKED`;
- must be included in critical eval slices.

---

## SEV-4 — Critical

Error can produce materially misleading analysis while appearing trustworthy.

Examples:

- $52M interpreted as $52B;
- unsupported value fabricated and fed into valuation;
- wrong EBITDA definition silently used in EV / EBITDA;
- system bypasses trust gate and executes a skill on unresolved inputs.

Expected behavior:

- must not be allowed into production silently;
- should trigger regression gating;
- unsafe auto-use should be treated as a primary release metric.

---

# 3. Core Failure Classes

## F-01 — Wrong Metric Identity

### Description

The correct number is extracted, but assigned to the wrong analytical concept.

### Example

Source:

> “Gross profit increased to $85M.”

System:

```text
Revenue = $85M
```

### Severity

`SEV-3` or `SEV-4` if used downstream.

### Consequence

A Deterministic Skill may execute correctly using the wrong metric.

### Expected system behavior

- require evidence;
- validate metric context;
- block downstream skill if unresolved.

### Eval requirement

Measure metric-identification accuracy separately from value extraction accuracy.

---

## F-02 — Actual vs Forecast Error

### Description

A future-looking value is interpreted as historical fact, or vice versa.

### Example

Source:

> “FY2026 revenue is expected to reach $128M.”

Incorrect interpretation:

```text
FY2026 Revenue
temporal_type = actual
```

### Severity

`SEV-3`

### Consequence

Historical growth, valuation, or performance comparisons become misleading.

### Expected behavior

- preserve `actual / forecast / guidance / target`;
- block incompatible skill use;
- show temporal type in evidence.

---

## F-03 — Wrong Period

### Description

The metric is assigned to the wrong fiscal period.

### Example

Q4 FY2025 revenue interpreted as FY2025 full-year revenue.

### Severity

`SEV-3`

### Consequence

Growth, margin, and valuation comparisons may be materially wrong.

### Expected behavior

- period is mandatory for period-sensitive skills;
- ambiguous period causes `ASK` or `BLOCKED`.

---

## F-04 — Wrong Basis

### Description

The system fails to preserve an important accounting or analytical basis.

### Example

Source:

> “Adjusted EBITDA was $52M.”

System:

```text
EBITDA
basis = reported
```

### Severity

`SEV-3` to `SEV-4`

### Consequence

Valuation multiple can look valid while being conceptually wrong.

### Expected behavior

- basis must be explicit;
- material basis ambiguity prevents auto-use.

---

## F-05 — Unit or Magnitude Error

### Description

The numerical value is extracted but unit scale is wrong.

### Example

```text
52 USD_millions
```

interpreted as:

```text
52 USD_billions
```

### Severity

`SEV-4`

### Consequence

Catastrophic downstream calculation error.

### Expected behavior

- explicit unit extraction;
- no silent inference when header/unit is unclear;
- strong validation rules.

---

## F-06 — Currency Error

### Description

Value is interpreted in the wrong currency or incompatible currencies are combined.

### Example

EUR revenue divided into USD enterprise value without conversion.

### Severity

`SEV-3` to `SEV-4`

### Expected behavior

- currency must be explicit where material;
- incompatible currencies block skill execution.

---

## F-07 — Approximate Value Converted to Exact

### Description

Uncertain or approximate language is converted into false precision.

### Example

Source:

> “EBITDA should approach $50M.”

System:

```text
EBITDA = 50.000M
precision = exact
```

### Severity

`SEV-3`

### Consequence

A deterministic result appears more certain than the evidence supports.

### Expected behavior

Preserve:

```text
precision = approximate
```

and require review for high-consequence skills.

---

## F-08 — Range Collapsed to Single Value

### Description

A range is silently reduced to one exact number.

### Example

Source:

> “Revenue is expected between $120M and $130M.”

Incorrect:

```text
Revenue = $125M
```

without user or policy decision.

### Severity

`SEV-3`

### Expected behavior

Preserve the range.

MVP high-consequence skills should generally not silently collapse it.

---

## F-09 — Missed Material Conflict

### Description

The system finds multiple valid values but fails to recognize that they represent different material definitions.

### Example

- Adjusted EBITDA = $52M
- Reported EBITDA = $41M

System chooses $52M without flagging conflict.

### Severity

`SEV-4`

### Consequence

This is one of the project's primary unsafe failure modes.

### Expected behavior

```text
conflict_state = material_conflict
trust_state = ask
```

Dependent skill:

```text
NEEDS_REVIEW
```

---

## F-10 — False Conflict

### Description

Two values are actually compatible or describe different periods, but the system incorrectly treats them as contradictory.

### Severity

`SEV-2`

### Consequence

Unnecessary interruption and reduced trust.

### Expected behavior

Evaluate alongside missed-conflict rate to avoid a system that blocks everything.

---

## F-11 — Unsupported / Hallucinated Analytical Input

### Description

The model creates a value or qualifier not supported by the report.

### Example

Source:

> “Margins should improve.”

System:

```text
FY2026 EBITDA Margin = 18%
```

### Severity

`SEV-4`

### Expected behavior

No supported source:

```text
trust_state = abstain
```

Unsupported inputs must never feed Deterministic Skills.

---

## F-12 — Wrong Evidence Attribution

### Description

Interpretation is correct, but citation points to the wrong passage.

### Severity

`SEV-2` to `SEV-3`

### Consequence

Analyst cannot verify the result, undermining trust.

### Expected behavior

Evidence correctness must be separately evaluated.

---

## F-13 — Correct Evidence, Wrong Interpretation

### Description

The model cites the right passage but interprets it incorrectly.

### Example

Evidence clearly says:

> “Adjusted EBITDA”

but output says:

```text
basis = reported
```

### Severity

`SEV-3`

### Importance

This demonstrates why citation alone is not sufficient for trustworthy AI.

---

## F-14 — Missing Important Input

### Description

A consequential input is present in the report but the system fails to identify it.

### Example

Enterprise Value exists in a table but is missed.

### Severity

`SEV-2` or `SEV-3`

### Expected behavior

Skill may become:

```text
BLOCKED
```

This is safer than fabricating the value, but may reduce product usefulness.

---

## F-15 — Incorrect AUTO Decision

### Description

Interpretation contains material uncertainty, but trust policy returns:

```text
AUTO
```

### Severity

`SEV-4`

### Consequence

Unsafe interpretation may silently flow downstream.

### Expected behavior

This is a primary eval target.

---

## F-16 — Unnecessary ASK

### Description

System interrupts the analyst even though the interpretation is clear and sufficiently supported.

### Severity

`SEV-2`

### Consequence

Creates review fatigue.

Too much caution can make the product unusable.

### Expected behavior

Measure separately from unsafe automation.

---

## F-17 — Incorrect ABSTAIN

### Description

System refuses to interpret a sufficiently clear input.

### Severity

`SEV-2`

### Consequence

Reduces automation value and increases manual work.

---

## F-18 — Unsafe Skill Execution

### Description

A Deterministic Skill executes even though required inputs are materially unresolved.

### Example

`EV / EBITDA` executes while EBITDA basis remains ambiguous.

### Severity

`SEV-4`

### Consequence

This is the most direct violation of the core product principle.

### Expected behavior

Must be release-gated.

---

## F-19 — Wrong Skill Pairing

### Description

Correct analytical inputs are supplied to the wrong skill or incompatible inputs are paired.

### Example

Enterprise Value paired with quarterly EBITDA when the user intended annual valuation.

### Severity

`SEV-3`

### Expected behavior

Skill contract should enforce period/basis compatibility.

---

## F-20 — Stale Result After Correction

### Description

User corrects an input, but downstream result is not invalidated or recalculated.

### Severity

`SEV-4`

### Consequence

UI displays a result that no longer corresponds to visible inputs.

### Expected behavior

Correction must invalidate dependent results immediately.

---

# 4. System-Level Failure Classes

## F-21 — Partial Document Parse

Important pages, tables, or footnotes fail to parse.

### Risk

System may appear complete despite incomplete source coverage.

### Expected behavior

Expose processing limitation.

Do not imply complete analysis when coverage is partial.

---

## F-22 — Table Structure Misread

Rows or columns are associated incorrectly.

### Example

FY2025 value assigned to FY2026 column.

### Severity

`SEV-3` to `SEV-4`

### Expected behavior

Table-heavy cases must be a dedicated eval slice.

---

## F-23 — Footnote Dependency Missed

Main table is interpreted without a material footnote.

### Example

EBITDA value excludes restructuring charges only according to footnote.

### Severity

`SEV-3`

### Expected behavior

Important footnote relationships should be tested separately.

---

## F-24 — Model/Prompt Regression

New model or prompt performs better overall but becomes worse on a critical slice.

### Example

Overall accuracy:

```text
94% → 96%
```

but actual-vs-forecast accuracy:

```text
98% → 91%
```

### Severity

Potentially `SEV-4`

### Expected behavior

Release decisions must be slice-aware.

---

# 5. Business-Side Failure Modes

## BF-01 — Trust Decay

Repeated plausible errors cause analysts to verify everything manually.

### Business consequence

- time savings disappear;
- usage drops;
- product becomes optional;
- renewal/expansion weakens.

This may be more likely than one dramatic visible failure.

---

## BF-02 — Review Fatigue

System asks for confirmation too often.

### Business consequence

Analysts conclude:

> “It is faster to do it myself.”

---

## BF-03 — False Confidence

System produces polished deterministic results from weak interpretation.

### Business consequence

A wrong analytical output may be trusted precisely because it looks mathematically rigorous.

This is the central product risk.

---

# 6. Critical Failures for MVP

The following must receive disproportionate attention:

| ID | Failure | Severity |
|---|---|---|
| F-02 | Actual vs Forecast Error | SEV-3 |
| F-03 | Wrong Period | SEV-3 |
| F-04 | Wrong Basis | SEV-3/4 |
| F-05 | Unit/Magnitude Error | SEV-4 |
| F-09 | Missed Material Conflict | SEV-4 |
| F-11 | Hallucinated Input | SEV-4 |
| F-15 | Incorrect AUTO Decision | SEV-4 |
| F-18 | Unsafe Skill Execution | SEV-4 |
| F-20 | Stale Result After Correction | SEV-4 |
| F-22 | Table Structure Misread | SEV-3/4 |

These failures should dominate critical eval coverage.

---

# 7. Primary Safety Metric Derived From Taxonomy

## METRIC-CANDIDATE — Unsafe Auto-Use Rate

Definition:

> **Percentage of cases in which a materially incorrect, unsupported, conflicting, or unresolved interpretation is automatically allowed to feed a Deterministic Skill.**

This is more important than raw extraction accuracy because it measures whether system architecture successfully prevents interpretation errors from becoming precise analytical errors.

Formal definition will be finalized in the eval scorecard artifact.

---

# 8. Failure Detection Sources

Potential detection signals:

### Offline

- labeled eval failures;
- regression tests;
- slice-level metrics.

### Online

- analyst correction;
- result invalidation;
- repeated evidence inspection;
- calculation abandonment;
- excessive `NEEDS_REVIEW`;
- manual replacement of system-derived inputs;
- support/user feedback.

---

# 9. Decision Summary

| Principle | Decision |
|---|---|
| Highest-risk error | Semantically wrong input silently consumed by a skill |
| Primary safety metric | Unsafe Auto-Use Rate |
| Citation is insufficient | Evidence can be correct while interpretation is wrong |
| Over-caution also matters | Excessive ASK/ABSTAIN creates review fatigue |
| Corrections affect lineage | All downstream results must be invalidated |
| Eval must be sliced | Aggregate accuracy cannot hide critical regressions |
| Production risk | Trust decay may matter more than visible catastrophic failure |