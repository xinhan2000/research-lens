---
artifact_id: build_7_correction_and_recalculation_log
product: Research Lens
build_step: BUILD-7
status: completed
date: 2026-09-05
---

# BUILD-7 — Analyst Correction and Safe Recalculation

## 1. Objective

BUILD-7 adds explicit analyst correction while preserving the original AI
interpretation and ensuring every dependent deterministic result reflects only
the current effective inputs.

```text
AI interpretation
      ↓
analyst correction overlay
      ↓
effective input
      ↓
Skill revalidation
      ↓
READY → new deterministic value
or
NEEDS_REVIEW / BLOCKED → no stale number
```

> The UI must never display a numerical result calculated from inputs that are
> no longer the current effective inputs.

> Correction changes the effective analytical state; it does not rewrite what
> the model originally said.

## 2. Correction Is Not Resolution

BUILD-6:

```text
existing candidate A
existing candidate B
→ analyst selects one existing candidate
```

BUILD-7:

```text
existing AI interpretation
→ analyst changes one or more interpreted fields
→ analyst introduces a corrected effective value / semantic field
```

`AnalystInputResolution` and `AnalystCorrection` are therefore separate concepts
and separate types. Correction cannot reuse the safety check that makes
resolution safe — "the selected id is in the candidate set" — because a
correction introduces a value that was never a candidate.

> Resolution selects among existing interpretations. Correction introduces
> analyst-authored analytical state.

## 3. Immutable AI Interpretation

`analysis.inputs` is never mutated. The original model output remains intact,
and the correction is stored separately and overlaid at runtime.

Reasons:

- provenance;
- resetability;
- evidence integrity;
- UI comparison between original and corrected state;
- prevents representing analyst judgment as model output.

A test proves the original input array remains byte-identical after corrections
are applied and replaced.

## 4. Correction Overlay

```text
AnalystCorrection = {
  inputId,
  changes,
  correctedAt
}
```

Stored in React state keyed by input id. One current correction per input;
re-editing replaces that input's overlay. No correction history stack, no
database, no persistence.

`inputId` is the authoritative anchor — never a metric label, source label, or
array index.

## 5. Editable Fields

Exactly:

```text
value
period
temporal_type
basis
precision
```

Multiple fields may change in one Save.

Explicitly not editable:

```text
metric
source_label
unit
currency
trust_state
conflict_state
evidence_type
source
materiality
resolved
input_id
confidence
notes
```

BUILD-7 demonstrates safe correction and recalculation rather than becoming a
general analytical-data editor. Editing unit or currency would open magnitude
and FX risk; editing trust, conflict, or evidence fields would turn a correction
into a safety override rather than a semantic fix.

## 6. Correction Validation

**Value** — finite number or null. Rejects `NaN`, `Infinity`, `-Infinity`, and
formatted text such as `"$100M"`. Negative values remain allowed, since a
negative EBITDA is semantically valid. The value is interpreted in the input's
existing unit; nothing is parsed from what was typed.

**Period** — trimmed, blank becomes null, and no automatic fiscal
normalization. `2025` is not silently rewritten to `FY2025`; the skill contracts
decide whether what the analyst wrote is usable.

**Temporal type / basis** — the canonical existing enums, imported from
`analysis-schema.ts` rather than duplicated.

**Precision** — `exact`, `approximate`, `qualitative`, `unknown`. Range
correction is not supported because BUILD-7 has no range-bound editor, and
manufacturing bounds the analyst never stated would invent precision.

The correction schema is strict and rejects safety-field edits including `unit`,
`currency`, `trust_state`, `conflict_state`, and evidence fields.

## 7. Effective Input Derivation

```text
original analysis.inputs
+
analystCorrections
        ↓
applyCorrections()
        ↓
effectiveInputs
        ↓
findResolvableBasisConflict(effectiveInputs)
runSkills(effectiveInputs, analystResolution)
```

The original `AnalysisResponse` remains unchanged. A corrected input keeps its
`input_id`, `source`, evidence fields, and every non-corrected field. This is a
pure derived view.

Notably, the skill engine required **no change**: `engine.ts`, `input-gate.ts`,
and `resolution.ts` are untouched, because `runSkills` already accepted an input
array.

## 8. Stale-Result Prevention

`SkillResult[]` is derived from the current `effectiveInputs`. No separately
cached skill result state exists.

Therefore an old result has no independent lifetime. When a correction changes a
value or eligibility, `runSkills` derives the current result immediately, and
the previous number simply ceases to exist.

There is no invalidation timer and no separate stale flag that someone could
forget to set.

> Invalidation means recomputation, not necessarily refusal.

That distinction became concrete during testing — see the next section.

## 9. Important Policy Discovery — EV / Revenue Fallback

