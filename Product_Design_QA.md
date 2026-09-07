# Research Lens — Product Design Q&A

Research Lens is an evidence-first investment research prototype for exploring one product question:

> **Can AI help investment analysts move from messy report language to trustworthy analytical calculations without hiding the interpretation decisions in between?**

Modern AI systems are already good at summarizing documents, extracting numbers, and answering questions. Financial analysis introduces a harder problem: a number can be extracted correctly and still be **used incorrectly**.

A report might contain reported EBITDA, adjusted EBITDA, historical revenue, management targets, forward estimates, quarterly values, and annual values. Every number may be factually correct. The risk comes from assigning the wrong meaning downstream.

```text
Report evidence
      ↓
AI interpretation
      ↓
Structured analytical inputs
      ↓
Trust / ambiguity decision
      ↓
Deterministic Skill eligibility
      ↓
READY / NEEDS_REVIEW / BLOCKED
      ↓
Calculation or analyst resolution
```

The core architecture is:

> **Open semantic extraction. Closed deterministic execution.**

Use AI where meaning is contextual or ambiguous. Use deterministic software where rules are explicit and testable. Keep the original evidence visible throughout.

Research Lens is not trying to replace investment judgment. Its goal is to make the path from **what a report says** to **what an analyst calculates** more inspectable, reproducible, and trustworthy.

For detailed source documents, see:

- [`Product Thesis and Hypothesis`](./01_Product_Brief/Product_Thesis_and_Hypothesis.md)
- [`Prototype PRD`](./01_Product_Brief/PRD.md)
- [`Semantic Input Schema`](./05_Product_Decisions/Semantic_Input_Schema.md)
- [`Deterministic Skill Spec`](./05_Product_Decisions/Deterministic_Skill_Spec.md)
- [`Autonomy Policy`](./05_Product_Decisions/Autonomy_Policy.md)
- [`Eval Design`](./04_Eval/)
- [`Build Log`](./08_Build_Log/)

---

# 1. Product Problem & User

## Q1. Who is Research Lens designed for?

The primary user is a **professional investment analyst** working at a private investment firm, family office, private equity firm, growth equity firm, or similar professional investment organization.

That analyst regularly works through company research, management materials, diligence documents, financial analyses, and industry reports. Their job is not simply to read those documents. They must convert them into a structured understanding of business performance, financial results, growth drivers, assumptions, risks, valuation inputs, and future events.

Research Lens initially focuses on a narrow boundary:

> **Help one professional analyst understand one investment report and safely use the important analytical inputs inside it.**

It is not initially designed for retail investors, automated trading, accountants performing formal financial reporting, or autonomous investment agents.

---

## Q2. What does the analyst workflow look like today?

A simplified workflow is:

```text
Receive report
      ↓
Read and navigate
      ↓
Identify important facts
      ↓
Determine what each number means
      ↓
Reconcile definitions and periods
      ↓
Copy values into notes / spreadsheets
      ↓
Calculate
      ↓
Return to source and verify
      ↓
Build analytical view
```

The analyst repeatedly needs to distinguish:

- historical vs forward-looking values;
- annual vs quarterly periods;
- reported vs adjusted metrics;
- exact values vs approximations or ranges;
- forecasts vs formal guidance vs internal targets;
- true conflicts vs different valid definitions.

The workflow often becomes:

> **find → interpret → copy → calculate → verify**

Research Lens tries to compress that loop while keeping evidence and interpretation visible.

---

## Q3. If the financial information is already in the report, what is actually hard?

The difficult question is often not:

> “What number appears in the document?”

It is:

> **“Is this the right number for the analytical question I am trying to answer?”**

For example, a report may state:

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
```

Both may be correct. But an EV / EBITDA calculation changes materially depending on which basis is used.

So Research Lens captures semantic attributes such as:

```text
metric
value
unit
currency
period
temporal type
accounting basis
precision
source evidence
conflict state
```

The central product distinction is:

> **Extraction accuracy and analytical correctness are not the same thing.**

The real transformation is:

> **unstructured language → interpreted financial meaning → trusted analytical input**

---

## Q4. What are the costs of being wrong or being slow?

There are two different costs.

### Cost of being wrong

A semantically wrong input can still feed perfectly correct deterministic arithmetic.

```text
Wrong EBITDA basis
      ↓
Correct division
      ↓
Precise but misleading multiple
```

So:

> **Correct arithmetic cannot rescue a semantically incorrect input.**

### Cost of being slow

Analysts spend time searching, interpreting, copying, reconciling, checking, and re-verifying information before they can safely use it.

The product objective is therefore not simply “time to answer.” It is:

> **Reduce the time required to reach a trustworthy, review-ready analytical input.**

Or more simply:

> **time to confident, source-grounded use.**

---

## Q5. What narrow job and hypothesis is Research Lens testing?

The Job to Be Done is:

> **When I receive an investment report, help me identify, understand, verify, and safely use the important analytical inputs so I can reach a review-ready analytical view faster without losing visibility into what the source actually said.**

The analytical chain is:

```text
Question
   ↓
Evidence
   ↓
Financial fact
   ↓
Calculation
   ↓
Investment judgment
```

Research Lens focuses on the middle:

```text
Evidence
   ↓
Interpretation
   ↓
Trusted analytical input
   ↓
Deterministic calculation
```

The core hypothesis is:

> **If analysts can inspect and correct AI-interpreted analytical inputs before deterministic analysis consumes them, they can reach a review-ready analytical view faster without sacrificing trust.**

That hypothesis depends on three assumptions:

1. interpretation is a meaningful bottleneck;
2. inspectability improves trust without creating too much review burden;
3. deterministic execution creates safe downstream leverage.

The operating model is:

> **AI interprets. Deterministic Skills execute. Evidence connects both.**

---

## Q6. What is deliberately out of scope?

The MVP intentionally excludes:

- PDF upload and OCR;
- external web research;
- multi-document analysis;
- vector databases and RAG infrastructure;
- persistent databases;
- authentication and user accounts;
- collaboration;
- model export;
- portfolio management;
- autonomous investment recommendations;
- investment memo generation;
- production observability;
- enterprise access controls;
- background jobs;
- microservices;
- an agent framework.

The current prototype uses four built-in fictional reports and real Claude inference so the experiment stays focused on the semantic-to-deterministic handoff.

Three exclusions are especially important.

### No raw PDF ingestion in the MVP

Broader input support would make the demo more complete, but it would not make the trust hypothesis cleaner.

### No autonomous Buy / Sell / Invest / Pass decision

Research Lens supports investment analysis. It does not make the capital-allocation decision.

### No silent assumption or model construction

If required evidence is missing or a material choice remains unresolved, the system should show that state rather than manufacture completeness.

> **Research Lens helps establish what the numbers are and whether the math is trustworthy. It does not decide what those numbers mean for the investment decision.**

### Section takeaway

The problem is not simply:

> “How do we extract financial numbers from reports?”

It is:

> **“How do we turn messy financial language into analytical inputs that are trustworthy enough for downstream calculation?”**

---

# 2. Core Architecture

## Q7. Why combine an LLM with deterministic software instead of asking the LLM to do everything?

Research Lens separates two fundamentally different kinds of work.

The first is **semantic interpretation**. Financial reports express meaning through language, tables, footnotes, accounting terminology, and company-specific definitions. Understanding them may require reasoning about metric identity, period, actual vs forecast, reported vs adjusted basis, precision, and whether two values are truly conflicting.

Those problems are difficult to encode as fixed rules. That is where the LLM is useful.

The second is **bounded analytical execution**. Once the inputs are understood, calculations such as:

```text
Gross Profit / Revenue
Enterprise Value / EBITDA
```

benefit from explicit inputs, fixed rules, reproducible behavior, test coverage, and clear failure states.

That is where deterministic software is better.

```text
Messy meaning
     ↓
    LLM

