import Anthropic from "@anthropic-ai/sdk";

import { parseAnalysisResponse } from "../lib/analysis";
import { ANALYSIS_RESPONSE_JSON_SCHEMA } from "../lib/analysis-json-schema";
import { AI_BENCHMARK_JSON_SCHEMA } from "../lib/ai-benchmark-json-schema";
import { parseBenchmarkResponse } from "../lib/ai-benchmark-schema";
import {
  ANALYSIS_EFFORT,
  ANALYSIS_MAX_TOKENS,
  ANALYSIS_MODEL,
  BENCHMARK_MAX_TOKENS,
} from "../lib/anthropic-config";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserMessage,
} from "../lib/prompts/analysis-prompt";
import {
  AI_BENCHMARK_SYSTEM_PROMPT,
  buildBenchmarkUserMessage,
} from "../lib/prompts/ai-benchmark-prompt";
import type { AiBenchmarkResponse } from "../lib/ai-benchmark-schema";
import type { AnalysisResponse } from "../types/analytical-input";

/**
 * Live inference for the eval harness.
 *
 * THIS MODULE KNOWS NOTHING ABOUT THE GOLDEN-SET ANSWERS.
 *
 * It imports no dataset loader and no scoring module, and no function here
 * accepts a parameter named for an expected answer. The only inputs are an API
 * key, a document id, and report text. That is the whole point of the
 * separation: the answers are not merely withheld from the prompt, they are not
 * reachable from this file at all. `eval/boundary.test.ts` enforces it.
 *
 * It also does not call the local Next.js API. The eval runner talks to
 * Anthropic directly while reusing the SAME model configuration, system prompt,
 * user-message builder, JSON Schema, and Zod validation boundary that
 * `/api/analyze` and `/api/ai-benchmark` use. `npm run eval` therefore needs no
 * dev server, and the analysis contract under test is the production one.
 */

/** Thrown for any inference-layer failure. Never carries request contents. */
export class InferenceError extends Error {
  readonly kind: "auth" | "rate_limit" | "upstream" | "invalid_output";

  constructor(kind: InferenceError["kind"], message: string) {
    super(message);
    this.name = "InferenceError";
    this.kind = kind;
  }
}

/**
 * Converts an SDK error into a safe message.
 *
 * Deliberately narrow: the class of failure and, for API errors, the HTTP
 * status. The upstream error object can quote the request body, so it is never
 * stringified, logged, or attached.
 */
function describe(error: unknown): InferenceError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new InferenceError(
      "auth",
      "Anthropic authentication failed. Check ANTHROPIC_API_KEY.",
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new InferenceError("rate_limit", "Rate limited by Anthropic.");
  }
  if (error instanceof Anthropic.APIError) {
    return new InferenceError(
      "upstream",
      `Anthropic request failed with status ${error.status ?? "unknown"}.`,
    );
  }
  return new InferenceError("upstream", "Anthropic request failed.");
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function guardStopReason(message: Anthropic.Message, what: string): void {
  if (message.stop_reason === "refusal") {
    throw new InferenceError("upstream", `The model declined the ${what} request.`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new InferenceError(
      "invalid_output",
      `The ${what} response was truncated at max_tokens.`,
    );
  }
}

/**
 * One analysis call for one report.
 *
 * `documentId` is the PRODUCT registry id, passed exactly as
 * `ResearchLensShell` passes it, so the request under evaluation is the request
 * the application sends.
 *
 * The response is validated by the production `parseAnalysisResponse`. Nothing
 * is repaired, coerced, retried into validity, or partially accepted: an
 * invalid response is an inference failure, not a scoring input.
 */
export async function runAnalysisInference(params: {
  apiKey: string;
  documentId: string;
  reportText: string;
}): Promise<AnalysisResponse> {
  const client = new Anthropic({ apiKey: params.apiKey });

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: ANALYSIS_MAX_TOKENS,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildAnalysisUserMessage(params.documentId, params.reportText),
        },
      ],
      output_config: {
        effort: ANALYSIS_EFFORT,
        format: { type: "json_schema", schema: ANALYSIS_RESPONSE_JSON_SCHEMA },
      },
    });
  } catch (error) {
    throw describe(error);
  }

  guardStopReason(message, "analysis");

  let json: unknown;
  try {
    json = JSON.parse(textOf(message));
  } catch {
    throw new InferenceError(
      "invalid_output",
      "Analysis response was not valid JSON.",
    );
  }

  try {
    return parseAnalysisResponse(json, `eval:${params.documentId}`);
  } catch {
    throw new InferenceError(
      "invalid_output",
      "Analysis response failed the AnalysisResponse contract.",
    );
  }
}

/**
 * One AI-only benchmark call for one report.
 *
 * Receives the report text and nothing else. No Ground Truth, no
 * AnalysisResponse, no SkillResult, no trust or conflict state, no analyst
 * resolution, no correction — the existing BUILD-5.5 contract already takes
 * only report text, and this signature preserves that.
 *
 * One call covers all six tasks. Never one call per task.
 */
export async function runBenchmarkInference(params: {
  apiKey: string;
  reportText: string;
}): Promise<AiBenchmarkResponse> {
  const client = new Anthropic({ apiKey: params.apiKey });

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: BENCHMARK_MAX_TOKENS,
      system: AI_BENCHMARK_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildBenchmarkUserMessage(params.reportText) },
      ],
      output_config: {
        effort: ANALYSIS_EFFORT,
        format: { type: "json_schema", schema: AI_BENCHMARK_JSON_SCHEMA },
      },
    });
  } catch (error) {
    throw describe(error);
  }

  guardStopReason(message, "benchmark");

  let json: unknown;
  try {
    json = JSON.parse(textOf(message));
  } catch {
    throw new InferenceError(
      "invalid_output",
      "Benchmark response was not valid JSON.",
    );
  }

  try {
    return parseBenchmarkResponse(json);
  } catch {
    throw new InferenceError(
      "invalid_output",
      "Benchmark response failed the AiBenchmarkResponse contract.",
    );
  }
}
