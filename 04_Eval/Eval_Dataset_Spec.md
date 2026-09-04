---
artifact_id: eval_dataset_spec
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - failure_taxonomy
  - eval_slices
  - autonomy_policy
  - semantic_input_schema
  - deterministic_skill_spec
used_by:
  - eval_dataset_csv
  - eval_dataset_jsonl
  - eval_scorecard
  - regression_gates
  - sample_report_design
  - prototype_validation
---

# Eval Dataset Spec

## 1. Purpose

This document defines the structure of the Research Lens evaluation dataset.

The eval must test the full trusted-analysis chain:

> **Evidence → AI Interpretation → Trust Decision → Deterministic Skill State → Result**

The dataset is not intended merely to measure number extraction.

Its primary purpose is to determine whether Research Lens safely turns report content into analytical inputs without allowing semantic mistakes to become precise downstream calculations.

---

# 2. Initial Dataset Size

For the prototype:

> **Target: 40–50 hand-labeled cases**

The dataset intentionally overrepresents high-consequence and ambiguous cases.

It is not intended to statistically reproduce production traffic.

The initial objective is:

- product behavior validation;
- prompt/model comparison;
- failure discovery;
- regression protection;
- interview demonstration.

---

# 3. Unit of Evaluation

The default unit is one **Eval Case**.

An Eval Case consists of:

1. source evidence;
2. expected semantic interpretation;
3. expected trust/autonomy behavior;
4. optional Deterministic Skill context;
5. expected skill state;
6. actual model/system output;
7. scoring result.

An Eval Case may be:

- one sentence;
- one paragraph;
- a table;
- a table plus footnote;
- several conflicting passages;
- a partial report section.

Whole-document cases may be added later.

---

# 4. Canonical Eval Case Schema

Each case should contain the following major sections:

```text
case metadata
source input
expected interpretation
expected trust behavior
expected skill behavior
actual system output
scoring
```

---

# 5. Case Metadata

## ED-01 — `case_id`

Stable identifier.

Example:

```text
EV-001
```

---

## ED-02 — `title`

Short human-readable case description.

Example:

```text
Adjusted EBITDA vs reported EBITDA conflict
```

---

## ED-03 — `slice_ids`

One case may belong to multiple slices.

Example:

```json
["SL-03", "SL-10", "SL-22", "SL-26"]
```

---

## ED-04 — `failure_risks`

Relevant failure taxonomy IDs.

Example:

```json
["F-04", "F-09", "F-15", "F-18"]
```

---

## ED-05 — `severity`

Expected consequence if mishandled.

Allowed:

```text
SEV-1
SEV-2
SEV-3
SEV-4
```

---

## ED-06 — `source_type`

Initial values:

```text
prose
simple_table
complex_table
table_with_footnote
multiple_passages
```

---

# 6. Source Input Fields

## ED-07 — `source_text`

Exact report content required for evaluation.

Example:

```text
Adjusted EBITDA was $52 million in FY2025.
Reported EBITDA after restructuring charges was $41 million.
```

---

## ED-08 — `source_context`

Optional surrounding context required for correct interpretation.

Example:

```text
All figures in USD millions.
```

---

## ED-09 — `source_page`

Page or synthetic page identifier.

Example:

```text
18
```

---

## ED-10 — `document_id`

Identifier linking the case to a sample report.

Example:

```text
report_conflict_01
```

---

# 7. Expected Semantic Interpretation

The expected interpretation should align with `Semantic_Input_Schema.md`.

## ED-11 — `expected_inputs`

One or more expected `AnalyticalInput` objects.

Example:

```json
[
  {
    "metric": "EBITDA",
    "value": 52,
    "unit": "USD_millions",
    "period": "FY2025",
    "temporal_type": "actual",
    "basis": "adjusted",
    "precision": "exact"
  },
  {
    "metric": "EBITDA",
    "value": 41,
    "unit": "USD_millions",
    "period": "FY2025",
    "temporal_type": "actual",
    "basis": "reported",
    "precision": "exact"
  }
]
```

---

## ED-12 — `expected_evidence`

Defines the evidence span each interpretation should point to.

Minimum prototype fields:

