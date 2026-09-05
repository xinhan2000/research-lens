---
artifact_id: build_9_evaluation_harness_log
product: Research Lens
build_step: BUILD-9
status: completed
date: 2026-09-05
---

# BUILD-9 — Golden-Set Evaluation Harness

**Status:** COMPLETE
**Final live validation:** PASS
**Final live run:** `eval/results/2026-09-05T23-19-45-896Z`

Saved eval results are intentionally gitignored (`.gitignore` → `eval/results/`).
The directory name above is recorded only as local validation provenance; the
snapshots themselves are not committed and are not test fixtures. `Ground_Truth.jsonl`
remains the only canonical expected dataset.

## 1. Goal

BUILD-9 adds a Node-only golden-set regression harness for the Research Lens
trusted path. It runs outside the Next.js application entirely: no route, no
page, no browser bundle.

Its purpose is deliberately not "does Claude answer correctly?" A single accuracy
number over four reports would hide exactly the failures this product exists to
prevent. The harness therefore evaluates seven things separately:

1. **interpretation correctness** — metric, value, unit, currency, period,
   temporal type, basis, precision, evidence;
2. **trust/autonomy correctness** — the `auto / ask / abstain / never` decision;
3. **Skill gating correctness** — `READY / NEEDS_REVIEW / BLOCKED`;
4. **deterministic numerical correctness** — the calculated result itself;
5. **behaviour requirements** — dataset-declared properties such as "a range must
   not collapse to a single value";
6. **resolution behaviour** — replaying analyst conflict resolution end to end;
7. **hard safety blockers** — the release gates.

### Execution ordering

```text
report
  → model inference (or saved model output)
  → validated AnalysisResponse
  → ONLY THEN load Ground Truth
  → deterministic evaluation
```

This ordering is the core anti-contamination property. The expected answers are
not merely withheld from the prompt — at the moment the model request is made,
they have not been read from disk. `eval/inference.ts` imports no dataset loader
and no scoring module, and its function signatures accept only an API key, a
document id, and report text.

## 2. Harness Architecture

Everything lives under `eval/`. The important modules, by responsibility:

| Area | Files |
|---|---|
| Runtime / CLI | `run.ts`, `cli.ts` |
| Inference reuse | `inference.ts` |
| Ground Truth loading | `ground-truth.ts` |
| Saved-output mode | `saved-output.ts`, `report-map.ts` |
| Input matching | `matching.ts` |
| Normalization | `normalization.ts`, `report-blocks.ts` |
| Field scoring | `scoring.ts` |
| Behaviour checks | `behaviors.ts` |
| Safety gates | `safety.ts` |
| Orchestration | `evaluate.ts`, `types.ts` |
| Benchmark isolation | `benchmark.ts` |
| Rendering / reporting | `render.ts` |
| Tests / fixtures | `*.test.ts`, `test-helpers.ts`, `fixtures/smoke/` |

### Command

```text
npm run eval
```

Flags: `--report`, `--from-dir`, `--benchmark`, `--output`, `--help`.
`tsx` is a dev-only dependency; no production dependency was added.

### Exit semantics

```text
0  trusted eval completed and PASS
1  trusted eval completed and FAIL
2  configuration / harness / inference failure prevented valid evaluation
```

`--from-dir` re-scores previously saved, re-validated `AnalysisResponse` files
with no model call. This matters more than it sounds: it made every scoring
change in this build verifiable against fixed model output, which is what allowed
the Report C and Report D findings below to be proven rather than asserted.

## 3. Ground Truth Isolation

- The Ground Truth loader is not part of the inference path.
- `inference.ts` reuses the production `ANALYSIS_MODEL`, `ANALYSIS_MAX_TOKENS`,
  `ANALYSIS_EFFORT`, `ANALYSIS_SYSTEM_PROMPT`, `buildAnalysisUserMessage`,
  `ANALYSIS_RESPONSE_JSON_SCHEMA`, and `parseAnalysisResponse` — the same
  contract `/api/analyze` uses, so the harness evaluates the production
  interpretation contract rather than a parallel one.
- Ground Truth is read only after every model output is fixed in memory.
- `eval/boundary.test.ts` enforces the invariant by source scan: no product file
  imports an eval module, no product runtime code references the dataset, the
  dataset path appears in exactly one runtime module, and no API route exposes
  eval results.
- Saved-output mode re-validates every loaded file through `parseAnalysisResponse`
  rather than trusting it because an earlier run produced it.

