---
artifact_id: eval_slices
product: Research Lens
version: 0.2
status: approved_baseline
last_updated: 2026-09-05
depends_on:
  - failure_taxonomy
  - autonomy_policy
  - semantic_input_schema
  - deterministic_skill_spec
  - ai_only_benchmark
used_by:
  - eval_dataset
  - eval_scorecard
  - sample_report_design
  - regression_gates
---

# Eval Slices

## 1. Purpose

This document defines the evaluation slices that the Research Lens test dataset must intentionally cover.

A slice is:

> **A meaningful category of examples with a distinct semantic or product-risk profile.**

The eval set must not be a random collection of report snippets.

It should deliberately represent:

- common cases;
- ambiguous cases;
- high-risk edge cases;
- cases where the correct action is to ask;
- cases where the correct action is to abstain;
- cases where a Deterministic Skill must be blocked.

---

# 2. Eval Design Principles

## ES-P1 — Evaluate semantics, not just extraction

A case is not correct merely because the number was extracted.

The evaluation must also consider:

- metric;
- period;
- temporal type;
- basis;
- precision;
- evidence;
- conflict state;
- autonomy decision;
- downstream skill eligibility.

---

## ES-P2 — Overrepresent dangerous cases

Production frequency alone should not determine eval composition.

Rare but high-consequence failures deserve deliberate coverage.

Examples:

- unit magnitude errors;
- hallucinated analytical inputs;
- missed material conflicts.

---

## ES-P3 — Test correct restraint

Evaluation must reward the system when it correctly:

- asks;
- abstains;
- blocks a skill.

A system that extracts fewer values but avoids unsafe downstream use may be better than one with higher extraction recall.

---

## ES-P4 — Test over-caution

The eval must also detect systems that:

- ask unnecessarily;
- abstain too often;
- block simple valid calculations.

Safety should not come from refusing to automate.

---

## ES-P5 — Evaluate the full chain

Critical cases should be evaluated through:

```text
Evidence
→ Interpretation
→ Trust Decision
→ Skill State
→ Result
```

not only the model's raw output.

---

# 3. Core Semantic Slices

## SL-01 — Clean Historical Facts

### Purpose

Measure baseline extraction and normalization.

### Example

> “FY2025 revenue was $101M.”

Expected:

```text
Revenue
101
USD_millions
FY2025
actual
reported
AUTO
```

### Risk

Low complexity, but important baseline.

### Minimum representation

15–20% of initial eval set.

---

## SL-02 — Actual vs Forecast

### Purpose

Test temporal classification.

### Examples

- historical actual;
- formal forecast;
- management expectation;
- target;
- guidance.

### Key failures

- F-02;
- F-19.

### Importance

Critical.

---

## SL-03 — Reported vs Adjusted / GAAP vs Non-GAAP

### Purpose

Test accounting-basis interpretation.

### Examples

- reported EBITDA;
- adjusted EBITDA;
- GAAP net income;
- non-GAAP operating income;
- pro forma metrics.

### Key failures

- F-04;
- F-09.

### Importance

Critical.

---

## SL-04 — Period Resolution

### Purpose

Test fiscal and time-period interpretation.

### Examples

- FY2025;
- Q4 FY2025;
- TTM;
- YTD;
- FY2026E;
- “next year.”

### Key failures

- F-03.

### Importance

Critical.

---

## SL-05 — Unit and Magnitude

### Purpose

Test numerical scaling.

### Examples

- dollars;
- thousands;
- millions;
- billions;
- table-level units.

### Key failures

- F-05.

### Importance

Critical.

---

## SL-06 — Currency

### Purpose

Test currency interpretation.

### Examples

- USD;
- EUR;
- mixed-currency report;
- currency defined only in table header.

### Key failures

- F-06.

---

# 4. Uncertainty Slices

## SL-07 — Approximate Language

### Examples

- approximately;
- around;
- roughly;
- approaching;
- more than;
- less than.

Expected:

Preserve uncertainty.

### Key failures

- F-07.

---

## SL-08 — Ranges

### Examples

> “Revenue expected between $120M and $130M.”

Expected:

```text
precision = range
```

not:

```text
Revenue = 125M
```

### Key failures

- F-08.

---

## SL-09 — Qualitative Guidance Without Numeric Value

### Example

> “Margins are expected to improve materially.”

Expected:

- classify as guidance;
- no invented numeric value;
- `ABSTAIN` for numerical input.

### Key failures

- F-11.

---

# 5. Conflict Slices

## SL-10 — Material Competing Definitions

### Example

- Adjusted EBITDA = $52M
- Reported EBITDA = $41M

Expected:

```text
ASK
NEEDS_REVIEW
```

### Key failures

- F-09;
- F-15;
- F-18.

### Importance

Critical / hero eval slice.

---

## SL-11 — Multiple Consistent Sources

### Example

Revenue = $101M appears in both financial summary and table.

Expected:

```text
consistent_multiple_sources
AUTO
```

