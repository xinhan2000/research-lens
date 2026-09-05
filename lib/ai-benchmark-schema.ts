import { z } from "zod";

/**
 * AI-only benchmark contract.
 *
 * Deliberately independent of the trusted analysis contract. This file imports
 * nothing from `analysis-schema.ts`, `types/analytical-input.ts`, or
 * `lib/skills/*`, and a benchmark object carries no skill status, trust state,
 * conflict state, lineage, or materiality.
 *
 * A benchmark item means exactly one thing:
 *
 *   "This is what the direct model said."
 */

/** Canonical benchmark task catalog. Mirrors the six MVP Deterministic Skills. */
export const AI_BENCHMARK_TASK_IDS = [
  "revenue_growth",
  "gross_margin",
  "ebitda_margin",
  "net_debt",
  "ev_revenue",
  "ev_ebitda",
] as const;

export type AiBenchmarkTaskId = (typeof AI_BENCHMARK_TASK_IDS)[number];

/** Human-facing task names. Display only — never used for identity or pairing. */
export const AI_BENCHMARK_TASK_NAMES: Record<AiBenchmarkTaskId, string> = {
  revenue_growth: "Revenue Growth",
  gross_margin: "Gross Margin",
  ebitda_margin: "EBITDA Margin",
  net_debt: "Net Debt",
  ev_revenue: "EV / Revenue",
  ev_ebitda: "EV / EBITDA",
};

export const aiBenchmarkTaskIdSchema = z.enum(AI_BENCHMARK_TASK_IDS);

/**
 * One benchmark answer.
 *
 * `answer` is free text exactly as the model phrased it — "23.2%",
 * "$95 million", "34.9x adjusted; 45.8x reported" — or null where the model
 * gives no result. It is never parsed into a number, and never checked
 * numerically at runtime; that belongs to evaluation, not display.
 */
export const aiBenchmarkItemSchema = z.strictObject({
  task_id: aiBenchmarkTaskIdSchema,
  answer: z.string().nullable(),
  explanation: z.string(),
});

export type AiBenchmarkItem = z.infer<typeof aiBenchmarkItemSchema>;

/**
 * The whole benchmark response.
 *
 * Every canonical task must appear exactly once. A response that is missing a
 * task, repeats one, or carries an unknown one is rejected outright — the
 * benchmark is never silently repaired by adding, dropping, or reordering
 * items into validity.
 */
export const aiBenchmarkResponseSchema = z
  .strictObject({
    items: z.array(aiBenchmarkItemSchema),
  })
  .superRefine((response, ctx) => {
    const seen = response.items.map((item) => item.task_id);

    if (seen.length !== AI_BENCHMARK_TASK_IDS.length) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: `expected exactly ${AI_BENCHMARK_TASK_IDS.length} benchmark items, received ${seen.length}`,
      });
    }

    const duplicates = seen.filter((id, index) => seen.indexOf(id) !== index);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: `duplicate benchmark task ids: ${[...new Set(duplicates)].join(", ")}`,
      });
    }

    const missing = AI_BENCHMARK_TASK_IDS.filter((id) => !seen.includes(id));
    if (missing.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: `missing benchmark task ids: ${missing.join(", ")}`,
      });
    }
  });

export type AiBenchmarkResponse = z.infer<typeof aiBenchmarkResponseSchema>;

/**
 * Sorts validated items into the canonical task order.
 *
 * Structural only — applied AFTER validation so the UI renders a stable row
 * order. It never repairs an invalid response.
 */
export function normalizeBenchmarkOrder(
  response: AiBenchmarkResponse,
): AiBenchmarkResponse {
  const order = new Map<AiBenchmarkTaskId, number>(
    AI_BENCHMARK_TASK_IDS.map((id, index) => [id, index]),
  );
  return {
    items: [...response.items].sort(
      (a, b) => (order.get(a.task_id) ?? 0) - (order.get(b.task_id) ?? 0),
    ),
  };
}

export class BenchmarkValidationError extends Error {
  readonly issues: z.core.$ZodIssue[];

  constructor(issues: z.core.$ZodIssue[], detail: string) {
    super(`Invalid AI-only benchmark response:\n${detail}`);
    this.name = "BenchmarkValidationError";
    this.issues = issues;
  }
}

/**
 * Validates an untrusted benchmark response and returns it in canonical order.
 *
 * Throws on any violation. A partially valid response is a failed benchmark —
 * four or five good items are never rendered.
 */
export function parseBenchmarkResponse(data: unknown): AiBenchmarkResponse {
  const result = aiBenchmarkResponseSchema.safeParse(data);
  if (!result.success) {
    throw new BenchmarkValidationError(
      result.error.issues,
      z.prettifyError(result.error),
    );
  }
  return normalizeBenchmarkOrder(result.data);
}

/**
 * Builds the request body sent to `/api/ai-benchmark`.
 *
 * Deliberately the ONLY place the body is constructed, so the payload boundary
 * is testable: the benchmark receives the report and nothing Research Lens
 * derived from it.
 */
export function buildBenchmarkRequestBody(
  apiKey: string,
  reportText: string,
): { apiKey: string; reportText: string } {
  return { apiKey, reportText };
}
