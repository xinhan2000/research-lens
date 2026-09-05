---
artifact_id: semantic_input_schema
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - product_thesis_and_hypothesis
  - autonomy_policy
used_by:
  - deterministic_skill_spec
  - eval_design
  - prototype
  - prd
  - failure_recovery_design
---

# Research Lens — Semantic Input Schema

## 1. Purpose

This document defines the canonical structure for turning unstructured investment-report content into an **AI-interpreted analytical input**.

The schema exists to make the handoff between AI interpretation and Deterministic Skills explicit, inspectable, testable, and auditable.

Core principle:

> **AI interprets. Deterministic Skills execute. Evidence connects both.**

A model output does not become a valid analytical input merely because it contains a number.

It must also preserve the semantic qualifiers required to understand what that number means.

---

# 2. Canonical Object

The core object is:

### `AnalyticalInput`

An `AnalyticalInput` represents one interpreted fact, estimate, assumption, or metric candidate extracted from the source report.

Example:

```json
{
  "input_id": "ai_001",
  "metric": "EBITDA",
  "value": 52,
  "unit": "USD_millions",
  "currency": "USD",
  "period": "FY2025",
  "temporal_type": "actual",
  "basis": "adjusted",
  "precision": "exact",
  "source": {
    "page": 18,
    "text": "Adjusted EBITDA increased to $52 million in FY2025."
  },
  "evidence_type": "direct",
  "conflict_state": "none",
  "trust_state": "auto",
  "materiality": "high",
  "resolved": true
}
```

---

# 3. Required Fields

## SI-1 — `input_id`

Unique stable identifier.

Example:

```text
ai_001
```

Purpose:

- trace inputs through calculations;
- attach corrections;
- link eval cases;
- support audit lineage.

---

## SI-2 — `metric`

Canonical analytical concept represented by the input.

Examples:

- Revenue
- Gross Profit
- EBITDA
- Adjusted EBITDA
- Cash
- Total Debt
- Enterprise Value
- Equity Value
- Gross Margin
- Customer Count

The canonical metric name should be normalized even if source wording differs.

Example source:

> “Net sales were $101 million.”

Possible normalized metric:

```text
Revenue
```

The source wording must still be preserved separately.

---

## SI-3 — `value`

Normalized numerical value when applicable.

Examples:

```text
101
52
0.184
```

The value should not embed unit text.

Bad:

```text
"$52M"
```

Preferred:

```text
value = 52
unit = USD_millions
```

---

## SI-4 — `unit`

Normalized unit.

Initial supported examples:

- `USD`
- `USD_thousands`
- `USD_millions`
- `USD_billions`
- `percent`
- `multiple`
- `count`
- `days`
- `months`
- `years`
- `none`

The system must not silently infer a consequential unit when the source does not support it.

---

## SI-5 — `currency`

Currency where relevant.

Examples:

- `USD`
- `EUR`
- `GBP`
- `CNY`
- `SGD`

Use `null` where currency is not applicable.

Currency and magnitude are distinct.

Example:

```text
currency = USD
unit = USD_millions
```

---

## SI-6 — `period`

The reporting or analytical period.

Examples:

- `FY2024`
- `FY2025`
- `Q4 FY2025`
- `TTM Q2 2026`
- `2026E`
- `2027E`

The source period should be normalized, but original wording should remain available through evidence.

If period cannot be safely resolved, the input may not be considered fully resolved for period-sensitive skills.

---

# 4. Semantic Qualifiers

## SI-7 — `temporal_type`

Defines whether the metric represents observed history or a future-looking value.

Allowed initial values:

```text
actual
forecast
guidance
target
assumption
unknown
```

Examples:

> “FY2025 revenue was $101M.”

```text
actual
```

> “We expect FY2026 revenue of $128M.”

```text
forecast
```

> “Management targets $150M in revenue over the medium term.”

```text
target
```

This field is critical because a correct number can still be unsafe if it is used under the wrong temporal interpretation.

---

## SI-8 — `basis`

Defines an important accounting or analytical basis.

Initial examples:

```text
reported
adjusted
gaap
non_gaap
management_defined
pro_forma
consensus
unknown
not_applicable
```

The schema should allow future extension.

Example:

```text
metric = EBITDA
basis = adjusted
```

This must remain distinct from:

```text
metric = EBITDA
basis = reported
```

---

## SI-9 — `precision`

Defines whether the value should be treated as exact or approximate.

Allowed values:

```text
exact
approximate
range
qualitative
unknown
```

Example:

> “Revenue was approximately $100 million.”

```text
precision = approximate
```

Example:

> “Revenue is expected to be between $120M and $130M.”

```text
precision = range
```

A range should not be silently converted into a single exact value.

---

# 5. Source Evidence

## SI-10 — `source`

Every consequential input must preserve source evidence.

