# Research Lens

Research Lens is an evidence-first analytical workspace for investment reports. It reads
report language, turns it into structured analytical inputs that stay linked to the text
they came from, and runs financial calculations only once those inputs are unambiguous
enough to be used safely.

> **AI interprets. Deterministic Skills execute. Evidence connects both.**

The model's job is reading comprehension: working out that a number is FY2025 revenue,
that an EBITDA figure is adjusted rather than reported, that a forecast is a forecast.
The arithmetic is not its job. Formulas run in plain TypeScript, from explicitly declared
inputs, with the same result every time. Every value on screen can be traced back to the
sentence it came from.

Live application: https://research-lens-xh.fly.dev

## What Research Lens Does

Financial reports are full of numbers that look interchangeable and are not. Adjusted and
reported EBITDA for the same year can differ by a third. A forecast and an actual sit in
adjacent paragraphs. A table header three rows up determines whether a figure means
thousands or millions.

Research Lens interprets that language into `AnalyticalInput` objects, each carrying the
qualifiers that make a number mean something: metric, value, unit, currency, period,
temporal type, accounting basis, precision, evidence, conflict state, and a trust state.
It shows what it understood, links each interpretation to its source text, and asks the
analyst to resolve genuine ambiguity rather than resolving it silently.

It does not make investment decisions and does not offer a view. It helps an analyst
inspect what a report actually says and then compute from it — the judgment stays with
the person.

## Why This Architecture

Three concerns are kept deliberately separate.

**Interpretation is probabilistic.** Language models are good at reading a sentence and
working out what it means. They are also stochastic: run the same report twice and a
classification can differ. That is tolerable when the output is a proposal a human can
inspect, and dangerous when it is an input to a calculation nobody re-checks.

**Execution should be reproducible.** `EV / EBITDA` is division. It should produce an
identical result from identical inputs, be readable in a few lines of code, and never
depend on how a prompt was phrased. So the calculations live in ordinary functions with
explicit contracts, not in the model.

**Uncertainty should stay visible.** The failure mode this design exists to prevent is a
deterministic-looking number computed from a misread input — output that carries the
authority of arithmetic and the fragility of a guess. Where the source is genuinely
ambiguous, the system surfaces the ambiguity instead of averaging it away.

## Trust Model

Two independent state machines, and keeping them distinct is the core of the design.

### Interpretation trust — `trust_state`

Set per analytical input. It answers one question: *is this reading of the source
sufficiently supported by the evidence?*

| State | Meaning |
|---|---|
| `auto` | The interpretation is well supported and carries no material unresolved ambiguity about what the source means. |
| `ask` | The evidence supports more than one materially plausible reading; an analyst can settle it. |
| `abstain` | The evidence is insufficient to responsibly state a value at all. |
| `never` | The action is prohibited by product policy. |

**`auto` does not mean "safe to calculate."** It means the reading is trusted. An input
can be a perfectly faithful interpretation and still be unusable by a given calculation —
an approximate figure, a relative period like "next year", a forward-looking target.
Whether a particular Skill may consume it is a different question, answered elsewhere.

### Execution readiness — Skill status

Set per Skill, per run. It answers: *can this specific calculation safely use the inputs
available?*

| State | Meaning |
|---|---|
| `READY` | All required inputs are present, compatible, and evidence-backed. The Skill executes. |
| `NEEDS_REVIEW` | Candidate inputs exist but a material ambiguity remains that an analyst can resolve. No result is produced. |
| `BLOCKED` | A required input is missing, unsupported, or incompatible in a way selection cannot fix. |

Each Skill validates its own contract — period, temporal type, basis, precision,
evidence, conflict state, currency — and refuses independently of what the trust layer
concluded. An `auto` input routinely gets refused by a Skill, and that is the system
working, not a contradiction.

```
trust_state   → is this reading of the source trustworthy?      (per input, global)
Skill status  → may this calculation use these inputs?          (per Skill, specific)
```

## Current Capabilities

- Structured extraction from report text using Claude, validated against a strict Zod
  contract before anything reaches application state.
- Evidence linking: each interpretation carries the source excerpt, matched back to the
  rendered report deterministically. When the excerpt cannot be located unambiguously,
  the interface says so rather than highlighting the nearest-looking passage.
- Semantic qualifiers preserved end to end: period, temporal type (actual, forecast,
  guidance, target, assumption), accounting basis, precision (exact, approximate, range,
  qualitative), unit and currency, conflict state, evidence type, materiality.