Resolved analytical inputs
     ↓
Deterministic software

Reproducible result
```

The separation makes failures easier to diagnose. An LLM can make a semantic mistake. Deterministic code can make a logic or implementation mistake. Keeping them separate lets the product evaluate and contain each type independently.

---

## Q8. What work should the LLM do?

The LLM's job is to turn unstructured report content into structured `AnalyticalInput` objects.

A simplified object might look like:

```json
{
  "metric": "EBITDA",
  "value": 18.6,
  "unit": "USD_millions",
  "currency": "USD",
  "period": "FY2025",
  "temporal_type": "actual",
  "basis": "adjusted",
  "precision": "exact",
  "source": {
    "text": "Adjusted EBITDA was $18.6 million in FY2025."
  },
  "conflict_state": "none",
  "trust_state": "auto"
}
```

The important point is that the model is not merely extracting `18.6`. It is interpreting what `18.6` means.

The semantic layer handles questions such as:

| Attribute | Question |
|---|---|
| `metric` | What financial concept is this? |
| `value` | What value did the source state? |
| `unit` | Dollars, thousands, millions, percent, etc.? |
| `currency` | USD, EUR, GBP, etc.? |
| `period` | FY2025, Q4 FY2025, next year, etc.? |
| `temporal_type` | Actual, forecast, guidance, target, assumption? |
| `basis` | Reported, adjusted, GAAP, management-defined, etc.? |
| `precision` | Exact, approximate, range, qualitative? |
| `source` | What evidence supports the interpretation? |
| `conflict_state` | Is there a competing interpretation? |
| `trust_state` | Can this interpretation proceed automatically? |

These are not decorative metadata. They are part of the meaning of the number.

A key rule is:

> **The LLM should preserve what the source says rather than make the source more convenient for downstream software.**

If the report says “next year,” do not silently invent FY2026 unless the source supports that mapping. If the report gives `$24M–$26M`, preserve the range rather than collapsing it to `$25M`.

The goal is faithful semantic representation, not forcing every input into a calculation-ready form.

---

## Q9. What work should deterministic software do?

Deterministic software begins after semantic interpretation.

Its responsibilities include:

1. identify candidate inputs for a Skill;
2. check those inputs against the Skill contract;
3. validate period, basis, currency, precision, and other compatibility rules;
4. normalize supported units where explicitly allowed;
5. determine the Skill state;
6. execute a fixed formula if the contract passes;
7. preserve lineage back to consumed inputs and evidence.

```text
Candidate AnalyticalInputs
          ↓
Validate Skill Contract
          ↓
 ┌──────────────────────┐
 │ READY                │ → Execute
 │ NEEDS_REVIEW         │ → Ask analyst
 │ BLOCKED              │ → Stop
 └──────────────────────┘
```

A Deterministic Skill may not decide:

- “Adjusted EBITDA probably makes more sense.”
- “Q4 FY2025 is close enough to FY2025.”
- “This approximate number is probably safe to treat as exact.”
- “The missing input can probably be inferred.”

Those are semantic or policy decisions and belong upstream.

> **Flexible about how financial information is expressed. Strict about what is allowed to execute.**

---

## Q10. What does “open semantic extraction, closed deterministic execution” mean?

Financial language is open-ended.

The same underlying concept may appear as:

```text
Revenue
Total Revenue
Net Revenue
Net Sales
Operating Revenue
```

Likewise:

```text
EBITDA
Adjusted EBITDA
Reported EBITDA
Consolidated Adjusted EBITDA
Segment Adjusted EBITDA
```

Trying to enumerate every phrase would make extraction brittle, so the semantic layer is intentionally **open**.

The execution layer is the opposite. A Skill has:

- a known name;
- known required inputs;
- known compatibility requirements;
- known blocking conditions;
- a fixed formula;
- a defined output type.

For example:

```text
EV / EBITDA

Required:
- Enterprise Value
- EBITDA

Requirements:
- valid EBITDA period
- valid basis
- valid temporal type
- compatible currency / unit
- no unresolved material conflict

Formula:
Enterprise Value / EBITDA
```

The Skill operates inside a closed contract.

```text
          OPEN
Unstructured report language
             ↓
    Semantic interpretation
             ↓
       AnalyticalInputs

             │
             │ trust boundary
             ▼

         CLOSED
     Skill contracts
             ↓
 READY / NEEDS_REVIEW / BLOCKED
             ↓
   Deterministic formula
```

If both layers were closed, normal financial-language variation would break extraction. If both layers were open, definitions and execution behavior could change silently from one run to another.

> **Open understanding. Closed execution.**

---

## Q11. Why keep semantic extraction broad when the prototype supports only six calculations?

Because understanding a report and executing a calculation are different product capabilities.

A report may contain customer concentration, management targets, covenant information, or other analytically meaningful facts that do not feed any current Skill. Those facts should not disappear simply because today's deterministic catalog is small.

If extraction were limited to current Skill inputs:

1. important report information would vanish;
2. adding a new Skill would require redesigning extraction;
3. interpretation and downstream use would become tightly coupled.

An input can therefore be faithfully understood while still being ineligible for a particular operation.

For example:

```text
trust_state = auto
```

may mean the source interpretation is clear, while a specific Skill still returns:

```text
BLOCKED
```

because it does not accept that period, temporal type, or precision.

> **The semantic layer understands more than the deterministic layer is allowed to do.**

That is intentional.

---

## Q12. Which Deterministic Skills exist today, and how do their contracts work?

The current executable prototype implements six Skills:

| Skill | Formula | Main semantic requirements |
|---|---|---|
| Revenue Growth | `(Revenue_current - Revenue_prior) / Revenue_prior` | Comparable definitions, sequential fiscal periods, historical actuals |
| Gross Margin | `Gross Profit / Revenue` | Same period, compatible scope and monetary basis |
| EBITDA Margin | `EBITDA / Revenue` | Same period, explicit EBITDA basis, compatible scope |
| Net Debt | `Total Debt - Cash` | Same period, compatible currency and scope |
| EV / Revenue | `Enterprise Value / Revenue` | Known revenue period and temporal type, compatible monetary basis |
| EV / EBITDA | `Enterprise Value / EBITDA` | Known EBITDA period, basis, temporal type, no unresolved competing definition |

The arithmetic is ordinary TypeScript. There is no model call inside the calculation functions.

The formula is usually the easy part. The contract is the hard part.

For example, Revenue Growth may accept:

```text
FY2024 Revenue Actual
FY2025 Revenue Actual
```

but should not silently treat:

```text
FY2025 Revenue Actual
FY2026 Revenue Target
```

as the same analytical operation.

For EV / EBITDA, if the source contains both:

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
```

then the formula is known, but the intended basis is not. The correct state is `NEEDS_REVIEW` until the analyst resolves the methodology.

> **A Deterministic Skill never resolves semantic ambiguity itself.**

### Note on CAGR

The earlier design specification includes CAGR in a recommended catalog, but the current executable prototype implements six Skills and does not currently expose CAGR in the Skill engine. CAGR remains a reasonable future deterministic Skill.

### Section takeaway

Research Lens does not use an LLM because financial arithmetic is difficult. It uses an LLM because financial meaning is messy.

> **Be flexible about language. Be strict about execution.**

