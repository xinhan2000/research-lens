---
artifact_id: build_10_public_deployment_log
product: Research Lens
build_step: BUILD-10
status: completed
date: 2026-09-05
---

# BUILD-10 — Public Fly.io Deployment

**Status:** COMPLETE
**Public validation:** PASS
**URL:** `https://research-lens-xh.fly.dev`

## 1. Goal

Turn the locally validated Research Lens prototype into a public, no-login
interview application **without relaxing any of the trust boundaries the product
is built on**.

Achieved:

- public HTTPS application, no authentication;
- bring-your-own-key Anthropic credential, session-scoped in the browser;
- no persistent server-side model secret;
- no database, no queue, no background worker, no server-side result store;
- deterministic Skill path unchanged, apart from one narrowly approved conflict
  recovery robustness fix (§12);
- production container image excludes Ground Truth and every evaluation
  artifact.

This is an interview prototype deployed publicly. It is not production-grade
SaaS, and nothing in this log should be read as an availability or quality
guarantee.

## 2. Deployment Architecture

```text
Browser
  ↓  API key entered manually, held in sessionStorage
  ↓  POST /api/analyze  (key in request body, on explicit user action)
Fly-hosted Next.js route
  ↓  per-request Anthropic client, discarded when the handler returns
Anthropic
  ↓  structured response
parseAnalysisResponse (Zod contract)
  ↓  validated AnalyticalInput[]
Deterministic Skills
  ↓
inspectable result with evidence lineage
```

Packaging and hosting:

| Property | Value |
|---|---|
| Framework output | Next.js `output: "standalone"` |
| Base image | `node:20-alpine` |
| Build | multi-stage Docker: `deps` → `builder` → `runner` |
| Runtime user | `nextjs`, uid 1001, non-root |
| Bind | `HOSTNAME=0.0.0.0`, `PORT=3000` |
| Host | Fly.io, region `sjc` |
| Machine | `shared-cpu-1x`, 512 MB |
| Machines running | 2, retained through the interview (§7) |

No database. No queue. No worker. No cache. No persistent model credential. No
server-side storage of analyses.

## 3. BYOK Security Boundary

The key handling is deliberately narrow, and it is worth stating precisely
rather than flatteringly.

The API key:

- is entered manually by the user in the browser UI;
- is stored in **`sessionStorage` only** — never `localStorage`, never a cookie;
- is sent in the **POST request body** to `/api/analyze` or `/api/ai-benchmark`
  when the user explicitly invokes that operation — never in a query string,
  never in a URL;
- is used to construct a **per-request** Anthropic client, which is discarded
  when the handler returns;
- is **not** persisted by the application server;
- is **not** stored in a database;
- is **not** configured as a Fly secret;
- is **not** returned in any response;
- is **not** intentionally logged — both routes log only a document id and Zod
  issue paths, with explicit comments that the body is never echoed because it
  carries the key;
- does **not** survive tab or session closure.

> It would be inaccurate to say the key never leaves the browser. It necessarily
> travels in the request body to the server route, which then uses it to call
> Anthropic. The correct statement is narrower and still meaningful:
>
> **The application server has no persistent model credential. The user's BYOK
> key is session-scoped in the browser and supplied per request, rather than
> owned or persisted by the service.**

Evidence:

| Check | Result |
|---|---|
| Fly secrets before public validation | 0 |
| Fly secrets after public validation | 0 |
| `ANTHROPIC_API_KEY` in container environment | absent |
| Credential-shaped strings in bounded runtime logs | 0 matches |
| Request-body dumps in logs | 0 matches |

No key value, and no credential-like sample, appears anywhere in this log.

## 4. Production Artifact / Ground-Truth Boundary

This was the first genuine finding of BUILD-10, and it changed how the image is
built.

`lib/reports.ts` loads the sample Markdown with a path Next's file tracer cannot
resolve statically:

```ts
readFileSync(join(process.cwd(), "03_Sample_Data", entry.fileName), "utf8")
```

The tracer therefore conservatively marked the **entire** `03_Sample_Data`
directory as required. A naive `.next/standalone` output physically contained
`Ground_Truth.jsonl`, all four PDFs, `Sample_Report_Spec.md`, and a stray
`.DS_Store` — despite no product code importing any of them.

That surfaced a distinction worth keeping:

> "not imported by runtime code" is **weaker** than "not physically present in
> the deployed production artifact."

