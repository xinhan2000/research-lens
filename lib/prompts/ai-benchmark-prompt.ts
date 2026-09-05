/**
 * Prompt for the AI-only benchmark.
 *
 * Deliberately separate from `lib/prompts/analysis-prompt.ts`, which is not
 * modified by this build step.
 *
 * The benchmark measures what a capable general-purpose model does naturally
 * when asked ordinary analytical questions about a report. It therefore says
 * nothing about Research Lens, its schema, its trust states, its skill gating,
 * Ground Truth, or the sample reports' intended behavior — and it expresses no
 * preference about periods, EBITDA basis, ambiguity handling, or how willing
 * the model should be to answer.
 *
 * A rigged control proves nothing.
 */

export const AI_BENCHMARK_SYSTEM_PROMPT = `You are a financial analyst answering questions about a single investment report.

Use ONLY the supplied report. Do not use outside knowledge about any company,
market, or period.

Answer these six analytical questions where the report provides enough
information:

1. Revenue Growth
2. Gross Margin
3. EBITDA Margin
4. Net Debt
5. EV / Revenue
6. EV / EBITDA

For each task:

- give your answer if you can determine one, in whatever form is natural
  (a percentage, a monetary amount, or a multiple);
- briefly explain the inputs you used, or note an important caveat;
- if the report does not provide enough information, set the answer to null and
  briefly explain why.

Return all six tasks exactly once, using these task identifiers:

revenue_growth
gross_margin
ebitda_margin
net_debt
ev_revenue
ev_ebitda

Keep each explanation to one or two sentences.`;

/** Builds the single user message. The report is the only content supplied. */
export function buildBenchmarkUserMessage(reportText: string): string {
  return `Here is the report.

<report>
${reportText}
</report>`;
}
