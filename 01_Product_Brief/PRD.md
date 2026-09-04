---
artifact_id: prd
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - product_thesis_and_hypothesis
  - autonomy_policy
  - semantic_input_schema
  - deterministic_skill_spec
  - failure_taxonomy
  - eval_slices
  - eval_dataset_spec
  - regression_gates
  - sample_report_spec
  - competitor_alternatives
  - approaches_considered
used_by:
  - prototype
  - ai_build_prompts
  - demo_runbook
  - prototype_eval
---

# Research Lens — Prototype PRD

## 1. Purpose

Research Lens is a demo prototype for testing one product hypothesis:

> **Can investment analysts safely move from messy report language to trusted analytical calculations by making AI interpretation visible and correctable before deterministic analysis runs?**

The prototype is intentionally narrow.

It is not intended to be:

- a production investment platform;
- a complete financial-modeling application;
- a multi-document research system;
- a general-purpose AI assistant.

The prototype should be just complete enough to demonstrate:

> **Evidence → AI Interpretation → Trust Decision → Deterministic Skill**

---

# 2. Primary Persona

## PERS-1 — Investment Analyst

A professional investment analyst reviewing company or investment reports and converting them into:

- financial facts;
- assumptions;
- risks;
- valuation inputs;
- analytical conclusions.

The user is comfortable with financial concepts and expects to verify consequential facts before relying on them.

---

# 3. Job to Be Done

> **When I receive an investment report, help me identify and safely use the important analytical inputs so I can reach a review-ready view faster without losing visibility into what the source actually said.**

---

# 4. Problem

AI can already:

- summarize documents;
- extract numbers;
- answer questions;
- calculate ratios.

The trust problem occurs when an extracted number is semantically misinterpreted.

Example:

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
```

Both numbers may be correct.

Automatically selecting one for:

```text
EV / EBITDA
```

without preserving the accounting basis can produce a precise but misleading result.

Research Lens therefore separates:

```text
AI Interpretation
```

from:

```text
Deterministic Execution
```

---

# 5. Product Principles

## P1 — AI interprets

Claude is used to interpret messy report language.

---

## P2 — Deterministic Skills execute

Explicit calculations run as ordinary deterministic TypeScript functions.

---

## P3 — Evidence stays connected

Every consequential interpretation and skill result remains traceable to report evidence.

---

## P4 — Semantic uncertainty survives

A precise calculation must not hide unresolved semantic ambiguity.

---

## P5 — Analyst retains judgment

The system supports analysis.

It does not make the investment decision.

---

# 6. MVP Scope

The prototype supports:

- four built-in fictional investment reports;
- real Anthropic Claude inference;
- AI-generated semantic interpretation;
- evidence-linked analytical inputs;
- semantic lenses;
- semantic report navigation;
- `AUTO / ASK / ABSTAIN`;
- Deterministic Skills;
- `READY / NEEDS_REVIEW / BLOCKED`;
- analyst correction;
- downstream recalculation;
- BYOK Anthropic API configuration.

The prototype must run:

- locally;
- from a private GitHub repository;
- deployed publicly on Fly.io without login.

---

# 7. Explicit Non-Scope

The MVP does **not** include:

- PDF upload;
- OCR;
- external web research;
- multi-document analysis;
- vector database;
- RAG infrastructure;
- persistent database;
- authentication;
- user accounts;
- collaboration;
- financial-model export;
- portfolio management;
- autonomous investment recommendations;
- investment memo generation;
- production-grade observability;
- enterprise access controls;
- background job infrastructure;
- microservices;
- agent framework.

PDF upload is a future enhancement.

---

# 8. Technical Constraints

## TC-1 — Application architecture

Use one:

```text
Next.js + TypeScript
```

application.

The same repository contains:

- UI;
- server/API routes;
- sample fixtures;
- deterministic skill implementation;
- eval utilities where practical.

---

## TC-2 — Model provider

Use:

```text
Anthropic Claude API
```

for real AI interpretation.

No model abstraction layer is required for MVP.

---

## TC-3 — BYOK

The user supplies their Anthropic API key through the UI.

The prototype must not maintain a shared production model key.

Recommended behavior:

1. user enters Anthropic API key;
2. key is stored only in browser `sessionStorage`;
3. key is sent to the application's server route only when an inference request is made;
4. server uses the key for that request;
5. key is not written to logs;
6. key is not persisted;
7. key disappears when the browser session is cleared.

The prototype UI should state:

> **Your API key is used only for the current browser session and is not stored by Research Lens.**

---

## TC-4 — Persistence

No database.

Application state exists only for the current session.

This includes:

- selected report;
- interpretations;
- user corrections;
- calculated results.

Refreshing the application may reset current work.

That is acceptable for the demo.

---

## TC-5 — Deployment

The application must support:

```text
Local
npm install
npm run dev
```

and:

```text
Docker image
    ↓