The host standalone output was therefore **not accepted** as proof of isolation.
The boundary is enforced in the Docker build context (`.dockerignore`) and by
copying the four report files explicitly, file by file, rather than by directory.

Verified against the **actual final image** by executing `find` and `test` inside
it as the runtime user — not inferred from source imports or from
`.dockerignore`:

| Item | Result |
|---|---|
| `Ground_Truth.jsonl` anywhere in `/` | **ABSENT** (0 hits) |
| `/app/eval` | **ABSENT** (0 `eval` directories under `/app`) |
| `eval/results` | **ABSENT** |
| `*.jsonl` under `/app` | 0 |
| PDFs under `/app` | 0 |
| `Sample_Report_Spec.md` | **ABSENT** |
| `01_Product_Brief`, `04_Eval`, `05_Product_Decisions`, `08_Build_Log` | **ABSENT** |
| `.env*` under `/app` | 0 |
| `.DS_Store` under `/app` | 0 |
| Four sample report `.md` files | **PRESENT** |
| `.next/static` | **PRESENT** |
| `server.js` | **PRESENT** |
| Runtime user | `nextjs` uid 1001, non-root |

`/app/03_Sample_Data` contains exactly the four Markdown reports and nothing
else.

> **Ground Truth is not merely unreachable from the inference path; it does not
> enter the production container image.**

## 5. Packaging

- `next.config.mjs` — `output: "standalone"`, the only configuration added.
- `Dockerfile` — three stages. `deps` runs `npm ci`; `builder` runs
  `npm run build` (which prerenders `/` and therefore needs the four report
  files); `runner` copies only `.next/standalone`, `.next/static`, and the four
  reports, then drops to a non-root user.
- `.dockerignore` — excludes `.git`, `node_modules`, `.next`, `eval`, the four
  documentation folders, `Ground_Truth.jsonl`, `03_Sample_Data/PDF`,
  `Sample_Report_Spec.md`, `.env*`, logs and `.DS_Store`. The four
  `Report_*.md` files are deliberately **not** excluded.
- `app/api/health/route.ts` — a static `GET` returning `{ status: "ok" }`.

The health endpoint imports nothing, reads no file, depends on no environment
variable, and cannot reach Anthropic. A health check that does real work
eventually becomes one that costs money or fails for the wrong reason.

There is no `public/` directory in this project, so none is copied.

## 6. Fly Configuration

| Setting | Value |
|---|---|
| `app` | `research-lens-xh` |
| Organization | `personal` |
| `primary_region` | `sjc` |
| `internal_port` | 3000 |
| `force_https` | true |
| `auto_start_machines` | true |
| `auto_stop_machines` | `"off"` |
| VM | `shared-cpu-1x`, 512 MB |
| Health check | `GET /api/health`, 30s interval, 5s timeout, 10s grace |
| Fly secrets | **0** |

Current Machines: `784447da0956d8`, `896429a65d03e8` — both app version **2**,
both `started` in `sjc`, both health checks passing, `autostop: false`.

`min_machines_running` is deliberately absent, since auto-stop is disabled.

## 7. Two-Machine Operational Decision

The first deployment created **two** Machines rather than the single warm Machine
originally planned. Fly said so explicitly:

> *Creating a second machine for high availability and zero downtime
> deployments. To disable this, set `min_machines_running = 0` in your fly.toml.*

Decision: **leave both running through the interview.**

Reasoning: the extra cost is modest at prototype scale; redundancy removes a
single point of failure on the day; and changing topology immediately before a
live exercise carries more risk than the saving is worth. Both Machines run the
identical image and both pass health checks, so there is no correctness or
security difference.

This is an operational choice, not a product requirement, and it is **not** a
validated high-availability configuration — no failover test, no load test, no
SLA. Scaling to one Machine after the interview is deferred (§17).

## 8. Local Packaging Validation

Final locally built image, validated before deployment:

| Property | Value |
|---|---|
| Tag | `research-lens:build10-4c` |
| Image id | `sha256:731e55ac1473954e08bc3ef6ec8e3e1b888f0986109cdcaaeeeeba76da875624` |
| Size | 196 MB (`196335316` bytes) |
| `/app` | ~65 MB |
| `/app/node_modules` | ~62 MB, 18 traced packages (no `vitest`, no `tsx`) |

Local container smoke, all with zero Anthropic calls:

```text
GET  /                      200   real app content (Research Lens, Northstar)
GET  /api/health            200   {"status":"ok"}
POST /api/analyze      {}   400   missing_key
POST /api/ai-benchmark {}   400   missing_key
static JS                   200   3,346 bytes
static CSS                  200   16,815 bytes   (contains app styles)
runtime process             nextjs, non-root
```

The CSS check matters more than it looks: forgetting `.next/static` produces a
page that returns 200 and is unusable. Verifying the stylesheet content, not just
the status code, is what catches that.

Local regression at close-out:

- **378 tests, 15 files** — all passing
- `npm run typecheck` — exit 0
- `npm run build` — exit 0, routes `/`, `/api/analyze`, `/api/ai-benchmark`,
  `/api/health`
- offline golden smoke — Reports A/B/C/D **PASS**, hard safety gates **PASS**,
  release **PASS**, exit 0

## 9. Public Deployment Chronology

**Initial deployment — version 1**

| Field | Value |
|---|---|
| Deployment id | `deployment-01M1T23BTMT254BEPZF41HXQRX` |
| Remote digest | `sha256:cb2282f150467f1f9d5a75a3d06c3b03aa0ec2df513fdbb60307ae479c616524` |

Public non-AI validation: root 200 with real report content; `/api/health` 200;
static JS and CSS 200; both model routes 400 `missing_key` without a caller key;
Fly secrets 0; public Ground Truth and eval paths not served (`/Ground_Truth.jsonl`,
`/03_Sample_Data/Ground_Truth.jsonl` → 404; `/eval/`, `/eval/results/` → 308
trailing-slash normalization resolving to 404).

Transient health-check failures appeared during machine boot and resolved to
passing within ~4 seconds on each Machine. Those are startup timing, not runtime
failures.

**Final deployment — version 2** (after the BUILD-10.4b fix)

| Field | Value |
|---|---|
| Deployment id | `deployment-01M1T7B76QSRK4VRD3Q6HKER8Z` |
| Remote image | `registry.fly.io/research-lens-xh:deployment-01M1T7B76QSRK4VRD3Q6HKER8Z` |
| Remote digest | `sha256:e400e21fe9aea586828a5bcc2aefd2722d9e8ec1954eed3de36f6d6a77a97e73` |
| Remote image size | 58 MB |
| Strategy | rolling; both Machine IDs retained |

Bundle evidence that the updated code was actually live rather than cached:

```text
version 1 page chunk:  page-19bedd53511fccf7.js
version 2 page chunk:  page-49f954be5f10b290.js   (contains the GAAP display path)
```

This is evidence of code freshness only. It is not a security mechanism.

## 10. Public BYOK Validation — Reports A and D

Authorized public trusted-path checks performed through the deployed UI.

**Report A — clean.** All six deterministic Skills READY:

| Skill | Result |
|---|---|
| Revenue Growth | 23.17% |
| Gross Margin | 61.39% |
| EBITDA Margin | 18.42% |
| Net Debt | $95M |
| EV / Revenue | 6.44x |
| EV / EBITDA | 34.95x |

No unexpected review or blocking state.

**Report D — adversarial.** Economic quantities normalized correctly from the
thousand-scale table: FY2025 Revenue $101M, Q4 Revenue $29M, FY2025 Adjusted
EBITDA $18.6M, Q4 Adjusted EBITDA $5.4M, Debt $125M, Cash $30M.

| Skill | State |
|---|---|
| Revenue Growth | BLOCKED |
| Gross Margin | BLOCKED |
| EBITDA Margin | NEEDS_REVIEW |
| Net Debt | READY, $95M |
| EV / Revenue | BLOCKED |
| EV / EBITDA | BLOCKED |

The "roughly $25M EBITDA next year" statement was classified
`temporal_type = target`, `basis = management_defined`,
`precision = approximate`, `trust_state = auto`.

`AUTO` here means **interpretation trust only** — the reading of the source is
trusted. It does not make the target calculation-ready, and the Skills above
correctly refused it. The qualitative margin language produced no numeric input,
and Q4 values stayed separate from FY2025.

## 11. Report C Failure Discovery

The first public Report C run preserved every financial fact: Revenue $101M,
Adjusted EBITDA $18.6M, comparator EBITDA $14.2M, Enterprise Value $650M. Both
EBITDA definitions stayed distinct, both required review, `EV / EBITDA` held at
`NEEDS_REVIEW` with no numeric result, and no basis was silently selected.

But the Analyst Resolution panel was **absent**, so the conflict could not be
resolved.