**Initial assumption.** If FY2025 Revenue becomes `approximate`, `EV / Revenue`
would become `BLOCKED`.

**Actual correct behavior.** FY2025 Revenue becomes ineligible. BUILD-5's
existing *eligibility before recency* policy then selects the latest remaining
eligible actual fiscal-year Revenue — FY2024 Revenue, $82M — so `EV / Revenue`
becomes:

```text
READY
7.93x
Label:   EV / FY2024 Revenue
Formula: 650 / 82
```

This was **not** treated as a bug, and no BUILD-7 special case was added.

The stale 6.50x result disappeared. The new result uses a different valid
current input and exposes that lineage in both the label and the consumed
inputs, so nothing is hidden from the analyst.

> Stale-result prevention means the previous result must disappear when its
> inputs are no longer selected. It does not require a Skill to BLOCK if another
> valid current input exists.

Two tests encode this: one asserting the FY2024 fallback with the correct label
and no FY2025 input in its lineage, and one proving `EV / Revenue` **is**
BLOCKED when no alternative eligible revenue exists.

## 10. Correction UI

`CorrectionDialog` opens from `Correct interpretation` on a consequential
`AnalyticalInput`.

The dialog shows metric, unit, and currency read-only; editable value, period,
temporal type, basis, and precision; the original AI values inline for each
field; the original evidence snippet; Save; Cancel; and
`Reset to AI interpretation` when a correction exists.

Only inputs belonging to a current Skill metric family expose the correction
control, using the exact metric-family helper rather than fuzzy label matching.
Narrative insights remain non-editable.

## 11. Original vs Corrected Presentation

For a corrected input the current effective value is displayed prominently,
because that is what the skill engine consumes, with a `CORRECTED BY ANALYST`
badge. The expanded detail adds an *Original AI interpretation* block listing
only the changed fields. Evidence remains the original report evidence.

From the live Clean test:

```text
Source / AI:            FY2025 Revenue = $101M
Analyst correction:     FY2025 Revenue = $100M
Effective Skill input:  $100M
Evidence still states:  $101M
```

> The apparent disagreement between evidence and corrected value is intentional
> and inspectable.

## 12. Evidence Lineage

Correction preserves `input_id`, so BUILD-4 evidence linking continues to work
unchanged and a corrected input still highlights the original report sentence.
`source.text` is never rewritten, and no model call occurs.

Evidence represents what the report said. Correction represents what the analyst
wants the current analytical model to use. Keeping both visible is the point.

## 13. BUILD-6 Resolution Interaction

Both `findResolvableBasisConflict` and `runSkills` consume `effectiveInputs`, so
detection and execution always reflect corrected semantic fields.

Any correction Save or Reset clears `analystResolution` to null, because a
correction can change value, period, basis, precision, or candidate meaning, and
a previously valid human resolution may become stale. BUILD-7 deliberately uses
conservative invalidation instead of complicated dependency analysis; the
analyst can resolve again in one click.

> A stale human decision can be as dangerous as a stale model result.

## 14. AI-Only Benchmark Isolation

Correction does **not** clear, rerun, or rewrite the benchmark, feed the
correction into it, parse its answers, or use it as correction input.

The AI-only benchmark remains the direct-model answer to the **original**
report, which produces a genuinely useful comparison:

```text
Original report AI-only answer
        vs
analyst-corrected trusted deterministic state
```

## 15. Zero-Model-Call Correction

Verified manual behavior:

| Action | API calls |
|---|---|
| Save correction | zero |
| Reset correction | zero |
| BUILD-6 resolution after correction | zero |

Correction is pure local analyst state plus deterministic recomputation.

## 16. Manual Clean Test — Baseline

**6 of 6 READY**

| Skill | Result |
|---|---|
| Revenue Growth | 23.17% |
| Gross Margin | 61.39% |
| EBITDA Margin | 18.42% |
| Net Debt | $95M |
| EV / Revenue | 6.44x |
| EV / EBITDA | 34.95x |

## 17. Manual Clean Test — Revenue Correction

Analyst corrected FY2025 Revenue `101 → 100`. Original source evidence remained
$101M. The interpretation card displayed `$100M` with the
`CORRECTED BY ANALYST` badge.

Dependent Skills recomputed immediately:

| Skill | Result |
|---|---|
| Revenue Growth | 21.95% |
| Gross Margin | 62.00% |
| EBITDA Margin | 18.60% |
| EV / Revenue | 6.50x |
| Net Debt | $95M (unchanged) |
| EV / EBITDA | 34.95x (unchanged) |

No API call occurred.

## 18. Manual Clean Test — Precision Invalidation

The analyst then changed the corrected FY2025 Revenue precision
`exact → approximate`.