Fly.io
```

Deployment architecture should remain minimal.

---

# 9. Built-In Sample Reports

The MVP ships with:

```text
Report_A_Clean.md
Report_B_Forecast.md
Report_C_Conflict.md
Report_D_Failure.md
```

All represent fictional:

> **Northstar Analytics, Inc.**

---

## Report A — Clean

Purpose:

Demonstrate successful automatic interpretation and Deterministic Skill execution.

Expected behavior:

```text
AUTO
READY
```

---

## Report B — Forecast

Purpose:

Demonstrate semantic distinction among:

- actual;
- forecast;
- target;
- approximate value;
- range.

---

## Report C — Conflict

Purpose:

Hero demo scenario.

Contains:

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
```

Expected:

```text
ASK
NEEDS_REVIEW
```

for EV / EBITDA.

---

## Report D — Failure

Purpose:

Demonstrate realistic difficult inputs.

Includes:

- table-level units;
- annual vs quarterly values;
- footnotes;
- approximate target;
- qualitative statement.

This report should expose where model behavior becomes uncertain or wrong.

---

# 10. Core User Journey

## J1 — Open application

User sees:

- Research Lens title;
- sample-report selector;
- Anthropic API key configuration.

---

## J2 — Configure Claude API key

If no key exists, user may browse reports but cannot run real AI interpretation.

Primary action:

```text
Set Anthropic API Key
```

After entry:

```text
API Key Configured
```

Never display the full key again.

---

## J3 — Select report

User selects one of:

```text
Clean
Forecast
Conflict
Failure
```

Report content appears immediately.

---

## J4 — Analyze report

User selects:

```text
Analyze Report
```

Application sends report text to Claude with a structured interpretation prompt.

During processing, show progressive states.

Example:

```text
Reading report...
Identifying financial inputs...
Resolving semantic context...
Checking conflicts...
Preparing analysis...
```

A simple implementation is acceptable.

---

## J5 — Review interpreted report

After inference, user sees:

- semantic navigation;
- report evidence;
- interpreted analytical inputs;
- trust state;
- deterministic skill state.

---

## J6 — Inspect evidence

Clicking an analytical input should reveal or highlight the supporting report text.

The analyst can compare:

```text
Source says
```

with:

```text
AI interprets
```

---

## J7 — Run Deterministic Skills

Skills whose required inputs are sufficiently resolved execute automatically.

Example:

```text
Revenue Growth
READY
23.2%
```

---

## J8 — Resolve ambiguity

If a skill depends on ambiguous input:

```text
EV / EBITDA
NEEDS REVIEW
```

The user sees candidate inputs.

Example:

```text
Adjusted EBITDA
$18.6M

Reported EBITDA
$14.2M
```

User selects the desired basis.

---

## J9 — Recalculate

After resolution:

```text
NEEDS_REVIEW
      ↓
READY
      ↓
Execute
```

The deterministic result is recalculated.

---

## J10 — Correct AI interpretation

User can change an important interpretation.

Examples:

```text
reported → adjusted
```

or:

```text
forecast → target
```

The application must:

1. update the input;
2. invalidate dependent results;
3. validate affected skills;
4. recalculate only if they return to `READY`.

---

# 11. Information Architecture

The main prototype uses four regions.