```text
page
source_text
```

---

## ED-13 — `expected_conflict_state`

Allowed:

```text
none
consistent_multiple_sources
possible_conflict
material_conflict
```

---

# 8. Expected Trust Behavior

## ED-14 — `expected_autonomy_state`

Allowed:

```text
AUTO
ASK
ABSTAIN
NEVER
```

Example:

```text
ASK
```

for materially different EBITDA definitions.

---

## ED-15 — `expected_materiality`

Allowed:

```text
low
medium
high
```

---

## ED-16 — `safe_for_auto_use`

Boolean:

```text
true
false
```

This field is particularly important for calculating Unsafe Auto-Use Rate.

---

## ED-17 — `expected_user_prompt`

Optional.

Used when `ASK` is correct.

Example:

```text
Which EBITDA basis should be used: adjusted or reported?
```

The wording does not need to match exactly during scoring unless explicitly required.

---

# 9. Deterministic Skill Context

Not every eval case needs a skill.

When applicable:

## ED-18 — `skill_id`

Example:

```text
skill_ev_ebitda
```

---

## ED-19 — `skill_inputs`

IDs or expected inputs relevant to the skill.

---

## ED-20 — `expected_skill_state`

Allowed:

```text
READY
NEEDS_REVIEW
BLOCKED
NOT_APPLICABLE
```

---

## ED-21 — `expected_result`

Used only when the skill should execute.

Example:

```json
{
  "value": 12.5,
  "unit": "multiple",
  "label": "EV / FY2025 Adjusted EBITDA"
}
```

---

# 10. Actual System Output

These fields are populated after running the prototype/model.

## ED-22 — `actual_inputs`

Captured model interpretation.

---

## ED-23 — `actual_conflict_state`

System output.

---

## ED-24 — `actual_autonomy_state`

System output.

---

## ED-25 — `actual_skill_state`

System output.

---

## ED-26 — `actual_result`

If skill executed.

---

## ED-27 — `actual_evidence`

Evidence returned by system.

---

# 11. Scoring Fields

## ED-28 — `value_correct`

Boolean or nullable.

---

## ED-29 — `metric_correct`

Boolean.

---

## ED-30 — `period_correct`

Boolean.

---

## ED-31 — `temporal_type_correct`

Boolean.

---

## ED-32 — `basis_correct`

Boolean.

---

## ED-33 — `unit_correct`

Boolean.

---

## ED-34 — `precision_correct`

Boolean.

---

## ED-35 — `evidence_correct`

Boolean.

---

## ED-36 — `conflict_correct`

Boolean.

---

## ED-37 — `autonomy_correct`

Boolean.

---

## ED-38 — `skill_gate_correct`

Boolean.

---

## ED-39 — `result_correct`

Boolean or nullable.

---

## ED-40 — `unsafe_auto_use`

Boolean.

Set `true` when:

> a materially incorrect, unsupported, conflicting, or unresolved interpretation is automatically permitted to feed a Deterministic Skill.

This is one of the most important scoring fields.

---

## ED-41 — `failure_ids_observed`

List of actual failure taxonomy IDs.

Example:

```json
["F-09", "F-15"]
```

---

## ED-42 — `overall_pass`

Boolean.

A case fails if any required critical expectation fails.

Exact scoring policy is defined in `Regression_Gates.md`.

---

## ED-43 — `review_notes`

Short human annotation.

Example:

```text
Model extracted both values correctly but failed to flag the basis conflict.
```

---

# 12. Recommended CSV Columns

For spreadsheet-friendly evaluation:

```text
case_id
title
slice_ids
failure_risks
severity
source_type
document_id
source_page
source_text
source_context
expected_metric
expected_value
expected_unit
expected_period
expected_temporal_type
expected_basis
expected_precision
expected_conflict_state
expected_autonomy_state
safe_for_auto_use
skill_id
expected_skill_state
expected_result
actual_metric
actual_value
actual_unit
actual_period
actual_temporal_type
actual_basis
actual_precision
actual_conflict_state
actual_autonomy_state
actual_skill_state
actual_result
metric_correct
value_correct
unit_correct
period_correct
temporal_type_correct
basis_correct
precision_correct
evidence_correct
conflict_correct
autonomy_correct
skill_gate_correct
result_correct
unsafe_auto_use
failure_ids_observed
overall_pass
review_notes
```

