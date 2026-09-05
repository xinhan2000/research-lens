---
artifact_id: claude_code_prompt_05_skill_engine
product: Research Lens
version: 0.1
build_step: BUILD-5
---

# Claude Code Prompt — 05 Skill Engine

You are implementing BUILD-5 of the Research Lens prototype.

## Read first

Read carefully:

- `05_Product_Decisions/Deterministic_Skill_Spec.md`
- `05_Product_Decisions/Autonomy_Policy.md`
- `05_Product_Decisions/Semantic_Input_Schema.md`
- `01_Product_Brief/PRD.md`
- `03_Sample_Data/Ground_Truth.jsonl`

Inspect current code before changes.

## Objective

Implement the deterministic analytical layer.

Critical principle:

> A Deterministic Skill never resolves semantic ambiguity itself.

Claude interprets.

TypeScript validates and calculates.

## Skills to implement

Implement only these MVP skills:

1. Revenue Growth
2. Gross Margin
3. EBITDA Margin
4. Net Debt
5. EV / Revenue
6. EV / EBITDA

Do not add more skills in this step.

## Architecture

Keep it simple.

Each skill should expose a contract similar to:

```ts
type SkillResult = {
  skillId: string;
  status: "READY" | "NEEDS_REVIEW" | "BLOCKED";
  value?: number;
  unit?: string;
  label?: string;
  reason?: string;
  inputIds: string[];
  formula?: string;
};
```

Exact typing may improve on this while staying small.

The skill engine may:

- find candidate structured inputs;
- validate semantic compatibility;
- determine skill state;
- perform deterministic formula.

It may not semantically reinterpret source text.

## Trust rules

A skill must not execute if a required consequential input:

- has `trust_state = ask`;
- has `trust_state = abstain`;
- lacks required evidence;
- has unresolved material conflict;
- has incompatible period/basis/unit;
- is missing.

Use:

- `NEEDS_REVIEW` for user-resolvable ambiguity;
- `BLOCKED` for missing/unsupported input.

## Calculations

Use formulas from the skill specification exactly.

Examples:

```text
Revenue Growth = (Current Revenue - Prior Revenue) / Prior Revenue
Gross Margin = Gross Profit / Revenue
EBITDA Margin = EBITDA / Revenue
Net Debt = Total Debt - Cash
EV / Revenue = Enterprise Value / Revenue
EV / EBITDA = Enterprise Value / EBITDA
```

No LLM calls.

## Output labels

Preserve important semantic meaning.

Good:

```text
EV / FY2025 Adjusted EBITDA
```

Bad:

```text
EV / EBITDA
```

when basis/period matter.

## Tests

Add lightweight unit tests.

Prefer `vitest`.

At minimum test:

### Report A values

Expected approximately:

- Revenue Growth: 23.17%
- Gross Margin: 61.39%
- Adjusted EBITDA Margin: 18.42%
- Net Debt: $95M
- EV / FY2025 Revenue: 6.44x
- EV / FY2025 Adjusted EBITDA: 34.95x

### Blocking behavior

Test that a missing required input results in `BLOCKED`.

Test that an input explicitly marked `ASK` or material conflict does not execute.

## UI

Connect the right panel to the skill engine.

Display skill cards with:

- skill name;
- state;
- result if READY;
- reason if NEEDS_REVIEW/BLOCKED;
- inputs/formula where useful.

Build a clear Deterministic Skills section.

Keep `SkillResult` data and state composable, so a later comparison UI can
place each Skill card beside its AI-only benchmark item without restructuring it.
A self-contained skill card is the goal.

Do not implement conflict resolution yet. That is BUILD-6.

Do not build the comparison endpoint or the comparison button in BUILD-5.

Do not make Skill logic depend on the future benchmark in any way — no optional
benchmark field, no placeholder slot, no conditional branch.

## Out of scope

- AI-only benchmark — that is **BUILD-5.5**;
- conflict-resolution controls — BUILD-6;
- correction flow — BUILD-7.

## Acceptance criteria

1. Report A can produce all supported valid calculations.
2. Deterministic test values match `Ground_Truth.jsonl`.
3. No skill contains model calls.
4. Unsafe inputs do not produce a numerical result.
5. Tests pass.
6. TypeScript/build passes.
7. Each skill card is self-contained, so BUILD-5.5 can compose all six into a
   side-by-side comparison without changing skill logic or state.

## At completion

Report:

- skill files added;
- validation logic;
- tests created;
- test command/results;
- any semantic case that could not be cleanly resolved by the current schema.