```text
┌─────────────────────────────────────────────────────────┐
│ Header / Report Selector / API Key                     │
├─────────────────────────────────────────────────────────┤
│ Lens: All | Financials | Risks | Timeline | Assumptions│
├──────────────┬──────────────────────────┬───────────────┤
│ Semantic     │ Original Report          │ Analysis      │
│ Navigation   │ + Evidence Highlights    │ / Skills      │
│              │                          │               │
└──────────────┴──────────────────────────┴───────────────┘
```

Responsive behavior may simplify this layout on small screens.

Desktop demo quality is the priority.

---

# 12. Header

Must contain:

- Research Lens product name;
- selected report;
- sample-report selector;
- `Analyze Report`;
- API key configuration.

Optional:

```text
Demo
```

badge.

No authentication controls.

---

# 13. Analytical Lenses

Top-level lenses:

```text
All
Financials
Risks
Timeline
Assumptions
```

Selecting a lens changes:

- highlighted evidence;
- visible semantic navigation items;
- relevant interpreted content.

The lens system should use AI interpretation output.

It does not need a separate model call.

---

# 14. Semantic Report Navigation

The left panel is not the document's physical table of contents.

It represents AI-generated analytical organization.

Suggested structure:

```text
Business
  Overview
  Customers

Financials
  Revenue
  Profitability
  Debt & Cash

Growth
  Historical
  Guidance
  Targets

Valuation
  Enterprise Value
  Multiples

Risks

Timeline

Assumptions
```

For the short sample reports, only sections containing content need to appear.

Avoid empty navigation categories.

---

# 15. Original Report Panel

The center panel remains the source-of-truth view.

Must support:

- full report text;
- current evidence highlight;
- click/scroll to evidence;
- visible table formatting for Report D.

The original report should visually remain more prominent than generated AI prose.

This reinforces:

> **Evidence first.**

---

# 16. Interpretation Card

Clicking a consequential interpretation should expose:

```text
Metric
Value
Unit
Period
Temporal Type
Basis
Precision
Trust State
Evidence
```

Example:

```text
EBITDA

Value:
$18.6M

Period:
FY2025

Type:
Actual

Basis:
Adjusted

Trust:
AUTO

Evidence:
"Northstar reported adjusted EBITDA of $18.6 million..."
```

Include:

```text
Edit Interpretation
```

for consequential fields.

---

# 17. Trust State Representation

Support three active MVP states:

## AUTO

Interpretation sufficiently resolved.

Suggested UI:

```text
Resolved
```

The internal state remains:

```text
AUTO
```

---

## ASK

Material ambiguity exists and user input is required.

Suggested UI:

```text
Needs Review
```

---

## ABSTAIN

System cannot responsibly create the requested analytical input.

Suggested UI:

```text
Insufficient Evidence
```

---

## NEVER

This is primarily policy behavior rather than a common card state.

If user-facing interaction later requests an autonomous investment recommendation, the system must decline.

A dedicated UI for `NEVER` is not required for MVP.

---

# 18. Deterministic Skills Panel

Right panel displays the initial supported skills.

MVP skills:

```text
Revenue Growth
Gross Margin
EBITDA Margin
Net Debt
EV / Revenue
EV / EBITDA
```

CAGR may remain implemented or deferred if unnecessary for the sample reports.

Avoid adding skills only to make the panel look fuller.

---

# 19. Skill Card

Example READY state:

```text
Revenue Growth

READY

FY2024 Revenue     $82.0M
FY2025 Revenue    $101.0M

23.2%

Formula:
(101 - 82) / 82
```

---

## NEEDS_REVIEW

Example:

```text
EV / EBITDA

NEEDS REVIEW

Multiple EBITDA definitions found:

Adjusted EBITDA
$18.6M

Reported EBITDA
$14.2M

Select basis to calculate.
```

No valuation result is displayed until resolved.

---

## BLOCKED

Example:

```text
EV / EBITDA

BLOCKED

Enterprise Value not available
from the source report.
```

Do not create a placeholder numerical result.

---

# 20. Deterministic Skill Implementation

Each skill should be an ordinary TypeScript function.

Example conceptual contract:

```text
validate inputs
    ↓
determine skill state
    ↓
if READY:
    calculate
else:
    return state + reason
```

No LLM calls inside skills.

Example:

```text
revenueGrowth(previousRevenue, currentRevenue)
```

returns the same result for the same valid inputs.

---