---

# 3. Trust, Ambiguity & Autonomy

## Q13. Why does Research Lens have two different state systems?

Research Lens separates two questions:

1. **Do we understand what the source means?**
2. **Can a particular calculation safely use that interpretation?**

The first belongs to the semantic trust layer:

```text
AUTO
ASK
ABSTAIN
NEVER
```

The second belongs to the Skill execution layer:

```text
READY
NEEDS_REVIEW
BLOCKED
```

```text
Source evidence
      ↓
Semantic interpretation
      ↓
AUTO / ASK / ABSTAIN / NEVER
      ↓
AnalyticalInput
      ↓
Specific Skill contract
      ↓
READY / NEEDS_REVIEW / BLOCKED
```

| Semantic state | Meaning |
|---|---|
| `AUTO` | Interpretation is sufficiently supported and can proceed without analyst confirmation |
| `ASK` | Multiple materially plausible interpretations exist and analyst judgment can resolve them |
| `ABSTAIN` | Evidence is insufficient to establish a reliable interpretation |
| `NEVER` | The action is outside the product's permitted authority |

| Skill state | Meaning |
|---|---|
| `READY` | All inputs satisfy the Skill contract; execute |
| `NEEDS_REVIEW` | Required information exists, but a reviewable ambiguity must be resolved |
| `BLOCKED` | A required input is missing, unsupported, or incompatible |

The key distinction is:

> **Semantic trust asks whether we understood the source correctly. Skill readiness asks whether that understanding satisfies the requirements of this specific operation.**

---

## Q14. When should the system automate, and when should it ask an analyst?

The goal is not maximum automation.

> **Maximum useful automation inside a clearly defined trust boundary.**

Automate when the source is clear.

Example:

> “FY2025 revenue was $101 million.”

This can reasonably be `AUTO` if the evidence is direct and there is no material conflict.

Ask when multiple interpretations are materially plausible and analyst intent matters.

Example:

```text
Adjusted EBITDA = $52M
Reported EBITDA = $41M
```

Both can be source-supported. Which one should a valuation use? That is a methodology decision and should become `ASK` / `NEEDS_REVIEW`.

Materiality matters. A low-consequence classification ambiguity may not justify interruption. A unit ambiguity such as `$520K` vs `$520M` certainly does.

> **The system can resolve evidence quality; it should not resolve analyst intent.**

Confidence alone should not decide autonomy. Trust policy should consider evidence quality, semantic completeness, conflict state, materiality, downstream consequence, and recoverability.

---

## Q15. Why doesn't analyst confirmation automatically make an input calculation-ready?

Because analyst confirmation and computational safety solve different problems.

If the analyst chooses Adjusted EBITDA instead of Reported EBITDA, that resolves one question:

> Which valid EBITDA definition should this calculation use?

It does not prove that every other requirement is satisfied.

The selected input may still have:

- no evidence;
- an unsupported unit;
- missing currency;
- an unresolved period;
- a qualitative rather than numeric value;
- a range where the Skill requires a scalar;
- an approximate value where the Skill requires exact precision;
- a forecast where the Skill requires an actual.

So the flow is:

```text
Material ambiguity
      ↓
Analyst selects interpretation
      ↓
Ambiguity resolved
      ↓
Run Skill gate again
      ↓
Check all hard requirements
      ↓
READY or BLOCKED
```

> **Confirmation establishes semantic validity. The Skill contract establishes computational validity.**

A human can resolve ambiguity. A human selection does not turn an unsupported input into a supported one.

---

## Q16. What should Research Lens never decide autonomously?

Research Lens deliberately limits its authority.

It should not independently decide:

```text
Invest
Don't invest
Buy
Sell
Pass
```

It should not silently choose one valid methodology when multiple source-supported definitions exist.

It should not create unsupported facts. “Margins should improve” must not become “FY2026 margin = 18%.”

It should not allow semantic discretion inside Deterministic Skills. A Skill cannot decide that Adjusted EBITDA “looks better” or that Q4 is “close enough” to a full year.

It should not use an LLM for arithmetic or formula-based transformations when deterministic logic is available.

It should not silently enrich missing evidence from external sources in the current MVP.

It should not automatically modify a live financial model or make a capital-allocation decision.

> **Research Lens helps establish what the numbers are and whether bounded math can be trusted. It does not decide what those numbers mean for the investment decision.**

---

## Q17. Why does `NEEDS_REVIEW` show no numeric result?

Because showing a number before the required judgment is resolved can influence the judgment itself.

Suppose:

```text
Enterprise Value = $650M
Adjusted EBITDA  = $18.6M
Reported EBITDA  = $14.2M
```

The two possible multiples are approximately:

```text
EV / Adjusted EBITDA ≈ 34.95×
EV / Reported EBITDA ≈ 45.77×
```

If the interface shows `34.95×` first and then adds a warning, the analyst has already been anchored to a specific result.

The safer sequence is:

```text
Candidates
    ↓
Material ambiguity
    ↓
NEEDS_REVIEW
    ↓
No calculated value yet
    ↓
Analyst selects basis
    ↓
Revalidate Skill contract
    ↓
READY
    ↓
Show result
```

The same principle applies to `BLOCKED`: show the reason, not a guessed placeholder.

A useful user expectation is:

```text
READY          → result
NEEDS_REVIEW   → choice
BLOCKED        → reason
```

> **A trustworthy interface should not manufacture confidence merely because a number can technically be calculated.**

### Section takeaway

Research Lens separates:

```text
Can we trust our interpretation?
```

from:

```text
Can this specific operation safely use it?
```

Three rules follow:

- automate clear interpretation; ask for material judgment;
- human resolution removes ambiguity, not safety requirements;
- do not show a consequential result before the inputs are actually ready.

---

# 4. Evidence & UX

## Q18. How does Research Lens keep every analytical input connected to source evidence?

Evidence is part of the analytical object, not a citation added after the answer.

A consequential `AnalyticalInput` carries source evidence such as the original excerpt supporting the interpretation.

```text
AnalyticalInput

Metric: EBITDA
Value: $18.6M
Period: FY2025
Basis: Adjusted

Evidence:
"Adjusted EBITDA was $18.6 million in FY2025."
```

This creates a lineage chain:

```text
Report evidence
      ↓
AI interpretation
      ↓
AnalyticalInput
      ↓
Deterministic Skill
      ↓
Result
```

The analyst should also be able to travel backward:

```text
Result
   ↓
Consumed inputs
   ↓
Interpretation
   ↓
Original evidence
```

The interface therefore emphasizes source excerpts and source highlighting rather than relying on generated explanation alone.

> **Explain less; show the source more.**

If an evidence highlight cannot be matched, the product should expose that failure rather than highlight a plausible-looking but incorrect passage.

---

## Q19. What should a result show immediately, and what belongs in deeper detail?

The UI should give enough information to establish trust quickly without forcing the analyst to inspect the full provenance chain for every calculation.

The hierarchy is:

```text
Result
  ↓
Inputs
  ↓
Evidence
  ↓
Interpretation / audit detail
```

For a `READY` Skill, the primary card should show the result, status, period/basis context, consumed inputs, and formula.

Example:

```text
EV / FY2025 Adjusted EBITDA
READY
34.95×

Inputs
Enterprise Value        $650M
FY2025 Adjusted EBITDA   $18.6M

Formula
Enterprise Value / EBITDA
```

For `NEEDS_REVIEW`, show the competing candidates and why review is required, but no result.

For `BLOCKED`, show the exact missing or incompatible requirement.

Deeper detail can expose:

