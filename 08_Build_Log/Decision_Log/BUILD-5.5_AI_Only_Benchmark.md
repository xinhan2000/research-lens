---
artifact_id: build_5_5_ai_only_benchmark_log
product: Research Lens
build_step: BUILD-5.5
status: completed
date: 2026-09-05
---

# BUILD-5.5 — AI-Only Benchmark

## 1. Objective

BUILD-5.5 adds an explicit direct-model benchmark across all six MVP analytical
tasks, displayed beside the deterministic results.

The comparison is between two architectures over the same report:

```text
Original Report
    ↓
AI-only benchmark
    ↓
UNVERIFIED direct answers
```

versus:

```text
Original Report
    ↓
AI Interpretation
    ↓
Trust Decision
    ↓
Deterministic Skill
    ↓
READY / NEEDS_REVIEW / BLOCKED
```

> The AI-only benchmark shows what the model is willing to answer. The Skill
> layer shows what the product is willing to trust and execute.

> Same answer does not mean same guarantee.

> Recognition is probabilistic; gating is enforceable.

## 2. Why Scope Expanded to Six Skills

The original BUILD-5.5 design covered only EV / EBITDA. Before implementation,
product review changed the scope to all six MVP Skills:

1. Revenue Growth
2. Gross Margin
3. EBITDA Margin
4. Net Debt
5. EV / Revenue
6. EV / EBITDA

**Reason.** A single EV / EBITDA comparison could appear like a cherry-picked
ambiguity case — the one calculation chosen because it makes the product look
good.

The six-task benchmark turns the feature into a systematic control layer and a
future evaluation baseline. It can now expose:

- cases where AI and Skill agree;
- cases where AI answers but the Skill refuses;
- cases where both refuse;
- cases where AI detects ambiguity;
- cases where the Skill may be overly conservative.

That last category matters most: a control that can only embarrass the model is
not a control.

## 3. One-Call Architecture

```text
one explicit user action
→ one POST /api/ai-benchmark
→ one Anthropic request
→ six benchmark items
```

No one-call-per-Skill behavior exists anywhere in the implementation.

Reasons:

- lower cost;
- lower latency;
- one consistent report context across all six answers;
- easier comparison;
- simpler demo behavior.

The benchmark never runs automatically — not on analysis, not on skill
execution, not on report selection.

## 4. Benchmark Contract

A separate lightweight contract:

```text
AiBenchmarkItem {
  task_id
  answer        // may be null
  explanation
}
```

Canonical task IDs:

```text
revenue_growth
gross_margin
ebitda_margin
net_debt
ev_revenue
ev_ebitda
```

The response must contain exactly six items, every task exactly once, no
duplicate tasks, and no unknown tasks. Malformed output fails as a whole —
there is no partial rendering of four or five valid items.

Explicitly absent from the contract:

```text
READY
NEEDS_REVIEW
BLOCKED
trust_state
conflict_state
resolved
inputIds
evidenceLineage
AnalyticalInput
SkillResult
```

> Structure is used for comparability, not for borrowed authority.

## 5. Independent Validation

- Anthropic structured output is used (`output_config.format`);
- a separate JSON Schema defines the model response;
- a separate Zod schema validates the response again;
- it does not extend `AnalysisResponseSchema`;
- the normal Research Lens analysis contract remains independent.

Structured model output is useful, but application validation remains the actual
contract boundary. The JSON Schema cannot express the exactly-six /
no-duplicate / no-missing rules at all — those live only in Zod, which is
precisely why the second pass is not redundant.

## 6. Fair Benchmark Design

The benchmark uses the **same Claude model** as the Research Lens interpretation
path, through the existing `ANALYSIS_MODEL` configuration. No stronger or weaker
model was introduced.

The comparison is intended to measure architectural behavior, not different
model capability. Giving either side a better model would answer a question
nobody asked.

The model receives:

- the original report;
- a neutral six-task analytical request.

The model does **not** receive:

- `AnalyticalInput` objects;
- `SkillResult` objects;
- trust state;
- conflict state;
- Ground Truth;
- expected answers;
- analyst resolution.

## 7. Benchmark Neutrality

The prompt deliberately does not tell the model to:

- prefer adjusted EBITDA;
- prefer reported EBITDA;
- prefer the latest period;
- refuse ambiguity;
- calculate aggressively;
- calculate conservatively;
- disagree with the Skill;
- imitate READY / NEEDS_REVIEW / BLOCKED.

> A rigged control proves nothing.

