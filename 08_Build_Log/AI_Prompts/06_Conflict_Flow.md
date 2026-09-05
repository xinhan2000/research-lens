---
artifact_id: claude_code_prompt_06_conflict_flow
product: Research Lens
version: 0.1
build_step: BUILD-6
---

# Claude Code Prompt — 06 Conflict Flow

You are implementing BUILD-6, the most important interaction in the Research Lens prototype.

## Read first

Read:

- `01_Product_Brief/PRD.md`
- `05_Product_Decisions/Autonomy_Policy.md`
- `05_Product_Decisions/Deterministic_Skill_Spec.md`
- `03_Sample_Data/Report_C_Conflict.md`
- `03_Sample_Data/Ground_Truth.jsonl`
- `04_Eval/Failure_Taxonomy.md`

Inspect the existing skill engine first.

## Objective

Implement Report C's material-conflict workflow.

The product must demonstrate:

```text
Adjusted EBITDA = $18.6M
Reported EBITDA = $14.2M
          ↓
EV / EBITDA
NEEDS_REVIEW
          ↓
No numerical result
          ↓
Analyst selects intended basis
          ↓
READY
          ↓
Deterministic calculation
```

## Critical safety requirement

Before user selection, the application must not:

- choose the first EBITDA;
- choose adjusted EBITDA by default;
- choose the higher/lower value;
- calculate both and present one as primary;
- ask Claude to decide;
- show a stale EV/EBITDA result.

This requirement must be enforced in application logic, not only in the Claude prompt.

## Candidate UI

For a `NEEDS_REVIEW` EV / EBITDA skill card, show something like:

```text
Multiple EBITDA definitions found

Adjusted EBITDA
$18.6M
FY2025
[Use Adjusted]

Reported EBITDA
$14.2M
FY2025
[Use Reported]
```

Each candidate should provide access to its evidence.

Do not preselect either option.

## User resolution state

Store the user's selection in current React/session state only.

After selection:

- mark selected candidate as the resolved input for this skill context;
- preserve the other candidate and evidence;
- re-run the deterministic skill;
- display result with explicit basis.

Expected values from ground truth:

```text
Adjusted:
650 / 18.6 ≈ 34.95x

Reported:
650 / 14.2 ≈ 45.77x
```

## Product language

Use:

- `NEEDS REVIEW` for the skill state;
- `Needs Review` in polished UI if desired.

Make the reason explicit:

> Multiple valid FY2025 EBITDA definitions were found.

## Relationship to the BUILD-5.5 AI-only benchmark

If a six-item AI-only benchmark is already on screen from BUILD-5.5:

- user basis selection affects **ONLY** the Deterministic Skill path;
- every benchmark item remains `UNVERIFIED` and unchanged;
- do not rewrite any benchmark item after user resolution;
- do not feed benchmark output into resolution, or treat the benchmark's
  EV / EBITDA or EBITDA Margin answer as the resolution;
- do not use the benchmark's choice as the default basis;
- do not automatically rerun the benchmark when the user selects Adjusted or
  Reported;
- the other benchmark items are likewise untouched.

The benchmark is the raw pre-resolution control. The contrast is intentional:

```text
AI-only raw answer   vs   user-resolved deterministic execution
```

Leaving the earlier benchmark untouched is what makes that contrast legible.

## Tests

Add/extend tests to verify:

1. unresolved conflict → `NEEDS_REVIEW`;
2. unresolved conflict → no `value`;
3. choosing adjusted → 34.95x approximately;
4. choosing reported → 45.77x approximately;
5. no default candidate exists.

## Acceptance criteria

This step is not complete unless Report C reliably demonstrates the entire state transition.

Also verify Report A remains unaffected.

## At completion

Report:

- how conflict candidates are represented;
- how user resolution is stored;
- exact safety check preventing pre-resolution calculation;
- tests and results;
- any manual change required because earlier generated code selected a candidate automatically.