- Analytical lenses — All, Financials, Risks, Timeline, Assumptions — that filter the
  current workspace without re-running any analysis.
- Semantic navigation grouped by Business, Financials, Growth / Outlook, Valuation,
  Risks, Timeline and Assumptions, derived from the current lens content.
- Analyst Resolution for competing accounting bases: both candidates stay visible, and
  one explicit choice propagates to every dependent Skill.
- Analyst Correction of interpreted fields, with dependent results recomputed from the
  corrected inputs so a stale number cannot survive an edit.
- An AI-only benchmark that asks the model the same six analytical questions directly,
  shown beside the deterministic results purely for comparison.
- A golden-set evaluation harness that runs offline or against live inference.
- Bring-your-own-key Anthropic credentials.
- Container packaging and public deployment.

The application analyses the Markdown reports included in the repository. There is no
document upload, and no PDF or OCR ingestion path. (The repository does contain PDF
renderings of the sample reports, but they are human-readable reference copies, not an
input format.)

## Deterministic Skills

| Skill | Formula |
|---|---|
| Revenue Growth | `(current revenue − prior revenue) / prior revenue` |
| Gross Margin | `gross profit / revenue` |
| EBITDA Margin | `EBITDA / revenue` |
| Net Debt | `total debt − cash` |
| EV / Revenue | `enterprise value / revenue` |
| EV / EBITDA | `enterprise value / EBITDA` |

Each Skill declares its required inputs explicitly, validates them against its own
contract before executing, normalizes monetary scale arithmetically from the declared
unit, and returns either a result or a reason it refused. Results carry lineage: which
inputs were consumed, in what role, with what evidence.

A Skill never resolves meaning. It cannot decide which EBITDA definition is intended,
whether two periods are close enough, or whether an approximate value will do. Those
questions belong upstream, to the model or to the analyst.

## Example Trust Flow

A report states both an adjusted EBITDA and a reported EBITDA for the same year. The two
differ materially, and either could legitimately be the intended denominator for a
valuation multiple.

The model returns both as separate analytical inputs, each with its own basis, value and
evidence, and flags the conflict. Nothing is merged, and neither is quietly preferred.

```
Report text
  → two EBITDA interpretations, distinct bases
  → material conflict detected
  → EV / EBITDA reports NEEDS_REVIEW, with no number
  → analyst chooses which basis the analysis should use
  → Skill revalidates against that choice
  → EV / EBITDA executes, labelled with the basis actually used
```

The analyst's choice selects among existing interpretations. It does not rewrite the
model's output, does not alter the stored evidence, and does not relax any hard gate — a
selected input that fails a safety check still refuses to execute. Both candidates remain
on screen afterwards, so the decision stays inspectable and reversible.

## Architecture

```
Report Markdown
    ↓
Claude interpretation (single structured call)
    ↓
Validated structured response (Zod contract)
    ↓
Evidence matching against the rendered report
    ↓
Trust state / conflict state
    ↓
Analyst resolution or correction, where needed
    ↓
Deterministic Skills
    ↓
Inspectable result with lineage
```

Built with Next.js (App Router), TypeScript, React, the Anthropic SDK, Zod for the
response contract, Vitest for tests, Docker for packaging, and Fly.io for hosting.

Deliberately absent: no database, no vector store, no retrieval layer, no background
worker or queue, no cache, no persistent server-side model credential, and no
authentication. State lives in the browser session. The server keeps nothing between
requests.

The model is configured in one place (`lib/anthropic-config.ts`) — there is no model
router, no provider abstraction, and no model picker in the interface.

## Bring Your Own Key

Analysis requires an Anthropic API key, which the user supplies through the interface.

The key is held in browser `sessionStorage`, never `localStorage` and never a cookie. It
is sent in the POST body when the user explicitly starts an analysis, and used to build
an Anthropic client for that single request, which is discarded when the request
completes. It is not written to a database, not stored as a server-side secret, not
placed in a URL, not returned in any response, and not logged. It does not survive
closing the tab.

To be precise: the key does travel to the application server, because the server makes
the Anthropic request. It is supplied per request and is not persisted or owned by the
service — **the application server has no model credential of its own.**

`sessionStorage` is per-origin, so a local instance and a hosted one each need the key
entered separately.

## Running Locally

```bash
npm install
npm run dev
```

The development server runs at http://localhost:3000. Open it, set an Anthropic API key
through the interface, choose a sample report, and analyse it.

