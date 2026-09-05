---
artifact_id: ai_only_benchmark
product: Research Lens
version: 0.2
status: approved_baseline
last_updated: 2026-09-05
depends_on:
  - product_thesis_and_hypothesis
  - autonomy_policy
  - deterministic_skill_spec
used_by:
  - prd
  - prototype_build_plan
  - build_5_5
  - eval_dataset_spec
  - eval_slices
  - regression_gates
  - demo_runbook
---

# Research Lens — AI-Only Benchmark

## 1. Purpose

The AI-only benchmark is a direct-model control that answers the same six
analytical tasks supported by the Deterministic Skill layer.

It exists to answer:

> What would a capable general-purpose model do if asked to perform the
> analytical work directly from the report, without Research Lens's structured
> interpretation, trust gates, or Deterministic Skills?

The benchmark is NOT designed to prove that LLMs are bad at arithmetic.

Core hypothesis:

> Deterministic Skills add value through reproducibility, explicit semantic
> contracts, enforceable execution gates, lineage, and consistent failure
> behavior — even when the direct model produces the same answer.

---

## 2. Product Role

The benchmark is:

- a control;
- a comparison surface;
- a future eval baseline.

It is NOT:

- trusted output;
- an `AnalyticalInput`;
- a Deterministic Skill;
- a fallback;
- an ambiguity resolver;
- Ground Truth;
- a source for downstream execution.

The trusted path remains:

```text
Evidence
→ AI Interpretation
→ Trust Decision
→ Deterministic Skill
→ Result
```

The benchmark path is separate:

```text
Original Report
→ direct analytical request
→ AI-only benchmark response
→ UNVERIFIED display
```

There must be no arrow from benchmark output into trusted execution.

---

## 3. Scope — All Six Tasks

The benchmark covers exactly:

1. Revenue Growth
2. Gross Margin
3. EBITDA Margin
4. Net Debt
5. EV / Revenue
6. EV / EBITDA

Do not add CAGR or future skills automatically. The benchmark catalog mirrors
the current MVP Deterministic Skill catalog.

If the Skill catalog changes later, benchmark expansion is a separate product
decision rather than automatic behavior.

---

## 4. One Request, Not Six

The default BUILD-5.5 design uses:

```text
one explicit user action
→ one additional Claude call
→ six benchmark task responses
```

Six separate model calls are prohibited.

Reasons:

- lower cost;
- lower latency;
- consistent report context across all six answers;
- easier side-by-side comparison;
- simpler demo behavior.

The benchmark still runs only on demand. The button may read:

```text
Compare with AI-only
```

The architectural name is **AI-only benchmark**.

---

## 5. Neutral Benchmark Question

The benchmark receives the original report only.

Conceptually:

> Using only this report, answer the following analytical questions where the
> report provides enough information: Revenue Growth, Gross Margin, EBITDA
> Margin, Net Debt, EV / Revenue, EV / EBITDA. For each, give the result if it
> can be determined and briefly state the inputs used or an important caveat.
> If the report does not provide enough information, say so.

The benchmark must NOT be told about:

- AUTO / ASK / ABSTAIN;
- READY / NEEDS_REVIEW / BLOCKED;
- `AnalyticalInput`;
- `SkillResult`;
- Research Lens trust rules;
- Ground Truth;
- expected answers;
- user resolution.

Nor may it be instructed to be aggressive, be conservative, choose the first
value, manufacture disagreement, or identify ambiguity in a particular way.

> The benchmark must not be a strawman. A rigged control proves nothing.

---

## 6. Light Structured Benchmark Response

Raw prose across six tasks is too difficult to compare consistently, so the
response takes a lightweight shape:

```text
AiBenchmarkItem {
  task_id:
    revenue_growth
    gross_margin
    ebitda_margin
    net_debt
    ev_revenue
    ev_ebitda

  answer: string | null
  explanation: string
}

AiBenchmarkResponse {
  items: AiBenchmarkItem[]
}
```

The exact implementation type comes later.

Benchmark objects must NOT contain:

- `READY`;
- `NEEDS_REVIEW`;
- `BLOCKED`;
- `trust_state`;
- `resolved`;
- `conflict_state`;
- `inputIds`;
- `evidenceLineage`;
- `SkillResult`;
- `AnalyticalInput`.

