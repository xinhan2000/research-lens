---
artifact_id: product_thesis_and_hypothesis
product: Research Lens
version: 0.2
status: approved_baseline
last_updated: 2026-09-04
depends_on: []
used_by:
  - autonomy_policy
  - semantic_schema
  - eval_design
  - prd
  - prototype
  - business_case
---

# Research Lens — Product Thesis and Hypothesis

## 1. Purpose

This document defines the core product thesis for **Research Lens**.

It is intentionally limited to:

- the primary user;
- the job they are trying to complete;
- the underlying problem;
- the role AI should play;
- the role Deterministic Skills should play;
- the core product hypothesis;
- conditions that would invalidate that hypothesis;
- the initial product boundary.

Detailed features, UI design, calculation definitions, implementation architecture, eval metrics, and business model are defined in later artifacts.

---

## 2. Terminology

### TERM-1 — AI Interpretation

**AI Interpretation** is the use of an AI model to infer meaning from unstructured or semantically ambiguous information.

Examples include determining:

- what a financial number represents;
- which reporting period it belongs to;
- whether it is historical or forecast;
- whether it is reported or adjusted;
- whether a statement is a fact, assumption, target, or risk;
- whether two values represent conflicting or alternative definitions.

AI Interpretation may produce uncertainty and should preserve that uncertainty when it is material.

---

### TERM-2 — Resolved Analytical Input

A **Resolved Analytical Input** is an interpreted value whose meaning is sufficiently established for a downstream deterministic operation.

A resolved input may include:

- metric;
- value;
- unit;
- currency;
- period;
- actual vs. forecast;
- reported vs. adjusted basis;
- source evidence;
- any other qualifiers required by the consuming skill.

An input is not considered resolved if a material ambiguity remains that could change the analytical result.

---

### TERM-3 — Deterministic Skill

A **Deterministic Skill** is a bounded, reusable analytical operation with:

- explicit input requirements;
- deterministic logic;
- reproducible outputs;
- testable behavior;
- no semantic discretion over materially unresolved inputs.

Examples include:

- Revenue Growth;
- CAGR;
- EBITDA Margin;
- Net Debt;
- EV / Revenue;
- EV / EBITDA.

A Deterministic Skill may consume an AI-interpreted input only after that input satisfies the product's trust policy.

A Deterministic Skill must not decide what an ambiguous input means.

---

## 3. Primary Persona

### PERS-1 — Investment Analyst

The primary user is an **investment analyst working at a private investment firm, family office, private equity firm, growth equity firm, or similar professional investment organization**.

The analyst regularly reviews long-form investment materials such as:

- company research reports;
- management or diligence materials;
- investment reports;
- financial analyses;
- industry research;
- related company documents.

The analyst is expected to convert these materials into a structured understanding of:

- business performance;
- financial results;
- growth drivers;
- assumptions;
- risks;
- valuation inputs;
- important future events.

Their work ultimately supports an investment decision made by the analyst, portfolio manager, investment lead, or investment committee.

### Persona boundary

Research Lens is **not initially designed for**:

- retail investors;
- general-purpose document readers;
- investment bankers preparing deal materials;
- accountants performing formal financial reporting;
- automated trading systems;
- autonomous investment agents.

These users may benefit from similar capabilities later, but they are outside the initial product hypothesis.

---

## 4. Job to Be Done

### JTBD-1 — Move from report to review-ready analysis

> **When I receive a long investment report, help me identify, understand, verify, and use the important facts, assumptions, risks, and financial inputs so I can reach a review-ready analytical view without manually reconstructing the report.**

The analyst's real job is not simply:

> “Read this report.”

Nor is it:

> “Summarize this report.”

The actual job is closer to:

> **Convert unstructured investment information into trustworthy analytical inputs that can support financial analysis and investment judgment.**

---

## 5. Current Workflow

A simplified current workflow is:

1. Receive a long investment report.
2. Read and navigate the document manually.
3. Identify important financial facts and business claims.
4. Highlight or take notes.
5. Determine what each number actually represents.
6. Distinguish historical facts from forecasts and assumptions.
7. Resolve different definitions or conflicting numbers.
8. Copy selected values into notes, spreadsheets, or models.
9. Perform calculations.
10. Return to the source document to verify questionable inputs.
11. Build an analytical view or investment thesis.

### Core friction

The expensive and risky part is not arithmetic.

The difficult transition is:

> **unstructured language → interpreted financial meaning → analytical input**

Each transition creates an opportunity for semantic error.

For example, a report may contain all of the following:

- reported EBITDA;
- adjusted EBITDA;
- forward EBITDA;
- management EBITDA target.

All four numbers may be correct.

Using the wrong one in a valuation calculation can still produce a materially wrong conclusion.

---

## 6. Problem Statement

### PROB-1 — Analysts need trustworthy interpretation, not just extraction

Modern AI can already summarize documents, answer questions, and extract numbers.

The harder problem is determining whether an extracted value has been interpreted correctly enough to use in downstream analysis.

Important semantic distinctions include:

- actual vs. forecast;
- reported vs. adjusted;
- annual vs. quarterly;
- historical vs. management target;
- exact vs. approximate;
- enterprise value vs. equity value;
- current period vs. future period;
- one metric definition vs. another.

