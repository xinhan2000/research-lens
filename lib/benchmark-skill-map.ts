import {
  AI_BENCHMARK_TASK_IDS,
  type AiBenchmarkTaskId,
} from "./ai-benchmark-schema";

/**
 * Explicit pairing between benchmark tasks and Deterministic Skills.
 *
 * Rows are paired by this map alone — never by array position, display label,
 * or string similarity. The mapping is one-to-one and total over both sets.
 *
 * This is the only place the two vocabularies meet, and it is a lookup in one
 * direction only: a benchmark item can find its skill for display. Nothing
 * flows the other way, and no skill result is ever mutated.
 */
export const BENCHMARK_TASK_TO_SKILL_ID: Record<AiBenchmarkTaskId, string> = {
  revenue_growth: "skill_revenue_growth",
  gross_margin: "skill_gross_margin",
  ebitda_margin: "skill_ebitda_margin",
  net_debt: "skill_net_debt",
  ev_revenue: "skill_ev_revenue",
  ev_ebitda: "skill_ev_ebitda",
};

/** Skill id paired with a benchmark task, or null if the task is unknown. */
export function skillIdForTask(taskId: string): string | null {
  return (
    BENCHMARK_TASK_TO_SKILL_ID[taskId as AiBenchmarkTaskId] ?? null
  );
}

/** Every skill id referenced by the benchmark catalog, in canonical order. */
export const BENCHMARK_SKILL_IDS: string[] = AI_BENCHMARK_TASK_IDS.map(
  (taskId) => BENCHMARK_TASK_TO_SKILL_ID[taskId],
);
