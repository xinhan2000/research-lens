import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AI_BENCHMARK_JSON_SCHEMA } from "@/lib/ai-benchmark-json-schema";
import {
  BenchmarkValidationError,
  parseBenchmarkResponse,
} from "@/lib/ai-benchmark-schema";
import {
  ANALYSIS_EFFORT,
  ANALYSIS_MODEL,
  BENCHMARK_MAX_TOKENS,
  MAX_REPORT_CHARS,
} from "@/lib/anthropic-config";
import {
  AI_BENCHMARK_SYSTEM_PROMPT,
  buildBenchmarkUserMessage,
} from "@/lib/prompts/ai-benchmark-prompt";

/**
 * POST /api/ai-benchmark — one Claude call, six benchmark answers.
 *
 * Deliberately separate from `/api/analyze`, which is untouched by this build
 * step. The two responsibilities never mix: this route knows nothing about
 * AnalyticalInputs, skill results, trust states, or Ground Truth, and it never
 * receives them.
 *
 * Security matches the analyze route: the caller's key builds a client for THIS
 * request only and is never logged, persisted, echoed, or held in module scope.
 */

export const runtime = "nodejs";

const requestSchema = z.strictObject({
  apiKey: z.string().min(1),
  reportText: z.string().min(1).max(MAX_REPORT_CHARS),
});

type ErrorCode =
  | "invalid_request"
  | "missing_key"
  | "auth_failed"
  | "rate_limited"
  | "upstream_error"
  | "invalid_benchmark_output"
  | "server_error";

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "Request body must be JSON.", 400);
  }

  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) {
    // Never echo the body — it carries the API key.
    const missingKey = parsedRequest.error.issues.some(
      (issue) => issue.path[0] === "apiKey",
    );
    return missingKey
      ? errorResponse(
          "missing_key",
          "Anthropic API key required to run the AI-only benchmark.",
          400,
        )
      : errorResponse("invalid_request", "Invalid benchmark request.", 400);
  }

  const { apiKey, reportText } = parsedRequest.data;

  let rawText: string;
  try {
    // Per-request client. Not cached, not shared, not module scoped.
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      // Same model as the trusted path: the benchmark compares architectures,
      // not model capability.
      model: ANALYSIS_MODEL,
      max_tokens: BENCHMARK_MAX_TOKENS,
      system: AI_BENCHMARK_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildBenchmarkUserMessage(reportText) },
      ],
      output_config: {
        effort: ANALYSIS_EFFORT,
        format: { type: "json_schema", schema: AI_BENCHMARK_JSON_SCHEMA },
      },
    });

    if (message.stop_reason === "refusal") {
      return errorResponse(
        "upstream_error",
        "The model declined to run the AI-only benchmark.",
        502,
      );
    }

    if (message.stop_reason === "max_tokens") {
      return errorResponse(
        "invalid_benchmark_output",
        "Unable to validate the AI-only benchmark safely.",
        502,
      );
    }

    rawText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return errorResponse(
        "auth_failed",
        "Claude request failed. Check your API key and try again.",
        401,
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return errorResponse(
        "rate_limited",
        "Rate limited by Anthropic. Wait a moment and retry.",
        429,
      );
    }
    if (error instanceof Anthropic.APIError) {
      return errorResponse(
        "upstream_error",
        "AI-only benchmark failed. Retry.",
        error.status && error.status >= 500 ? 502 : 400,
      );
    }
    return errorResponse("server_error", "AI-only benchmark failed. Retry.", 500);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return errorResponse(
      "invalid_benchmark_output",
      "Unable to validate the AI-only benchmark safely.",
      502,
    );
  }

  // Structured output is never treated as sufficient. A response missing a
  // task, repeating one, or carrying an unknown one fails entirely — partial
  // items are never returned, and nothing is synthesized to fill a gap.
  try {
    const benchmark = parseBenchmarkResponse(parsedJson);
    return NextResponse.json({ benchmark });
  } catch (error) {
    if (error instanceof BenchmarkValidationError) {
      // Issue paths are safe to log; the benchmark response holds no secrets.
      console.warn(
        "[ai-benchmark] schema validation failed:",
        error.issues.map((issue) => issue.path.join(".")).join(", "),
      );
      return errorResponse(
        "invalid_benchmark_output",
        "Unable to validate the AI-only benchmark safely.",
        502,
      );
    }
    return errorResponse("server_error", "AI-only benchmark failed. Retry.", 500);
  }
}