A system can extract the correct number while still assigning the wrong meaning to it.

---

### PROB-2 — Deterministic precision can amplify semantic mistakes

Once an incorrect interpretation becomes a structured input, a Deterministic Skill can produce a perfectly precise result from it.

Therefore:

> **Correct arithmetic does not make an analysis trustworthy if the input was semantically wrong.**

This is the primary trust problem Research Lens is designed to address.

---

### PROB-3 — Existing AI interfaces can hide the interpretation step

A conventional AI workflow often appears as:

> Document → AI answer

Research Lens treats the hidden middle step as a first-class product object:

> **Evidence → AI Interpretation → Resolved Analytical Inputs → Deterministic Skills → Analytical Results**

The analyst should be able to inspect and correct important interpretations before consequential skills depend on them.

---

## 7. Product Thesis

### THESIS-1

> **Research Lens helps investment analysts move safely from what a report says to what they calculate from it.**

The product keeps the original evidence visible while AI converts messy language into structured analytical meaning.

Only after that meaning is sufficiently resolved should Deterministic Skills consume it.

---

## 8. Core Product Principles

### P1 — AI interprets

Use AI where meaning is messy, contextual, or ambiguous.

Examples include determining:

- what a number represents;
- which period it belongs to;
- whether it is actual or forecast;
- whether it is reported or adjusted;
- whether a passage describes a risk or assumption;
- whether two values represent competing definitions.

AI is used because these tasks require semantic interpretation rather than simple rules.

---

### P2 — Deterministic Skills execute

Once analytical inputs are sufficiently resolved, calculations and bounded rule-based analysis should be performed by deterministic, testable skills rather than delegated to an LLM.

A Deterministic Skill has:

- explicit required inputs;
- deterministic logic;
- reproducible output;
- testable behavior.

Example:

**Skill:** EV / EBITDA

**Required inputs:**
- Enterprise Value
- EBITDA
- EBITDA basis
- EBITDA period

**Logic:**
- Enterprise Value / EBITDA

**Output:**
- Valuation multiple

The skill does **not** decide which EBITDA definition the analyst intended.

That decision belongs to the interpretation and trust layer.

---

### P3 — Evidence stays connected

Every important AI interpretation should remain traceable to the original report evidence.

Every Deterministic Skill result should remain traceable to:

1. the skill and formula used;
2. the inputs consumed;
3. the AI interpretation of each input;
4. the original report evidence supporting each input.

The desired forward lineage is:

> **Evidence → Interpretation → Input → Skill → Result**

The desired reverse lineage is:

> **Result → Skill → Inputs → Interpretation → Evidence**

The analyst should be able to move backward through that chain.

---

### P4 — Preserve semantic uncertainty

> **Never let deterministic precision hide unresolved semantic uncertainty.**

A precise result must not imply that the underlying interpretation was certain.

If a skill depends on a materially unresolved input, the skill must not execute.

For example:

> Adjusted EBITDA = $52M

and

> Reported EBITDA = $41M

should not automatically become:

> EV / EBITDA = 12.5×

until the appropriate EBITDA definition has been resolved.

---

### P5 — Support analyst judgment rather than replace it

Research Lens should compress information-processing effort while leaving consequential investment judgment with the analyst.

The system can:

- organize evidence;
- interpret financial information;
- identify uncertainty;
- expose conflicts;
- execute bounded Deterministic Skills.

It should not automatically make the capital-allocation decision.

---

## 9. Core Product Hypothesis

### H1 — Trustworthy semantic-to-deterministic handoff

> **If investment analysts can inspect and correct AI-interpreted analytical inputs before Deterministic Skills consume them, they will reach a review-ready analytical view faster while maintaining greater trust than with workflows that hide the interpretation step.**

The hypothesis contains three linked assumptions.

---

### H1-A — Interpretation is a meaningful bottleneck

A meaningful portion of analyst effort is spent not merely finding information, but deciding what extracted information actually means.

---

### H1-B — Inspectability improves trust

Analysts will value seeing and correcting important interpretations rather than receiving only AI-generated conclusions.

---

### H1-C — Deterministic Skills create safe downstream leverage

Once semantic inputs are sufficiently resolved, reusable Deterministic Skills can automate repetitive analytical work without introducing additional semantic discretion.

---

## 10. What Would Falsify the Hypothesis

### F1 — Interpretation is not a meaningful bottleneck

The hypothesis weakens if analysts report that identifying and normalizing analytical inputs takes little time relative to other parts of investment research.

---

### F2 — Inspectability creates more work than value

The hypothesis weakens if analysts spend so much time reviewing AI interpretations that the product does not materially reduce their overall effort.

---

### F3 — Analysts still independently reconstruct the analysis

The hypothesis fails if users routinely reproduce calculations manually because they do not trust the system's interpreted inputs.

A strong failure signal would be:

> **Research Lens produces outputs, but analysts still rebuild the same analysis elsewhere before relying on it.**

---

### F4 — Critical semantic accuracy cannot reach an acceptable quality level

