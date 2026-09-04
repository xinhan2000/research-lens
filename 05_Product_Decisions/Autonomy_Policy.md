---
artifact_id: autonomy_policy
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - product_thesis_and_hypothesis
used_by:
  - semantic_schema
  - deterministic_skill_spec
  - eval_design
  - prd
  - prototype
  - failure_recovery_design
---

# Research Lens — Trust Boundary and Autonomy Policy

## 1. Purpose

This document defines when Research Lens may:

- interpret information automatically;
- ask the analyst to resolve ambiguity;
- abstain from interpretation;
- prohibit an action entirely;
- execute a Deterministic Skill;
- block a Deterministic Skill.

The objective is not maximum automation.

The objective is:

> **Maximum useful automation inside a clearly defined trust boundary.**

This policy operationalizes the core principles defined in `Product_Thesis_and_Hypothesis.md`:

- **P1:** AI interprets.
- **P2:** Deterministic Skills execute.
- **P3:** Evidence stays connected.
- **P4:** Never let deterministic precision hide semantic uncertainty.
- **P5:** Support analyst judgment rather than replace it.

---

# 2. Core Trust Model

Research Lens separates the workflow into five stages:

```text
Evidence
   ↓
AI Interpretation
   ↓
Trust Decision
   ↓
Resolved Analytical Input
   ↓
Deterministic Skill
   ↓
Analytical Result
```

A model output does **not** automatically become an analytical input.

The trust layer determines whether the interpretation is sufficiently resolved for downstream use.

---

# 3. Autonomy States

Research Lens uses four autonomy states.

## AUTO

The system may proceed without asking the analyst.

Use `AUTO` when:

- the interpretation is sufficiently clear;
- required qualifiers are present;
- no material conflict exists;
- supporting evidence is available;
- the cost of an incorrect interpretation is acceptable under the applicable policy.

Example:

> “FY2025 revenue increased to $101 million from $82 million in FY2024.”

Interpretation:

- Metric: Revenue
- Value: $101M
- Period: FY2025
- Type: Actual
- Basis: Reported

If no contradictory evidence exists, the value may be accepted automatically.

---

## ASK

The system has plausible interpretations, but analyst input is required before consequential downstream use.

Use `ASK` when:

- more than one materially plausible interpretation exists;
- a qualifier required by a skill is unresolved;
- different interpretations would materially change the result;
- the source itself is ambiguous;
- a user preference determines the correct interpretation.

Example:

The report contains:

> Adjusted EBITDA: $52M

and:

> Reported EBITDA: $41M

For an `EV / EBITDA` skill, the system should ask:

> Which EBITDA basis do you want to use?

It must not silently choose.

---

## ABSTAIN

The system should explicitly state that it cannot reliably interpret the information.

Use `ABSTAIN` when:

- available evidence is insufficient;
- the value cannot be traced to a reliable source passage;
- the interpretation depends primarily on speculation;
- confidence is low and there is no useful clarification to request;
- the document is unreadable or structurally unreliable.

Example:

> “Margins should improve materially over time.”

The system should not fabricate:

> FY2026 EBITDA margin = 18%.

It may identify the statement as qualitative guidance, but must abstain from creating a numerical input.

---

## NEVER

The system is prohibited from taking the action, even if technically capable of doing so.

Examples include:

- making an autonomous Invest / Don't Invest decision;
- executing a trade;
- silently choosing between materially conflicting financial definitions;
- publishing an investment recommendation;
- allowing an LLM to replace deterministic arithmetic when a deterministic skill exists.

`NEVER` represents a deliberate product boundary, not a model limitation.

---

# 4. Materiality Principle

Not every uncertainty requires interruption.

Research Lens should distinguish:

> **uncertainty that is informational**

from:

> **uncertainty that can materially change downstream analysis.**

## Material ambiguity

An ambiguity is considered material when different reasonable interpretations can change:

- a key calculated metric;
- a valuation result;
- the historical vs. forward nature of a metric;
- the direction or magnitude of a trend;
- the analyst's understanding of financial risk;
- another consequential downstream skill.