Structure is for comparability, not for borrowed authority. The object means
only:

> This is what the direct model said.

---

## 7. UI Model

Each benchmark task pairs with its corresponding Deterministic Skill:

```text
AI-ONLY BENCHMARK          DETERMINISTIC SKILL
UNVERIFIED                 READY / NEEDS_REVIEW / BLOCKED

Revenue Growth
AI answer                  Skill result / state

Gross Margin
AI answer                  Skill result / state

...

EV / EBITDA
AI answer                  Skill result / state
```

Exact styling is not prescribed. The comparison should support visually
scanning all six rows. The existing detailed Skill cards may remain the trusted
detail surface.

---

## 8. Clean Case

The benchmark may match all six deterministic values closely. **That is a PASS.**

The product message is:

> Same answer does not mean same guarantee.

The comparison should highlight the difference in kind:

- **AI-only** — a probabilistic direct answer.
- **Skill** — validated inputs, an explicit formula, a deterministic result, and
  evidence lineage.

Do not manufacture disagreement.

---

## 9. Conflict Case

For a report with competing EBITDA definitions, the benchmark may choose
adjusted, choose reported, show both, calculate both, explain the ambiguity, or
decline to calculate. All may be legitimate direct-model behavior depending on
the run.

Research Lens must independently show:

```text
EBITDA Margin   NEEDS_REVIEW
EV / EBITDA     NEEDS_REVIEW
```

with no deterministic result until user resolution.

> The value of the Skill layer does not depend on the benchmark making a
> mistake.

Even when the model notices the ambiguity, Research Lens turns it into an
enforceable execution state rather than a well-worded caveat that a downstream
consumer may ignore.

---

## 10. Failure / Over-Caution Case

The benchmark is also useful when the Skill system may be **too conservative**.

For example: the benchmark directly calculates an otherwise defensible FY2025
result while the Skill returns NEEDS_REVIEW because multiple periods exist. That
difference should be visible.

Do not automatically conclude either side is correct. This becomes an
evaluation question:

- Was the AI too aggressive?
- Was the Skill too conservative?
- Was user intent underspecified?

Surfacing these product-policy questions is a deliberate purpose of the
benchmark, not a side effect.

---

## 11. Three-Way Evaluation Model

Future BUILD-9 should distinguish three things:

1. **AI-only benchmark** — the control;
2. **Research Lens trusted path** — the product under evaluation;
3. **Ground Truth** — authoritative.

Never use the benchmark to resolve Ground Truth. Never use the benchmark to
repair Research Lens.

Future comparative metrics may include:

- numerical correctness;
- answer coverage;
- unsafe direct-answer rate;
- Skill READY coverage;
- Skill false-refusal / unnecessary-block rate;
- disagreement cases.

Four sample reports cannot support statistically meaningful production claims.
The ~40–50-case eval dataset is the appropriate future measurement surface.

---

## 12. Security and Cost

Preserved from the earlier design:

- BYOK session key;
- explicit user action;
- one benchmark model call;
- no persistence;
- no logging of the key;
- no agent loop;
- no automatic benchmark run;
- benchmark state cleared on report switch.

---

## 13. Relationship to BUILD-6

User conflict resolution affects only the Deterministic Skill path.

It must not:

- rewrite the benchmark;
- feed benchmark output into resolution;
- automatically rerun the benchmark;
- use the benchmark's choice as the default basis.

The benchmark remains the raw pre-resolution control. Leaving it untouched is
what makes the before/after contrast legible.

---

## 14. Success Criteria

The benchmark succeeds if:

1. all six MVP analytical tasks are represented;
2. one explicit action creates one benchmark model request;
3. every benchmark item is clearly `UNVERIFIED`;
4. benchmark results cannot mutate trusted Skill state;
5. Clean supports six-task side-by-side comparison;
6. Conflict shows direct-model behavior beside deterministic gating;
7. Failure can expose overly aggressive AI or overly conservative Skills;
8. report switch clears the benchmark;
9. Ground Truth never enters the benchmark request;
10. no benchmark result is reused downstream.

---

## 15. Core Decision

> The AI-only benchmark shows what the model is willing to answer. The Skill
> layer shows what the product is willing to trust and execute.

And:

> Same answer does not mean same guarantee.