| Skill | Result |
|---|---|
| Revenue Growth | BLOCKED — no value |
| Gross Margin | BLOCKED — no value |
| EBITDA Margin | BLOCKED — no value |
| EV / Revenue | READY 7.93x — `EV / FY2024 Revenue`, lineage FY2024 Revenue $82M |
| Net Debt | READY $95M (unchanged) |
| EV / EBITDA | READY 34.95x (unchanged) |

The stale 21.95%, 62.00%, 18.60%, and 6.50x results no longer remained anywhere.

No API call occurred.

## 19. Manual Clean Test — Reset

`Reset to AI interpretation` restored FY2025 Revenue to $101M with precision
`exact`, and the `CORRECTED BY ANALYST` badge disappeared.

Original Skill results returned: 23.17%, 61.39%, 18.42%, $95M, 6.44x, 34.95x.

No API call occurred. Reset is reliable precisely because the original model
state was never mutated — there is nothing to reconstruct.

## 20. Manual Conflict Composition Test — Initial

Conflict initially showed Adjusted EBITDA $18.6M and Reported EBITDA $14.2M,
with `EBITDA Margin` and `EV / EBITDA` both `NEEDS_REVIEW` and no value. No
basis was preselected.

## 21. Manual Conflict Composition Test — Resolve

The analyst selected **Adjusted EBITDA**:

```text
EBITDA Margin   READY   18.42%
EV / EBITDA     READY   34.95x
```

Normal BUILD-6 behavior.

## 22. Manual Conflict Composition Test — Correct Selected Candidate

The analyst then corrected Adjusted EBITDA `18.6 → 19`.

The previous analyst resolution was automatically cleared. The corrected
interpretation showed `$19M` with the `CORRECTED BY ANALYST` badge, while the
original evidence still stated $18.6M.

Both dependent Skills immediately returned to `NEEDS_REVIEW` with no value. The
old 18.42% and 34.95x did not survive.

This is an important stale-human-decision recovery behavior: correcting the very
candidate an earlier resolution had selected must not leave that resolution
silently in force.

## 23. Manual Conflict Composition Test — Resolve Again

The analyst explicitly selected Adjusted again. Using the corrected $19M:

```text
EBITDA Margin   19 / 101   ≈ 18.81%   READY
EV / EBITDA     650 / 19   ≈ 34.21x   READY
```

No model or API request occurred.

This demonstrates that correction is not resolution: a correction invalidates a
stale resolution, and explicit resolution is required again.

## 24. Automated Testing

**196 tests passing** — 150 pre-BUILD-7 plus 46 new. No existing test required
modification.

**Correction schema:** finite values; null; negative values; NaN and infinity
rejection; canonical enums; range rejection; period trimming; prohibited fields;
strict unknown-field rejection.

**Pure application:** overlay by input id; original array immutability; original
object immutability; source preservation; trust/conflict/evidence preservation;
stale id handling; deterministic repeated application; multiple corrected
inputs; correction replacement; correction removal and reset.

**Skill propagation:** Revenue 101 → 100 recalculation; four dependent Skill
values change; Net Debt unchanged; EV / EBITDA unchanged; approximate Revenue
invalidates three direct dependents; EV / Revenue falls back to FY2024; a
variant with no alternate Revenue blocks; stale results absent; reset returns
the original output.

**BUILD-6 composition:** correction alone does not resolve ASK or material
conflict; a corrected candidate remains resolvable; resolution can use the
corrected candidate after re-selection.

**Benchmark isolation:** the benchmark response remains unchanged; corrected
Skill output is independent of benchmark presence.

All tests offline. No API key required.

## 25. Product Lessons

1. Correction must preserve original AI output rather than overwrite it.
2. Analyst-authored state needs its own provenance.
3. Correction and resolution are distinct forms of human judgment.
4. Correcting a value must invalidate any stale dependent deterministic result.
5. Invalidation is best achieved through derivation rather than a separate
   stale-result state machine.
6. Invalidation does not necessarily mean BLOCKED; a Skill may select another
   valid current input under its existing contract.
7. Existing deterministic policy should not be overridden merely to satisfy a
   demo expectation.
8. Original evidence should remain visible even when the analyst correction
   disagrees with it.
9. A corrected value must not silently inherit a stale analyst resolution.
10. Clearing resolution after any correction is conservative but safer than
    attempting partial dependency inference in the MVP.
11. User correction must not expose direct editing of trust, conflict, evidence,
    unit, or currency safety fields.
12. Corrections are local deterministic state and require no model call.
13. Reset is reliable precisely because original model state was never mutated.
14. The same effective-input abstraction can support later evaluation of AI
    interpretation vs analyst correction vs Ground Truth.

> Correction changes the effective analytical state; it does not rewrite the
> evidence or the model's original interpretation.

> Every deterministic result must be reproducible from the current effective
> inputs and current analyst decisions.