The hypothesis weakens if important distinctions such as:

- actual vs. forecast;
- adjusted vs. reported;
- period;
- unit;
- metric definition;

cannot be interpreted reliably enough at an economically reasonable cost.

---

### F5 — The workflow does not generate repeat usage

The product hypothesis weakens if analysts find the experience interesting during initial use but do not repeatedly use it for real report-review tasks.

---

## 11. Initial Scope Boundary

Research Lens initially focuses on:

> **Helping one professional investment analyst understand one investment report and safely use interpreted information through a small set of Deterministic Skills.**

### In scope at the hypothesis level

- one investment report;
- AI interpretation of consequential report information;
- preservation of original evidence;
- analyst visibility into important interpretations;
- explicit handling of semantic ambiguity;
- Deterministic Skills operating only on sufficiently resolved analytical inputs.

---

## 12. Explicit Non-Goals

### NG1 — No autonomous investment recommendation

The system does not decide:

- Invest;
- Don't Invest;
- Buy;
- Sell;
- Pass.

---

### NG2 — No autonomous investment thesis

The system does not independently synthesize and publish the final investment thesis.

---

### NG3 — No LLM-dependent deterministic work

Any analytical operation that can be expressed using explicit deterministic logic should be implemented as a Deterministic Skill rather than delegated to an LLM.

Examples include:

- arithmetic;
- growth rates;
- margins;
- CAGR;
- valuation multiples;
- unit conversions;
- threshold comparisons;
- formula-based transformations.

Determining what an input means remains an AI Interpretation problem.

---

### NG4 — No silent resolution of material ambiguity

When multiple plausible interpretations could materially affect analysis, the system should not silently choose one.

---

### NG5 — No full autonomous financial model

The initial product does not automatically build and populate an end-to-end financial model.

---

### NG6 — No general-purpose report chatbot

Free-form document Q&A is not the primary product experience in the MVP.

---

### NG7 — No external research

The initial product reasons only over the provided report.

It does not silently introduce external market data, web research, or third-party financial information.

---

### NG8 — No multi-document research

Cross-report, cross-company, and longitudinal analysis are deferred until single-report interpretation can be trusted.

---

### NG9 — No autonomous external actions

The system does not:

- execute trades;
- send investment recommendations;
- approve investments;
- modify production portfolio systems;
- publish research without user action.

---

### NG10 — No semantic discretion inside Deterministic Skills

A Deterministic Skill must not silently resolve ambiguity in its required inputs.

For example, an `EV / EBITDA` skill may not decide:

> “Adjusted EBITDA looks more appropriate, so I will use that.”

If multiple materially different EBITDA inputs remain valid, the interpretation and trust layer must resolve the ambiguity before the skill can execute.

---

## 13. Primary Trust Boundary

The central product boundary is:

> **AI may propose what information means. Deterministic Skills may operate on sufficiently resolved meaning. The analyst retains authority over material ambiguity and investment judgment.**

The simplified operating model is:

> **AI interprets. Deterministic Skills execute. Evidence connects both.**

The primary safety rule is:

> **No Deterministic Skill executes on materially unresolved inputs.**

Research Lens should therefore optimize not for maximum automation, but for:

> **maximum useful automation inside a clearly defined trust boundary.**

---

## 14. One-Sentence Product Definition

> **Research Lens is an evidence-first investment report workspace that uses AI to turn messy report language into inspectable analytical inputs, then applies Deterministic Skills to sufficiently resolved inputs while preserving uncertainty and source evidence.**

---

## 15. Decision Summary

| ID | Decision |
|---|---|
| PERS-1 | Primary user is a professional investment analyst |
| JTBD-1 | Move from long report to review-ready analysis |
| THESIS-1 | Safely bridge report language and analytical calculation |
| TERM-1 | AI Interpretation resolves semantic meaning |
| TERM-2 | Resolved Analytical Inputs are sufficiently clear for downstream use |
| TERM-3 | Deterministic Skills are bounded, reusable, testable analytical operations |
| P1 | AI interprets |
| P2 | Deterministic Skills execute |
| P3 | Evidence remains connected throughout |
| P4 | Deterministic precision must not hide semantic uncertainty |
| P5 | Product supports rather than replaces investment judgment |
| H1 | Inspectable interpretation + Deterministic Skills improve speed without sacrificing trust |
| NG1 | No autonomous investment recommendation |
| NG3 | No LLM-dependent deterministic work |
| NG4 | No silent material ambiguity resolution |
| NG6 | No generic chatbot in MVP |
| NG7 | No external research in MVP |
| NG8 | No multi-document research in MVP |
| NG10 | No semantic discretion inside Deterministic Skills |

---

## 16. Open Questions Deferred to Later Artifacts

The following are intentionally unresolved here:

- exact autonomy thresholds;
- what constitutes material ambiguity;
- semantic interpretation schema;
- supported Deterministic Skills;
- skill input contracts;
- skill execution states;
- confidence representation;
- correction workflow;
- eval dataset and quality thresholds;
- UI structure;
- model selection;
- latency requirements;
- cost architecture;
- business metrics;
- roadmap prioritization.

These will be resolved in subsequent project artifacts.