Inspecting the actual `/api/analyze` response showed why:

| Input | Value | Basis emitted |
|---|---|---|
| Adjusted EBITDA | $18.6M | `adjusted` |
| Comparator EBITDA | $14.2M | **`gaap`** |

The source says *"The company's reported EBITDA after restructuring and
stock-based compensation was $14.2 million"* — it describes the figure as
**reported** and never identifies it as GAAP. The model made a basis
classification error.

`findResolvableBasisConflict()` required exactly one `adjusted` **and** one
`reported`:

```text
adjusted.length   = 1
reported.length   = 0
candidates.length = 2
→ zero qualifying groups
→ basisConflict = null
→ {skills && basisConflict} false
→ resolution panel not rendered
```

Classification: **FAIL-SAFE BUT UNRECOVERABLE** — explicitly *not* unsafe
auto-execution.

Nothing wrong was calculated, nothing was silently resolved, no incorrect number
was shown. The system refused correctly and then offered no way forward. That
distinction matters: the safety property held, and the recovery property did not.

## 12. Two-Layer Report C Fix

Two independent causes, fixed at two independent layers.

**Layer 1 — prompt correctness.** Added, report-agnostically:

> Where the report describes a figure as "reported" and states no more specific
> accounting basis for it, use reported. Do not infer gaap from the expenses a
> figure happens to include — a reported measure that is stated after
> restructuring, stock-based compensation, or similar charges is still reported.
> Use gaap only where the source itself identifies the figure as GAAP.

No sample-report name, value, or document-id branching was introduced.

**Layer 2 — recovery robustness.** The detector now accepts exactly two two-way
pairs:

```text
adjusted + reported
adjusted + gaap
```

and nothing else. `unknown`, `not_applicable`, `non_gaap`, `management_defined`,
`pro_forma` and `consensus` all fail closed, as does any three-way group.

Critically, the fix does **not** map GAAP to reported. Candidate objects are
returned unmodified with their original basis values, and a GAAP candidate
displays as **GAAP EBITDA** in both the resolution panel and the Skill lineage —
never as "Reported", never as "Gaap", never unqualified.

Analyst selection still re-enters the unchanged hard Skill gates. A selected
input that violates a universal gate (approximate precision, for example) cannot
become READY merely because the analyst chose it. Broadening what can be
*offered* did not broaden what can be *executed*.

9 regression tests added; suite total **369 → 378**.

**Evidence distinction, stated precisely:**

| Claim | Evidence type |
|---|---|
| Source-faithful `reported` basis on the final run | **Live**, public deployment |
| Normal `adjusted + reported` recovery, no silent choice, correct results | **Live**, public deployment |
| `adjusted + gaap` fallback detection | **Deterministic tests only** |
| GAAP label preservation in panel and lineage | **Deterministic tests only** |
| Unresolved state stays NEEDS_REVIEW under the fallback | **Deterministic tests only** |
| Hard gates still enforced after analyst selection | **Deterministic tests only** |

The GAAP fallback was **not** exercised publicly, because the prompt correction
succeeded and the model returned `reported`. That is a good outcome, but it means
the fallback's live behaviour remains unsampled.

## 13. Final Public Report C Validation

Exactly **one** fresh Report C Analyze action after the version-2 deployment.

Classification: **FULL PASS**

| Field | Observed |
|---|---|
| Adjusted EBITDA | $18.6M, `basis = adjusted` |
| Comparator EBITDA | $14.2M, `basis = reported` |
| EV / EBITDA before choice | `NEEDS_REVIEW`, no numeric result |
| Resolution panel | present, nothing preselected |
| Adjusted selection | EBITDA Margin 18.42% READY; EV / EBITDA **34.95x** READY |
| Adjusted label | `EV / FY2025 Adjusted EBITDA` |
| Reported selection | EBITDA Margin 14.06% READY; EV / EBITDA **45.77x** READY |
| Reported label | `EV / FY2025 Reported EBITDA` |
| Silent basis selection | none |
| Unsafe execution | none |

The two analyst selections are deterministic local product operations and invoke
no model.

After the call: public health `{"status":"ok"}`, both Machines healthy, Fly
secrets still **0**. Bounded log review found no crash, no restart caused by the
call, no unhandled exception, no credential-like value, and no request-body dump.

> The authoritative intended model-call count for this validation is one browser
> Analyze action. The application does not emit model-call telemetry, so that
> count cannot be independently verified from server logs — by design, since the
> routes deliberately log neither request bodies nor upstream calls.