```text
Value
Period
Temporal type
Basis
Precision
Trust state
Source excerpt
Original AI interpretation
Analyst correction
Skill formula
Consumed input IDs
```

A production system could extend this with document version, page/bounding box, model version, prompt version, Skill version, and correction history.

---

## Q20. How does analyst conflict resolution work?

The analyst should resolve one semantic question once, rather than separately inside every dependent calculation.

Suppose the report contains:

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
```

Both EBITDA Margin and EV / EBITDA may depend on that same choice. Asking twice would invite inconsistent state.

So the product presents one Analyst Resolution panel:

```text
Use Adjusted
Use Reported
```

The selection becomes a local semantic resolution shared by dependent Skills.

The UI deliberately does not recommend a candidate. It preserves document order, shows evidence, and selects nothing by default.

The selection stores the exact `selectedInputId` rather than merely a free-form basis label. That keeps lineage to the source-backed candidate and allows stale-selection checks.

The current MVP keeps the resolution scope narrow: an EBITDA accounting-basis conflict. It does not use the same control to resolve unrelated period ambiguity.

---

## Q21. How is methodology selection different from factual correction?

They are different user actions.

### Methodology selection

Multiple source-supported facts are valid, and the analyst decides which definition is appropriate for the calculation.

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
```

Nothing needs to be “fixed.” The analyst selects one valid methodology.

### Factual correction

The AI interpretation itself is wrong.

Examples:

```text
AI: Basis = Reported
Correct: Basis = Adjusted
```

or:

```text
AI: Period = FY2024
Correct: Period = FY2025
```

The current MVP allows correction of value, period, temporal type, basis, and precision while preserving the original evidence and original model interpretation.

> **Methodology selection chooses among valid facts. Factual correction repairs an interpreted fact.**

Those concepts should remain separate because they represent different kinds of human judgment.

---

## Q22. What happens after an analyst correction?

A correction must propagate through every dependent result.

The current product derives working inputs from:

```text
Original model inputs
        +
Analyst corrections
        ↓
Effective inputs
        ↓
Run Skills
```

Skill results therefore derive from the latest effective state rather than surviving as independent stale objects.

The source remains unchanged. The original model interpretation remains available. The correction is an overlay.

```text
Source
   ↓
Original AI interpretation
   ↓
Analyst correction
   ↓
Effective input
   ↓
Revalidated Skill
   ↓
New result
```

A production system should persist the correction, analyst identity, timestamp, model/prompt version, and before/after calculation impact.

Corrections should not automatically become training data. A safer loop is:

```text
Analyst correction
      ↓
Reviewed quality signal
      ↓
Candidate eval case
      ↓
Domain validation
      ↓
Regression dataset
      ↓
Model / prompt improvement
```

### Section takeaway

Evidence and correction are part of the trust architecture:

1. keep source evidence closer to the answer than AI explanation;
2. let analysts resolve methodology without rewriting source facts;
3. treat factual correction as an overlay;
4. recompute downstream state from corrected inputs.

---

# 5. Concrete Product Scenarios

The four built-in fictional reports isolate different behaviors:

| Report | Scenario | Main question |
|---|---|---|
| A | Clean | What happens when the source is clear? |
| B | Forward-looking | Can the system preserve actual vs forecast vs target distinctions? |
| C | Material conflict | What happens when two valid facts require analyst methodology? |
| D | Adversarial | Does the system preserve units, periods, footnotes, and unsupported information correctly? |

See [`03_Sample_Data/`](./03_Sample_Data/).

---

## Q23. What happens in a clean, unambiguous report?

Report A contains clear FY2025 financial facts:

```text
FY2024 Revenue        $82.0M
FY2025 Revenue       $101.0M
FY2025 Gross Profit   $62.0M
FY2025 Adj. EBITDA    $18.6M
Cash                  $30.0M
Total Debt           $125.0M
Enterprise Value     $650.0M
```

The expected semantic inputs are sufficiently clear to be `AUTO`, and all six Skills can become `READY`.

Expected calculations include:

```text
Revenue Growth
(101 - 82) / 82 = 23.17%

Gross Margin
62 / 101 = 61.39%

Adjusted EBITDA Margin
18.6 / 101 = 18.42%

Net Debt
125 - 30 = $95.0M

EV / Revenue
650 / 101 = 6.44×

EV / Adjusted EBITDA
650 / 18.6 = 34.95×
```

The clean case demonstrates the full lineage without requiring analyst intervention:

```text
Report
   ↓
AI interpretation
   ↓
Evidence-backed analytical inputs
   ↓
Skill contracts pass
   ↓
Deterministic results
```

---

## Q24. What happens when the report contains two legitimate EBITDA definitions?

Report C states:

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
Enterprise Value = $650M
```

Both EBITDA values are valid source-supported facts.

The question is not “Which number is correct?” It is:

> **Which basis does the analyst intend to use?**

The semantic layer preserves both candidates and marks the conflict as material.

EV / EBITDA becomes:

```text
NEEDS_REVIEW
```

No multiple is shown yet.

If the analyst chooses Adjusted EBITDA:

```text
650 / 18.6 = 34.95×
```

If the analyst chooses Reported EBITDA:

```text
650 / 14.2 = 45.77×
```

The scenario demonstrates:

> **Sometimes the system has extracted every fact correctly and still should not calculate.**

---

## Q25. What happens when required inputs are missing or financially incompatible?

Report D is deliberately adversarial.

It includes a table with:

```text
$ in thousands unless otherwise noted
```

and both FY2025 and Q4 FY2025 values.

### Table-level units matter

`Revenue = 101,000` under a `$ in thousands` header means `$101M`, not `$101,000` and not `$101,000M`.

### Q4 is not the full year

`Q4 FY2025` and `FY2025` are distinct periods even though both contain 2025.

### Footnotes can change the meaning of the metric

If the footnote explains that EBITDA excludes restructuring expense and stock-based compensation, the adjusted basis must be preserved.

### Internal targets are not automatically formal guidance

“Working toward roughly $25M of EBITDA next year” as an internal planning objective should remain a target, management-defined, and approximate.

### Qualitative margin language is not a number

“Margins should improve meaningfully” must not become a fabricated numeric margin.

### Missing inputs should block calculations

If Gross Profit is missing, Gross Margin is `BLOCKED`.

If Enterprise Value is missing, EV / Revenue and EV / EBITDA are `BLOCKED`.

The system should say what is missing rather than infer or fetch a substitute.

> **Preserve source meaning even when doing so reduces the number of calculations the product can complete.**

---

## Q26. How does Research Lens distinguish actuals, forecasts, guidance, targets, ranges, and approximate values?

Report B isolates forward-looking semantics.

It contains:

```text
FY2025 Revenue            $101.0M actual
FY2025 Adjusted EBITDA     $18.6M actual
FY2026 Revenue             approx. $128M forecast
FY2026 Adjusted EBITDA     $24M–$26M forecast range
Longer-term Revenue        approx. $150M target
```

The system should preserve those distinctions rather than flatten everything into a generic list of numbers.

A forecast can still be `AUTO` if the source clearly expresses that it is a forecast. `AUTO` means the interpretation is clear, not that every Skill may use it.

A range should remain:

```text
range.min = 24
range.max = 26
precision = range
```

not silently become `$25M`.

A target should remain a target rather than being converted into formal guidance or a specific fiscal-year forecast unless the source supports that meaning.

A section heading such as “Outlook” does not by itself make every value formal guidance.

> **Faithfully interpreted does not mean universally calculation-ready.**

### Section takeaway

A good financial AI system is not one that always produces a number. It is one that knows what kind of number it has, where it came from, and whether the next operation is justified.

---

# 6. Failure & Recovery

## Q27. What real prototype failure did Research Lens uncover?

One useful failure occurred in the conflict-resolution flow.

The intended Report C scenario was:

```text
Adjusted EBITDA
vs.
Reported EBITDA
```

The original recovery control expected exactly that pair.

In a live inference run, however, a source-described “reported EBITDA” was classified by the model as:

```text
basis = gaap
```

The structured inputs therefore looked like:

```text
Adjusted EBITDA
vs.
GAAP EBITDA
```

The safety system worked: the Skill did not silently choose one value and did not execute an unsafe multiple.

But the recovery UI failed because the original conflict detector did not recognize that pair as an offerable two-way basis choice.

```text
The system detects ambiguity
        ↓
