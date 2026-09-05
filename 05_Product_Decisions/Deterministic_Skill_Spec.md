---
artifact_id: deterministic_skill_spec
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - product_thesis_and_hypothesis
  - autonomy_policy
  - semantic_input_schema
used_by:
  - eval_design
  - prd
  - prototype
  - calculation_engine
  - ai_only_baseline_comparison
---

# Research Lens — Deterministic Skill Specification

## 1. Purpose

This document defines the contract for **Deterministic Skills** used by Research Lens.

A Deterministic Skill is:

> **A bounded, reusable analytical operation with explicit inputs, deterministic logic, reproducible outputs, testable behavior, and no semantic discretion over materially unresolved inputs.**

A skill may execute only after all required inputs satisfy its semantic contract.

---

# 2. Skill Lifecycle

```text id="s5af0f"
Candidate Inputs
      ↓
Validate Skill Contract
      ↓
 ┌───────────────────────┐
 │ READY                 │ → Execute
 │ NEEDS_REVIEW          │ → Ask user
 │ BLOCKED               │ → Do not execute
 └───────────────────────┘
      ↓
Deterministic Result
      ↓
Evidence Lineage
```

---

# 3. Canonical Skill Contract

Every skill must define:

```text
skill_id
name
purpose
required_inputs
optional_inputs
semantic_requirements
formula_or_rule
allowed_input_types
blocking_conditions
output_schema
lineage_requirements
```

---

# 4. Skill Execution Rules

## SKR-1 — Explicit inputs only

A skill cannot search the document for missing values.

Interpretation belongs upstream.

The skill consumes structured `AnalyticalInput` objects.

---

## SKR-2 — No semantic discretion

A skill cannot decide:

- which EBITDA definition is better;
- whether forecast revenue should replace actual revenue;
- whether an approximate value is “close enough”;
- whether two periods are equivalent.

Those decisions must already be resolved.

---

## SKR-3 — Deterministic output

Given identical valid inputs, the skill must return identical output.

---

## SKR-4 — Reproducible lineage

Every result must preserve:

- skill ID;
- formula/rule;
- input IDs;
- input values;
- input evidence;
- execution timestamp/version where applicable.

---

## SKR-5 — Block on unsafe input

If any required input is materially unresolved:

```text
NEEDS_REVIEW
```

or:

```text
BLOCKED
```

The skill must not silently substitute another value.

---

# 5. Output Schema

Recommended result object:

```json
{
  "result_id": "result_001",
  "skill_id": "skill_ev_ebitda",
  "status": "ready",
  "value": 12.5,
  "unit": "multiple",
  "formula": "Enterprise Value / EBITDA",
  "inputs": [
    "ai_ev_001",
    "ai_ebitda_001"
  ],
  "warnings": [],
  "evidence_lineage": true
}
```

Allowed status values:

```text
ready
needs_review
blocked
```

---

# 6. MVP Skill Catalog

The MVP should support a small set of broadly understandable skills.

Recommended initial catalog:

1. Revenue Growth
2. CAGR
3. Gross Margin
4. EBITDA Margin
5. Net Debt
6. EV / Revenue
7. EV / EBITDA

This is intentionally limited.

Research Lens is not an autonomous financial-modeling system.

---

# 7. Skill DS-1 — Revenue Growth

## Skill ID

```text
skill_revenue_growth
```

## Purpose

Calculate period-over-period revenue growth.

## Required inputs

- Revenue — prior period
- Revenue — current period

## Semantic requirements

Both inputs must have:

- same currency;
- same unit basis;
- compatible revenue definition;
- compatible temporal basis;
- sequential or explicitly comparable periods.

Example valid:

```text
FY2024 Revenue Actual
FY2025 Revenue Actual
```

Example potentially invalid:

```text
FY2025 Revenue Actual
FY2026 Revenue Management Target
```

unless the user explicitly requests forward growth.

## Formula

```text
(Current Revenue - Prior Revenue) / Prior Revenue
```

## Output

```text
percent
```

## Blocking conditions

- missing period;
- actual vs. forecast mismatch without explicit user intent;
- materially different revenue basis;
- unresolved currency mismatch;
- missing value;
- material conflict.

---

# 8. Skill DS-2 — CAGR

## Skill ID

```text
skill_cagr
```

## Purpose

Calculate compound annual growth rate.

## Required inputs

- beginning value;
- ending value;
- number of years.