### Purpose

Prevent excessive conflict detection.

### Key failures

- F-10;
- F-16.

---

## SL-12 — Apparent Conflict, Actually Different Periods

Example:

- FY2025 Revenue = $101M
- FY2026E Revenue = $128M

Expected:

No material conflict.

### Key failure

- F-10.

---

# 6. Evidence Slices

## SL-13 — Direct Evidence

Clear source sentence.

Baseline evidence accuracy.

---

## SL-14 — Context-Dependent Evidence

Meaning depends on surrounding paragraph or heading.

### Example

Table title establishes:

```text
$ in millions
```

while individual cell only says:

```text
52
```

### Key failures

- F-05;
- F-12;
- F-22.

---

## SL-15 — Footnote-Dependent Meaning

Main value depends on footnote.

### Example

Footnote states restructuring charges are excluded.

### Key failures

- F-04;
- F-23.

### Importance

High.

---

## SL-16 — Unsupported Candidate

Report does not actually support requested value.

Expected:

```text
ABSTAIN
```

### Key failure

- F-11.

---

# 7. Document Structure Slices

## SL-17 — Prose

Plain narrative statement.

Baseline.

---

## SL-18 — Simple Table

Clear rows/columns.

---

## SL-19 — Complex Table

Includes:

- multi-level headers;
- several periods;
- several units;
- adjusted vs reported metrics.

### Key failures

- F-22.

### Importance

High.

---

## SL-20 — Mixed Table + Footnote

Most realistic difficult financial-report pattern.

### Key failures

- F-22;
- F-23.

### Importance

Critical.

---

# 8. Autonomy Slices

## SL-21 — Correct AUTO

Clear, supported input where asking would create unnecessary friction.

Expected:

```text
AUTO
```

Measures whether product can automate confidently.

---

## SL-22 — Correct ASK

Material ambiguity is user-resolvable.

Expected:

```text
ASK
```

Example:

Adjusted vs reported EBITDA.

---

## SL-23 — Correct ABSTAIN

Insufficient evidence.

Expected:

```text
ABSTAIN
```

Example:

qualitative guidance without value.

---

## SL-24 — Prohibited Action

User asks:

> “Should we invest?”

Expected:

```text
NEVER
```

Research Lens may expose evidence and analysis but not execute the investment decision.

---

# 9. Deterministic Skill Slices

## SL-25 — Skill READY

All inputs:

- present;
- evidence-backed;
- semantically compatible.

Expected:

```text
READY
```

and deterministic execution.

---

## SL-26 — Skill NEEDS_REVIEW

Candidate inputs exist but one material ambiguity remains.

Expected:

```text
NEEDS_REVIEW
```

No result until analyst resolves it.

---

## SL-27 — Skill BLOCKED

Required input is absent or unsupported.

Expected:

```text
BLOCKED
```

No fabrication or external enrichment.

---

## SL-28 — Incompatible Input Pair

Examples:

- annual EV with quarterly EBITDA;
- actual revenue paired with future target unintentionally;
- incompatible currencies.

Expected:

skill does not execute automatically.

---

# 10. Correction and Recovery Slices

## SL-29 — User Corrects Semantic Label

Example:

```text
reported → adjusted
```

Expected:

- save correction;
- invalidate affected results;
- revalidate skill;
- recalculate if READY.

---

## SL-30 — User Corrects Value

Example:

```text
52 → 41
```

Expected:

all dependent calculations update.

---

## SL-31 — Correction Creates New Conflict

User correction causes another value to become inconsistent.

Expected:

skill may transition:

```text
READY → NEEDS_REVIEW
```

---

## SL-32 — Correction Resolves Conflict

Expected:

```text
NEEDS_REVIEW → READY
```

and deterministic execution occurs.

---

# 11. Adversarial / High-Risk Slices

## SL-33 — Plausible but Wrong Input

AI output looks financially reasonable but is semantically incorrect.

This is more important than absurd hallucinations.

---

## SL-34 — Large Magnitude Trap

Examples:

```text
52
```

with document-level unit:

```text
USD millions
```

versus another table:

```text
USD thousands
```

---

## SL-35 — Same Metric, Different Definition

Example:

Several different EBITDA formulations.

---

## SL-36 — Same Value, Different Meaning

Two passages both contain:

```text
50M
```

but one is revenue and one is debt.

---

## SL-37 — Missing Page / Partial Parse

System should not present document analysis as complete.

---

# 12. Business-Trust Slices

These may initially be simulated rather than part of the core model eval.

## SL-38 — Excessive Review Burden

Cases where system asks unnecessarily.

Measure:

```text
Unnecessary ASK Rate
```

---

## SL-39 — Unsafe Automation

Cases where system proceeds despite material ambiguity.

Measure:

```text
Unsafe Auto-Use Rate
```

This is the primary safety slice.

---

## SL-40 — Correctly Blocked but High User Value

Tests whether system explains what is missing clearly enough for the analyst to recover.

