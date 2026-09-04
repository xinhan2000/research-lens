---
artifact_id: approaches_considered
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - product_thesis_and_hypothesis
  - competitor_alternatives
  - autonomy_policy
used_by:
  - prd
  - prototype
  - demo_runbook
---

# Approaches Considered

## 1. Purpose

This document records the major product approaches considered for Research Lens, their advantages, their weaknesses, and why the evidence-first analytical workbench was selected.

The decision was evaluated using three primary criteria:

### C1 — Evidence visibility

Can the analyst easily understand where an important interpretation came from?

### C2 — Interpretation correctability

Can the analyst inspect and correct what the AI believes the information means?

### C3 — Safe downstream leverage

Can resolved information feed deterministic analytical operations without propagating unresolved semantic uncertainty?

A fourth practical criterion is:

### C4 — Prototype focus

Can the hardest product hypothesis be demonstrated clearly in a small working prototype?

---

# 2. Approach A — Chat-First

## Concept

The analyst uploads a report and interacts primarily through conversation.

Example:

```text
Analyst:
What was FY2025 EBITDA?

AI:
Adjusted EBITDA was $18.6 million.
```

Follow-up:

```text
Analyst:
What's the EV / EBITDA multiple?
```

---

## Why it is attractive

- familiar interaction model;
- very low learning curve;
- flexible;
- handles unpredictable questions;
- quick to prototype;
- useful for exploratory research.

---

## Core weakness

Chat tends to compress multiple internal operations into a single answer.

For example:

```text
Source
  ↓
Find number
  ↓
Interpret number
  ↓
Select definition
  ↓
Calculate
  ↓
Answer
```

may appear to the analyst simply as:

```text
EV / EBITDA = 34.9×
```

If the answer is wrong, it can be difficult to know whether the failure was:

- retrieval;
- metric identity;
- period;
- accounting basis;
- source interpretation;
- calculation.

---

## Product decision

`REJECT AS PRIMARY MVP`

Chat may later complement the product, but should not be the main interface for testing the trust hypothesis.

---

## What we may reuse later

Natural-language requests can eventually initiate skills:

> “Show me FY2025 valuation metrics.”

But the resulting analytical inputs should still be inspectable.

---

# 3. Approach B — AI Summary / Investment Tearsheet

## Concept

Upload report → generate concise investment summary.

Example:

```text
Company
Business overview
Key financials
Growth drivers
Risks
Catalysts
Valuation
```

---

## Why it is attractive

- visually compelling;
- immediately useful;
- easy to demo;
- reduces reading time;
- mirrors common analyst deliverables.

---

## Core weakness

A summary solves:

> **information compression**

more than:

> **trustworthy analytical transformation**

It can remove exactly the surrounding context needed to understand:

- whether a number is historical or forward;
- whether EBITDA is adjusted;
- whether a value is approximate;
- whether management called something guidance or merely a target.

---

## Example

Original:

> Management is working toward roughly $25 million of EBITDA next year, but described this as an internal planning objective rather than formal guidance.

Summary might become:

```text
FY2026 EBITDA: $25M
```

The summary is shorter.

It is also substantially more dangerous.

---

## Product decision

`REJECT AS PRIMARY MVP`

A summary could eventually be generated **after** underlying analytical inputs are trusted.

---

## What we may reuse later

Research Lens may ultimately create a tearsheet from verified interpretations.

Sequence:

```text
Trusted Inputs
     ↓
Deterministic Analysis
     ↓
Summary
```

rather than:

```text
Raw Report
     ↓
Generated Summary
```

---

# 4. Approach C — Structured Extraction Grid

## Concept

Convert the document immediately into a table.

Example:

| Metric | FY24 | FY25 | FY26E |
|---|---:|---:|---:|
| Revenue | $82M | $101M | $128M |
| EBITDA | — | $18.6M | $25M |
| Margin | — | 18.4% | — |

---

## Why it is attractive

- systematic;
- easy to scan;
- comparable;
- exportable;
- useful for models;
- good for repetitive workflows.

---

## Core weakness

The grid can make an interpretation look like established fact too early.

The transformation:

```text
messy report
    ↓
cell = $25M
```

hides questions such as:

- target or forecast?
- exact or approximate?
- adjusted or reported?
- what period does “next year” mean?
- was the figure extracted from prose or calculated?

Structured presentation can unintentionally create **false certainty**.

---

## Product decision

`REJECT AS PRIMARY INTERACTION`

Structured data remains essential underneath Research Lens.

But the grid should be downstream of the trust model rather than replacing it.

---

## What we reuse

The `AnalyticalInput` schema is essentially a trustworthy structured layer.

The difference is that Research Lens keeps:

```text
structure + evidence + semantic qualifiers + trust state
```

rather than only:

```text
metric + value
```

---

# 5. Approach D — Autonomous Investment Agent

## Concept

The analyst provides a report and asks:

> “Analyze this company and tell me whether we should invest.”

The agent autonomously:

1. reads the report;
2. extracts financials;
3. identifies risks;
4. calculates valuation;
5. generates thesis;
6. recommends Invest / Pass.

---

## Why it is attractive

- maximum automation;
- strong AI story;
- compelling demo;
- appears to save the most analyst time.

---

## Core weakness

It compounds uncertainty across multiple semantic steps.

Example:

```text
Wrong EBITDA interpretation
        ↓
Wrong EBITDA margin
        ↓
Wrong EV / EBITDA
        ↓
Wrong valuation assessment
        ↓
Wrong investment thesis
        ↓
Invest / Pass
```

Every downstream step can look internally coherent.

The initial semantic error becomes harder to detect as the chain grows.