The benchmark may agree completely with Research Lens and still be useful — and
on the Clean report, it did.

## 8. Trusted-Path Isolation

Benchmark state is completely independent from `analysis`, `SkillResult[]`, and
`runSkills()`.

Benchmark output cannot:

- provide missing Skill inputs;
- repair an input;
- resolve a conflict;
- mutate a Skill status;
- trigger a deterministic calculation;
- serve as a fallback;
- become Ground Truth.

A benchmark error also cannot change normal analysis state: it has its own
error field and never sets the analysis status.

## 9. UI Design

Each of the six tasks has one compact comparison row:

```text
AI-ONLY BENCHMARK          DETERMINISTIC SKILL
UNVERIFIED                 READY / NEEDS REVIEW / BLOCKED
```

The existing detailed Skill cards remain below and retain inputs, candidates,
formula, and source-evidence lineage. The comparison does not replace the
trusted detail view.

Presentation decisions:

- `UNVERIFIED` deliberately uses neutral grey styling — never green, never
  styled as success;
- there is no AI READY / BLOCKED pseudo-status;
- a benchmark `answer = null` displays as **No direct answer**;
- a non-READY Skill never displays a numerical result.

## 10. State and Stale-Result Behavior

- the benchmark has its own idle / running / success / error state;
- report switch clears the benchmark;
- starting a new normal analysis clears the benchmark;
- the benchmark never automatically reruns — the user must invoke it again;
- duplicate benchmark requests are disabled while one is running;
- the report selector and re-analysis are disabled during an active benchmark
  request, preventing stale cross-report application.

The disable-during-request approach was chosen over request-identity tracking
because it is simpler and sufficient for a single-user demo.

## 11. Clean Manual Result

Deterministic Skills: **6 of 6 READY**

| Skill | Result |
|---|---|
| Revenue Growth | 23.17% |
| Gross Margin | 61.39% |
| Adjusted EBITDA Margin | 18.42% |
| Net Debt | $95M |
| EV / Revenue | 6.44x |
| EV / EBITDA | 34.95x |

AI-only benchmark:

| Task | Answer |
|---|---|
| Revenue Growth | 23.2% |
| Gross Margin | 61.4% |
| EBITDA Margin | 18.4% |
| Net Debt | $95.0 million |
| EV / Revenue | 6.4x |
| EV / EBITDA | 35.0x |

All six benchmark items displayed `UNVERIFIED`. The deterministic side remained
`READY`.

Observed benchmark latency: **approximately 17 seconds**. This was one observed
live run, not a latency measurement.

**Key product learning.** The model was essentially correct across all six
straightforward tasks. This is a **successful comparison**, not a
disappointing one — it is the cleanest possible statement of the actual claim.

> Same answer does not mean same guarantee.

## 12. Conflict Manual Result

AI-only benchmark:

| Task | Answer |
|---|---|
| Revenue Growth | No direct answer |
| Gross Margin | No direct answer |
| EBITDA Margin | approximately 18.4% adjusted, or approximately 14.1% reported |
| Net Debt | No direct answer |
| EV / Revenue | 6.44x |
| EV / EBITDA | approximately 34.9x adjusted, or approximately 45.8x reported |

The direct model recognized and explained both EBITDA definitions.

Research Lens deterministic behavior:

| Skill | State |
|---|---|
| Revenue Growth | BLOCKED |
| Gross Margin | BLOCKED |
| EBITDA Margin | NEEDS_REVIEW — no result |
| Net Debt | BLOCKED |
| EV / Revenue | READY 6.44x |
| EV / EBITDA | NEEDS_REVIEW — no result |

No basis was automatically selected. No benchmark answer mutated Skill state.

Benchmark latency: not recorded.

**Key product learning.** The benchmark did **not** need to fail for Research
Lens to demonstrate value. The model handled the ambiguity well and said so
clearly in prose.

> The model understood the ambiguity. Research Lens converted that ambiguity
> into an enforceable execution state.

> Recognition is probabilistic; gating is enforceable.

A caveat in prose can be read, skimmed, or ignored by whatever consumes the
answer next. `NEEDS_REVIEW` with no numerical result cannot.

## 13. Failure Manual Result

AI-only benchmark:

| Task | Answer |
|---|---|
| Revenue Growth | No direct answer |
| Gross Margin | No direct answer |
| EBITDA Margin | 18.4% |
| Net Debt | $95,000 thousand |
| EV / Revenue | No direct answer |
| EV / EBITDA | No direct answer |

