---
artifact_id: build_8_lenses_and_semantic_navigation_log
product: Research Lens
build_step: BUILD-8
status: completed
date: 2026-09-05
---

# BUILD-8 — Lenses and Semantic Navigation

## 1. Objective

BUILD-8 adds local analytical lenses and dynamic semantic navigation without
introducing a new reasoning layer.

> Navigation filters the current analytical workspace; it does not regenerate
> analysis.

> Lens selection changes presentation, not trusted execution.

Five lenses — All, Financials, Risks, Timeline, Assumptions — plus semantic
navigation derived from the current lens content. No additional Claude call.

## 2. Why This Is a Presentation Layer

`activeLens` does not enter:

```text
runSkills
findResolvableBasisConflict
applyCorrections
/api/analyze
/api/ai-benchmark
benchmark request construction
```

Trusted execution continues to depend only on:

```text
analysis.inputs
+
analyst corrections
→ effectiveInputs
→ resolution
→ runSkills
```

Lens and navigation operate only after `effectiveInputs` exist.

> A user should be able to reorganize what they are looking at without changing
> what the system is willing to trust.

## 3. Lens Catalog

Exactly five top-level lenses: `all`, `financials`, `risks`, `timeline`,
`assumptions`.

Business, Valuation and Growth / Outlook are **not** top-level lenses — they
exist only as semantic-navigation groups. No custom lenses, no user-defined
taxonomy.

## 4. Lens Filter Rules

| Lens | Inputs | Insights |
|---|---|---|
| All | all `effectiveInputs` | all `analysis.insights` |
| Financials | all `effectiveInputs` | none |
| Risks | none | `category === "risk"` |
| Timeline | none | `category === "timeline"` |
| Assumptions | `forecast` / `guidance` / `target` / `assumption` | `category === "assumption"` |

Historical actual inputs are excluded from Assumptions. No broader financial
ontology was introduced — `AnalyticalInput` *is* the structured analytical
layer, so Financials shows all of them rather than inventing a second
classification to exclude edge metrics.

## 5. Why Financials Uses Effective Inputs

If an analyst corrects:

```text
FY2025 Revenue   $101M → $100M
```

and the Skills compute on `$100M`, then Financials must also show `$100M`.
Displaying the original `$101M` in the current workspace would contradict the
state used for deterministic execution — exactly the inconsistency BUILD-7
exists to prevent.

Financials and semantic navigation therefore use `effectiveInputs`, while
`analysis.inputs` remains immutable for provenance, reset, and the
*Original AI interpretation* display.

## 6. Why Narrative Insights Remain Original

`ReportInsight` objects continue to come from `analysis.insights`. A numeric
correction does **not** rewrite `insight.label`, `insight.summary`, or
`insight.sourceText`.

Reasons: no new model call is made; automatic narrative rewriting would
fabricate content; narrative correction is not part of BUILD-8.

> Corrections affect the current analytical inputs; narrative insights remain
> source-derived AI interpretations.

## 7. Lens Membership vs Navigation Group

Lens membership answers *"what type of analytical content should be visible?"*
Navigation grouping answers *"where is this item most useful to find
semantically?"*

A FY2026 Revenue forecast is visible in the **Financials lens** (it is an
`AnalyticalInput`) and in the **Assumptions lens** (it is forward-looking),
while its primary navigation group is **Growth / Outlook**, because temporal
purpose outranks the generic Financials bucket for findability.

> Lens membership and primary navigation grouping solve different user problems.

## 8. Semantic Navigation Groups

```text
Business
Financials
Growth / Outlook
Valuation
Risks
Timeline
Assumptions
```

Only non-empty groups render; there is no empty placeholder taxonomy. Each
visible item has exactly one primary group.

## 9. Deterministic Grouping Rules

Insights map by category: business → Business, risk → Risks, timeline →
Timeline, assumption → Assumptions.

Inputs use priority order:

1. `temporal_type = assumption` → Assumptions
2. `forecast` / `guidance` / `target` → Growth / Outlook
3. Enterprise Value → Valuation
4. everything else → Financials

Valuation detection is an exact, closed metric-family check. No fuzzy matching,
no substring ontology, no source-text parsing, no embeddings, no model call, no
report-specific branching.

## 10. Semantic Navigation Target Model

A discriminated target:

```text
input   → input_id
insight → insight.id
```

Never an array index, display-text match, or fuzzy label lookup. Stable identity
preserves evidence linkage and correction identity across lens changes.

## 11. Insight Cards

A new narrative `InsightCard` displays category, label, summary, and a neutral
`Narrative insight` marker; expanding reveals its `sourceText` evidence.