> **Ground Truth is the evaluator's authority, never prompt context.**

## 4. Matching and Normalization

Design philosophy, held deliberately narrow:

- deterministic matching only — no LLM, no embeddings, no edit distance, no
  fuzzy library, no model-based judgement of identity;
- **value is never identity.** Identity comes from metric family → period →
  temporal type → basis. This is what lets a wrong number still match its correct
  expected field, so the harness reports `VALUE MISMATCH` instead of the far less
  useful `INPUT MISSING`;
- tiered assignment with a mutual-uniqueness fixpoint; anything still contested
  is reported `ambiguous` rather than guessed;
- one-to-one — one actual input can satisfy at most one expected input;
- normalization handles spelling and representation equivalence only, never
  meaning.

### Report C finding — report-date surface form

```text
Ground Truth       report_date
fresh model output as of report date
```

Both name the same instant. The evaluator originally treated them as different
because `period` is a free string in the schema, no product artifact defines a
canonical token for the report date, and generic normalization (lowercase,
`_`/`-` → space, whitespace collapse, trim) does not canonicalize the phrase.
Across five saved interpretations the model wrote `"report date"` four times and
`"as of report date"` once — variance on an unconstrained field, not a semantic
error.

**Fix:** a closed exact-key alias table, the same mechanism `lib/skills/metric-family.ts`
uses. Accepted aliases:

```text
report date
as of report date
as of the report date
at report date
at the report date
```

Directional and qualifying phrases remain distinct, because none of them is a key:

```text
after report date          before report date
subsequent to report date  prior to the report date
report date estimate       date of report publication
```

No substring matching, prefix stripping, stop-word deletion, edit distance,
embeddings, or fuzzy matching were added. Closure is the safety property: a rule
that stripped `"as of"` or deleted `"the"` would have reached all six of the
phrases above.

## 5. Safety Model

A hard blocker fails the release regardless of any other metric. The classes:

| ID | Failure |
|---|---|
| BLOCK-1 | SEV-4 unsafe auto-use |
| BLOCK-2 | unsupported consequential input consumed by a Skill |
| BLOCK-3 | material conflict silently resolved |
| BLOCK-4 | unit catastrophe (≥100× magnitude error) |
| BLOCK-5 | Skill executed against a blocked/review expectation |
| BLOCK-7 | deterministic math failure from correct inputs |
| BLOCK-STRUCTURAL | a non-READY Skill carrying a numerical value |

`BLOCK-6` (stale result after correction) was deliberately **not** synthesised
into the four-report run; the BUILD-7 test suite remains its enforcement.

Unsafe auto-use is measured as one case per `(READY Skill, consumed input)` pair —
each is one opportunity for an unresolved interpretation to reach a trusted
calculation. Non-READY Skills contribute to neither side of the ratio.

The `RG-M13` prototype target is `< 1%`, but on a set this small **any SEV-4
unsafe auto-use event is a release blocker** and aggregate accuracy cannot offset
it. `decideReleaseStatus` takes only the report evaluations as arguments, so no
other signal can reach it.

> The four-report golden set is too small to support statistical claims. The
> scorecard prints this on every run.

## 6. AI-Only Benchmark Isolation

BUILD-9 supports the existing BUILD-5.5 benchmark and keeps it strictly separate
from the trusted path:

- benchmark is **OFF by default** (`--benchmark` opts in);
- one call per report covering all six tasks, never one per task;
- the benchmark receives report text only — no Ground Truth, no
  `AnalysisResponse`, no `SkillResult`, no trust or conflict state;
- benchmark metrics render under their own heading, never beside release status
  in a way that implies a trade-off;
- benchmark output cannot change trusted release status, and a benchmark
  infrastructure failure is recorded as exactly that rather than converted into
  a trusted-path failure.

**The final validation run used benchmark OFF.** No AI-only benchmark result
formed part of this release decision, and none is claimed here.

> The AI-only benchmark shows what the model is willing to answer. The Skill
> layer shows what the product is willing to trust and execute.

## 7. Eval-Driven Findings

The harness found four distinct classes of failure. Only one of them was a model
error.

### 7.1 Ground Truth error — Enterprise Value basis

The first live Report A failed on one field:

```text
expected  basis = reported
actual    basis = not_applicable
```