Examples:

- $52M adjusted EBITDA vs. $41M reported EBITDA;
- FY2025 actual revenue vs. FY2026 forecast revenue;
- $500K vs. $500M;
- enterprise value vs. equity value.

These should generally result in `ASK` or `ABSTAIN`.

---

## Non-material ambiguity

Minor uncertainty that does not affect downstream interpretation may remain visible without blocking the workflow.

Examples might include:

- minor wording differences;
- non-consequential descriptive classification;
- approximate semantic categorization that is not used by a Deterministic Skill.

The system may proceed while preserving evidence and uncertainty.

---

# 5. Trust Decision Inputs

The trust policy should consider multiple signals rather than one model confidence score.

## T1 — Evidence availability

Does the interpretation have identifiable supporting evidence in the report?

Possible states:

- `DIRECT`
- `INDIRECT`
- `NONE`

`NONE` cannot become an auto-used analytical input.

---

## T2 — Semantic completeness

Are the qualifiers required to understand the value present?

Depending on the metric, this may include:

- metric identity;
- value;
- unit;
- currency;
- period;
- actual vs. forecast;
- reported vs. adjusted;
- approximate vs. exact;
- source context.

Missing required qualifiers may cause `ASK` or `ABSTAIN`.

---

## T3 — Conflict state

Possible states:

- `NONE`
- `CONSISTENT_MULTIPLE_SOURCES`
- `MATERIAL_CONFLICT`

A `MATERIAL_CONFLICT` blocks automatic downstream use.

---

## T4 — Downstream consequence

How consequential is an incorrect interpretation?

Suggested categories:

- `LOW`
- `MEDIUM`
- `HIGH`

Examples:

### LOW
Misclassifying a descriptive passage in navigation.

### MEDIUM
Incorrectly tagging a management assumption.

### HIGH
Using the wrong EBITDA definition in valuation.

Higher-consequence use requires stronger evidence and semantic resolution.

---

## T5 — Recoverability

Can the error be easily detected and reversed?

Examples:

### High recoverability
Incorrect navigation category.

### Lower recoverability
A wrong input silently flows through multiple calculations and appears in an investment memo.

Lower recoverability should reduce autonomy.

---

# 6. Core Decision Policy

The initial policy is:

| Evidence | Ambiguity | Material conflict | Consequence | Action |
|---|---|---|---|---|
| Direct | Low | No | Low | AUTO |
| Direct | Low | No | High | AUTO only if required semantics are complete |
| Direct | Material | No | Any | ASK |
| Direct | Any | Yes | Any | ASK |
| Indirect | Low | No | Low | AUTO with visible uncertainty where appropriate |
| Indirect | Material | No | Medium/High | ASK |
| None | Any | Any | Any | ABSTAIN |
| Any | Unresolved | Any | High | Do not feed skill |
| Any | Any | Any | Investment recommendation | NEVER |

This is a policy baseline, not a final production threshold.

Quantitative confidence thresholds will be defined only after evaluation data exists.

---

# 7. Deterministic Skill Execution States

Every Deterministic Skill has one of three user-visible execution states.

## READY

All required inputs are sufficiently resolved.

The skill may execute automatically.

Example:

```text
Revenue Growth
READY

FY24 Revenue: $82M
FY25 Revenue: $101M

Result: 23.2%
```

---

## NEEDS_REVIEW

Required inputs exist, but one or more have a resolvable material ambiguity.

The system shows the candidate interpretations and asks the analyst to resolve them.

Example:

```text
EV / EBITDA
NEEDS REVIEW

Two EBITDA definitions found:

$52M — Adjusted EBITDA
$41M — Reported EBITDA

Select a basis before calculation.
```

The skill does not execute until resolution.

---

## BLOCKED

A required input:

- is missing;
- lacks sufficient evidence;
- cannot be interpreted reliably;
- cannot be resolved through a simple user choice.

Example:

```text
EV / EBITDA
BLOCKED

Enterprise Value could not be established
from the report.
```

The product should explain what is missing rather than fabricate an input.

---