For cases with multiple expected inputs, JSONL is preferred.

---

# 13. Recommended JSONL Structure

Example:

```json
{
  "case_id": "EV-017",
  "title": "Adjusted vs reported EBITDA",
  "slice_ids": ["SL-03", "SL-10", "SL-22", "SL-26"],
  "failure_risks": ["F-04", "F-09", "F-15", "F-18"],
  "severity": "SEV-4",
  "source": {
    "document_id": "report_conflict_01",
    "page": 18,
    "type": "multiple_passages",
    "text": [
      "Adjusted EBITDA was $52 million in FY2025.",
      "Reported EBITDA after restructuring charges was $41 million."
    ]
  },
  "expected": {
    "inputs": [
      {
        "metric": "EBITDA",
        "value": 52,
        "unit": "USD_millions",
        "period": "FY2025",
        "temporal_type": "actual",
        "basis": "adjusted"
      },
      {
        "metric": "EBITDA",
        "value": 41,
        "unit": "USD_millions",
        "period": "FY2025",
        "temporal_type": "actual",
        "basis": "reported"
      }
    ],
    "conflict_state": "material_conflict",
    "autonomy_state": "ASK",
    "safe_for_auto_use": false,
    "skill_id": "skill_ev_ebitda",
    "skill_state": "NEEDS_REVIEW"
  },
  "actual": null,
  "score": null
}
```

---

# 14. Required Initial Dataset Coverage

The first dataset should contain approximately:

| Category | Cases |
|---|---:|
| Clean facts | 6 |
| Actual / forecast / period | 6 |
| Basis / metric definition | 6 |
| Unit / currency / precision | 5 |
| Conflicts | 5 |
| Tables / footnotes | 4 |
| ASK / ABSTAIN / BLOCKED | 4 |
| Correction / skill gating | 2 |
| Adversarial critical | 2 |

Target:

```text
40 cases
```

Additional cases can be added if needed to cover sample-report behavior.

---

# 15. Golden Set vs Development Set

The eval should eventually be divided into:

## Development Set

Used while iterating prompts/models.

The team may inspect failures directly.

---

## Golden Regression Set

Frozen examples used to detect regressions.

Changes should not be made simply because a new model fails an existing case.

---

## Future Holdout Set

For a real production system, maintain unseen cases to avoid overfitting to the known golden set.

This is outside the prototype scope but should be part of the interview explanation.

---

# 16. Labeling Process

For the prototype:

1. create source example;
2. manually label expected semantic interpretation;
3. label expected trust/autonomy behavior;
4. label expected skill state;
5. assign severity and slices;
6. freeze expected result;
7. run model/system;
8. compare;
9. record failure taxonomy IDs.

For production:

Labels should increasingly come from:

- domain experts;
- analyst corrections;
- production failure reviews;
- difficult real report cases;
- regression discoveries.

---

# 17. Production Feedback → Eval Loop

Future flow:

```text
Production interaction
        ↓
User correction / failure signal
        ↓
Human review
        ↓
High-value labeled case
        ↓
Development eval
        ↓
Golden regression set where appropriate
```

Not every production correction should automatically enter the golden set.

Cases should be reviewed for:

- representativeness;
- consequence;
- duplication;
- label quality.

---

# 18. What One Overall Pass Rate Cannot Tell Us

A single number such as:

```text
94% accuracy
```

can hide:

- wrong periods;
- wrong accounting basis;
- unsafe AUTO decisions;
- missed conflicts;
- poor table parsing.

The dataset is therefore designed for slice-level and field-level evaluation.

---

# 19. Decision Summary

| Decision | Choice |
|---|---|
| Initial size | 40–50 hand-labeled cases |
| Primary unit | Eval Case |
| Preferred structured format | JSONL |
| Human-friendly format | CSV/spreadsheet |
| Primary safety field | `unsafe_auto_use` |
| Critical labeling | semantic + autonomy + skill state |
| Golden set | frozen after baseline |
| Production expansion | analyst-corrected real failures |