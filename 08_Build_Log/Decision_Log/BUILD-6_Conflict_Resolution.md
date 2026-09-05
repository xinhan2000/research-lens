---
artifact_id: build_6_conflict_resolution_log
product: Research Lens
build_step: BUILD-6
status: completed
date: 2026-09-05
---

# BUILD-6 — Analyst Conflict Resolution

## 1. Objective

BUILD-6 turns a reviewable semantic conflict into an explicit analyst decision
without weakening the deterministic safety boundary.

```text
Adjusted EBITDA
Reported EBITDA
        ↓
NEEDS_REVIEW
        ↓
Analyst chooses one existing candidate
        ↓
selected candidate revalidated
        ↓
READY only if all remaining hard gates pass
```

> A Deterministic Skill never resolves semantic ambiguity itself.

> Analyst resolution removes a reviewable ambiguity; it does not override
> evidence, precision, unit, period, currency, or other hard safety rules.

## 2. Why Resolution Is an Overlay

The original `AnalyticalInput` objects remain unchanged. A user selection does
not rewrite `metric`, `value`, `period`, `temporal_type`, `basis`,
`trust_state`, `conflict_state`, `resolved`, `evidence`, or `source`.

BUILD-6 instead stores, in local React state:

```text
family
period
selectedInputId
```

Reasons:

- preserves the original model interpretation exactly as received;
- preserves provenance;
- keeps the analyst action explicit and attributable;
- prevents silently pretending Claude originally resolved the conflict;
- makes reset and revalidation straightforward.

If the selection had been written back into the input, the record of *what the
model actually said* would be gone, and with it the ability to show that a human
made the call.

## 3. Input ID Is Authoritative

Selection is stored as `selectedInputId`, not merely `"adjusted"` or
`"reported"`.

Reasons:

- exact lineage;
- evidence connection;
- stale-input detection;
- avoids reconstructing an input from a display label;
- allows validation that the selected candidate belongs to the correct family
  and period.

A basis string could match several candidates and would sever the link to the
evidence that justified it. Basis remains useful for display; the ID is
authoritative.

## 4. One Semantic Choice, Multiple Dependent Skills

The analyst is resolving one question:

> Which FY2025 EBITDA definition should be used?

Not, separately, "which EBITDA should EBITDA Margin use?" and "which EBITDA
should EV / EBITDA use?".

One selection therefore updates both `EBITDA Margin` and `EV / EBITDA`, keeping
semantic intent consistent downstream. Two clicks for one decision would invite
inconsistent state.

## 5. Reviewable Gates vs Hard Gates

A new `analystResolvedReview` option was added to the input gate, defaulting to
`false`. Without it, BUILD-5 behaviour is unchanged — confirmed by all 111
pre-existing tests passing unmodified.

Analyst selection may resolve **only** these, and only for the specifically
selected candidate:

```text
trust_state = ask
conflict_state = possible_conflict
conflict_state = material_conflict
```

It may **never** bypass:

```text
trust_state = abstain
trust_state = never
evidence_type = none
qualitative precision
unsupported range
unsupported approximate value
unknown precision
missing value
unsupported unit
missing currency
required period
required temporal type
actual-only constraint
required basis
currency mismatch
period mismatch
normalization failure
zero denominator
```

> Analyst selection is not a general "trust this anyway" override.

This distinction is the heart of the build step, and it is encoded structurally:
the three reviewable checks are the only ones guarded by the flag, and fourteen
parameterised tests prove each hard gate still prevents READY even when the
analyst has explicitly chosen that candidate.

## 6. Revalidation After Selection

The execution path:

1. build the normal candidate set for that skill role;
2. verify the selected input id belongs to it;
3. verify family and period context match;
4. re-run `checkInput` with only the reviewable conditions relaxed;
5. normalize with the existing deterministic unit conversion;
6. apply all normal compatibility checks;
7. execute the formula only if every remaining rule passes.

No implementation of the form:

```ts
if (selectedInputId) return selected
```

exists anywhere. Selection does not bypass the Skill contract; it changes one
input to the contract. A selected candidate that fails a hard gate falls through
to normal unresolved behaviour rather than forcing a state.