# 8. Core Skill Gate

Before executing any Deterministic Skill, Research Lens asks:

### G1 — Are all required inputs present?

If no:

`BLOCKED`

---

### G2 — Are all material semantic qualifiers resolved?

If no, but analyst can resolve:

`NEEDS_REVIEW`

If no and not reasonably resolvable:

`BLOCKED`

---

### G3 — Is each consequential input supported by evidence?

If no:

`BLOCKED`

---

### G4 — Is there a material unresolved conflict?

If yes:

`NEEDS_REVIEW`

---

### G5 — Is the requested operation allowed by product policy?

If no:

`NEVER`

---

### G6 — If all gates pass

`READY → EXECUTE`

---

# 9. Example Policies by Interpretation Type

## AP-1 — Clear historical financial fact

Source:

> “Revenue for FY2025 was $101 million.”

Expected behavior:

`AUTO`

Reason:

- direct evidence;
- clear metric;
- clear period;
- clear type;
- no material ambiguity.

---

## AP-2 — Forecast clearly labeled

Source:

> “Management expects FY2026 revenue of approximately $128 million.”

Expected interpretation:

- Metric: Revenue
- Period: FY2026
- Type: Forecast
- Approximate: Yes
- Value: ~$128M

Expected behavior:

`AUTO` as a forecast input if the consuming skill explicitly supports forecasts.

It must never be silently treated as an actual historical value.

---

## AP-3 — Approximate language

Source:

> “EBITDA should approach $50 million next year.”

Expected behavior:

Generally `ASK` before using in consequential valuation.

Reason:

- value is approximate;
- “next year” may require period resolution;
- language may represent aspiration rather than formal guidance.

The system may still highlight the passage as an assumption or outlook statement.

---

## AP-4 — Conflicting EBITDA definitions

Sources:

> “Adjusted EBITDA was $52 million.”

> “EBITDA after restructuring charges was $41 million.”

Expected behavior:

`ASK`

The system should present both values with labels and evidence.

No downstream EBITDA-dependent skill may run until the basis is resolved.

---

## AP-5 — Unit ambiguity

Source table header is unclear:

> Revenue: 520

No reliable unit is available.

Expected behavior:

`ABSTAIN` or `ASK` if the analyst can identify the intended unit.

It must not infer `$520M` merely because that seems plausible.

---

## AP-6 — Unsupported calculated value

The user requests:

> “Calculate EV / EBITDA.”

The report contains EBITDA but no enterprise value.

Expected behavior:

`BLOCKED`

The product should say enterprise value is missing.

It should not retrieve external market data in the MVP.

---

## AP-7 — Investment recommendation

The analyst asks:

> “Should we invest?”

Expected behavior:

`NEVER` for autonomous recommendation.

Research Lens may continue to expose:

- facts;
- risks;
- assumptions;
- calculations;
- evidence.

The investment decision remains outside the product boundary.

---

# 10. User Correction Policy

A correction is not just a UI edit.

It is a high-value quality signal.

When the analyst changes an interpretation, Research Lens should:

1. save the corrected interpretation;
2. retain the original model interpretation;
3. record the evidence involved;
4. record the model/prompt/version where available;
5. identify downstream skills that consumed the original value;
6. invalidate affected results;
7. re-run Deterministic Skills only after the new input is resolved;
8. log the case as a candidate for evaluation and future model improvement.

Example:

```text
Original:
EBITDA
$52M
Reported

Corrected:
EBITDA
$52M
Adjusted
```

Affected:

```text
EV / EBITDA
Previous result invalidated
Recalculate with corrected basis
```

---

# 11. Confidently Wrong Behavior

Research Lens must assume that AI will sometimes be confidently wrong.

The product should not rely on confidence display alone as protection.

When a wrong interpretation is discovered:

### User-facing response

- make the value editable;
- show source evidence;
- allow correction;
- immediately identify affected calculations;
- invalidate or recompute downstream results.

### System-facing response

Log:

- original interpretation;
- corrected interpretation;
- evidence;
- model/version;
- affected skill;
- consequence severity.

