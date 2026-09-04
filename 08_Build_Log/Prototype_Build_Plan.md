---
artifact_id: prototype_build_plan
product: Research Lens
version: 0.1
status: approved_baseline
last_updated: 2026-09-04
depends_on:
  - PRD.md
  - Semantic_Input_Schema.md
  - Deterministic_Skill_Spec.md
  - Autonomy_Policy.md
  - Ground_Truth.jsonl
used_by:
  - 01_Scaffold.md
  - 02_Interpretation_Schema.md
  - 03_Claude_Integration.md
  - 04_Evidence_UI.md
  - 05_Skill_Engine.md
  - 06_Conflict_Flow.md
  - 07_Correction_Flow.md
  - 08_Lenses_and_Navigation.md
  - 09_Eval_Harness.md
  - 10_Fly_Deployment.md
---

# Prototype Build Plan

## 1. Goal

Build the smallest working Research Lens prototype that can demonstrate:

> Evidence → AI Interpretation → Trust Decision → Deterministic Skill

The prototype is for an interview demo, not a production platform.

Primary implementation priorities:

1. correct trust behavior;
2. clear evidence lineage;
3. reliable live demo;
4. simple architecture;
5. easy local development and Fly.io deployment.

## 2. Locked Technical Decisions

- Framework: Next.js + TypeScript
- Router: Next.js App Router
- Runtime AI provider: Anthropic Claude API
- Inference: real inference
- API model abstraction: none
- API key model: bring your own key (BYOK)
- State: browser/server session only
- Database: none
- Authentication: none
- Input in MVP: four built-in Markdown sample reports
- PDF upload: future enhancement
- Deterministic Skills: plain TypeScript functions
- Deployment: Docker → Fly.io
- Source control: private GitHub repository
- External research: none
- Vector database / RAG: none
- Agent framework: none unless a concrete blocker appears

## 3. Repository Assumption

Claude Code should run from the Research Lens project root.

The project root is expected to contain the existing product artifacts:

```text
01_Product_Brief/
03_Sample_Data/
04_Eval/
05_Product_Decisions/
08_Build_Log/
```

Application source can be created alongside those folders:

```text
app/
components/
lib/
types/
eval/
public/
```

Do not move or rename the existing product artifacts unless explicitly requested.

## 4. Minimal Dependency Policy

Prefer built-in Next.js/React capabilities.

Recommended additions only when needed:

- `@anthropic-ai/sdk` — Claude API
- `zod` — structured response validation
- `react-markdown` — sample report rendering
- `vitest` — deterministic skill/eval tests

Avoid adding:

- LangChain
- agent SDKs
- Redux
- database clients
- ORM
- Redis
- queue libraries
- authentication libraries
- component frameworks unless clearly necessary

Use simple React state unless complexity proves otherwise.

## 5. BYOK Security Boundary

The demo should use this simple key flow:

```text
Browser sessionStorage
      ↓
Analyze request
      ↓
Next.js server route
      ↓
Anthropic API
```

Rules:

- never commit API keys;
- never put keys in source code;
- never put keys in URLs;
- never print keys to browser/server logs;
- do not persist keys in a database;
- do not store keys in localStorage;
- clear browser-session key when requested;
- display only configured/not-configured state after entry.

The prototype should say:

> Your API key is used only for the current browser session and is not stored by Research Lens.

## 6. Implementation Boundary

### Must genuinely work

- four built-in sample reports;
- Claude API call;
- structured AI interpretation;
- semantic qualifiers;
- source evidence;
- conflict state;
- AUTO / ASK / ABSTAIN;
- Deterministic Skill gating;
- READY / NEEDS_REVIEW / BLOCKED;
- deterministic calculation;
- user resolution of Report C conflict;
- user correction;
- downstream invalidation/recalculation;
- local execution;
- Fly.io deployment.

### May be simplified

- visual styling;
- semantic navigation sophistication;
- loading progress accuracy;
- report highlighting precision;
- responsive/mobile behavior;
- correction-history persistence.

### Do not build

- PDF ingestion;
- OCR;
- login;
- database;
- multi-user support;
- external market data;
- multi-document search;
- full financial model;
- investment recommendation;
- production observability platform.

## 7. Small Implementation Extension for Non-Financial Content

`AnalyticalInput` remains the canonical schema for consequential analytical inputs.

For UI navigation only, the prototype may add a small implementation type:

```ts
type ReportInsight = {
  id: string;
  category: "business" | "risk" | "timeline" | "assumption";
  label: string;
  summary: string;
  sourceText: string;
};
```