## 7. Basis-Conflict Detection

`findResolvableBasisConflict` in `lib/skills/resolution.ts`.

Controls require:

- EBITDA family;
- same explicit period;
- exactly one adjusted candidate;
- exactly one reported candidate;
- numerical candidates;
- a unique, unambiguous conflict group.

Detection uses structured `AnalyticalInput` fields and exact metric-family
semantics only. It does **not** use source-text parsing, fuzzy matching,
document id, the Report C filename, a model call, a hard-coded period, or
hard-coded values.

If multiple candidate groups are independently plausible, it fails closed and
returns nothing rather than guessing which conflict the analyst is looking at.

## 8. Why the Failure Report Gets No Controls

The Failure report contains:

```text
FY2025 Adjusted EBITDA
Q4 FY2025 Adjusted EBITDA
```

That is **period ambiguity**, not accounting-basis ambiguity. Neither period
group contains an adjusted/reported pair, so no group forms.

BUILD-6 therefore renders no `Use FY2025` / `Use Q4` control, and Failure's
EBITDA Margin stays `NEEDS_REVIEW`.

This boundary is deliberate and tested. Without it, a basis control would
quietly become a generic ambiguity resolver, and a period guess would ride in on
a mechanism designed for a different question.

## 9. Resolution UI

`ConflictResolutionPanel` shows both candidates together, because they
represent one semantic decision rather than one decision per skill card.

Initial state: **nothing selected by default.**

Each candidate shows basis, period, value, `Show evidence`, and
`Use Adjusted` / `Use Reported`. Neither option is styled as recommended, and
candidates appear in document order — never ordered by value.

After selection, the chosen candidate is marked `Selected by analyst` and the
alternative remains visible and selectable. The panel does not disappear once
skills become READY.

This preserves reversibility, competing evidence, inspection, and auditability.
A panel that vanished on success would hide exactly the thing an analyst may
later need to defend.

## 10. Evidence Lineage

`Show evidence` reuses the BUILD-4 input selection: the adjusted candidate
highlights the adjusted EBITDA sentence, the reported candidate highlights the
reported one. No model call occurs.

Evidence inspection and basis selection are separate actions — choosing a basis
never requires viewing evidence first, and viewing evidence never selects a
basis.

## 11. State Reset

Analyst resolution is cleared when the report changes and when a new
`Analyze Report` begins.

Model output and input ids can change between runs, so a stale analyst decision
must never silently apply to new inference.

Resolution is React state only: no database, no `localStorage`, no persistence.

## 12. AI-Only Benchmark Isolation

The BUILD-5.5 benchmark remains the raw pre-resolution control.

Basis selection does not clear it, rerun it, rewrite it, parse its answers, use
its answer as the resolution, use its apparent basis as a default, or feed its
output into a Skill. Every benchmark item stays `UNVERIFIED` and unchanged;
only the deterministic side updates.

No benchmark file required modification for BUILD-6.

The resulting comparison is the clearest statement of the product thesis:

```text
AI-only benchmark        Deterministic Skill
UNVERIFIED               NEEDS_REVIEW
may show both              ↓ analyst selects
possibilities            READY
```

## 13. Zero-Model-Call Resolution

`Use Adjusted` and `Use Reported` are purely local deterministic state
transitions, causing:

- zero `/api/analyze` calls;
- zero `/api/ai-benchmark` calls;
- zero Anthropic calls.

Selection updates React state and recomputes `runSkills` locally. Verified by
inspection: the resolution panel and resolution module contain no `fetch`, and
the shell's only two network handlers remain Analyze and the benchmark.

This is a real product property, not an implementation detail — resolving an
ambiguity is instant and free, which is what makes exploring both bases
practical during a review.

## 14. Manual Conflict Test — Initial State

Report C analysis produced:

| Skill | State |
|---|---|
| Revenue Growth | BLOCKED |
| Gross Margin | BLOCKED |
| EBITDA Margin | NEEDS_REVIEW — no result |
| Net Debt | BLOCKED |
| EV / Revenue | READY 6.44x |
| EV / EBITDA | NEEDS_REVIEW — no result |