Other scripts:

```bash
npm test         # Vitest suite
npm run typecheck
npm run build    # production build
npm run start    # serve the production build
```

## Running with Docker

The image is a multi-stage build producing a Next.js standalone server on Node 20 Alpine,
running as a non-root user and listening on port 3000.

```bash
docker build -t research-lens .
docker run --rm -p 3000:3000 research-lens
```

No environment variables are required. Because the application uses bring-your-own-key
credentials, the container holds no Anthropic key and needs none configured. It exposes a
static `GET /api/health` for liveness checks, which performs no model call and touches no
filesystem.

## Evaluation

The evaluation harness lives in `eval/` and runs as a Node CLI, entirely outside the web
application.

```bash
npm run eval                                   # all reports, live inference
npm run eval -- --report report_a_clean        # a single report
npm run eval -- --from-dir <dir>               # re-score saved output, no API key
npm run eval -- --benchmark                    # include the AI-only comparison
```

Two properties shape the design.

**Ground truth is never available during inference.** Expected answers are loaded only
after every model response has been collected and validated. The inference module imports
no dataset loader and no scoring code, so an expected answer cannot reach a prompt even by
accident, and automated tests verify that the separation holds.

**Correctness is scored along separate dimensions**, because a single accuracy number
would hide exactly the failures that matter:

- interpretation correctness — metric, value, unit, currency, period, temporal type,
  basis, precision, evidence;
- trust decision correctness;
- Skill gating correctness;
- deterministic numerical correctness;
- declared behavioural requirements, such as a range not collapsing to a single value;
- analyst conflict-resolution behaviour, replayed end to end;
- safety gates.

Evaluation treats unsafe execution as a blocking failure rather than allowing aggregate
accuracy to hide it. A single unsafe execution — a Skill consuming an unresolved or
unsupported input, a silently resolved conflict, a magnitude error reaching a calculation
— fails the run regardless of how the other metrics look.

The AI-only benchmark is scored separately and can never change the trusted-path result.
It is a control, not an oracle: it shows what a model is willing to answer directly, next
to what the product is willing to trust and execute.

The current sample set is small and deliberately weighted toward difficult cases. It is
useful for regression detection and for reasoning about behaviour. It is not a
statistically meaningful measure of accuracy, and the harness says so in its own output.

## Sample Reports

Four synthetic reports about a fictional company, each built to exercise a different
behaviour:

| Report | Exercises |
|---|---|
| Clean | Straightforward historical facts; the baseline case where everything should compute. |
| Forecast | Actual, forecast and target values side by side, including a range that must not collapse to a point estimate. |
| Conflict | Two materially different EBITDA definitions for the same period, requiring analyst resolution. |
| Failure | Adversarial: a thousand-scale table, a full-year column beside a quarterly one, a footnote-defined basis, an internal target framed as planning rather than guidance, and qualitative language that must not become a number. |

## Project Structure

```
app/                    Next.js App Router — page and API routes
components/             React interface: report viewer, interpretations,
                        skills, navigation, resolution and correction
lib/
  skills/               Deterministic Skill engine, input gate, calculations
  prompts/              Interpretation and benchmark prompts
  corrections/          Analyst correction overlay
  analysis-schema.ts    Zod contract for structured model output
  evidence-match.ts     Deterministic evidence-to-source matching
  navigation.ts         Lenses and semantic grouping
eval/                   Golden-set evaluation harness (Node CLI)
03_Sample_Data/         Sample reports
types/                  Types inferred from the Zod schemas
```

The repository also carries product decision records and a build log documenting how the
trust boundaries were arrived at, kept alongside the code rather than in a separate wiki.

## Current Scope and Limitations

This is a working prototype, not a production system. It does not provide:

- investment recommendations or any buy / sell / hold view;
- autonomous decisions of any kind;
- PDF ingestion, OCR, or document upload;
- multi-document or cross-report analysis;
- external market data or web research;
- full financial modelling;
- user accounts, saved analyses, or persistence between sessions;
- multi-user security controls;
- availability or performance guarantees.

Model interpretation remains probabilistic, and the same report can be read slightly
differently between runs. That is the reason trust decisions and Skill gates are kept
separate: a classification can vary without a calculation becoming unsafe, because the
Skill validates its own inputs regardless of what the interpretation layer concluded.

## Disclaimer

Research Lens is an experimental analytical tool intended for research and software
exploration. It is not investment advice, financial advice, or a substitute for
professional judgment.
