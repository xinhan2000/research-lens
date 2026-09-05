# CLI smoke fixtures — SYNTHETIC, NOT MODEL OUTPUT

These four `*.analysis.json` files are **hand-authored** interpretations written
to exercise the `--from-dir` code path end to end without a network call.

They are **not** the output of any Claude run, they are **not** an eval result,
and they must never be reported as one. Nothing here is evidence about model
quality.

What they are for:

- proving `npm run eval -- --from-dir` loads, re-validates, and scores;
- proving a fully correct interpretation produces `RELEASE STATUS: PASS`;
- giving the CLI a deterministic, offline, zero-cost regression check.

What they are **not** for:

- measuring interpretation accuracy;
- standing in for `Ground_Truth.jsonl`, which remains the only canonical
  expected dataset;
- serving as a baseline for future runs.

Because they were authored from the golden set's own expectations, a passing
smoke run proves the harness *runs* and that a perfect interpretation *passes*.
It does not prove the harness would catch a real model deviation — the
deviation cases are covered by the Vitest suites in `eval/*.test.ts`, which
mutate these same shapes and assert that each mutation is detected.

Real model output belongs in `eval/results/`, which is gitignored.
