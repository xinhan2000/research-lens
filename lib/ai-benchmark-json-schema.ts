import { AI_BENCHMARK_TASK_IDS } from "./ai-benchmark-schema";

/**
 * JSON Schema for Anthropic structured output on the benchmark call.
 *
 * Written independently of `lib/analysis-json-schema.ts` so BUILD-3 behavior
 * cannot be disturbed. It is small enough that sharing a generator would cost
 * more coupling than it saves.
 *
 * The task-id enum derives from the canonical catalog, so schema, prompt, UI
 * and tests cannot drift apart.
 *
 * `answer` is expressed as an `anyOf` string/null rather than a type array,
 * matching the documented structured-output subset.
 *
 * Structured output is a hint, not a guarantee: the response is ALWAYS revalidated
 * by `parseBenchmarkResponse`, which additionally enforces the exactly-six,
 * no-duplicate, no-missing rules that JSON Schema cannot express.
 */
export const AI_BENCHMARK_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            enum: [...AI_BENCHMARK_TASK_IDS],
          },
          answer: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          explanation: {
            type: "string",
          },
        },
        required: ["task_id", "answer", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};
