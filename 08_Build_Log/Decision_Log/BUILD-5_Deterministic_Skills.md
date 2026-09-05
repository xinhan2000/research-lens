---
artifact_id: build_5_deterministic_skills_log
product: Research Lens
build_step: BUILD-5
status: completed
date: 2026-09-04
---

# BUILD-5 — Deterministic Skills

## Objective

BUILD-5 adds the trusted deterministic execution layer:

```text
Evidence
    ↓
AI Interpretation
    ↓
Trust Decision
    ↓
Skill Contract
    ↓
READY / NEEDS_REVIEW / BLOCKED
    ↓
deterministic result only when READY
```

Core principle:

> A Deterministic Skill never resolves semantic ambiguity itself.

And:

> AI interprets. Deterministic Skills execute. Evidence connects both.

Three properties define the layer:

- **No LLM call exists inside the Skill engine.** No Anthropic import, no
  network access, no reinterpretation of source text.
- **Skills operate only on validated `AnalyticalInput` objects** produced by the
  BUILD-3 validation boundary.
- **Non-READY `SkillResult` objects cannot contain a numerical value.**

## Skills Implemented

Exactly six. CAGR was deliberately deferred — the sample reports do not need it,
and adding a skill only to fill the panel would be the wrong reason.

| Skill | Formula |
|---|---|
| Revenue Growth | `(Current Revenue - Prior Revenue) / Prior Revenue` |
| Gross Margin | `Gross Profit / Revenue` |
| EBITDA Margin | `EBITDA / Revenue` |
| Net Debt | `Total Debt - Cash` |
| EV / Revenue | `Enterprise Value / Revenue` |
| EV / EBITDA | `Enterprise Value / EBITDA` |

## Skill Result Contract

**READY** — required inputs exist, semantics are sufficiently resolved, and a
deterministic value is permitted.

**NEEDS_REVIEW** — materially plausible candidates exist and analyst judgment
could resolve the ambiguity. No numerical result allowed.

**BLOCKED** — a required input is missing, unsupported, or incompatible. No
numerical result allowed.

The invariant is enforced structurally rather than by convention:

> Only the READY constructor accepts a numerical value. NEEDS_REVIEW and
> BLOCKED have no code path for attaching one.

A reviewer does not have to trust that every branch remembered to omit the
value — the type system makes the unsafe state unconstructable.

## Universal Safety vs Skill-Specific Semantics

The initial implementation treated `period` and `temporal_type` as universal
requirements for every consequential monetary input. Live behavior showed this
was too broad.

Enterprise Value may legitimately carry an unresolved fiscal period: it is
stated as of the report date, and its role in `EV / FY2025 Revenue` depends on
the **denominator's** period, not its own. A global rule would have blocked both
hero multiples for a reason the specification never required of that role.

Final design:

**Universal safety** — always enforced:

- `trust_state`
- `conflict_state`
- `evidence_type`
- scalar value presence
- supported precision
- monetary unit
- currency

**Skill-specific semantics** — enforced only where material to that input's role:

- period where material
- temporal type where material
- basis where material

> Skill contracts should require only semantic qualifiers material to that
> input's role.

Two examples surfaced during implementation:

- **Enterprise Value** does not require a fiscal period merely to divide by
  FY2025 Revenue or EBITDA.
- **Net Debt** requires compatible Debt/Cash periods and currency, but not a
  `temporal_type` classification.

Neither was solved by inventing a missing value. Nothing is promoted to
`actual`, and no period is copied from nearby text.

## Monetary Unit Normalization

Deterministic conversion to USD millions:

| Unit | Factor |
|---|---|
| `USD` | × 1e-6 |
| `USD_thousands` | × 1e-3 |
| `USD_millions` | × 1 |
| `USD_billions` | × 1e3 |

Properties:

- driven only by the explicit `unit` field;
- never inferred from source text;
- the original `AnalyticalInput` remains unchanged — normalization happens only
  inside skill execution;
- no FX conversion;
- currency mismatch blocks execution.

Validated live on the Failure report, whose table header states
`$ in thousands`:

```text
125,000 debt  ->  $125M
 30,000 cash  ->   $30M
Net Debt      ->   $95M  READY
```

## Historical Valuation Period Policy

A product decision discovered during implementation:

> Eligibility before recency.