It deliberately has no `Correct interpretation` control, no `READY` /
`BLOCKED` / `NEEDS_REVIEW` state, and no trust badge. Narrative insights do not
gate deterministic execution, and the card should never imply otherwise.

## 12. Input vs Insight Selection

Selecting an input sets `selectedInputId` and clears `selectedInsightId`;
selecting an insight does the reverse. Only one evidence target is active at
once.

`ResearchLensShell` remains the selection source of truth. `SkillPanel` and
`ConflictResolutionPanel` evidence clicks continue to route through the same
input-selection path, so BUILD-4 lineage is unchanged.

## 13. Evidence Behavior

```text
selected input   → input.source.text
selected insight → insight.sourceText
```

Both flow through the **existing** BUILD-4 `ReportViewer` matcher. No second
matching system, no fuzzy evidence lookup, no new model call.

Live validation confirmed: an FY2025 Revenue navigation selection highlighted
the revenue paragraph; an Enterprise Value selection highlighted the valuation
evidence; a Timeline narrative selection highlighted its product-launch source
sentence.

## 14. Lens-Switch Selection Reset

A lens switch clears only presentation-selection state:

```text
selectedInputId
selectedInsightId
evidenceMatched
correctingInputId
```

It does **not** clear analysis, corrections, `analystResolution`, benchmark, or
Skill results.

A hidden item should not leave unrelated evidence highlighted, but a change of
view must never invalidate analytical state.

## 15. Fresh Analysis Reset

Report switch and a new `Analyze Report` both reset `activeLens` to `all`,
alongside the existing report and analysis reset behavior, so every fresh
analysis starts from the same predictable workspace.

## 16. Corrections Integration

Live Clean behavior:

| | |
|---|---|
| AI interpretation | $101M |
| Analyst correction | $100M |
| Financials lens shows | **$100M**, `CORRECTED BY ANALYST` |
| Expanded provenance | Original AI $101M |
| Evidence | the original $101M report sentence |

Skills showed 21.95% / 62.00% / 18.60% / 6.50x, with Net Debt and EV / EBITDA
unchanged. Lens switching did not clear the correction, navigation still
targeted the same `input_id`, and no network call occurred.

## 17. Skills Remain Independent

`SkillPanel` renders regardless of lens. A lens switch never changes a
`SkillResult`, changes candidate selection, makes a forecast eligible, makes an
input ineligible, or alters historical valuation policy.

Report B demonstrated this directly: forward-looking FY2026 values became easy
to find under Growth / Outlook, while historical Skill eligibility was
completely unaffected.

> Findability is not executability.

## 18. BUILD-6 Resolution Independence

The Analyst Resolution panel is not gated by the active lens. Report C's
conflict stays active under every lens.

Lens switching does not select a basis, clear a selected basis, modify Skill
state, or rerun analysis. Live validation confirmed a basis selection survives
lens switching.

This matters: a material conflict that could disappear because the analyst
clicked Timeline would be a serious safety regression.

## 19. AI-Only Benchmark Independence

Lens switching does not clear, rerun, filter, or modify the benchmark. It
remains the six-task direct-model control, and no `/api/ai-benchmark` call
occurs on any lens or navigation interaction.

## 20. Manual Clean Test — All

All active by default. Semantic Navigation populated dynamically with non-empty
groups including Business, Financials, Valuation, Risks and Timeline.

The right workspace showed analytical input cards plus narrative insight cards.
Skills remained 6 of 6 READY: 23.17%, 61.39%, 18.42%, $95M, 6.44x, 34.95x.

No placeholder text remained.

## 21. Manual Clean Test — Financials

Displayed `AnalyticalInput` cards only; narrative insight cards disappeared.
Navigation contained analytical groups only.

Customer-concentration and recurring-revenue inputs remained visible, because
Financials intentionally shows all `AnalyticalInput` objects rather than
introducing a secondary finance ontology to exclude them.

Skills unchanged. Zero network requests.

## 22. Manual Clean Test — Risks

Displayed only the customer-concentration risk narrative insight. Navigation
showed only the relevant Risks content, and no analytical input cards appeared
in the filtered interpretation content.

Skills unchanged. Zero network requests.

## 23. Manual Clean Test — Timeline

Displayed the planned product-launch narrative insight. Selecting it from
semantic navigation highlighted:

> "Management plans to launch a new enterprise analytics module in Q2 2026."

The existing evidence matcher was reused unchanged. Skills unchanged. Zero
network requests.

## 24. Manual Clean Test — Assumptions

Clean produced no forward-looking or assumption content in this live run, so the
lens displayed an honest empty state.

No automatic fallback to All, and no generated or fabricated content. Skills
unchanged. Zero network requests.

An empty lens is a real answer about this report, not a failure to fill space.

