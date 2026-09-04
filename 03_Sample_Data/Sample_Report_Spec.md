---
artifact_id: sample_report_spec
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - semantic_input_schema
  - deterministic_skill_spec
  - failure_taxonomy
  - eval_slices
used_by:
  - prototype
  - eval_dataset
  - demo_runbook
---

# Sample Report Spec

## 1. Purpose

The sample-report corpus provides a small, controlled set of fictional but realistic investment-report excerpts for:

- prototype development;
- demo scenarios;
- AI interpretation testing;
- Deterministic Skill testing;
- failure demonstrations;
- eval-case generation.

The reports are intentionally short to minimize model and development cost.

They are **test fixtures**, not attempts to reproduce a full investment report.

---

## 2. Fictional Company

### Company

**Northstar Analytics, Inc.**

### Business

Northstar Analytics is a fictional B2B SaaS company providing operational analytics software to logistics and supply-chain companies.

### Why this company shape

A SaaS business provides familiar investment metrics while allowing realistic ambiguity around:

- revenue growth;
- reported vs. adjusted EBITDA;
- forward guidance;
- customer concentration;
- valuation multiples;
- cash and debt.

No real company data is used.

---

## 3. Shared Baseline Facts

Unless a specific report intentionally modifies presentation or ambiguity, the fictional baseline is:

| Metric | Value |
|---|---:|
| FY2024 Revenue | $82.0M |
| FY2025 Revenue | $101.0M |
| FY2025 Gross Profit | $62.0M |
| FY2025 Adjusted EBITDA | $18.6M |
| Cash | $30.0M |
| Total Debt | $125.0M |
| Enterprise Value | $650.0M |

These support the following Deterministic Skills:

- Revenue Growth
- Gross Margin
- EBITDA Margin
- Net Debt
- EV / Revenue
- EV / EBITDA

---

## 4. Report Design Principles

### SR-P1 — Short

Each report should contain only enough information to exercise the intended product behavior.

Target:

> roughly 100–180 words plus a small table where useful.

---

### SR-P2 — One primary test objective per report

Each report has a dominant purpose.

The demo should make it clear why that report exists.

---

### SR-P3 — Reuse the same fictional company

Using one company reduces irrelevant variation and makes differences between scenarios easier to explain.

---

### SR-P4 — Preserve realistic language

Reports should contain realistic qualifiers such as:

- adjusted;
- expected;
- approximately;
- target;
- excluding;
- year-end;
- planned.

---

### SR-P5 — Include evidence needed for the UI

Across the corpus, reports should support:

- Financials lens;
- Risks lens;
- Timeline lens;
- Assumptions lens;
- semantic navigation;
- evidence highlighting;
- deterministic calculations.

---

## 5. Report A — Clean

### File

`Report_A_Clean.md`

### Purpose

Demonstrate the happy path.

### Tests

- clear historical facts;
- direct evidence;
- compatible periods;
- compatible units;
- skill state `READY`;
- deterministic calculations.

### Expected autonomy

Mostly:

`AUTO`

### Expected skill behavior

Mostly:

`READY`

---

## 6. Report B — Forecast

### File

`Report_B_Forecast.md`

### Purpose

Test whether AI preserves the distinction between:

- actual;
- forecast;
- target;
- range;
- approximate value.

### Tests

- actual vs. forecast;
- management target;
- approximate language;
- range;
- forward-period labeling.

### Main product question

> Can the system expose forward-looking values without silently treating them as historical facts?

---

## 7. Report C — Conflict

### File

`Report_C_Conflict.md`

### Purpose

Primary demo of the Research Lens trust boundary.

### Tests

- adjusted vs. reported EBITDA;
- multiple valid values;
- material conflict;
- `ASK`;
- skill state `NEEDS_REVIEW`.

### Hero workflow

`EV / EBITDA` must not execute until the analyst selects the intended EBITDA basis.

---

## 8. Report D — Failure

### File

`Report_D_Failure.md`

### Purpose

Deliberately combine several difficult but realistic conditions.

### Tests

- unit defined at table level;
- quarter vs. full-year period;
- footnote-dependent metric meaning;
- approximate management target;
- target vs. formal guidance;
- qualitative statement;
- table parsing.

### Desired demo behavior

This report should be used to show:

> “Here is where the system can break or become uncertain.”

The prototype does not need to solve every condition perfectly.

---

## 9. Ground Truth

### File

`Ground_Truth.jsonl`

Ground truth records:

- expected analytical inputs;
- evidence;
- expected conflict state;
- expected autonomy state;
- expected skill state;
- expected deterministic outputs where applicable.

This ground truth is the source for later eval-case generation.

---

## 10. Deliberate Coverage

| Requirement | A | B | C | D |
|---|---:|---:|---:|---:|
| Clean historical fact | ✓ | ✓ | ✓ | ✓ |
| Forecast |  | ✓ |  |  |
| Target |  | ✓ |  | ✓ |
| Approximate value |  | ✓ |  | ✓ |
| Range |  | ✓ |  |  |
| Basis conflict |  |  | ✓ |  |
| Material ASK |  |  | ✓ | possible |
| Table |  |  |  | ✓ |
| Footnote |  |  | ✓ | ✓ |
| Unit context | ✓ | ✓ | ✓ | ✓ |
| Risk content | ✓ | ✓ | ✓ | ✓ |
| Timeline content | ✓ | ✓ |  | ✓ |
| Deterministic skills | ✓ | partial | ✓ | partial |

---

## 11. Cost Principle

The sample corpus deliberately avoids:

- long PDFs;
- duplicated narrative;
- unnecessary background sections;
- external data;
- images;
- charts;
- complex formatting unless the format itself is being tested.

The goal is:

> **maximum trust/eval coverage per token processed.**