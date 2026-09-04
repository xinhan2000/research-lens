---
artifact_id: competitor_alternatives
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - product_thesis_and_hypothesis
  - autonomy_policy
used_by:
  - approaches_considered
  - prd
  - business_case
  - demo_runbook
---

# Competitor Alternatives

## 1. Purpose

This document identifies the closest existing alternatives to Research Lens and clarifies the product hypothesis we are actually testing.

Research Lens is **not** based on the claim that existing AI products cannot:

- read financial documents;
- extract numbers;
- provide citations;
- calculate metrics;
- organize research;
- work across multiple documents.

Several existing products already do these things well.

The narrower hypothesis is:

> **For consequential analysis of a report, analysts benefit from directly inspecting and correcting the semantic interpretation that sits between source evidence and deterministic calculation.**

Our differentiation is therefore primarily about the **trust boundary and interaction model**, not feature breadth.

---

# 2. Competitive Frame

Research Lens sits near four categories of existing products:

1. General-purpose AI document tools
2. Financial research platforms
3. AI-native financial research workspaces
4. Structured financial-data/modeling platforms

The closest representative products are:

- ChatGPT / Adobe Acrobat AI Assistant
- AlphaSense
- Hebbia
- Daloopa

---

# 3. ChatGPT / Adobe Acrobat AI Assistant

## User job

Quickly understand a document by:

- summarizing it;
- asking questions;
- extracting information;
- finding key passages;
- analyzing uploaded data.

ChatGPT supports uploaded files including PDFs and spreadsheets and can analyze documents and structured data. Adobe Acrobat AI Assistant provides document Q&A, summaries, and source-linked citations, including across multiple documents.

---

## Strength

### Low-friction flexibility

The user can simply upload a report and ask:

> “What was FY2025 EBITDA?”

or:

> “Summarize the risks.”

There is almost no workflow configuration required.

Acrobat also keeps the PDF itself central and provides citations that jump back to source content.

---

## Overlap with Research Lens

Both can support:

- document comprehension;
- financial fact extraction;
- source verification;
- summarization;
- follow-up questions.

Therefore we should **not** position Research Lens as:

> “ChatGPT, but for investment reports.”

---

## Research Lens hypothesis

The difference we want to test is the explicit intermediate object:

```text
Evidence
    ↓
AI Interpretation
    ↓
Resolved Analytical Input
    ↓
Deterministic Skill
```

Instead of only seeing:

> Question → Answer → Citation

the analyst can inspect:

```text
Metric: EBITDA
Value: $18.6M
Period: FY2025
Type: Actual
Basis: Adjusted
Evidence: p.18
```

before that interpretation becomes an input to another analytical operation.

---

## What not to claim

Do **not** say:

> “ChatGPT cannot perform calculations.”

or:

> “Acrobat doesn't provide citations.”

Both would be inaccurate.

The interview-safe distinction is:

> **General-purpose document AI is optimized for flexible interaction. Research Lens explores whether consequential financial analysis benefits from making semantic interpretation itself inspectable and governable.**

---

# 4. AlphaSense

## User job

Perform professional investment and market research across a large information universe.

AlphaSense's Generative Search reasons across qualitative and quantitative sources including filings, transcripts, sell-side research, expert interviews, financial data, and internal content. Its Generative Grid applies prompts across many documents and organizes outputs into structured tables with source citations.

AlphaSense also integrates structured financial data directly into generative responses.

---

## Strength

### Research breadth

AlphaSense is designed around a much broader research universe than Research Lens.

It can help analysts answer questions such as:

- How has management commentary changed across quarters?
- What are competitors saying about pricing?
- What themes appear across earnings calls?
- How does a company's financial performance compare with peers?

---

## Overlap with Research Lens

Strong overlap exists in:

- investment-research persona;
- natural-language financial research;
- citations;
- financial facts;
- structured and unstructured information;
- repeatable analysis.

This makes AlphaSense a serious alternative, not a strawman competitor.

---

## Research Lens hypothesis

Research Lens deliberately narrows the problem from:

> **Search and synthesize across a financial-research universe**

to:

> **Safely move from one consequential report to trusted analytical inputs and calculations.**

Our prototype therefore emphasizes:

```text
single report
+
semantic interpretation
+
material ambiguity
+
deterministic downstream analysis
```

rather than breadth of information access.

---

## What not to claim

Do **not** say:

> “AlphaSense is only search.”

or:

> “AlphaSense doesn't work with structured financial data.”

Its current product clearly goes beyond both statements.

Use:

> **AlphaSense is optimized for broad institutional research and discovery. Research Lens deliberately isolates a smaller trust problem inside the report-to-analysis handoff.**

---

# 5. Hebbia

## User job

Automate complex research and diligence workflows over large sets of financial and business documents.

Hebbia's Matrix supports large document collections and produces structured, citation-linked outputs. Hebbia specifically describes equity-research use cases where outputs feed models, drafts, and decks, and its current platform includes finance-specific Skills, Agents, and workflow capabilities.

Hebbia positions the platform for institutional finance workflows rather than simple document chat.

---

## Strength

### Structured research at scale

Hebbia is probably the strongest direct conceptual competitor.

Matrix can organize complex research into structured workflows and retain source traceability across substantial document sets.

That overlaps significantly with our original thinking.

---

## Important consequence for Research Lens

We should **not** compete with Hebbia on:

- document scale;
- research workflow breadth;
- multi-document synthesis;
- number of financial workflows;
- generic “AI with citations.”

That would make the project less differentiated and much harder to prototype credibly.

---

## Research Lens hypothesis

Our narrower question is:

> **Before an AI-derived financial fact becomes an input to deterministic analysis, should the analyst be able to inspect and resolve its semantic meaning as a first-class object?**