## 25. Manual Clean Test — Navigation Evidence

- FY2025 Revenue nav item → selected the Revenue input, highlighted the correct
  source paragraph.
- Enterprise Value nav item → selected the valuation input, highlighted the
  enterprise-value evidence.
- Timeline narrative item → selected the narrative insight, highlighted its
  `sourceText`.

Input and insight selection remained mutually exclusive throughout. No model or
API request.

## 26. Manual Forecast Test — Navigation

Report B live semantic grouping:

**Financials** contained historical FY2025 Revenue and FY2025 Adjusted EBITDA.

**Growth / Outlook** contained the forward-looking FY2026 Revenue $128M, FY2026
Adjusted EBITDA $24M–$26M, and the longer-term Revenue target of $150M within
two years.

This is the intended temporal-semantic grouping.

## 27. Manual Forecast Test — Financials Lens

The Financials lens showed both historical and forward-looking analytical
inputs, with narrative insights excluded.

This validates the design directly: lens membership is not navigation grouping.

## 28. Manual Forecast Test — Assumptions Lens

Observed content:

```text
FY2026 Revenue            $128M      Guidance   Approximate
FY2026 Adjusted EBITDA    $24M–$26M  Guidance   Range
longer-term Revenue       $150M      Target     Management Defined, Approximate
```

Historical FY2025 actual inputs were excluded. Zero network requests.

## 29. Manual Forecast Test — Evidence

The Growth / Outlook navigation item for FY2026 Adjusted EBITDA selected its
interpretation and highlighted:

> "FY2026 adjusted EBITDA is expected to be between $24 million and $26 million."

No model or API request.

## 30. Manual Forecast Test — Trusted Execution

Lens and navigation did not make forward-looking values valid for historical
Skills. Observed:

```text
Revenue Growth                  BLOCKED
Gross Margin                    BLOCKED
FY2025 Adjusted EBITDA Margin   READY 18.42%
```

Other Skill states remained whatever BUILD-5 independently derived.

> Navigation made future information easier to find without changing whether it
> was eligible for deterministic execution.

## 31. Manual Conflict Test

User-confirmed live results on Report C:

- both Adjusted EBITDA and Reported EBITDA remained visible as distinct
  analytical inputs;
- both remained distinct semantic-navigation targets;
- the Analyst Resolution panel remained visible across lens changes;
- unresolved EBITDA Margin and EV / EBITDA remained `NEEDS_REVIEW`;
- lens switching did not auto-resolve;
- after explicit basis selection, switching lenses preserved the selection;
- Skill values and statuses were unchanged by lens switching itself;
- evidence behavior continued to work;
- zero network requests occurred.

## 32. Zero-Network Behavior

After the initial `Analyze Report` completed, these actions generated zero
`/api/analyze` and zero `/api/ai-benchmark` requests:

```text
lens switching
semantic-navigation clicks
input evidence selection
insight evidence selection
lens switching after correction
lens switching after BUILD-6 resolution
```

No additional Anthropic call.

## 33. Automated Testing

**234 tests passing** — 196 pre-BUILD-8 plus 38 new. No existing test required
modification.

Coverage includes: lens catalog; duplicate prevention and order; All,
Financials, Risks, Timeline and Assumptions filtering; all forward-looking
temporal types; actual exclusion; input and insight no-mutation; corrected
effective-input integration; grouping rules; one primary group per item;
empty-group omission; stable group ordering under reversed source arrays;
lens-specific navigation; Report B semantic shape; Report C conflict
visibility; and correction marker integration.

All tests offline. No API key required.

## 34. Product Lessons

1. Navigation is valuable precisely because it does not change execution
   semantics.
2. Effective corrected inputs should drive the visible analytical workspace.
3. Original narrative insights should not be silently rewritten after numeric
   correction.
4. Lens membership and semantic grouping are different abstractions.
5. Forward-looking financial inputs can be visible in Financials while grouped
   under Growth / Outlook.
6. Findability is not executability.
7. A risk or timeline lens can hide analytical inputs without hiding
   deterministic Skill state.
8. Material conflicts must remain active even when the current lens focuses on
   unrelated content.
9. Lens switches should reset evidence selection but preserve analytical state.
10. Dynamic navigation should omit empty groups rather than present an empty
    taxonomy.
11. Simple deterministic grouping is sufficient for the MVP; no ontology engine
    is required.
12. Narrative evidence can reuse the same conservative source-matching mechanism
    as numerical inputs.
13. Zero-call local navigation keeps interaction instant and cost-free.
14. A corrected input must keep the same navigation identity and evidence
    lineage.

> Navigation filters the current analytical workspace; it does not regenerate
> analysis.

> Findability is not executability.