## Semantic requirements

Inputs must represent:

- same metric;
- same basis;
- same currency/unit;
- compatible period types.

## Formula

```text
(Ending Value / Beginning Value)^(1 / Years) - 1
```

## Output

```text
percent
```

## Blocking conditions

- period length cannot be established;
- incompatible metric definition;
- missing value;
- beginning value <= 0 where formula becomes invalid for intended use;
- unresolved forecast/actual distinction if material.

---

# 9. Skill DS-3 — Gross Margin

## Skill ID

```text
skill_gross_margin
```

## Purpose

Calculate gross margin.

## Required inputs

- Gross Profit
- Revenue

## Semantic requirements

Both inputs must refer to:

- same period;
- same reporting basis;
- same currency/unit;
- comparable entity scope.

## Formula

```text
Gross Profit / Revenue
```

## Output

```text
percent
```

## Blocking conditions

- period mismatch;
- entity/scope mismatch;
- missing value;
- material definition conflict.

---

# 10. Skill DS-4 — EBITDA Margin

## Skill ID

```text
skill_ebitda_margin
```

## Purpose

Calculate EBITDA margin.

## Required inputs

- EBITDA
- Revenue

## Semantic requirements

Both inputs must refer to:

- same period;
- compatible entity scope;
- explicit EBITDA basis.

The result should preserve the EBITDA basis.

Example output label:

```text
Adjusted EBITDA Margin
```

rather than silently:

```text
EBITDA Margin
```

if adjusted EBITDA was used.

## Formula

```text
EBITDA / Revenue
```

## Output

```text
percent
```

## Blocking conditions

- EBITDA basis unresolved;
- period mismatch;
- actual/forecast mismatch without explicit context;
- missing value;
- material conflict.

---

# 11. Skill DS-5 — Net Debt

## Skill ID

```text
skill_net_debt
```

## Purpose

Calculate net debt.

## Required inputs

- Total Debt
- Cash and Cash Equivalents

## Semantic requirements

Inputs must use:

- same period;
- same currency;
- compatible entity scope.

## Formula

```text
Total Debt - Cash
```

## Output

Monetary value.

## Blocking conditions

- period mismatch;
- currency mismatch;
- debt definition unresolved;
- missing cash or debt.

---

# 12. Skill DS-6 — EV / Revenue

## Skill ID

```text
skill_ev_revenue
```

## Purpose

Calculate enterprise-value-to-revenue multiple.

## Required inputs

- Enterprise Value
- Revenue

## Semantic requirements

Revenue period must be explicitly known.

Result label must preserve the period.

Example:

```text
EV / FY2025 Revenue
```

or:

```text
EV / FY2026E Revenue
```

Do not hide whether revenue is historical or forward.

## Formula

```text
Enterprise Value / Revenue
```

## Output

```text
multiple
```

## Blocking conditions

- enterprise value missing;
- revenue period unresolved;
- actual/forecast classification unresolved;
- currency incompatibility;
- material conflict.

---

# 13. Skill DS-7 — EV / EBITDA

## Skill ID

```text
skill_ev_ebitda
```

## Purpose

Calculate enterprise-value-to-EBITDA multiple.

## Required inputs

- Enterprise Value
- EBITDA

## Semantic requirements

EBITDA must have:

- period;
- basis;
- temporal type;
- currency/unit.

Output must preserve these qualifiers.

Good:

```text
EV / FY2025 Adjusted EBITDA = 12.5×
```

Bad:

```text
EV / EBITDA = 12.5×
```

when basis/period materially matter.

## Formula

```text
Enterprise Value / EBITDA
```

## Output

```text
multiple
```

## Blocking conditions

- EBITDA basis unresolved;
- multiple materially plausible EBITDA values;
- period unresolved;
- actual vs. forecast unresolved;
- enterprise value missing;
- currency mismatch;
- unsupported input.

This should be the primary MVP example of a skill entering:

```text
NEEDS_REVIEW
```

---

# 14. Skill State Logic

## READY

Use when:

- all required inputs exist;
- semantic qualifiers are complete;
- evidence is sufficient;
- no material conflict remains;
- the operation is permitted.

Then:

```text
execute
```

---

## NEEDS_REVIEW

Use when:

- required candidate inputs exist;
- ambiguity is material;
- user can reasonably resolve the ambiguity.

Example:

```text
Adjusted EBITDA = $52M
Reported EBITDA = $41M
```

User chooses basis.

Then skill becomes:

```text
READY
```

---

## BLOCKED

Use when:

- required input is absent;
- source evidence is insufficient;
- meaning cannot be resolved;
- required external information is outside MVP scope.

Example:

Enterprise Value absent from report.

Result:

```text
EV / EBITDA
BLOCKED
Enterprise Value not found in source report.
```

---

# 15. Approximate and Range Inputs

Skills must explicitly declare whether they accept approximate or range inputs.

Default MVP rule:

> High-consequence valuation skills do not silently collapse ranges or approximate values into exact values.

Example source:

```text
EBITDA expected to approach $50M
```

A skill may display:

```text
Potential EBITDA input: approximately $50M
```

but should require review before using it in EV / EBITDA.

Future versions may support range outputs:

```text
EV / EBITDA = 12.4×–13.1×
```

but this is not required for MVP.

---

# 16. Evidence Lineage Requirements

Every skill result must be explainable through:

```text
Result
  ↓
Skill
  ↓
Input A → Interpretation → Evidence
  ↓
Input B → Interpretation → Evidence
```

Example:

```text
EV / FY2025 Adjusted EBITDA = 12.5×
```

Clicking the result should expose:

```text
Formula:
$650M / $52M

Enterprise Value:
$650M
Source: p.11

Adjusted EBITDA:
$52M
Source: p.18
```

This is a core product requirement, not an optional debugging tool.

---

# 17. Corrections and Recalculation

If a user changes any consumed input:

1. mark previous result stale;
2. invalidate the result;
3. validate the skill contract again;
4. execute only if status returns to `READY`;
5. preserve prior result history where practical.

Example:

User changes:

```text
EBITDA basis:
reported → adjusted
```

Then:

```text
EV / EBITDA result invalidated
```

and recalculated only after the corrected input is accepted.

---

# 18. Explicit Non-Skills

The following are not Deterministic Skills in the MVP:

- determine whether a company is attractive;
- identify the “best” EBITDA definition;
- decide whether management guidance is credible;
- assess whether a risk is material to the investment thesis;
- decide Invest / Pass;
- write the investment recommendation.

These require semantic judgment or investment judgment.

They remain outside the Deterministic Skill layer.

---

# 19. AI-Only Baseline Boundary

Research Lens may display a raw model answer beside a Deterministic Skill
result for demo comparison. That answer is an **AI-only baseline**, and it sits
outside this specification's authority.

The AI-only baseline:

- is **NOT** a Deterministic Skill;
- does not have `READY` / `NEEDS_REVIEW` / `BLOCKED` authority;
- cannot supply or repair missing skill inputs;
- cannot resolve semantic ambiguity;
- cannot override skill gating.

A raw model answer may be shown next to a skill result for comparison. Trusted
results continue to come only from validated `AnalyticalInput` objects plus
deterministic execution.

> A model answer may be informative without being executable.

The baseline is labeled `UNVERIFIED` wherever it appears, and it is never
consumed by another skill.

> The baseline may disagree with a Skill result or with a Skill refusal. That
> disagreement is displayed, not automatically reconciled.

See `05_Product_Decisions/AI_Only_Baseline_Comparison.md` for the full product
definition.

---

# 20. Future Skill Candidates

Potential future deterministic skills:

- free cash flow margin;
- debt / EBITDA;
- interest coverage;
- Rule of 40;
- revenue per customer;
- customer concentration calculations;
- valuation sensitivity tables;
- scenario-based valuation;
- unit economics;
- return calculations.

These are intentionally deferred until the MVP trust model is validated.

---

# 21. Decision Summary

| Skill | MVP | Main Semantic Risk |
|---|---|---|
| Revenue Growth | Yes | period / actual-vs-forecast |
| CAGR | Yes | period compatibility |
| Gross Margin | Yes | basis / period |
| EBITDA Margin | Yes | EBITDA basis |
| Net Debt | Yes | debt definition / period |
| EV / Revenue | Yes | historical vs forward revenue |
| EV / EBITDA | Yes | EBITDA basis / period |

Core rule:

> **A Deterministic Skill never resolves semantic ambiguity itself.**

And:

> **A precise result is allowed only when the required semantic inputs are sufficiently resolved.**

And, per section 19:

> **An AI-only baseline may be displayed alongside a skill result, but it never carries skill authority.**