The UI therefore focuses specifically on:

```text
Evidence
↓
Interpretation
↓
Trust State
↓
Skill Eligibility
```

rather than building a broad research workflow engine.

---

## Example distinction

Suppose the report contains:

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
```

Research Lens makes the semantic conflict itself the product event:

```text
EV / EBITDA
NEEDS REVIEW

Adjusted EBITDA: $18.6M
Reported EBITDA: $14.2M

Choose basis before calculation.
```

Our hypothesis is that this explicit handoff deserves focused product treatment.

---

## What not to claim

Do **not** say:

> “Hebbia only extracts information.”

> “Hebbia cannot do financial workflows.”

> “Hebbia cannot feed models.”

Those claims conflict with its current product positioning and documented use cases.

Use:

> **Hebbia validates that structured, source-linked AI research is valuable. Research Lens goes much narrower and makes the semantic-to-deterministic trust boundary the object of the experiment.**

---

# 6. Daloopa

## User job

Provide reliable structured financial data directly into analysts' financial models and workflows.

Daloopa currently positions Scout as an AI Excel agent built on a financial-data layer, with source-linked outputs across thousands of global tickers. Its Excel tooling also connects models to structured, source-linked financial data for model updates.

Daloopa emphasizes auditability: numbers link directly back to original source documents.

---

## Strength

### Structured financial truth → model

Daloopa is especially strong where the analyst needs:

- standardized financial statements;
- historical values;
- company KPIs;
- model updates;
- source traceability.

This is close to the downstream half of Research Lens.

---

## Overlap with Research Lens

Both care about:

- financial accuracy;
- structured analytical inputs;
- provenance;
- analysts;
- downstream calculations/models.

Daloopa also explicitly highlights the danger of wrong reporting periods or numerical errors in financial retrieval.

---

## Research Lens hypothesis

Research Lens focuses on an earlier and less standardized transition:

> **What does this arbitrary report passage mean before I treat it as structured truth?**

Examples:

- Is this EBITDA actual or target?
- Is it reported or adjusted?
- Does “next year” mean FY2026?
- Is this $25M formal guidance or an internal planning objective?
- Are these two EBITDA values conflicting or simply different definitions?

So the conceptual difference is:

```text
Daloopa:
Source disclosures
      ↓
Verified structured financial data
      ↓
Financial model
```

versus the Research Lens hypothesis:

```text
Messy report language
      ↓
AI semantic interpretation
      ↓
Analyst-visible trust boundary
      ↓
Resolved analytical input
      ↓
Deterministic Skill
```

---

## What not to claim

Do **not** say:

> “Daloopa doesn't provide source traceability.”

Source linking is one of its core strengths.

Do not claim Research Lens has stronger financial-data coverage.

It does not.

Use:

> **Daloopa demonstrates the value of reliable structured financial truth. Research Lens explores how analysts safely create that trusted structure from semantically messy report content.**

---

# 7. Competitive Summary

| Alternative | Primary Strength | Research Lens Narrower Question |
|---|---|---|
| ChatGPT / Acrobat | Flexible document interaction | Should interpreted financial meaning be directly inspectable before downstream use? |
| AlphaSense | Broad institutional research universe | Can we solve the trust handoff deeply inside one report? |
| Hebbia | Structured AI research workflows at scale | Should semantic ambiguity explicitly gate deterministic analysis? |
| Daloopa | Verified structured financial data into models | How do we safely create trusted structure from messy report language? |

---

# 8. Positioning

The positioning should **not** be:

> “Nobody else can analyze financial reports.”

That is clearly false.

It should be:

> **Research Lens is exploring the trust boundary between semantic interpretation and deterministic financial analysis.**

Or more conversationally:

> **I wasn't trying to build a broader financial-research platform. I wanted to isolate one problem I repeatedly saw in investment work: AI can find the right number and still misunderstand what that number means. Once that incorrect interpretation enters a calculation, the result looks precise. Research Lens makes that handoff visible and correctable.**

---

# 9. Competitive Insight That Changed the Product

Competitive analysis should influence what we build.

It caused us to **remove**, rather than add, product scope.

We deliberately moved away from:

- generic document chat;
- large extraction grids;
- broad multi-document search;
- automated research-agent workflows;
- model-building breadth.

Existing products already demonstrate those capabilities.

We chose instead to go deeper on:

> **Evidence → Interpretation → Trust → Deterministic Skill**

This makes competitive research part of the product decision, rather than a feature checklist.

---

# 10. Interview Answer — 60–90 Seconds

> **The closest products are probably Hebbia, AlphaSense, Daloopa, and general document AI such as ChatGPT or Acrobat. I wouldn't claim they can't analyze reports or provide citations—several of them are very sophisticated. Hebbia, for example, already supports structured finance workflows at scale, and Daloopa is very strong at source-linked structured financial data.**
>
> **That research actually caused me to make the product smaller. Instead of trying to compete on research breadth, I focused on one trust boundary: when AI extracts something like EBITDA, how do I know it understood the period, basis, and whether it was actual or forecast before another system calculates from it?**
>
> **Research Lens makes that intermediate interpretation inspectable and uses deterministic skills only after the meaning is sufficiently resolved. That's the specific hypothesis I'm testing.**

---

# 11. Decision Summary

| ID | Decision |
|---|---|
| COMP-1 | Do not compete on broad research coverage |
| COMP-2 | Do not claim citations are unique |
| COMP-3 | Do not claim deterministic calculation is unique |
| COMP-4 | Treat Hebbia as a serious direct alternative |
| COMP-5 | Treat Daloopa as strong at structured financial truth/model workflows |
| COMP-6 | Research Lens differentiates on explicit semantic trust handoff |
| COMP-7 | Competitive research should reduce MVP scope |