The Skill refuses to execute safely
        ↓
The UI offers no recovery control
        ↓
The analyst cannot complete the task
```

> **Safety worked. Task completion failed.**

The product failed closed, which was good, but it also failed unrecoverably.

---

## Q28. How was the failure fixed, and what did it teach us?

The fix was deliberately narrow.

The product now allows a bounded two-way recovery between:

```text
Adjusted
vs.
Reported
```

or:

```text
Adjusted
vs.
GAAP
```

But this does **not** mean `reported == gaap`.

The original semantic label is preserved. A `gaap` candidate remains `GAAP EBITDA` in the UI. The recovery policy only decides that the pair is offerable as a bounded analyst choice.

The system still excludes unrelated or materially different bases from this specific recovery path.

After analyst selection, the Skill revalidates all hard gates. Human selection does not bypass evidence, precision, units, period, currency, or denominator safety.

The main lesson is:

> **Safe failure and recoverable failure are separate product requirements.**

Three possible behaviors illustrate the distinction:

```text
Unsafe completion:
Ambiguity → system guesses → result

Safe but unrecoverable:
Ambiguity → block → no way forward

Safe and recoverable:
Ambiguity → block → show choices → analyst resolves → revalidate → execute
```

A second lesson is that recovery deserves its own design. The product must ask:

```text
Can the error be detected?
Can the user understand what went wrong?
Can the user repair it?
Does the repair preserve provenance?
Does it apply only to the intended scope?
Does the system revalidate afterward?
Can the decision become stale?
```

A third lesson is that not every model error should be fixed by adding another model call. Analyst resolution is a local deterministic state transition with zero additional inference.

> **The model identifies the ambiguity. The analyst resolves the intent. The Skill revalidates and executes.**

---

# 7. Evaluation

## Q29. What is the unit of evaluation, and why evaluate multiple trust boundaries?

Research Lens does not evaluate only:

```text
Did the model give the right final number?
```

A correct final answer can hide an unsafe intermediate path.

The eval tests the full chain:

```text
Evidence
   ↓
AI Interpretation
   ↓
Trust Decision
   ↓
Deterministic Skill State
   ↓
Result
```

The design unit is an Eval Case containing source evidence, expected semantic interpretation, expected trust behavior, optional Skill context, expected Skill state, actual system output, and scoring.

At the semantic level, a financial fact is evaluated across:

```text
metric
value
unit
currency
period
temporal type
basis
precision
evidence
conflict state
trust state
```

Then, where applicable:

```text
Skill state
result
```

Research Lens therefore thinks about quality at five levels:

```text
Q1 Extraction
Q2 Semantic Interpretation
Q3 Evidence
Q4 Trust Decision
Q5 Skill Safety
```

Higher levels matter more than raw extraction because they determine whether an interpretation can become trusted downstream work.

Ground Truth is loaded only after model inference is fixed, so expected answers are evaluator authority, not prompt context.

---

## Q30. Which failures matter most, and what is Unsafe Auto-Use Rate?

Not all errors have equal consequence.

The failure taxonomy ranges from low-severity presentation problems to critical errors that can produce materially misleading analysis.

Especially important failures include:

- actual vs forecast errors;
- wrong period;
- wrong accounting basis;
- unit or magnitude catastrophe;
- missed material conflict;
- unsupported analytical input;
- incorrect `AUTO` decision;
- unsafe Skill execution;
- stale result after correction;
- table-structure and footnote errors.

The central safety metric is:

> **Unsafe Auto-Use Rate: percentage of cases where a materially incorrect, unsupported, conflicting, or unresolved interpretation is automatically allowed to feed a Deterministic Skill.**

Conceptually:

```text
Unsafe Auto-Use Cases
---------------------------
Eligible Consequential Cases
```

This metric focuses on **error propagation**, not merely error existence.

A model may make a semantic mistake while the downstream gate safely blocks execution. That is serious but less dangerous than allowing the mistake to cross the trust boundary and become a precise calculation.

Safety cannot mean refusing everything, so the system also measures unnecessary review.

> **Minimize unsafe automation without making analysts review everything.**

---

## Q31. What offline metrics matter?

Research Lens needs a portfolio of metrics.

### Semantic correctness

```text
Value accuracy
Metric identity accuracy
Period accuracy
Temporal-type accuracy
Basis accuracy
Unit / magnitude accuracy
Precision accuracy
```

### Evidence quality

```text
Evidence accuracy
```

### Conflict and autonomy quality

```text
Conflict detection recall
Conflict detection precision
Autonomy decision accuracy
Unnecessary ASK rate
Correct abstention rate
```

### Skill safety and deterministic correctness

```text
Skill Gate Accuracy
Correction Propagation Accuracy
Deterministic Calculation Accuracy
```

Deterministic application logic should have much stricter expectations than probabilistic interpretation. Calculation math and correction propagation should be 100% correct on covered cases.

### System-level safety

```text
Unsafe Auto-Use Rate
Unsupported Input Rate
```

The current prototype thresholds are design targets, not validated production SLAs.

Slice-level quality matters more than one average. A model should be rejected if overall semantic accuracy improves while a critical slice such as actual-vs-forecast or Unsafe Auto-Use materially regresses.

> **Averages tell us whether the model improved broadly. Slices tell us whether it became dangerous somewhere important.**

---

## Q32. What should block a release?

Current regression policy treats the following as hard blockers on the golden set:

- SEV-4 unsafe auto-use;
- hallucinated consequential input consumed downstream;
- material conflict silently resolved;
- catastrophic unit/currency error reaching analysis;
- Skill executing despite blocked or review-required inputs;
- stale result surviving correction;
- deterministic math failure.

The current executable eval harness also treats a non-READY Skill carrying a numerical result as a structural failure.

The optional AI-only benchmark is diagnostic only. It cannot rescue an unsafe trusted-path release.

The release sequence is:

```text
Prompt / model / build change
        ↓
Run eval
        ↓
Any hard blocker?
        ↓
Check Unsafe Auto-Use
        ↓
Check critical slices
        ↓
Check review burden / usefulness
        ↓
Approve or reject
```

For the current small corpus, individual failures still require manual inspection.

---

## Q33. How should the evaluation corpus evolve, and who should label Ground Truth?

The current executable MVP uses four fictional reports with hand-authored expected behavior in `03_Sample_Data/Ground_Truth.jsonl`.

That is enough to test architecture and targeted regressions, but not enough for production-scale statistical claims.

The design target is roughly 40–50 hand-labeled cases that intentionally overrepresent high-consequence and ambiguous scenarios.

A production program should evolve into three layers.

### 1. Canonical / Gold cases

Small, surgical cases for one known behavior:

```text
actual vs forecast
adjusted vs reported
Q4 vs full year
thousands vs millions
range preservation
missing EV
```

### 2. Representative regression corpus

Larger, more realistic variation across industries, reporting styles, tables, footnotes, accounting terminology, period formats, and document length.

### 3. Production challenge set

Reviewed real-world failures become permanent regression cases.

```text
Production failure
       ↓