Audit against the pre-existing artifacts showed the model was right. The
production prompt already said, verbatim: *"Use `not_applicable` where an
accounting basis does not apply (for example enterprise value)."* Neither Report A
nor Report C assigns enterprise value a reported/adjusted/GAAP basis — every
basis word in both documents attaches to EBITDA. Enterprise value is a
capital-structure quantity; there is no reported-versus-adjusted version of it.

**Correction:**

```text
report_a_clean  a_ev.basis   reported → not_applicable
report_c_conflict c_ev.basis reported → not_applicable
```

Ground Truth was **not** changed because the model disagreed with it. It was
changed because the specification and the source evidence independently
contradicted the label, and the model happened to be obeying the contract
correctly. That distinction is the discipline that keeps a golden set from
degenerating into a record of whatever the model last produced.

### 7.2 Prompt gap — forecast vs guidance, and forward basis

The first full live run found three Report B semantic errors:

```text
FY2026 Revenue  temporal_type  expected forecast          actual guidance
FY2026 EBITDA   temporal_type  expected forecast          actual guidance
FY2026 Revenue  basis          expected management_defined actual reported
```

A repeat live Report B run reproduced the temporal errors exactly and produced a
*different* wrong basis (`reported` → `unknown`). That contrast was the useful
signal: a **stable** instruction failure on forecast/guidance, and an **unstable**
one on basis — the model had a wrong rule for the first and no rule at all for
the second.

The evidence for the correct labels pre-dated the run.
`Semantic_Input_Schema.md` §9 contains a complete worked object for this exact
sentence shape prescribing `temporal_type: forecast` and `basis: management_defined`,
and SI-7 gives the same `forecast` example. The prompt's own `guidance` definition
required "formal … issued to investors", and the words *guidance*, *issued*, and
*investors* appear nowhere in Report B. The likely mechanism was the `## Outlook`
section heading: every input the model placed in that section became `guidance`
unless the report explicitly called it a target.

The prompt was narrowly clarified — three compact rules, no examples table, no
report-specific wording:

- a management expectation is a forecast unless the report identifies it as
  formal guidance issued to investors;
- a section heading such as "Outlook" is document structure and does not by
  itself confer guidance status;
- a basis the report states always wins, whoever supplied the figure;
- a management-supplied forward value with no other stated accounting or
  analytical basis uses `management_defined`;
- `reported` is an accounting basis, not a record of where the number was found.

Post-refinement Report B: **PASS, 0 semantic differences.** The final fresh run
independently confirmed it.

### 7.3 Evaluator gap — Report C period surface form

Classification: **EVALUATOR / NORMALIZATION ERROR.** Not a model error, and not a
Ground Truth semantic error — `report_date` is a perfectly good canonical token
and `as of report date` is a faithful reading of the same instant.

The proof was clean: re-scoring the byte-identical saved snapshot after the
deterministic alias fix moved Report C from **FAIL → PASS** with the model output
and Ground Truth both unchanged. The design detail is in §4.

### 7.4 Product specification gap — trust vs execution readiness

Report D's source:

> "Management is working toward roughly $25 million of EBITDA next year, but
> described this as an internal planning objective rather than formal guidance."

The correct interpretation, which the model produced:

```text
EBITDA
25 USD_millions
period        = "next year"     (relative form preserved verbatim, as instructed)
temporal_type = target
basis         = management_defined
precision     = approximate
evidence      = direct
conflict      = none
```

Ground Truth expected `trust_state = ASK`; the model emitted `AUTO`. A prompt
clarification aimed at ASK changed **nothing** — a field-by-field comparison of
the pre- and post-refinement snapshots showed every value identical, including
`confidence: 0.75` and the input id.

The audit then found the real problem, and it was not in the model. Two Ground
Truth rows were **identical on every field the dataset records**:

| | `b_rev_target` | `d_ebitda_target` |
|---|---|---|
| temporal_type | target | target |
| basis | management_defined | management_defined |
| precision | approximate | approximate |
| period | relative, unanchored | relative, unanchored |
| evidence | direct | direct |
| conflict | none | none |
| **Ground Truth** | **AUTO** | **ASK** |

Nothing recorded justified the distinction. The specification had conflated two
different questions:

- **INTERPRETATION TRUST** — did the AI faithfully understand the source?
- **EXECUTION READINESS** — can a particular Skill safely use this input?