Initial structure:

```json
{
  "document_id": "report_001",
  "page": 18,
  "section": "Financial Performance",
  "text": "Adjusted EBITDA increased to $52 million in FY2025.",
  "char_start": null,
  "char_end": null
}
```

Minimum viable evidence for the prototype:

- document;
- page;
- exact source text.

Future implementations may include precise coordinates or spans.

---

## SI-11 — `evidence_type`

Allowed values:

```text
direct
derived_from_source
indirect
none
```

### `direct`

Source explicitly states the value and meaning.

### `derived_from_source`

Value is deterministically derived from explicit source inputs.

### `indirect`

Interpretation depends on surrounding context rather than one direct statement.

### `none`

No reliable supporting evidence.

`none` must not feed consequential Deterministic Skills.

---

# 6. Trust and Conflict State

## SI-12 — `conflict_state`

Allowed values:

```text
none
consistent_multiple_sources
material_conflict
possible_conflict
```

Examples:

### `none`

Only one clear interpretation exists.

### `consistent_multiple_sources`

Two sections both state FY25 revenue = $101M.

### `material_conflict`

Report contains:

- Adjusted EBITDA = $52M
- Reported EBITDA = $41M

and a downstream skill needs one EBITDA basis.

### `possible_conflict`

The model suspects a conflict but has not fully resolved whether the values are comparable.

---

## SI-13 — `trust_state`

Uses the autonomy framework defined in `Autonomy_Policy.md`.

Allowed values:

```text
auto
ask
abstain
never
```

Examples:

```text
auto
```

Interpretation may proceed automatically.

```text
ask
```

Analyst resolution is required.

```text
abstain
```

System lacks sufficient support.

`never` is uncommon at the input level but may apply to prohibited derived interpretations.

### Scope

`trust_state` is INPUT-GLOBAL and describes INTERPRETATION TRUST. It answers:

> Is this structured interpretation sufficiently supported by the source
> evidence, with no material unresolved ambiguity about what the source means?

It does not answer:

> Can every downstream calculation safely use this input?

That second question is consumer-specific and cannot be settled here, because an
`AnalyticalInput` exists before any Skill has been selected. A period expressed
as a relative phrase, an approximate value, or a forward-looking type may be a
perfectly trustworthy reading of the source and still be unusable by a
particular calculation. Each Skill validates its own contract — see SI-15 and
`Deterministic_Skill_Spec.md`.

---

## SI-14 — `materiality`

Allowed values:

```text
low
medium
high
```

Materiality represents the consequence of using the interpretation incorrectly.

Examples:

### Low

Navigation classification.

### Medium

Risk tagging not yet used in a valuation.

### High

Revenue, EBITDA, enterprise value, debt, or another metric feeding valuation.

---

## SI-15 — `resolved`

Boolean:

```text
true
false
```

An input is `resolved = true` when its semantics have been faithfully established
from the source — the interpretation is settled, not merely guessed.

Important:

> Resolved is contextual and source-faithful.

An input may be sufficiently resolved for display but not sufficiently resolved for a high-consequence Deterministic Skill.

The implementation should therefore avoid using this field alone as the execution gate.

The consuming skill must validate its own input contract.

### Source-faithful resolution vs. Skill eligibility

These two statements are both true at once, and are not a contradiction:

1. An input may be faithfully resolved with `period = "next year"`, because that
   is exactly what the source says and the schema forbids inventing a fiscal
   year the report does not state.
2. A period-sensitive Skill may still refuse that input, because `"next year"`
   cannot be safely equated with a specific fiscal period.

The first is a statement about interpretation; the second is a statement about
one operation's requirements. Reading (1) as license to execute, or (2) as
evidence that the interpretation was wrong, conflates two different layers.

The same separation governs `trust_state` (SI-13): interpretation trust is
input-global, execution readiness is consumer-specific.

---

# 7. Optional Fields

## SI-16 — `range`

For bounded values:

```json
{
  "min": 120,
  "max": 130
}
```

Use when:

```text
precision = range
```

---

## SI-17 — `confidence`

Optional model confidence.

Example:

```text
0.92
```

Important:

> Confidence must never be the sole basis for trust.

The trust policy considers evidence, completeness, conflicts, materiality, and consequence.

---

## SI-18 — `notes`

Short structured explanation for unusual cases.

Example:

```text
"Source describes this as management-defined adjusted EBITDA."
```

Not intended for uncontrolled long-form model reasoning.

---

## SI-19 — `user_correction`

If corrected:

```json
{
  "corrected": true,
  "previous_value": "reported",
  "new_value": "adjusted",
  "timestamp": "2026-09-04T10:30:00-07:00"
}
```

Prototype implementation may simplify this.

---

# 8. Full Prototype JSON Shape

Recommended initial JSON object:

```json
{
  "input_id": "ai_001",
  "metric": "EBITDA",
  "source_label": "Adjusted EBITDA",
  "value": 52,
  "unit": "USD_millions",
  "currency": "USD",
  "period": "FY2025",
  "temporal_type": "actual",
  "basis": "adjusted",
  "precision": "exact",
  "range": null,
  "source": {
    "document_id": "report_001",
    "page": 18,
    "section": "Financial Performance",
    "text": "Adjusted EBITDA increased to $52 million in FY2025."
  },
  "evidence_type": "direct",
  "conflict_state": "none",
  "trust_state": "auto",
  "materiality": "high",
  "confidence": 0.97,
  "resolved": true,
  "notes": null,
  "user_correction": null
}
```

---

# 9. Example — Actual vs Forecast

Source 1:

> “FY2025 revenue was $101 million.”

```json
{
  "metric": "Revenue",
  "value": 101,
  "unit": "USD_millions",
  "period": "FY2025",
  "temporal_type": "actual",
  "basis": "reported",
  "precision": "exact",
  "trust_state": "auto"
}
```

Source 2:

> “Management expects FY2026 revenue of approximately $128 million.”

```json
{
  "metric": "Revenue",
  "value": 128,
  "unit": "USD_millions",
  "period": "FY2026",
  "temporal_type": "forecast",
  "basis": "management_defined",
  "precision": "approximate",
  "trust_state": "auto"
}
```

These two values must never be treated as semantically interchangeable.

---

# 10. Example — Material Conflict

Source 1:

> “Adjusted EBITDA was $52 million.”

Source 2:

> “EBITDA after restructuring charges was $41 million.”

Object A:

```json
{
  "metric": "EBITDA",
  "value": 52,
  "basis": "adjusted",
  "period": "FY2025",
  "conflict_state": "material_conflict",
  "trust_state": "ask"
}
```

Object B:

```json
{
  "metric": "EBITDA",
  "value": 41,
  "basis": "reported",
  "period": "FY2025",
  "conflict_state": "material_conflict",
  "trust_state": "ask"
}
```

Neither value should automatically feed an `EV / EBITDA` skill unless the skill's requested basis uniquely resolves the conflict.

---

# 11. Example — Insufficient Evidence

Source:

> “Margins should improve significantly next year.”

Possible interpretation:

```json
{
  "metric": "EBITDA Margin",
  "value": null,
  "period": "next_year",
  "temporal_type": "guidance",
  "precision": "qualitative",
  "evidence_type": "direct",
  "trust_state": "abstain",
  "resolved": false
}
```

The system may highlight the statement as guidance.

It must not fabricate a numerical margin.

---

# 12. Schema Validation Rules

## SV-1

A consequential numerical input must have:

- metric;
- value;
- unit;
- source evidence.

---

## SV-2

Period-sensitive skills require a sufficiently resolved `period`.

---

## SV-3

Historical-vs-forward comparisons require a resolved `temporal_type`.

---

## SV-4

Basis-sensitive skills require a resolved `basis`.

---

## SV-5

`material_conflict` prevents automatic downstream use unless the consuming skill explicitly resolves the conflict through its own requested input criteria.

---

## SV-6

`evidence_type = none` prevents consequential downstream use.

---

## SV-7

`trust_state = ask` prevents automatic skill execution until user resolution.

---

## SV-8

`trust_state = abstain` cannot feed a Deterministic Skill.

---

## SV-9

`precision = approximate` or `range` must remain visible downstream.

A Deterministic Skill may consume them only if its specification explicitly allows approximate/range inputs.

---

# 13. Future Extensions

Not required for MVP:

- entity identifiers;
- source-table coordinates;
- cross-document provenance;
- confidence calibration metadata;
- accounting-standard taxonomy;
- metric ontology;
- company-specific metric definitions;
- analyst-specific interpretation preferences;
- revision history across multiple user corrections.

---

# 14. Decision Summary

| ID | Decision |
|---|---|
| SI-1 | Every interpretation has a stable input ID |
| SI-2 | Metrics use normalized canonical names |
| SI-4 | Units are explicit and normalized |
| SI-6 | Period is a first-class semantic qualifier |
| SI-7 | Actual, forecast, guidance, target, assumption are distinct |
| SI-8 | Basis is explicitly preserved |
| SI-9 | Approximate/range values must not become false precision |
| SI-10 | Consequential inputs preserve original evidence |
| SI-12 | Material conflict is explicitly represented |
| SI-13 | Trust state follows AUTO / ASK / ABSTAIN / NEVER |
| SI-15 | Resolved means sufficiently interpreted, but skill contracts still gate execution |
| SV-5 | Material conflicts block silent downstream use |
| SV-6 | Unsupported facts cannot feed skills |
| SV-9 | Approximation must survive into downstream analysis |