Analyst correction / incident
       ↓
Domain review
       ↓
Canonical expected behavior
       ↓
Permanent regression case
```

The current repository does not define a required production labeler process. For financially consequential production Ground Truth, the recommended policy is domain-qualified financial or investment analysts, with independent review and adjudication for high-risk ambiguous cases.

Engineering should encode the evaluation contract. It should not silently invent financial truth where domain judgment is required.

Ground Truth itself must remain challengeable. The eval harness already found cases where the model disagreement exposed a Ground Truth or specification issue rather than a model error.

> **Ground Truth is authoritative during scoring, but it should not be treated as infallible during dataset governance.**

### Section takeaway

Research Lens evaluation asks whether every trust boundary works and whether any dangerous interpretation crosses into trusted deterministic execution.

> **Aggregate improvement must never hide a critical trust regression.**

---

# 8. Product Metrics

## Q34. What should the primary online product metric be?

A recommended production north star is:

> **Trusted Task Completion Rate**

Working definition:

> **Percentage of analyst tasks that reach a usable, source-grounded, modeling-ready result without unsafe automation and within acceptable analyst effort and time.**

```text
Analyst starts task
        ↓
Report interpreted
        ↓
Ambiguity resolved where needed
        ↓
Required calculations complete
        ↓
Analyst can use result
        ↓
No unsafe automation
        ↓
Task completed
```

Model accuracy alone is insufficient. A highly accurate model is still a weak product if analysts verify every result manually, re-enter the same inputs elsewhere, or abandon the workflow.

Likewise, `% Skills READY` is a dangerous north star because the easiest way to raise it is to weaken gating.

Time saved alone is also insufficient if the speed comes from unjustified decisions.

The recommended metric therefore combines:

```text
Task completion
+
trust
+
acceptable effort / time
```

“Modeling-ready” means the analyst has a source-grounded input or deterministic result that is sufficiently established to use in downstream analysis. It does not mean the product has automatically populated a financial model.

The MVP does not currently measure Trusted Task Completion Rate; it is a recommended production product metric.

---

## Q35. Which signals explain why Trusted Task Completion Rate moved?

Useful diagnostic signals fall into five groups.

### Correction signals

```text
Analyst correction rate
Corrections by field
Corrections by severity
```

A spike in EBITDA basis corrections after a model change may reveal a semantic regression even if the average benchmark looks stable.

### Review and blocking signals

```text
NEEDS_REVIEW rate
BLOCKED rate
Unnecessary review rate
Resolution completion rate
```

These are diagnostic, not inherently good or bad.

### Evidence-trust signals

```text
Evidence inspection rate
Repeated evidence re-check rate
Manual source verification behavior
```

Evidence inspection is healthy in moderation. A sharp rise in repeated re-checking may indicate trust decay.

### Workflow-completion signals

```text
Time to modeling-ready input
Calculation abandonment
Retry rate
Manual replacement rate
```

The key question is whether the product actually compresses the manual workflow rather than simply moving it into a different interface.

### Habit and adoption signals

```text
Repeat report-analysis usage
Weekly active analysts
Tasks per analyst
Return frequency
```

Repeat usage matters, but it should be interpreted alongside task success. High usage caused by repeated corrections is not necessarily value.

A useful diagnostic tree is:

```text
Trusted Task Completion ↓
          ↓
Was completion lower?
Was review burden higher?
Was correction higher?
Was evidence re-checking higher?
Was latency / abandonment higher?
Did a critical semantic slice regress?
```

---

## Q36. How is offline evaluation different from production quality, and how would we prove real productivity?

Offline evaluation asks:

> **Can the system correctly handle labeled cases that we understand?**

Production quality asks:

> **Can analysts successfully rely on the product during real work?**

Offline metrics include semantic correctness, evidence accuracy, conflict detection, autonomy decisions, Skill gating, Unsafe Auto-Use, and deterministic calculation.

Production quality asks whether the analyst finishes the task, can use the output, trusts it, needs manual rework, and reaches a usable state faster.

```text
OFFLINE
Are the individual trust boundaries correct?

PRODUCTION
Do those boundaries combine into successful analyst work?
```

The cleanest next experiment would compare the same analyst performing comparable tasks under two workflows.

### Baseline

```text
Report
  ↓
manual search
  ↓
interpret
  ↓
copy
  ↓
calculate
  ↓
verify
```

### Research Lens

```text
Report
  ↓
AI interpretation
  ↓
evidence verification where needed
  ↓
resolve ambiguity
  ↓
deterministic calculation
```

Measure:

```text
Time to modeling-ready input
Correction / error rate
Task completion rate
Manual verification effort
```

Ideally also track confidence/trust rating, number of source returns, and manual recalculations.

The strongest failure signal is:

```text
Research Lens produces outputs
        ↓
Analysts still manually reconstruct
those outputs before relying on them
```

> **Speed is useful. Trustworthy speed is product.**

---

# 9. Cost, Latency & Scale

## Q37. What does the current inference architecture actually look like, and why was it reasonable for the prototype?

The current MVP is deliberately simple.

The user selects one built-in Markdown report and clicks `Analyze Report`. The browser sends the API key, document ID, and full report text to `POST /api/analyze`.

The server makes **one Claude call** over the complete selected report.

```text
Built-in Markdown report
        ↓
Browser
        ↓
Next.js /api/analyze
        ↓
One Claude call
        ↓
Structured JSON
        ↓
Application validation
        ↓
AnalyticalInputs
        ↓
Deterministic Skills
```

Current configuration is centralized around:

```text
Model: claude-sonnet-5
Max output: 8,000 tokens
Effort: medium
```

with a defensive report-text ceiling of 200,000 characters.

The full-report strategy is reasonable because the sample reports are tiny and the prototype is testing semantic interpretation and trust, not large-scale retrieval.

There is no model retry loop, no agent loop, no vector database, and no RAG layer in the trusted path.

After the Claude call, downstream Skills run with zero additional model calls.

The optional AI-only benchmark is one separate on-demand Claude request covering all six analytical tasks. It remains isolated from the trusted path.

The MVP has no database, no persistent analysis cache, no user accounts, and no server-side API-key persistence.

Informal browser tests showed roughly 3–15 second latency depending on the sample and run, but those observations are not controlled benchmarks.

> **Pay model latency for semantic understanding once. Do not pay it again for arithmetic and explicit rules.**

---

## Q38. What changes at 100× scale, or if model cost increases dramatically?

The current architecture is intentionally not optimized for production scale.

The first pressure points would be repeated full-document inference, lack of reuse, long-document context size, concurrency, provider rate limits, latency, and operational visibility.

The first response should not be “switch to the cheapest model.” It should be “remove unnecessary inference.”

### Priority 1 — Persist and reuse semantic work

```text
Document version
+
model version
+
prompt version
+
schema version
        ↓
Reusable semantic interpretation
```

### Priority 2 — Reduce unnecessary context through retrieval

```text
Document
   ↓
Parse / structure
   ↓
High-recall candidate retrieval
   ↓
Financial-semantic reranking
   ↓
Relevant evidence package
   ↓
Semantic interpretation
```

### Priority 3 — Route model complexity

```text
Simple extraction
        ↓
lower-cost model