This becomes part of the quality flywheel:

> **Production Error → User Correction → Labeled Case → Eval Set → Improvement → Regression Test**

---

# 12. Deliberately Prohibited Behaviors

These boundaries should remain explicit in the prototype and interview narrative.

## NEVER-1 — No autonomous capital-allocation decision

Research Lens does not decide whether to invest.

---

## NEVER-2 — No silent conflict resolution

Research Lens does not silently choose among materially conflicting financial definitions.

---

## NEVER-3 — No unsupported fact creation

Research Lens does not create analytical inputs that cannot be tied to report evidence.

---

## NEVER-4 — No semantic reasoning inside Deterministic Skills

A skill cannot decide what an ambiguous input means.

---

## NEVER-5 — No LLM arithmetic when a Deterministic Skill exists

Arithmetic and explicit formula-based analysis remain deterministic.

---

## NEVER-6 — No silent external information in MVP

Research Lens does not silently enrich missing data from the web or external market databases.

---

# 13. UI Implications

This document does not define final UI design, but the autonomy policy requires the product to support at least the following states.

### Interpretation state

- accepted automatically;
- needs review;
- unavailable / abstained;
- user corrected.

### Skill state

- `READY`
- `NEEDS_REVIEW`
- `BLOCKED`

### Evidence behavior

The analyst must be able to inspect evidence for consequential interpretations.

### Correction behavior

The analyst must be able to correct material interpretations before or after a skill uses them.

---

# 14. Eval Implications

The eval system must test not only:

> “Did the model extract the correct value?”

It must also test:

> **“Did the system make the correct autonomy decision?”**

Required eval labels will therefore include:

- expected interpretation;
- expected conflict state;
- expected materiality;
- expected autonomy state;
- expected skill state;
- whether automatic downstream use is safe.

A particularly important metric will be:

> **Unsafe Auto-Use Rate**

Definition:

> The percentage of cases where Research Lens automatically allows a materially incorrect or unresolved interpretation to feed a Deterministic Skill.

This metric will be defined formally in the eval artifact.

---

# 15. Policy Summary

## AI may automatically:

- organize report information;
- extract clear financial facts;
- classify clearly stated actuals and forecasts;
- identify direct evidence;
- identify potential conflicts;
- suggest interpretations;
- populate sufficiently resolved analytical inputs.

## AI must ask when:

- material ambiguity remains;
- multiple consequential definitions exist;
- analyst intent determines the correct basis;
- required qualifiers are unresolved but user-resolvable.

## AI must abstain when:

- evidence is insufficient;
- interpretation would require fabrication;
- ambiguity cannot be responsibly resolved.

## AI must never:

- make the autonomous investment decision;
- silently resolve material financial ambiguity;
- invent unsupported analytical inputs;
- perform semantic discretion inside a Deterministic Skill.

## Deterministic Skills may execute only when:

> **all required consequential inputs are sufficiently resolved and evidence-backed.**

---

# 16. Decision Summary

| ID | Decision |
|---|---|
| AUTO | System proceeds without user confirmation |
| ASK | User must resolve material ambiguity |
| ABSTAIN | System cannot responsibly interpret |
| NEVER | Product policy prohibits the action |
| READY | Skill inputs are sufficiently resolved |
| NEEDS_REVIEW | Skill has user-resolvable ambiguity |
| BLOCKED | Required input is unavailable or unreliable |
| G1–G6 | Skill gate determines execution eligibility |
| NEVER-1 | No autonomous investment recommendation |
| NEVER-2 | No silent material conflict resolution |
| NEVER-4 | No semantic discretion inside skills |
| NEVER-5 | No LLM arithmetic where deterministic logic exists |

---

# 17. Open Questions Deferred

The following will be addressed later:

- quantitative confidence thresholds;
- exact materiality scoring;
- metric-specific required qualifiers;
- final semantic input schema;
- full Deterministic Skill catalog;
- UI representation of uncertainty;
- evaluation thresholds;
- production monitoring thresholds;
- whether user corrections should persist across reports;
- personalization or analyst-specific preferences.