## 14. What BUILD-10 Proves

For this interview deployment, and scoped to the checks actually performed:

- the application is publicly reachable over valid HTTPS with no login;
- static assets serve correctly, so the deployed page is usable and not merely
  returning 200;
- the BYOK path works end to end against the real Anthropic API;
- the server holds no persistent model credential — Fly secrets remained 0
  throughout, and both model routes refuse without a caller-supplied key;
- Ground Truth and every evaluation artifact are absent from the production
  container image, verified against the image itself;
- deterministic Skill calculations remain reproducible after deployment;
- an ambiguous Report C does not silently auto-resolve;
- analyst resolution propagates deterministically to dependent Skills with
  correct labels;
- a recovery-path fragility discovered in production was fixed at both the
  instruction and the deterministic layer without weakening any hard gate;
- Reports A, C and D behaved as expected in their authorized public checks.

## 15. What BUILD-10 Does Not Prove

- No production SLA claim of any kind.
- No formal high-availability validation. Two Machines is a cost/risk choice,
  not a tested failover configuration.
- No load test, no concurrency test, no multi-user isolation test beyond what
  the stateless architecture implies.
- No browser matrix; no mobile validation.
- No OCR, no PDF ingestion, no multi-document workflow.
- No provider-outage simulation; no rate-limit stress test.
- No statistical claim about model quality — a handful of public trusted-path
  examples is not a measurement.
- The `adjusted + gaap` fallback is validated by deterministic tests, **not**
  publicly sampled.
- Model-call counts are intended, not backend-verified.
- Provider availability remains an external dependency outside our control.
- BYOK key security still depends on the user's browser and session hygiene.

## 16. Operational Recovery

If the public app misbehaves during the interview:

1. `curl https://research-lens-xh.fly.dev/api/health` — expect `{"status":"ok"}`.
2. `flyctl status -a research-lens-xh` — check app and Machine state.
3. Confirm both Machines are `started` with checks passing.
4. `flyctl logs -a research-lens-xh --no-tail` — bounded log inspection.
5. If necessary, redeploy the same committed configuration:
   `flyctl deploy -a research-lens-xh`.

Two Machines provide interview-time redundancy. That is not a substitute for
production incident engineering, and this list is not a runbook.

## 17. Deferred Work

- Expand the golden set toward the ~40-case target.
- Broader unit and scale coverage; unit-label fidelity monitoring.
- Period-normalization harmonization between `lib/skills/resolution.ts` and the
  stronger eval-side normalizer (noted during diagnosis; not the cause of any
  observed failure).
- Broader conflict and malformed-output cases.
- Model-version regression tracking.
- Client-side `AbortController` / request-timeout polish — there is currently no
  cancel path if an upstream call hangs.
- Browser matrix and mobile validation.
- Monitoring and alerting.
- Rate limiting, if the URL is ever published broadly.
- Multi-user and security hardening beyond the current stateless model.
- Post-interview scale-down from two Machines to one, if desired.
- Broader production telemetry.

The AI-only benchmark remains deliberately separate from release gating.

## 18. Interview Takeaway

> **We treated deployment boundaries as part of AI trust: the production image
> does not contain the answer key, the server does not own the user's model
> credential, and the trusted calculation path remains deterministic.**

And on the Report C failure specifically:

> **The failure was not that the system calculated the wrong answer. It refused
> safely, but one stochastic enum changed whether the analyst could recover. We
> fixed the semantic instruction and the deterministic recovery boundary
> separately.**

The second point is the more interesting one. A system that only ever fails
closed looks safe in a test suite and can still be unusable in practice. The
distinction between *fail-safe* and *fail-safe but unrecoverable* is not
academic — it is the difference between a product that refuses and a product
that refuses and then helps.

## 19. Final Status

| Field | Value |
|---|---|
| BUILD-10 | **COMPLETE** |
| Public URL | `https://research-lens-xh.fly.dev` |
| Final deployment | version 2, `deployment-01M1T7B76QSRK4VRD3Q6HKER8Z` |
| Final trusted-path public validation | **PASS** (Report C, FULL PASS) |
| Final local regression | **PASS** (378 tests, typecheck, build, offline smoke) |
| Production artifact boundary | **PASS** (verified against the image) |
| Fly secrets | **0** |

No claim of production-grade SLA is made or implied.
