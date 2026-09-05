---
artifact_id: ai_only_baseline_comparison
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - product_thesis_and_hypothesis
  - autonomy_policy
  - deterministic_skill_spec
used_by:
  - prd
  - prototype_build_plan
  - build_5_5
  - demo_runbook
---

# Research Lens — AI-Only Baseline Comparison

## 1. Purpose

Define an optional demo comparison between:

1. a direct AI-only analytical answer; and
2. a result produced through Research Lens's trusted Deterministic Skill path.

The comparison exists to make the value of deterministic execution visually
inspectable.

It is not intended to prove that LLMs cannot perform arithmetic.

The hypothesis is:

> Deterministic Skills add value through reproducibility, explicit inputs,
> enforceable semantic gates, and traceable execution — even when a raw model
> happens to produce the same numerical answer.

---

## 2. Product Role

The baseline is an experimental comparison control.

It is NOT:

- a trusted result;
- a Deterministic Skill;
- an AnalyticalInput;
- an input to another skill;
- a source of truth;
- a fallback when a skill is blocked;
- a substitute for user resolution.

The trusted product path remains:

```text
Evidence
→ AI Interpretation
→ Trust Decision
→ Deterministic Skill
→ Result
```

The comparison path is separate:

```text
Report
→ direct Claude question
→ AI-only baseline response
→ UNVERIFIED display only
```

---

## 3. Initial Scope

The MVP comparison supports only:

```text
EV / EBITDA
```

Do not add AI-only comparisons for all six skills merely to make the UI more
complete.

EV / EBITDA is chosen because it demonstrates both:

- a clean calculation case; and
- a material semantic ambiguity case.

---

## 4. User Interaction

The comparison must be ON-DEMAND.

Do not automatically run an extra model call when:

- the report is analyzed;
- the skill engine executes;
- the report selection changes.

The user explicitly selects:

```text
Compare with AI-only
```

before the additional request is made.

This keeps:

- cost visible;
- latency controlled;
- the trusted path independent.

---

## 5. Baseline Prompt Principle

The AI-only baseline should receive:

- the original report;
- a normal analytical question.

For example:

> Using only this report, what is the company's EV / EBITDA? Briefly state the
> inputs you used and any important caveat.

Do not intentionally make the baseline unsafe.

Do not instruct it to:

- ignore ambiguity;
- choose the first EBITDA;
- suppress caveats;
- produce a wrong answer.

The comparison must not be a strawman.

---

## 6. Baseline Independence

The AI-only request must NOT receive:

- Research Lens AnalyticalInput objects;
- Deterministic Skill results;
- trust states;
- conflict states;
- user resolution;
- Ground Truth;
- eval answers.

It should answer directly from the original report.

This makes it a meaningful baseline rather than another rendering of the
trusted pipeline.

---

## 7. UI Representation

The comparison should visually distinguish:

```text
AI-ONLY BASELINE
UNVERIFIED
```

from:

```text
DETERMINISTIC SKILL
READY / NEEDS_REVIEW / BLOCKED
```

Example clean case:

```text
AI-only baseline
34.9x
UNVERIFIED
```

vs

```text
Deterministic Skill
34.95x
READY
EV = $650M
Adjusted EBITDA = $18.6M
Formula = 650 / 18.6
```

The numerical values may be equal.

That is acceptable.

The comparison should emphasize the difference in provenance and execution
guarantees.

---

## 8. Conflict Case

For a report containing multiple valid EBITDA definitions, the AI-only baseline
may:

- choose one;
- return both;
- mention the ambiguity;
- produce a caveat;
- vary across runs.

Do not manipulate the prompt to force one of these outcomes.

The Deterministic Skill must independently return:

```text
NEEDS_REVIEW
```

with no numerical EV / EBITDA result until the analyst resolves the basis.

The product value is not dependent on the raw model making a mistake.

Even if the model identifies the ambiguity correctly, its behavior is
probabilistic while Research Lens converts the ambiguity into an enforceable
execution state.

---

## 9. Relationship to BUILD-6

BUILD-5.5 occurs before conflict-resolution controls.

During BUILD-5.5:

```text
AI-only baseline
```

may show its raw response.

```text
Deterministic Skill
```

may show `NEEDS_REVIEW`.

BUILD-6 later adds analyst basis selection.

User resolution affects ONLY the Deterministic Skill path.

It must not rewrite, reinterpret, or automatically rerun the previous AI-only
baseline response.

---

## 10. Security and Cost

Use the existing BYOK key policy.

The comparison request must:

- be initiated explicitly;
- use the current browser-session API key;
- not persist the key;
- not log it;
- use one model call;
- not enter an agent loop;
- not automatically retry with another model.

---

## 11. Evaluation Boundary

The AI-only baseline is not authoritative ground truth.

Do not use it to:

- determine whether a Deterministic Skill is correct;
- resolve an eval disagreement;
- override Ground Truth;
- set READY / NEEDS_REVIEW / BLOCKED;
- pass regression gates.

It is a visual experimental control.

---

## 12. Success Criteria

The comparison succeeds if:

1. it is clearly labeled UNVERIFIED;
2. it runs only when explicitly requested;
3. it does not affect trusted skill state;
4. Clean can visually compare raw AI output with a deterministic result;
5. Conflict can visually compare probabilistic model behavior with
   deterministic NEEDS_REVIEW gating;
6. no baseline result is reused downstream.

---

## 13. Core Decision

> The AI-only baseline demonstrates what the model can answer. The
> Deterministic Skill demonstrates what the product is willing to trust.

And:

> Same answer does not mean same guarantee.