Research Lens deterministic path:

| Skill | State |
|---|---|
| Revenue Growth | BLOCKED |
| Gross Margin | BLOCKED |
| EBITDA Margin | NEEDS_REVIEW — no result |
| Net Debt | READY $95M |
| EV / Revenue | BLOCKED |
| EV / EBITDA | BLOCKED |

**Interpretation.** The AI benchmark naturally chose the FY2025 EBITDA/revenue
pair and returned 18.4%. The Skill refused because both FY2025 and Q4 FY2025
represent materially plausible period choices and user intent was not explicit.

Neither behavior is automatically wrong. This exposes a product-policy question:

- Is the direct AI being too aggressive?
- Is the Skill contract too conservative?
- Is user intent underspecified?

The honest answer is that the question is currently unanswerable from the
report alone, which is itself the finding.

**Presentation difference.** The AI benchmark preserved the table-scale
representation as `$95,000 thousand`, while the deterministic Skill normalized
the same economics to `$95M`. This is not automatically an AI error — it is a
useful example of raw model presentation versus normalized execution. Both
describe the same amount; only one is in a form a downstream calculation can
consume without further interpretation.

Benchmark latency: not recorded.

## 14. Benchmark as Evaluation Instrument

Live testing changed the conceptual role of the benchmark. It is not only a
demo comparison.

It can diagnose **both**:

- unsafe or aggressive direct-model behavior;
- excessive Skill conservatism.

The Failure report demonstrated the second direction on the first live run,
which was not the outcome the feature was originally designed to show.

Future BUILD-9 can compare:

```text
Ground Truth
    vs
AI-only benchmark
    vs
Research Lens trusted path
```

Possible future diagnostics: benchmark numerical correctness, answer coverage,
unsafe direct-answer rate, trusted READY coverage, false-refusal review rate,
disagreement rate.

No production metric is claimed. Four sample reports are insufficient for
statistical conclusions.

## 15. Cost and Latency

| Path | Model calls |
|---|---|
| Normal Research Lens analysis | one |
| AI-only benchmark | one additional, explicit |
| Deterministic Skills | none — local execution after interpretation |

Clean benchmark observed: ~17 seconds. Conflict and Failure: latency not
recorded. No token or cost figures were measured.

**Product implication.** The benchmark is explicitly on-demand because the
comparison adds real latency and model cost. Running it automatically would
double the cost of every analysis to answer a question the analyst may not be
asking.

## 16. Automated Testing

**111 tests passing** — 81 existing BUILD-5 tests plus 30 new BUILD-5.5 tests.

Coverage includes:

- six-item valid schema;
- missing task;
- duplicate task;
- unknown task;
- excess items;
- nullable answer;
- prohibited fields;
- strict object behavior;
- six-task catalog uniqueness;
- task-to-Skill mapping uniqueness;
- mapping verified against actual `runSkills` IDs;
- request payload boundary;
- prompt neutrality;
- JSON Schema shape;
- canonical output ordering;
- `SkillResult` immutability and isolation.

Tests remain offline: no real Anthropic request, no API key required.

## 17. Security

Verified design:

- existing `sessionStorage` BYOK;
- no `localStorage`;
- API key sent only in the POST body;
- no query-string key;
- no key persistence;
- no key rendered in the UI;
- no key logging;
- per-request Anthropic client;
- no shared server API key;
- no Ground Truth runtime import.

## 18. Product Lessons

1. A benchmark is more useful when it can show agreement, not only failure.
2. Direct-model correctness does not provide deterministic execution
   guarantees.
3. Detecting ambiguity and enforcing ambiguity are different product
   capabilities.
4. A benchmark can reveal Skill over-caution as well as AI over-aggression.
5. Comparing all six tasks is more credible than cherry-picking one ambiguous
   calculation.
6. A single six-task model call is simpler and cheaper than one call per Skill.
7. Structured benchmark output improves comparability without making the output
   trusted.
8. Benchmark and trusted-path contracts should remain separate.
9. A benchmark must never become a hidden fallback path.
10. Raw AI presentation differences — such as `$95,000 thousand` vs `$95M` —
    can be informative rather than automatically normalized away.
11. The strongest product story is not "AI cannot calculate"; it is that
    probabilistic interpretation requires explicit execution policy when the
    cost of wrong is high.

> The AI-only benchmark shows what the model is willing to answer. The Skill
> layer shows what the product is willing to trust and execute.

> Same answer does not mean same guarantee.