# 21. AI Interpretation Contract

Claude should return structured JSON compatible with the `AnalyticalInput` schema.

Minimum fields:

```text
input_id
metric
value
unit
currency
period
temporal_type
basis
precision
source
evidence_type
conflict_state
trust_state
materiality
resolved
```

The server must validate/parsing-check the response before using it.

If parsing fails:

```text
Analysis Failed
Retry
```

is acceptable.

Do not silently invent fallback analytical values.

---

# 22. AI Prompting Principle

The interpretation prompt should instruct Claude to:

1. identify consequential analytical inputs;
2. preserve semantic qualifiers;
3. distinguish actual / forecast / target;
4. distinguish reported / adjusted basis;
5. preserve approximate/range language;
6. return exact evidence text;
7. identify materially competing values;
8. avoid unsupported numerical inference;
9. return structured JSON only.

The prompt should emphasize:

> **Do not resolve material ambiguity merely to complete the output.**

---

# 23. Conflict Detection

The AI interpretation layer should identify candidate conflicts.

Example:

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
```

Expected:

```text
conflict_state = material_conflict
trust_state = ASK
```

The deterministic layer must independently enforce:

```text
no resolved input
→ no calculation
```

Do not rely only on Claude behaving correctly.

---

# 24. User Correction Flow

The user may edit:

- metric;
- value;
- period;
- temporal type;
- basis;
- precision.

After correction:

```text
interpretation updated
      ↓
dependent skill results invalidated
      ↓
skill contracts revalidated
      ↓
READY skills recalculated
```

For MVP, corrections persist only during the current session.

---

# 25. Evidence Lineage

Every deterministic result should expose:

```text
Result
  ↓
Formula
  ↓
Inputs
  ↓
Interpretation
  ↓
Evidence
```

Example:

```text
EV / FY2025 Adjusted EBITDA
34.9×

Formula
$650M / $18.6M

Enterprise Value
$650M
Source: report passage