Ambiguous financial interpretation
        ↓
stronger model

Explicit calculation
        ↓
deterministic code
```

### Priority 4 — Add traffic control where needed

Rate limiting, concurrency control, queues, backpressure, retry budgets, request tracing, and cost attribution become relevant at scale.

### Priority 5 — Add observability

Track cost per document, cost per successful trusted task, latency by document size, latency by semantic complexity, retry rate, cache hit rate, retrieval hit rate, and model errors by slice.

If model prices rose dramatically, optimize in this order:

```text
1. Reuse persisted analysis
2. Reduce unnecessary context through retrieval
3. Route simple work to cheaper models
4. Keep explicit transformations deterministic
5. Optimize request/output sizes
```

> **Don't pay reasoning-model prices for rules.**

---

## Q39. How should slow inference and failures behave?

Today the browser sends a normal `fetch()` to `/api/analyze` and waits. The MVP does not implement an application-level `AbortController` timeout and does not have an automatic retry loop.

The API distinguishes failure classes such as invalid request, missing key, authentication failure, rate limiting, upstream failure, invalid model output, and server error.

Invalid model output fails closed. If the model refuses, reaches the output limit, returns invalid JSON, or fails the application schema, the product does not partially render the result as trusted analysis.

A production implementation should add bounded timeout and retry policy:

```text
Request starts
     ↓
bounded timeout
     ↓
success?
 ┌───┴───┐
yes      no
 │        ↓
 │   transient failure?
 │     ┌──┴──┐
 │    yes    no
 │     ↓      ↓
 │  small    clear
 │  retry    failure
 │  budget
 │     ↓
 └──── result
```

Retry only plausibly transient failures, keep retry budgets small, and make retry cost observable.

Most importantly, the underlying report should remain usable when AI analysis fails.

```text
Report
  ✓ still readable

AI analysis
  ✗ failed

Deterministic results
  ✗ unavailable until valid inputs exist
```

> **A slow or failed model call should degrade to a clear, bounded failure—not an indefinite spinner or a partially trusted result.**

---

# 10. Productionization

## Q40. What are the first three production investments?

The prototype intentionally excludes most production infrastructure so the trust hypothesis stays isolated.

The first three investments should be:

```text
1. Real document ingestion
        ↓
2. Scalable retrieval
        ↓
3. Persistent analytical state
```

### 1. Real document ingestion

A production system must handle real PDFs and related materials containing native text, scans, tables, footnotes, multi-column layouts, headers, exhibits, and inconsistent formatting.

The ingestion layer should preserve provenance such as:

```text
document id
version
page
block
table coordinates
section heading
footnote relationship
source text
parse completeness
```

Incomplete parsing must remain visible. A partially processed document should not look complete.

### 2. Scalable retrieval

For large documents and repositories, full-document inference becomes inefficient.

Retrieval should separate:

```text
High-recall semantic discovery
        ↓
Financial compatibility / evidence ranking
```

The key principle is:

> **Semantic relevance decides what should be considered. Financial compatibility decides what can safely be used.**

Retrieval should not silently collapse materially plausible alternatives into one “best” result.

If an analyst asks for FY2025 Adjusted EBITDA but the system finds only FY2024 Adjusted EBITDA, FY2025 Reported EBITDA, and FY2026 forecast EBITDA, the product should say what was found and what is missing rather than silently answering a nearby question.

> **Do not answer a slightly different financial question just because the evidence is nearby.**

### 3. Persistent analytical state

Production needs durable storage for:

```text
Document
Document version
Parsed evidence
AI interpretation
Semantic inputs
Model / prompt version
Analyst corrections
Analyst resolutions
Skill results
Skill version
Timestamps
```

This enables reuse, auditability, history, and cost reduction.

The architecture should become larger, but the trust model should remain simple:

```text
Evidence
   ↓
AI Interpretation
   ↓
Trust Decision
   ↓
Deterministic Skill
```

Production infrastructure should strengthen that handoff, not bypass it.

After ingestion, retrieval, and persistence, likely next priorities are authentication/access control, observability, model routing, background jobs, production retry policies, collaboration, and Excel/export integration.

---

# 11. AI-Assisted Product Development

## Q41. How was AI used to design and build Research Lens?

Research Lens was built with AI throughout the process, but not through one “build this app” prompt.

I separated two forms of AI assistance:

```text
Product / architecture reasoning
        ↓
ChatGPT

Implementation / repository work
        ↓
Claude Code
```

> **I separate design intelligence from implementation intelligence.**

ChatGPT was used primarily to challenge and refine product decisions:

- define the user and narrow problem;
- compare alternative product approaches;
- define the trust boundary;
- design autonomy rules;
- distinguish semantic trust from Skill readiness;
- refine the analytical-input schema;
- design evaluation strategy;
- reason through productionization;
- review unexpected prototype behavior;
- convert locked design intent into precise implementation instructions.

Claude Code was used to:

- inspect the repository;
- write TypeScript and React code;
- implement API integration;
- build the deterministic Skill engine;
- add conflict-resolution and correction flows;
- create tests;
- build the eval harness;
- prepare deployment;
- report what changed and what was learned.

The working loop was:

```text
Discuss
   ↓
Plan
   ↓
Review
   ↓
Approve
   ↓
Implement
   ↓
Test
   ↓
Reflect
```

rather than:

```text
Prompt
   ↓
Generate app
```

### Why use two model families?

The goal was not a formal ensemble. It was to reduce the chance that one model would make an assumption, encode it into the design, implement the same assumption, and then validate itself without challenge.

```text
ChatGPT
challenge product decision
        ↓
Human approves design
        ↓
Claude Code
implements design
        ↓
Implementation exposes issue
        ↓
Return to product discussion
```

### The coding agent did not own the product architecture

The build plan told Claude Code to read only relevant artifacts, inspect current code, state the minimal approach, make the smallest coherent change, avoid unrelated refactors, avoid unnecessary infrastructure, run checks, and summarize assumptions and remaining issues.

If the coding agent proposed a larger architecture, the simpler implementation was preferred unless requirements proved otherwise.

> **Do not let implementation convenience silently become product design.**

### High-quality implementation prompts became part of the product process

The staged prompts under [`08_Build_Log/AI_Prompts/`](./08_Build_Log/AI_Prompts/) cover scaffolding, schema, Claude integration, evidence UI, Skill engine, benchmark, conflict flow, correction flow, navigation, eval harness, and deployment.

A good implementation prompt contained:

1. required design context;
2. explicit product outcome;
3. safety invariants;
4. acceptance tests;
5. completion reporting requirements.

For example, the conflict-flow prompt required:

```text
Adjusted EBITDA
Reported EBITDA
        ↓
EV / EBITDA
NEEDS_REVIEW
        ↓
No numerical result
        ↓
Analyst selects basis
        ↓
READY
        ↓
Deterministic calculation
```

and explicitly prohibited defaulting to the first, larger, smaller, or adjusted value, or asking Claude to choose the methodology.

### Implementation was allowed to challenge the design

The process was:

```text
Unexpected behavior
        ↓
Return to design
        ↓
Identify failed assumption
        ↓
Update decision / contract
        ↓
Create revised implementation instructions
        ↓
Implement
        ↓
Add regression coverage
```

> **When implementation exposes a design flaw, change the design first—not just the code.**

### Decision logs made the process inspectable

Each build step produced a record under [`08_Build_Log/Decision_Log/`](./08_Build_Log/Decision_Log/) describing what the coding agent produced, what worked, what was wrong or overbuilt, manual changes, and product lessons.

That turns AI-assisted development from transient chat into durable project evidence.

### The prototype verified the PRD

The process was not simply “write PRD, then implement.” It was closer to:

```text
Product thesis
      ↓