For BUILD-5 automatic EV multiples:

1. restrict to eligible safe **actual** candidates;
2. rank only parseable historical `FY####` periods;
3. select the latest fiscal year when uniquely defined;
4. expose that period in the output label.

Example:

```text
FY2025 Actual Revenue
FY2026 Forecast Revenue

-> use FY2025 actual for automatic historical EV / Revenue
```

The first implementation had this backwards: the later forecast won the recency
ranking and was only rejected afterwards, blocking the whole skill and
suppressing a valid trailing multiple. Fail-safe, but needlessly lossy.

Constraints:

- actual only for automatic BUILD-5 multiples;
- recency never resolves same-period semantic ambiguity;
- forecast, guidance, and target are never silently substituted;
- source array order is irrelevant;
- forward-looking valuation behavior is deferred.

## Metric Family Boundary

The most important live-integration issue of BUILD-5.

Initial unit-test fixtures used canonical metric labels such as `EBITDA` and
`Cash`. Live Claude legitimately returned variations such as `Adjusted EBITDA`
and `Cash and Equivalents`. Exact metric equality caused valid inputs to appear
missing.

Final design: a small deterministic **closed** metric-family mapping used for
candidate selection only.

```text
EBITDA family:  EBITDA | Adjusted EBITDA | Reported EBITDA
Cash family:    Cash | Cash and Cash Equivalents | Cash and Equivalents
```

Matching behavior:

- exact lookup after trim;
- collapse internal whitespace;
- lowercase comparison.

Explicitly **not** used:

- substring matching
- fuzzy matching
- edit distance
- embeddings
- `source.text` parsing
- `source_label` fallback
- model calls

Metric-family membership only identifies candidate analytical concepts. It does
**not** resolve basis, resolve trust state, merge values, or select between
competing definitions.

> Structured output reduces ambiguity, but it does not guarantee a single
> lexical representation for every analytical concept.

And:

> The deterministic boundary must tolerate legitimate structured variation
> without becoming fuzzy or semantically discretionary.

The distinction is testable: `Adjusted EBITDA` maps to the EBITDA family, while
`EBITDA Margin`, `EBITDA Guidance Commentary`, `Cash Flow`, `Cash Margin` and
`Cash and Equivalents Margin` map to nothing at all.

## Live Issue 1 — EBITDA Representation

Clean live inference returned:

```text
metric = Adjusted EBITDA
value  = 18.6
period = FY2025
basis  = adjusted
```

The initial Skill engine expected the exact metric `EBITDA`, producing:

```text
EBITDA Margin   BLOCKED
EV / EBITDA     BLOCKED
```

with the incorrect reason *"EBITDA is not available from this report."*

**Fix:** exact metric-family mapping. After the fix:

```text
FY2025 Adjusted EBITDA Margin   READY   18.42%
EV / FY2025 Adjusted EBITDA     READY   34.95x
```

A latent label bug surfaced during the same fix: a metric label of
`Adjusted EBITDA` combined with `basis = adjusted` would have rendered as
**"Adjusted Adjusted EBITDA"**. Labels now use the family's canonical noun plus
the basis exactly once.

## Live Issue 2 — Cash Representation

Live Clean inference returned `Cash and Equivalents`, while the family table
supported `Cash` and `Cash and Cash Equivalents`. Net Debt therefore incorrectly
BLOCKED.

The exact observed alias was added:

```text
Cash and Equivalents -> Cash family
```

No fuzzy matching was introduced. After the fix:

```text
FY2025 year-end Net Debt   READY   $95M
```

## Testing Lesson

A pattern recurred across two build steps.

The initial deterministic fixtures were authored using canonical names that
matched the implementation's own assumptions. They therefore could not expose
representation differences produced by live inference — they tested the
implementation against itself.

BUILD-4 had the same shape:

```text
test evidence:  Revenue 101,000 29,000
live evidence:  Revenue | 101,000 | 29,000
```

BUILD-5 repeated it twice:

```text
fixture: EBITDA        live: Adjusted EBITDA
fixture: Cash          live: Cash and Equivalents
```

> Test the interface between probabilistic and deterministic systems with
> actual model output, not only fixtures authored from the deterministic
> implementation's assumptions.