Adjusted EBITDA
$18.6M
Source: report passage
```

Exact page numbers are unnecessary because sample reports are text fixtures.

Use source section/evidence snippet instead.

---

# 26. Real AI vs Fixture Behavior

## Must be real

The following should come from live Claude inference:

- analytical input extraction;
- semantic normalization;
- temporal type;
- basis;
- precision;
- evidence association;
- conflict identification.

---

## Must be deterministic

The following must come from application code:

- formula calculation;
- skill input validation;
- skill execution state;
- result invalidation after correction.

---

## Built-in fixtures

Sample reports and ground truth live in the repository.

Ground truth is not supplied to Claude during normal prototype inference.

It is used only for:

- development;
- eval;
- validation.

---

# 27. Demo Reliability

The working demo should use real inference.

However, the repository may contain stored example outputs for:

- development comparison;
- offline debugging;
- emergency demo reference.

The primary interview path should demonstrate live inference when available.

Do not falsely represent precomputed output as live model output.

---

# 28. Loading and Latency UX

Initial report interpretation may take several seconds.

Instead of only:

```text
Loading...
```

show a simple progressive sequence:

```text
Reading report...
Finding analytical inputs...
Checking semantic context...
Checking conflicts...
Preparing skills...
```

These states may be UI progress stages rather than true backend pipeline stages.

Do not pretend they represent exact internal model progress.

---

# 29. Error Handling

## API key missing

Show:

```text
Anthropic API key required to analyze this report.
```

---

## Invalid key

Show:

```text
Claude request failed.
Check your API key and try again.
```

Never log or display the complete key.

---

## Claude request failure

Show:

```text
Analysis failed.
Retry
```

Existing report remains visible.

---

## Invalid structured output

Show:

```text
Unable to interpret the model response safely.
Retry analysis.
```

Do not attempt to calculate from partially parsed uncertain output.

---

# 30. Functional Requirements

## FR-01

User can select any of four built-in reports.

## FR-02

User can configure an Anthropic API key.

## FR-03

User can trigger real Claude analysis.

## FR-04

System converts Claude output into structured analytical inputs.

## FR-05

System shows source evidence for consequential inputs.

## FR-06

System displays semantic lenses.

## FR-07

System displays semantic report navigation.

## FR-08

System supports `AUTO / ASK / ABSTAIN`.

## FR-09

System evaluates deterministic skill contracts.

## FR-10

System supports `READY / NEEDS_REVIEW / BLOCKED`.

## FR-11

READY skills calculate deterministically.

## FR-12

NEEDS_REVIEW skills do not calculate.

## FR-13

BLOCKED skills do not calculate.

## FR-14

User can resolve material candidate ambiguity.

## FR-15

User can correct important interpretation fields.

## FR-16

Dependent results invalidate after correction.

## FR-17

Corrected valid inputs trigger deterministic recalculation.

## FR-18

Application runs locally.

## FR-19

Application is deployable to Fly.io.

## FR-20

Public deployment requires no login.

---

# 31. Non-Functional Requirements

Because this is a demo, non-functional requirements are intentionally limited.

## NFR-01 — Demo reliability

The four sample reports should repeatedly load correctly.

---

## NFR-02 — Deterministic correctness

Given valid inputs:

```text
calculation accuracy = 100%
```

---

## NFR-03 — Secret handling

Anthropic API keys must not be persisted or logged intentionally.

---

## NFR-04 — Explainability

Every consequential calculated result must expose its inputs and evidence lineage.

---

## NFR-05 — Desktop usability

Primary demo should work clearly on a standard laptop-sized browser.

---

## NFR-06 — Simplicity

Prefer fewer dependencies and less infrastructure when two solutions provide equivalent demo value.

---

# 32. Prototype Success Criteria

The prototype is successful if it can demonstrate all five behaviors below.

## SC-1 — Clean automation

Using Report A:

```text
clear evidence
→ AUTO
→ READY
→ deterministic calculation
```

---

## SC-2 — Forward-looking semantics

Using Report B:

The prototype correctly distinguishes:

```text
actual
forecast
target
range
```

without collapsing them.

---

## SC-3 — Material ambiguity

Using Report C:

```text
multiple EBITDA definitions
→ ASK
→ EV / EBITDA NEEDS_REVIEW
```

No result appears until analyst resolves basis.

---

## SC-4 — Analyst correction

User changes an interpretation.

Dependent result is invalidated and recalculated correctly.

---

## SC-5 — Difficult input behavior

Using Report D:

The system either:

- interprets difficult input correctly;
- asks;
- abstains;
- visibly fails.

It should not silently create a confidently precise unsupported result.

---

# 33. What the Prototype Does Not Need to Prove

The prototype does not need to prove:

- large-scale PDF ingestion;
- OCR quality;
- multi-document performance;
- financial-data coverage;
- enterprise security readiness;
- multi-tenant infrastructure;
- model cost at production scale;
- real portfolio outcomes.

Those belong in the productionization discussion, not the prototype implementation.

---

# 34. Suggested Repository Structure

Keep the repository simple.

```text
research-lens/
├── app/
│   ├── api/
│   │   └── analyze/
│   ├── page.tsx
│   └── layout.tsx
│
├── components/
│   ├── ApiKeyDialog.tsx
│   ├── ReportSelector.tsx
│   ├── LensBar.tsx
│   ├── SemanticNav.tsx
│   ├── ReportViewer.tsx
│   ├── InterpretationCard.tsx
│   └── SkillPanel.tsx
│
├── lib/
│   ├── anthropic.ts
│   ├── interpretation.ts
│   ├── skill-engine.ts
│   └── skills/
│       ├── revenue-growth.ts
│       ├── gross-margin.ts
│       ├── ebitda-margin.ts
│       ├── net-debt.ts
│       ├── ev-revenue.ts
│       └── ev-ebitda.ts
│
├── data/
│   ├── Report_A_Clean.md
│   ├── Report_B_Forecast.md
│   ├── Report_C_Conflict.md
│   ├── Report_D_Failure.md
│   └── Ground_Truth.jsonl
│
├── types/
│   └── analytical-input.ts
│
├── eval/
│
├── Dockerfile
├── fly.toml
├── package.json
└── README.md
```

This is guidance, not a rigid architecture requirement.

Claude Code may propose modest simplifications.

---

# 35. Claude Code Build Strategy

Do not ask Claude Code to build the full product in one prompt.

Recommended sequence:

## BUILD-1 — Scaffold

Build:

- Next.js app;
- basic three-column layout;
- report selector;
- static sample reports.

No Claude API yet.

---

## BUILD-2 — Interpretation types

Implement:

- `AnalyticalInput` TypeScript types;
- fixture loading;
- interpretation-card rendering.

Use temporary fixture output.

---

## BUILD-3 — Claude integration

Implement:

- BYOK dialog;
- `/api/analyze`;
- Anthropic request;
- structured output parsing.

---

## BUILD-4 — Evidence interaction

Implement:

- evidence snippets;
- report highlight/jump behavior;
- interpretation selection.

---

## BUILD-5 — Deterministic skill engine

Implement:

- skill contracts;
- READY / NEEDS_REVIEW / BLOCKED;
- calculations.

---

## BUILD-6 — Conflict flow

Implement Report C behavior:

```text
ASK
→ user selects basis
→ READY
→ calculation
```

This is the most important product interaction.

---

## BUILD-7 — Correction flow

Implement:

- edit interpretation;
- invalidate results;
- revalidate;
- recalculate.

---

## BUILD-8 — Lenses and semantic navigation

Add:

```text
All
Financials
Risks
Timeline
Assumptions
```

Keep lightweight.

---

## BUILD-9 — Eval harness

Run built-in reports against ground truth.

Capture major semantic and skill-gating failures.

---

## BUILD-10 — Deployment

Add:

- Dockerfile;
- Fly.io configuration;
- README;
- deployment validation.

---

# 36. Manual Intervention Expectation

Claude Code is a development assistant, not the final product authority.

Record cases where:

- generated implementation violates trust policy;
- skill logic incorrectly resolves ambiguity;
- UI hides evidence;
- Claude output schema becomes overcomplicated;
- generated architecture adds unnecessary infrastructure.

A particularly valuable build-log story would be:

> **Claude Code initially implemented EV / EBITDA by selecting the first EBITDA value returned by the model. I changed the skill contract so a material conflict produces NEEDS_REVIEW and calculation is impossible until the analyst resolves the basis.**

This demonstrates product judgment rather than merely AI-assisted coding.

---

# 37. Demo-Critical Path

If implementation time becomes constrained, prioritize in this order:

```text
1. Sample report loading
2. Real Claude inference
3. Structured analytical inputs
4. Evidence display
5. Deterministic calculations
6. Report C conflict gating
7. User resolution
8. Correction/recalculation
9. Lenses
10. Semantic navigation polish
```

The demo is successful even if later visual polish is limited.

---

# 38. Cut List

If scope becomes too large, cut in this order:

1. CAGR
2. advanced semantic navigation
3. elaborate loading animation
4. Report D special UI treatment
5. rich edit forms
6. visual styling polish beyond basic professionalism

Do **not** cut:

- evidence;
- semantic qualifiers;
- Report C ambiguity;
- skill gating;
- deterministic calculations;
- correction/recalculation.

Those are the product thesis.

---

# 39. Demo Boundary Statement

If asked why the prototype is intentionally small:

> **I deliberately kept the implementation narrow because I wanted to test the difficult product decision, not simulate an entire investment platform. The prototype uses four controlled reports and real model inference so I can directly test whether exposing semantic interpretation and gating deterministic analysis improves trust.**

---

# 40. Decision Summary

| ID | Decision |
|---|---|
| TECH-1 | Single Next.js + TypeScript application |
| TECH-2 | Anthropic Claude API |
| TECH-3 | Real inference |
| TECH-4 | BYOK through UI |
| TECH-5 | No database |
| TECH-6 | Session-only state |
| TECH-7 | Four built-in reports |
| TECH-8 | PDF upload deferred |
| TECH-9 | Local + Fly.io |
| TECH-10 | Private GitHub source |
| TECH-11 | No agent framework by default |
| TECH-12 | Deterministic Skills are plain TypeScript |
| MVP-1 | Evidence remains central |
| MVP-2 | Report C conflict is hero interaction |
| MVP-3 | Skill gating is deterministic |
| MVP-4 | User corrections invalidate downstream results |
| MVP-5 | Demo simplicity outweighs production architecture |