`Autonomy_Policy.md` §3 listed *"a qualifier required by a skill is unresolved"*
as an input-global ASK condition, while `SI-15` already said resolution is
contextual and *"the consuming skill must validate its own input contract"*, and
`Deterministic_Skill_Spec.md` §15 already located the review requirement for
approximate values at the **Skill**. An `AnalyticalInput` exists before any Skill
is selected, so "required downstream" has no referent at interpretation time.

**Final architectural clarification:**

```text
trust_state  = INPUT-GLOBAL      interpretation trust
Skill state  = CONSUMER-SPECIFIC execution readiness
```

`AUTO` does not mean Skill-ready. A correctly interpreted `AUTO` input can still
be refused by a Skill for period, precision, basis, temporal type, evidence,
conflict, or any other operation-specific requirement.

Under the clarified contract, `d_ebitda_target` moved `ASK → AUTO` in Ground
Truth. This was specification-driven, not a model-driven relabel: had the
clarification gone the other way, `b_rev_target` would have become ASK and the
model would still have been wrong. The internal inconsistency decided the
direction, not the model output.

**The critical proof** is that the relabel created no execution path. Running the
real Skill engine over the saved Report D analysis with `trust_state` swept
across `auto`, `ask`, and `abstain` produces byte-identical Skill states. The
target is excluded by `precision = approximate`, a universal gate condition that
is not relaxable even by an analyst resolution:

```text
ratio role  → block: EBITDA is approximate. This skill requires an exact value.
EV role     → block: EBITDA is approximate. This skill requires an exact value.
```

Unsafe auto-use remained 0. The target is consumed by no Skill and is not even
listed as a candidate.

> **AI interprets. Deterministic Skills execute. Evidence connects both.**

This finding sharpened that boundary. Before it, the trust field was quietly
doing a piece of *executing* — encoding gate-relevant readiness the Skill layer
was already enforcing correctly and independently. Separating the two put each
layer back on its own side of the thesis without changing a single line of Skill
logic.

## 8. Final Fresh Live Regression

**Run:** `eval/results/2026-09-05T23-19-45-896Z`
**Model:** `claude-sonnet-5` · **Mode:** live · **Benchmark:** OFF

```text
REPORT A — PASS
REPORT B — PASS
REPORT C — PASS
REPORT D — PASS
```

```text
Expected input match coverage     22/22 (100.0%)
Metric identity accuracy          22/22 (100.0%)
Economic value accuracy           21/21 (100.0%)
Range accuracy                     1/1  (100.0%)
Unit accuracy                     17/22 (77.3%)
Currency accuracy                 22/22 (100.0%)
Period accuracy                   22/22 (100.0%)
Temporal-type accuracy            22/22 (100.0%)
Basis accuracy                    22/22 (100.0%)
Precision accuracy                22/22 (100.0%)
Evidence validity                 22/22 (100.0%)
Ground-Truth evidence agreement   22/22 (100.0%)
Trust-decision accuracy           22/22 (100.0%)
Conflict detection checks           2/2 (100.0%)
Skill gate accuracy                 7/7 (100.0%)
Deterministic result accuracy       6/6 (100.0%)
Behaviour checks                    8/8 (100.0%)
Resolution checks                   2/2 (100.0%)
Unsafe auto-use                    0/18 (0.00%)
Unsupported consequential inputs      0
Extra actual inputs                   5 diagnostic
Hard safety gates                  PASS
Release status                     PASS
```

### Unit accuracy — 77.3%

The five failing cases are all Report D table values:

```text
d_rev25     expected 101000 USD_thousands  →  actual 101   USD_millions
d_rev_q4    expected  29000 USD_thousands  →  actual  29   USD_millions
d_ebitda25  expected  18600 USD_thousands  →  actual  18.6 USD_millions
d_debt      expected 125000 USD_thousands  →  actual 125   USD_millions
d_cash      expected  30000 USD_thousands  →  actual  30   USD_millions
```

Every one is **economically correct**. The harness deliberately separates
economic-quantity correctness from unit-label agreement, so that a labelling
difference is never reported as a magnitude catastrophe and a magnitude
catastrophe is never normalized away. Economic value accuracy stayed 100%, no
≥100× unit catastrophe occurred, and no unsafe execution followed — the
deterministic results computed from these inputs were all correct because the
scale was applied correctly.

The label difference is gated `monitor` rather than `critical`, so it does not
fail the release. **That is a decision about this release gate, not a statement
that 77.3% unit-label agreement is acceptable in general.** For a production
system it plainly would not be. Unit-label accuracy is a monitor-only gap for
this BUILD and needs deliberate coverage in a larger eval set.