The Analyst Resolution panel displayed:

```text
Adjusted EBITDA   $18.6M   FY2025
Reported EBITDA   $14.2M   FY2025
```

Nothing was selected by default. The AI-only benchmark remained available and,
when run, showed both EBITDA possibilities as `UNVERIFIED`.

## 15. Manual Conflict Test — Adjusted

After `Use Adjusted`:

| Skill | Result |
|---|---|
| EBITDA Margin | READY **18.42%** — `FY2025 Adjusted EBITDA Margin`, formula `18.6 / 101` |
| EV / EBITDA | READY **34.95x** — `EV / FY2025 Adjusted EBITDA`, formula `650 / 18.6` |
| EV / Revenue | READY 6.44x (unchanged) |

Unrelated skills remained unchanged. The panel remained visible with Adjusted
marked `Selected by analyst` and Reported still available. No API or model
request occurred. The AI-only benchmark was unchanged.

## 16. Manual Conflict Test — Reported

After `Use Reported`:

| Skill | Result |
|---|---|
| EBITDA Margin | READY **14.06%** — `FY2025 Reported EBITDA Margin`, formula `14.2 / 101` |
| EV / EBITDA | READY **45.77x** — `EV / FY2025 Reported EBITDA`, formula `650 / 14.2` |
| EV / Revenue | READY 6.44x (unchanged) |

The panel remained visible with Reported marked `Selected by analyst` and
Adjusted still available. No API or model request occurred. The AI-only
benchmark was unchanged.

## 17. Manual Negative Regression — Clean

- no Analyst Resolution panel;
- all six deterministic Skills remain READY;
- same BUILD-5 results: 23.17%, 61.39%, 18.42%, $95M, 6.44x, 34.95x.

No user choice was required.

## 18. Manual Negative Regression — Failure

- no Analyst Resolution panel;
- Revenue Growth BLOCKED;
- Gross Margin BLOCKED;
- EBITDA Margin NEEDS_REVIEW;
- Net Debt READY $95M;
- EV / Revenue BLOCKED;
- EV / EBITDA BLOCKED;
- no `Use FY2025` / `Use Q4` controls.

This confirms BUILD-6 does not confuse period ambiguity with basis ambiguity.

## 19. Automated Testing

**150 tests passing** — 111 pre-BUILD-6 plus 39 new. No existing test required
modification.

Coverage includes:

- unresolved Report C;
- adjusted resolution;
- reported resolution;
- both dependent Skills updating from one choice;
- unrelated Skills unchanged;
- old `runSkills` API compatibility;
- stale / nonexistent input id;
- wrong-family selection;
- mismatched period;
- hard gates remaining enforced (fourteen cases);
- no mutation of inputs;
- deterministic repeated execution;
- basis conflict detection;
- Report D period-ambiguity boundary;
- same-basis candidate rejection;
- unknown basis;
- multiple conflict groups failing closed;
- benchmark isolation.

Tests remain offline: no network, no API key.

## 20. Product Lessons

1. Human resolution should be modeled as explicit data, not by mutating model
   interpretation.
2. A user choice should resolve only the ambiguity the user actually addressed.
3. Reviewable gates and hard safety gates are different classes and must be
   encoded separately.
4. Explicit analyst selection must still trigger deterministic revalidation.
5. One semantic choice should propagate consistently to all dependent Skills.
6. Resolution should remain reversible and preserve the rejected alternative.
7. Basis ambiguity and period ambiguity are distinct product problems.
8. Evidence should remain inspectable before and after resolution.
9. A trusted deterministic result can change without another AI call.
10. The AI-only benchmark becomes more valuable when it stays frozen while the
    deterministic path moves from NEEDS_REVIEW to READY.
11. The product should never represent an analyst decision as if the model made
    it.
12. A stale human decision can be as dangerous as a stale model result, so
    resolution must reset on re-analysis.

> The model identifies the ambiguity. The analyst resolves the intent. The Skill
> revalidates and executes.

> Human judgment may resolve ambiguity; it may not bypass evidence or safety.
