---
artifact_id: claude_code_prompt_02_interpretation_schema
product: Research Lens
version: 0.1
build_step: BUILD-2
---

# Claude Code Prompt — 02 Interpretation Schema

You are implementing BUILD-2 of the Research Lens prototype.

## Read first

Read:

- `01_Product_Brief/PRD.md`
- `05_Product_Decisions/Semantic_Input_Schema.md`
- `05_Product_Decisions/Autonomy_Policy.md`
- `08_Build_Log/Prototype_Build_Plan.md`

Inspect the current implementation from BUILD-1 before changing code.

## Objective

Implement the typed contract between Claude output and the application.

Do not call Claude yet.

The application should be able to consume a fixture analysis response, validate it, and render basic interpretation data.

## Canonical analytical type

Implement `AnalyticalInput` based on `Semantic_Input_Schema.md`.

Minimum fields:

```text
input_id
metric
value
unit
currency
period
temporal_type
basis
precision
source
evidence_type
conflict_state
trust_state
materiality
resolved
```

Support nullable/range values as defined by the spec.

## Validation

Use `zod` unless the repository already has an equally simple validation solution.

Create a schema that rejects structurally unsafe responses.

Do not silently coerce malformed values into valid analytical inputs.

## Analysis response

Create one small top-level response contract such as:

```ts
type AnalysisResponse = {
  inputs: AnalyticalInput[];
  insights: ReportInsight[];
};
```

The exact naming can vary slightly if needed.

## Small narrative type

For non-financial navigation only, add:

```ts
type ReportInsight = {
  id: string;
  category: "business" | "risk" | "timeline" | "assumption";
  label: string;
  summary: string;
  sourceText: string;
};
```

This is an implementation helper.

Do not merge narrative insights into `AnalyticalInput`.

## Fixture

Create a small local fixture for Report A that exercises:

- Revenue FY2024
- Revenue FY2025
- Gross Profit FY2025
- Adjusted EBITDA FY2025
- Cash
- Total Debt
- Enterprise Value
- at least one risk insight
- one timeline insight

The fixture is temporary development data, not ground truth used during live inference.

## UI

Update the right panel enough to show:

- interpreted metric;
- value;
- period;
- basis;
- trust state.

No skill calculations yet.

Selecting an interpretation may simply set active state. Evidence highlighting comes later.

## Out of scope

Do not add:

- Anthropic SDK;
- API call;
- deterministic skills;
- conflict-resolution UI;
- correction UI;
- eval harness.

## Acceptance criteria

1. Valid fixture passes schema validation.
2. Deliberately invalid fixture fails validation.
3. TypeScript passes.
4. Application can render validated interpretation objects.
5. `AnalyticalInput` remains aligned with the product schema.
6. No duplicated financial-business logic is embedded in UI components.

## At completion

Report:

- types/schemas added;
- fixture added;
- validation behavior;
- commands/checks run;
- any mismatch found between spec and implementation.