---

## Additional product issue

The final capital-allocation judgment is precisely where Research Lens should **not** seek autonomy in the MVP.

The system should improve analyst judgment, not simulate replacing it.

---

## Product decision

`REJECT`

Specifically prohibited by the Research Lens autonomy policy.

---

## What we may reuse later

Agentic orchestration could later coordinate bounded tasks such as:

```text
identify relevant inputs
→ validate them
→ run approved skills
→ assemble evidence package
```

But material ambiguity and investment judgment remain controlled.

---

# 6. Approach E — Evidence-First Analytical Workbench

## Concept

Keep the original report central.

AI interprets meaningful content into structured analytical inputs.

The analyst can inspect:

```text
What did the source say?
        ↓
What does AI think it means?
        ↓
Is that interpretation sufficiently resolved?
        ↓
What deterministic analysis can safely use it?
```

---

## Core interaction

```text
Original Report
      ↓
Highlighted Evidence
      ↕
AI Interpretation
      ↓
Trust State
      ↓
Resolved Input
      ↓
Deterministic Skill
```

---

## Example

Report:

> Adjusted EBITDA was $18.6M.

Interpretation:

```text
Metric: EBITDA
Value: $18.6M
Period: FY2025
Type: Actual
Basis: Adjusted
Evidence: p.18
```

Then:

```text
EV / EBITDA
READY
```

But if the report also contains:

```text
Reported EBITDA = $14.2M
```

the product becomes:

```text
EV / EBITDA

NEEDS REVIEW

Adjusted EBITDA   $18.6M
Reported EBITDA   $14.2M

Select basis before calculation.
```

---

# 7. Why This Approach Was Chosen

## Reason 1 — It exposes the hardest problem

The interesting product problem is not:

> Can an LLM find EBITDA?

It is:

> **When is an interpreted EBITDA sufficiently trustworthy to become an input to something else?**

The workbench exposes that directly.

---

## Reason 2 — Errors are easier to diagnose

The analyst can distinguish:

```text
Evidence wrong?
Interpretation wrong?
Input wrong?
Skill wrong?
```

rather than only observing a bad final answer.

---

## Reason 3 — It supports asymmetric error handling

Clear facts:

```text
AUTO
```

Material ambiguity:

```text
ASK
```

Insufficient evidence:

```text
ABSTAIN
```

Prohibited judgment:

```text
NEVER
```

---

## Reason 4 — Deterministic leverage becomes safe

Once the semantic input is resolved:

```text
AI judgment stops
      ↓
Deterministic Skill begins
```

This is the central architectural boundary.

---

## Reason 5 — It is highly evaluable

Each layer can be scored independently:

```text
Value
Metric
Period
Basis
Evidence
Conflict
Autonomy
Skill gate
Calculation
```

This gives us much better failure diagnostics than scoring a generated investment memo.

---

## Reason 6 — It is appropriate for the prototype

The hardest interaction can be demonstrated with:

- one report;
- a few metrics;
- several deterministic skills;
- one material conflict.

We do not need to build an entire investment platform to test the hypothesis.

---

# 8. Decision Matrix

| Approach | Evidence Visibility | Interpretation Correctability | Safe Deterministic Handoff | MVP Focus |
|---|---|---|---|---|
| Chat | Medium | Low | Low–Medium | High |
| AI Summary | Low–Medium | Low | Low | High |
| Extraction Grid | Medium | Medium | Medium | Medium |
| Autonomous Agent | Low | Low | Low | Low |
| **Evidence-First Workbench** | **High** | **High** | **High** | **High** |

The scoring is a product judgment for this specific hypothesis, not a claim that the other interaction patterns are generally inferior.

---

# 9. What We Are Explicitly Not Solving

The chosen approach intentionally leaves out:

- full multi-document research;
- external market data;
- investment recommendation;
- automated memo generation;
- full Excel replacement;
- portfolio management;
- broad collaboration workflows;
- general-purpose chat.

These may be valuable.

They are not required to test the hypothesis.

---

# 10. What Competitive Research Changed

The earliest concept risked becoming:

> an AI investment-research workspace with chat, extraction, analysis, and summaries.

Competitive research showed that this would overlap heavily with existing sophisticated platforms.

So rather than adding capabilities, we **removed them**.

The final MVP asks one narrower question:

> **Can we create a safer and more transparent handoff between AI interpretation and deterministic financial analysis?**

This is the product decision we want the prototype to test.

---

# 11. Interview Answer — Why This Approach?

> **I considered a chat interface first because it's flexible and easy to build. I also considered a generated investment summary, a structured extraction grid, and a more autonomous research agent.**
>
> **The problem with all four is that they can hide the most important failure point. The model might extract the right number but misunderstand whether it's adjusted, reported, historical, or forward. Once that interpretation gets buried in a grid or feeds a calculation, the output starts looking authoritative.**
>
> **So I chose an evidence-first workbench. The report stays visible, AI interpretations are inspectable, material ambiguity stops downstream analysis, and deterministic skills only run after their required inputs are resolved. That lets me test the trust hypothesis directly without building a huge research platform.**

---

# 12. Decision Summary

| ID | Decision |
|---|---|
| APP-1 | Chat-first rejected as primary interface |
| APP-2 | AI summary deferred until inputs are trusted |
| APP-3 | Structured grid remains supporting infrastructure, not primary trust UX |
| APP-4 | Autonomous investment agent explicitly rejected |
| APP-5 | Evidence-first analytical workbench selected |
| APP-6 | Original evidence remains central |
| APP-7 | Semantic interpretation is directly correctable |
| APP-8 | Deterministic Skills begin only after semantic resolution |