This exists only to support Risks, Timeline, Assumptions, and Business navigation.

Do not overload `AnalyticalInput` with narrative content.

## 8. Build Sequence

### BUILD-1 — Scaffold

Create the application shell and load the four reports locally.

Acceptance gate:

- `npm run dev` works;
- all four sample reports can be selected and read;
- no Claude/API code yet.

### BUILD-2 — Interpretation Schema

Implement TypeScript/Zod contracts for:

- `AnalyticalInput`;
- analysis response;
- small `ReportInsight` type.

Acceptance gate:

- fixture response validates;
- invalid response fails safely.

### BUILD-3 — Claude Integration

Implement BYOK and live Anthropic inference.

Acceptance gate:

- valid key can analyze Report A;
- response is validated before entering application state;
- invalid/missing keys fail clearly.

### BUILD-4 — Evidence UI

Connect interpretations to source evidence.

Acceptance gate:

- selecting an input visibly identifies its supporting source block;
- evidence text remains visible.

### BUILD-5 — Skill Engine

Implement deterministic validation and calculations.

Acceptance gate:

- Report A produces correct deterministic results;
- math is covered by tests;
- no LLM is used inside skills.

### BUILD-6 — Conflict Flow

Implement the hero Report C behavior.

Acceptance gate:

```text
two EBITDA definitions
→ NEEDS_REVIEW
→ no EV/EBITDA result
→ analyst selects basis
→ READY
→ calculate
```

This is the most important gate in the build.

### BUILD-7 — Correction Flow

Allow user corrections to interpreted fields.

Acceptance gate:

- dependent results become stale/invalid;
- skills revalidate;
- only READY skills recalculate.

### BUILD-8 — Lenses and Navigation

Add lightweight:

- All
- Financials
- Risks
- Timeline
- Assumptions

Acceptance gate:

- filters derive from existing analysis result;
- no extra Claude call required.

### BUILD-9 — Eval Harness

Create a local repeatable eval command.

Acceptance gate:

- can run built-in sample reports;
- compares system behavior with `Ground_Truth.jsonl`;
- reports semantic/gating failures;
- does not expose API key.

### BUILD-10 — Fly Deployment

Add Docker/Fly configuration.

Acceptance gate:

- local Docker build succeeds;
- Fly.io deployment works;
- no login;
- BYOK works on deployed site.

## 9. Claude Code Working Rules

Every implementation prompt should follow this pattern:

1. Read only the relevant product artifacts first.
2. Inspect the current repository before changing code.
3. State the minimal implementation approach.
4. Make the smallest coherent change.
5. Do not refactor unrelated code.
6. Do not add infrastructure without a demonstrated need.
7. Run relevant checks after changes.
8. Summarize:
   - files changed;
   - behavior added;
   - tests/checks run;
   - assumptions;
   - remaining issues.

If Claude Code proposes a larger architecture, prefer the simpler implementation unless the current requirements cannot be met.

## 10. Human Review Checkpoints

Manually inspect after:

### BUILD-3
Confirm Claude output is truly structured and source-linked.

### BUILD-5
Confirm deterministic skills cannot resolve semantic ambiguity.

### BUILD-6
Confirm Report C never displays a valuation result before basis selection.

### BUILD-7
Confirm correction invalidates stale downstream results.

### BUILD-9
Review failures rather than only overall scores.

### BUILD-10
Test the public URL from a clean browser session.

## 11. Build Log

After each Claude Code step, append a short entry under:

```text
08_Build_Log/Decision_Log/
```

Recommended fields:

```text
Date
Build step
Prompt used
What Claude Code produced
What worked
What was wrong / overbuilt
Manual changes
Product decision learned
```

High-value entries are cases where human product judgment changed the AI-generated implementation.

## 12. Demo-Critical Priority

If time becomes constrained:

```text
1. Report loading
2. Live Claude inference
3. Structured interpretation
4. Evidence
5. Deterministic skills
6. Report C conflict gating
7. Conflict resolution
8. Correction/recalculation
9. Lenses
10. Visual polish
```

Never trade away trust behavior for UI polish.

## 13. Definition of Done

Step 9 build execution is complete when:

- application runs locally;
- four reports load;
- Claude analyzes them live;
- Report A demonstrates safe automation;
- Report B preserves forward-looking semantics;
- Report C blocks unsafe EV/EBITDA until user resolution;
- Report D exposes difficult behavior without silently fabricating precision;
- user corrections propagate correctly;
- deterministic calculations are tested;
- eval harness can be run;
- application deploys to Fly.io.

The prototype does not need production-platform completeness.
