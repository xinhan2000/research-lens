---
artifact_id: claude_code_prompt_03_claude_integration
product: Research Lens
version: 0.1
build_step: BUILD-3
---

# Claude Code Prompt — 03 Claude Integration

You are implementing BUILD-3 of the Research Lens prototype.

## Read first

Read:

- `01_Product_Brief/PRD.md`
- `05_Product_Decisions/Semantic_Input_Schema.md`
- `05_Product_Decisions/Autonomy_Policy.md`
- `04_Eval/Failure_Taxonomy.md`
- `08_Build_Log/Prototype_Build_Plan.md`

Inspect BUILD-1 and BUILD-2 code before changing anything.

## Objective

Replace the temporary fixture path with real Anthropic Claude inference while retaining fixture code only where useful for development/tests.

Implement:

- BYOK UI;
- one server-side analyze route;
- one Anthropic call;
- structured response parsing/validation;
- safe error handling.

Do not build a provider abstraction.

## Dependencies

Use the official Anthropic TypeScript SDK.

Use the existing Zod validation from BUILD-2.

Use one model constant/configuration point. Do not build multi-model routing.

Choose a currently supported Anthropic Claude model appropriate for this demo and keep the model name easy to change in one location.

## BYOK behavior

The browser should:

1. allow user to enter an Anthropic API key;
2. store it only in `sessionStorage`;
3. show only configured/not-configured state afterward;
4. allow clearing/replacing it.

The key must not be:

- committed;
- logged;
- placed in a URL;
- placed in localStorage;
- persisted server-side.

For each Analyze request, send the key to the Next.js server route in the request body or a dedicated request header.

Do not echo the key in responses.

## Analyze API

Create one route, for example:

```text
POST /api/analyze
```

Input:

```text
apiKey
documentId
reportText
```

Output:

validated `AnalysisResponse`.

The API route should return safe user-facing errors for:

- missing key;
- invalid key/auth failure;
- upstream model failure;
- malformed structured response.

Do not return stack traces to the browser.

## Interpretation prompt

The Claude prompt must instruct the model to:

1. identify consequential analytical inputs;
2. normalize metric names;
3. preserve units/currency;
4. resolve period when evidence supports it;
5. distinguish:
   - actual
   - forecast
   - guidance
   - target
   - assumption
6. distinguish important basis:
   - reported
   - adjusted
   - GAAP/non-GAAP where applicable
7. preserve:
   - exact
   - approximate
   - range
   - qualitative
8. provide exact source evidence text;
9. identify material competing definitions;
10. use `ASK` rather than silently resolving material ambiguity;
11. use `ABSTAIN` rather than inventing unsupported numerical inputs;
12. produce the exact structured response expected by the app.

Critical instruction:

> Do not resolve material ambiguity merely to complete the output.

Do not ask Claude to calculate valuation ratios.

## Report insights

Also request a small number of source-linked narrative insights for:

- business
- risk
- timeline
- assumption

Only include insights actually supported by the report.

Keep output compact to reduce API cost.

## State behavior

On `Analyze Report`:

- show a simple processing state;
- call API;
- validate response;
- place validated response into application state;
- render interpretations.

If validation fails:

> Unable to interpret the model response safely. Retry analysis.

Do not partially consume malformed output.

## Out of scope

Do not add:

- retries with multiple models;
- queue;
- database;
- streaming architecture;
- LangChain;
- agent framework;
- skill calculations;
- conflict-resolution UI beyond displaying states.

## Acceptance criteria

1. With a valid key, Report A can be analyzed live.
2. Response passes Zod validation before UI use.
3. Missing key is handled clearly.
4. Invalid key does not crash app.
5. Key is not logged or persisted.
6. No calculations are delegated to Claude.
7. Report B semantic qualifiers can be represented by the returned schema.
8. Report C can return two distinct EBITDA interpretations rather than silently collapsing them.

## At completion

Report:

- files changed;
- API flow;
- model/config chosen;
- exact prompt location;
- security precautions;
- commands/checks run;
- any malformed-output issue encountered.