Core trust decisions
      ↓
Schemas / policies
      ↓
Sample cases
      ↓
Prototype
      ↓
Observe actual behavior
      ↓
Refine design
      ↓
Eval architecture
      ↓
PRD synthesis
```

> **The prototype was a verification mechanism for the PRD; the PRD was the synthesis, not simply the starting point.**

The eval harness even uncovered disagreements caused by evaluator logic, Ground Truth, and product specification—not only model behavior.

A good debugging question became:

```text
Is the model wrong?
Is the prompt incomplete?
Is the schema wrong?
Is the evaluator wrong?
Is Ground Truth wrong?
Is the product rule wrong?
```

AI coding still required human product review. Code can compile, type-check, and satisfy a schema while still implementing the wrong user behavior.

The complete design package includes the Product Thesis, PRD, approaches considered, competitor alternatives, autonomy policy, semantic schema, Skill specification, benchmark design, sample reports, Ground Truth, eval design, failure taxonomy, regression gates, prototype plan, AI prompts, decision logs, executable eval harness, and working prototype.

> **The prototype is one artifact in the product-design package, not the product-design package itself.**

### Section takeaway

> **Use AI to accelerate the loop, not to eliminate the product judgment inside the loop.**

---

# 12. What Did We Actually Learn?

## Q42. What did the prototype actually validate, what remains unproven, and what would make us stop?

The most precise conclusion is:

> **The prototype provides evidence that the trust architecture is coherent and implementable. It does not yet prove that the product creates enough real-world analyst value to justify production investment.**

Those are different claims.

## What did the prototype validate?

### 1. The semantic-to-deterministic boundary is workable

The prototype demonstrates:

```text
AI interpretation
        ↓
Structured analytical inputs
        ↓
Trust handling
        ↓
Deterministic execution
```

without requiring the LLM to own the entire analytical workflow.

### 2. Financial ambiguity can be preserved instead of hidden

Report C shows that two valid definitions can remain visible, block automatic execution, and become analyst-resolvable workflow state.

### 3. Safety and usefulness can coexist

The product can distinguish:

```text
Clear fact
→ AUTO
→ READY

Material ambiguity
→ ASK
→ NEEDS_REVIEW

Missing / unsupported input
→ BLOCKED
```

rather than choosing between “automate everything” and “review everything.”

### 4. Analyst intervention can remain bounded

A human can provide one missing piece of intent, after which the Skill revalidates and executes deterministically without another model call.

### 5. Evidence lineage can be part of the interaction

The user can move from result to input to interpretation to source evidence.

### 6. Corrections can propagate safely

The system preserves the original interpretation and analyst correction while recalculating dependent results from the latest effective state.

### 7. Evaluation can inspect multiple trust boundaries

The eval work demonstrated that failures can come from the model, prompt, evaluator, Ground Truth, or product specification. That validates evaluating the full chain rather than only final answers.

## What did the prototype not validate?

### Production-scale semantic accuracy

The current executable golden set is only four deliberately designed fictional reports. It does not support statistically meaningful production-quality claims.

### Real PDF ingestion

The prototype uses prepared Markdown and has not validated OCR, complex tables, multi-column PDFs, cross-page footnotes, or large appendices.

### Broad document and industry coverage

The sample reports do not demonstrate robustness across sectors and accounting/reporting styles.

### Statistically significant productivity improvement

No controlled study has yet shown that analysts complete real tasks 20%, 30%, or 50% faster.

### Long-term analyst trust

A demo does not prove that analysts will rely on the system over weeks or months without independently re-checking most outputs.

### Repeat adoption

The prototype does not yet prove weekly habit, retention, team adoption, or workflow dependency.

### Economic ROI

The project has not yet proven that time saved and errors avoided justify model cost, engineering cost, document infrastructure, enterprise controls, and workflow change.

So the bounded claim should be:

> **I believe the prototype validated the trust architecture; it has not yet validated the productivity outcome at production scale.**

## What should the next experiment be?

The next step should not be “build more features.” It should be:

```text
Real analysts
+
real documents
+
real tasks
```

Compare current workflow against Research Lens and measure:

```text
Time to modeling-ready input
Analyst corrections
Input errors
Evidence verification
Manual reconstruction
NEEDS_REVIEW recovery
Task abandonment
Trusted task completion
```

The central question is:

> **Does the architecture reduce real analyst effort without creating hidden analytical risk?**

## What would make us kill or materially change the product?

### 1. Interpretation is not a meaningful bottleneck

If analysts spend little time determining what extracted information actually means, Research Lens may be optimizing the wrong problem.

### 2. Inspectability creates more work than value

If analysts must inspect every interpretation and source passage, the review layer may erase the productivity benefit.

### 3. Analysts still rebuild the result elsewhere

If users routinely recalculate in Excel before relying on Research Lens, the trust gap has not been closed.

### 4. Critical semantics remain unreliable

If period, basis, units, temporal type, and metric definitions cannot reach acceptable reliability or safe gating at reasonable cost, the core hypothesis weakens.

### 5. The trust problem is already solved well enough by existing tools

If existing products already provide clear evidence, correctable semantics, and safe deterministic handoff without meaningful workflow friction, Research Lens may not be differentiated enough.

### 6. No repeat usage

If users say “interesting demo” but do not use it on the next real report, that is meaningful negative evidence.

## The most important learning

Research Lens began with an apparently simple problem:

> “Use AI to extract financial information from reports.”

The prototype made the problem more precise.

The hard questions are:

```text
What does the number mean?
How certain is that meaning?
What evidence supports it?
Is there another valid definition?
Can this particular operation safely use it?
When should the analyst decide?
```

That changes the product from an extraction feature into a **trust architecture**.

---

# Closing — Design Principles

The project can be summarized in six principles.

### 1. Use AI where interpretation is required; use deterministic software where the rules are known.

```text
Messy meaning
→ AI

Explicit rule
→ deterministic software
```

### 2. Preserve ambiguity instead of manufacturing confidence.

```text
Two valid definitions
≠
one automatically chosen answer
```

A missing result can be safer and more useful than a precise but unjustified result.

### 3. Human judgment resolves methodology; it does not override safety contracts.

```text
Analyst selects intended basis
        ↓
Skill revalidates
```

not:

```text
Analyst clicked
        ↓
force calculation
```

### 4. Keep evidence closer to the answer than AI explanation.

The highest-value trust question is often not:

```text
Why did the model think this?
```

but:

```text
What did the report actually say?
```

### 5. Safe failure is necessary; recoverable failure is better.

```text
Wrong:
guess and continue

Better:
block

Best:
block + explain + provide bounded recovery
```

### 6. Evaluate every trust boundary, then evaluate whether those boundaries combine into successful user work.

Offline:

```text
Evidence
Interpretation
Trust
Skill gate
Result
```

Online:

```text
Did the analyst complete the task
faster and with less hidden risk?
```

Both are necessary.

---

# Final Takeaway

Research Lens is not ultimately about financial extraction.

It is about the transition:

```text
What the report says
        ↓
What the system thinks it means
        ↓
What the analyst is willing to trust
        ↓
What deterministic analysis is allowed to do
```

The prototype provides evidence that this boundary can be made explicit, inspectable, correctable, and executable.

The next challenge is proving that doing so creates enough real analyst value to matter.

> **We are not building AI extraction for its own sake. We are trying to remove a trust and workflow gap.**