This does not make fixtures useless — the two kinds of test cover different
failure classes. Unit tests protect deterministic invariants: that a
NEEDS_REVIEW result never carries a number, that a range is never collapsed to a
midpoint, that arithmetic is correct and reproducible. Live integration testing
validates the representation boundary, which no fixture authored from one side
of that boundary can exercise. Both are required; neither substitutes for the
other.

## Automated Test Coverage

**81 Vitest tests passing** across two files.

Coverage includes:

- the six Report A expected values;
- missing inputs;
- `ASK`;
- `ABSTAIN`;
- `evidence_type = none`;
- material conflict;
- incompatible periods (FY2025 vs Q4 FY2025);
- actual vs forecast mismatch;
- currency mismatch;
- approximate and range rejection, including proof a range is never collapsed;
- zero denominator;
- unit normalization across all four monetary scales;
- deterministic repeated execution;
- source-array order independence;
- the latest-actual policy;
- Report C no-value behavior;
- metric-family live labels;
- false-positive metric aliases.

Also recorded:

- Vitest is a dev-only dependency;
- tests make no network calls;
- no API key is required to run them;
- Ground Truth is not used in normal runtime.

## Manual Test Results

### Clean

Analyze latency: **~12 seconds**. Result: **6 of 6 READY**.

| Skill | Result |
|---|---|
| Revenue Growth | 23.17% |
| Gross Margin | 61.39% |
| FY2025 Adjusted EBITDA Margin | 18.42% |
| FY2025 year-end Net Debt | $95M |
| EV / FY2025 Revenue | 6.44x |
| EV / FY2025 Adjusted EBITDA | 34.95x |

Skill input clicks successfully reused the BUILD-4 evidence
selection/highlighting. No extra Claude call occurred for skill or evidence
interaction.

Earlier Clean runs exposed the EBITDA and Cash metric-family mismatches. Both
were fixed deterministically rather than by modifying the Claude prompt — the
model output was valid in each case.

### Conflict

Analyze latency: **~8 seconds**.

| Skill | Result |
|---|---|
| Revenue Growth | BLOCKED |
| Gross Margin | BLOCKED |
| EBITDA Margin | NEEDS_REVIEW |
| Net Debt | BLOCKED |
| EV / FY2025 Revenue | READY 6.44x |
| EV / EBITDA | **NEEDS_REVIEW** |

Candidates shown for EV / EBITDA:

```text
FY2025 Adjusted EBITDA   $18.6M
FY2025 Reported EBITDA   $14.2M
```

No numerical EV / EBITDA result was displayed. No basis was chosen
automatically. Candidate lineage remained inspectable.

This is the hero BUILD-5 trust behavior.

### Failure

Analyze latency: **~12 seconds**.

| Skill | Result |
|---|---|
| Revenue Growth | BLOCKED — FY2025 and Q4 FY2025 are not two comparable historical fiscal-year values |
| Gross Margin | BLOCKED — Gross Profit unavailable |
| EBITDA Margin | NEEDS_REVIEW |
| Net Debt | READY $95M |
| EV / Revenue | BLOCKED |
| EV / EBITDA | BLOCKED |

EBITDA Margin candidates:

```text
FY2025 Adjusted EBITDA      $18.6M
Q4 FY2025 Adjusted EBITDA    $5.4M
```

The engine did not silently select one period. Enterprise Value is absent from
this report, so no unsupported valuation multiple was produced.

## Product Learning

1. Deterministic arithmetic is the easy part; deterministic input eligibility is
   the product-critical layer.
2. Structured output does not eliminate representation variance.
3. Trust policy must be enforced again at Skill execution, rather than trusting
   upstream Claude fields alone.
4. Semantic requirements should be role-specific rather than globally applied to
   all inputs.
5. Eligibility must be applied before recency.
6. Recency can select a historical period, but must never resolve competing
   semantic definitions within that period.
7. A false READY result is more dangerous than a BLOCKED result.
8. Live model integration tests and deterministic unit tests cover different
   failure classes.
9. Evidence lineage should remain connected through Skill inputs rather than
   creating a separate result-provenance system.
10. BUILD-5.5 can now compare AI-only output with a stable trusted Skill result
    without changing the deterministic engine.

> The model determines what the report may mean. The Skill contract determines
> whether that meaning is safe enough to execute.

> AI interprets. Deterministic Skills execute. Evidence connects both.