## 9. What the Final Result Proves

On the current four-report golden set, and against the current release policy:

- the expected semantic inputs were recovered — 22/22 matched;
- the critical temporal, basis, period, precision and trust distinctions were
  preserved;
- the material FY2025 EBITDA conflict was not silently resolved — `skill_ev_ebitda`
  correctly held at `NEEDS_REVIEW`;
- the deterministic Skill calculations were numerically correct — 6/6;
- analyst conflict resolution reproduced both expected results and labels — 2/2;
- the hard safety gates detected no unsafe execution — 0 unsafe auto-use across
  18 consequential cases, 0 unsupported consequential inputs, 0 blockers;
- a fresh live inference run passed the current release policy end to end.

That is regression evidence for this set. It is not an accuracy estimate.

## 10. What It Does Not Prove

- **Four reports are not statistically significant.** No confidence interval,
  slice metric, or production quality claim can rest on this sample.
- It is not a production-quality accuracy estimate.
- It does not establish robustness across sectors, issuers, or document
  structures — all four reports concern one fictional company.
- It does not establish robustness across model upgrades; a new model version
  invalidates these results as a quality claim.
- It does not establish OCR or PDF extraction quality; the inputs are Markdown.
- It does not establish multi-document or cross-report behaviour.
- The AI-only benchmark was not part of the final release decision.
- Unit-label accuracy needs broader coverage before it can be trusted.
- Extra diagnostic inputs (5 in the final run) are reported but not
  comprehensively scored.
- Saved results are local validation artifacts, gitignored, and are not committed
  test fixtures or a baseline.
- The committed smoke fixtures are hand-authored, not model output. A passing
  smoke run proves the harness runs and that a correct interpretation passes; it
  does not prove the harness catches real model drift. The Vitest suites cover
  that by mutating those same shapes.

## 11. Deferred Items

None of these is a release blocker.

1. Expand the golden set toward the ~40-case target in `Eval_Dataset_Spec.md`.
2. Add broader unit/scale cases and track unit-label accuracy deliberately.
3. Expand conflict, unsupported-input, and malformed-report coverage.
4. Add model-version regression tracking so a model upgrade is evaluated rather
   than assumed.
5. Consider richer statistical metrics only once the case count supports them.
6. Keep the AI-only benchmark separate from trusted-path release decisions.
7. **Smoke fixture coherence nit.** The synthetic Report D fixture carries
   `resolved: false` on a now-`AUTO`, faithfully interpreted target. This is
   currently non-functional: `resolved` is never read by Skill gating (by design —
   see SI-15) and Ground Truth does not assert it. Deferred rather than changed
   immediately before close-out.
8. **CLI rough edge.** `--from-dir` without `--report` expects the complete
   four-report golden directory and exits 2 on a partial one. Scoring whatever a
   directory contains would be friendlier; deferred.

## 12. Interview Takeaway

The most valuable result of BUILD-9 was not the final 100% on most metrics.

It was that the eval found **four different classes of failure**, and only one of
them was the model:

1. **Ground Truth error** — Enterprise Value basis was mislabelled.
2. **Model/prompt instruction gap** — forecast vs guidance, and forward-looking
   basis.
3. **Evaluator normalization gap** — two spellings of the same instant treated as
   different periods.
4. **Product specification / architecture gap** — `trust_state` conflated
   interpretation trust with execution readiness, and the dataset applied that
   conflation inconsistently to two structurally identical rows.

A harness that only compared model answers to labels would have reported all four
as model errors, and three of the four "fixes" would have been wrong — tuning the
prompt to satisfy a mislabelled expectation, loosening the evaluator to accept a
paraphrase, or relabelling Ground Truth because the model disagreed.

> **The eval did more than score the model. It tested whether the product's
> Ground Truth, instructions, evaluator, and trust architecture were themselves
> coherent.**

Two practices made that possible and are worth carrying forward. First, every
Ground Truth change had to be justified from artifacts that pre-dated the run —
which is why the Enterprise Value label changed and the Report B labels did not,
despite both starting as live failures. Second, `--from-dir` re-scoring meant
each fix could be proven against fixed model output: same snapshot, same answers,
only the thing under test changed. Without that, "we fixed it" would have been
indistinguishable from "the model sampled differently this time."
