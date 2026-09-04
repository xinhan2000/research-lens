---
artifact_id: claude_code_prompt_01_scaffold
product: Research Lens
version: 0.1
build_step: BUILD-1
---

# Claude Code Prompt — 01 Scaffold

You are implementing BUILD-1 of the Research Lens prototype.

## Read first

Read these project artifacts before changing code:

- `01_Product_Brief/PRD.md`
- `08_Build_Log/Prototype_Build_Plan.md`
- `03_Sample_Data/Report_A_Clean.md`
- `03_Sample_Data/Report_B_Forecast.md`
- `03_Sample_Data/Report_C_Conflict.md`
- `03_Sample_Data/Report_D_Failure.md`

Do not implement later build steps yet.

## Objective

Create the smallest Next.js + TypeScript application shell that:

1. runs locally;
2. presents the Research Lens desktop layout;
3. loads the four built-in sample reports;
4. allows switching between them;
5. renders the selected report clearly.

No Anthropic API integration in this step.

## Technical constraints

Use:

- Next.js App Router;
- TypeScript;
- npm;
- simple React state;
- minimal styling.

If the repository does not already contain a Next.js application, scaffold one in the current project root without moving the existing numbered product-artifact folders.

Prefer the default Next.js styling approach already created by the scaffold. Do not add a component framework.

You may add `react-markdown` if it materially simplifies rendering the Markdown reports.

## Required UI

Create a desktop-oriented shell with:

### Header
- Research Lens
- selected report
- sample report selector
- disabled or placeholder `Analyze Report` action
- placeholder API-key control

### Lens row
Static placeholders for:

- All
- Financials
- Risks
- Timeline
- Assumptions

Do not implement filtering yet.

### Main area

Three regions:

```text
Semantic Navigation | Original Report | Analysis / Skills
```

For this step:

- left panel may show a simple placeholder;
- center panel must render the selected report;
- right panel may show a clear placeholder.

## Sample-data behavior

Load the existing files from `03_Sample_Data/`.

Do not duplicate the report text in component source code.

Use a simple server-side or build-time loader appropriate for Next.js.

## Out of scope

Do not add:

- Anthropic SDK;
- API routes;
- database;
- authentication;
- PDF upload;
- vector database;
- agent framework;
- deterministic skills;
- eval harness;
- Fly.io config.

## Acceptance criteria

Before finishing:

1. `npm install` succeeds.
2. `npm run dev` can launch the app.
3. TypeScript compilation passes.
4. All four reports are selectable.
5. Report D's table remains readable enough for demo use.
6. No secrets or API keys exist in source.
7. Existing product artifacts are not renamed or moved.

## Working style

Inspect the repository first.

Make the smallest coherent changes.

Do not refactor unrelated files.

At the end, report:

- files created/changed;
- exact commands run;
- checks that passed;
- any assumptions;
- anything intentionally deferred to BUILD-2.