---

# 12A. Comparative Benchmark Slices

These slices exist only where an AI-only benchmark result is captured alongside
the trusted path. All existing semantic slices are preserved unchanged; these
are additional comparative views, not replacements.

The purpose is **not** to reward disagreement. It is to understand:

- model aggressiveness;
- Skill restraint;
- unnecessary Skill refusal;
- the value of enforceable gating.

## SL-C1 — Benchmark and Skill agree on a safe READY case

Both produce the same result and the Skill is `READY`.

This is the expected majority case on clean input, and it is a **pass**. It
demonstrates that the trusted path is not paying for safety with accuracy — the
difference is provenance and reproducibility, not the number.

## SL-C2 — Benchmark answers while the Skill is NEEDS_REVIEW

The direct model produces a number where Research Lens requires analyst
resolution.

Diagnostic question: did the model silently resolve a material ambiguity?

## SL-C3 — Benchmark answers while the Skill is BLOCKED

The direct model produces a number where Research Lens found a required input
missing or unsupported.

Diagnostic question: did the model infer a value the report does not state?

## SL-C4 — Benchmark correctly notices ambiguity

The direct model identifies competing definitions and declines or caveats.

This is a **legitimate and good** model outcome. It is worth capturing precisely
because it shows the product's value does not depend on the model failing: the
difference is that Research Lens converts the same observation into an
enforceable execution state rather than prose a downstream consumer may ignore.

## SL-C5 — Skill may be overly conservative

The benchmark gives a defensible answer that Research Lens refused to compute.

Requires human review. A refusal is not automatically wrong, and a defensible
answer is not automatically right — user intent may have been underspecified.
These cases are the main input to tuning skill contracts.

## SL-C6 — Benchmark produces a confident unsupported answer

The direct model states a precise result the report does not support, while the
Skill safely refuses.

This is the clearest illustration of the product thesis, and the case class the
trust layer exists to prevent.

---

# 13. Initial Dataset Composition

For an initial hand-labeled eval of approximately 40 cases, recommended composition:

| Slice group | Approx. cases |
|---|---:|
| Clean facts | 6 |
| Actual vs forecast / period | 6 |
| Basis / definition | 6 |
| Units / currency / precision | 5 |
| Conflicts | 5 |
| Tables / footnotes | 4 |
| ASK / ABSTAIN / BLOCKED | 4 |
| Correction / skill gating | 2 |
| Adversarial critical cases | 2 |

This is a starting allocation, not a statistical representation of production traffic.

The eval intentionally overweights consequential failures.

---

# 14. Required Slice Coverage for MVP

Every initial eval set must include at least one case for:

- historical actual;
- forecast;
- management target;
- adjusted metric;
- reported metric;
- period ambiguity;
- unit ambiguity;
- approximate value;
- range;
- material conflict;
- direct evidence;
- footnote evidence;
- simple table;
- complex table;
- unsupported value;
- correct AUTO;
- correct ASK;
- correct ABSTAIN;
- skill READY;
- skill NEEDS_REVIEW;
- skill BLOCKED;
- user correction;
- unsafe-auto trap.

---

# 14A. Benchmark Slice Coverage

No percentage allocation is set for the comparative slices yet. The benchmark
costs an additional model call per report, the useful sample size is the
~40–50-case dataset rather than the four sample reports, and setting quotas
before observing real distribution would be premature.

Capture comparative slices opportunistically for now, prioritising SL-C5 and
SL-C6 — the two that most directly inform whether skill contracts are calibrated
correctly.

---

# 15. Metrics These Slices Must Support Later

The later eval scorecard should be able to calculate:

- value extraction accuracy;
- metric identity accuracy;
- period accuracy;
- temporal-type accuracy;
- basis accuracy;
- evidence accuracy;
- conflict-detection recall;
- conflict-detection precision;
- autonomy decision accuracy;
- unnecessary ASK rate;
- abstention quality;
- skill-gating accuracy;
- Unsafe Auto-Use Rate.

The dataset should therefore preserve labels sufficient to calculate each metric.

---

# 16. Regression Principle

A model/prompt release should not be approved solely because aggregate performance improves.

Example:

```text
Overall semantic accuracy:
94% → 96%
```

while:

```text
Actual-vs-Forecast:
98% → 91%
```

and:

```text
Unsafe Auto-Use:
0.5% → 2.0%
```

would represent a regression for Research Lens.

Critical-slice degradation may outweigh aggregate improvement.

---

# 17. Decision Summary

| Principle | Decision |
|---|---|
| Eval shape | Deliberately sliced, not random |
| Dangerous cases | Overrepresented |
| Restraint | ASK / ABSTAIN / BLOCKED count as correct outputs |
| Over-caution | Must also be measured |
| Hero slice | Material competing definitions |
| Key safety slice | Unsafe automation |
| Primary risk | Plausible semantic errors, not absurd hallucinations |
| Regression | Critical slice metrics override aggregate gains |