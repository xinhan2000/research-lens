import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AnalysisValidationError, parseAnalysisResponse } from "@/lib/analysis";
import { ANALYSIS_RESPONSE_JSON_SCHEMA } from "@/lib/analysis-json-schema";
import {
  ANALYSIS_EFFORT,
  ANALYSIS_MAX_TOKENS,
  ANALYSIS_MODEL,
  MAX_REPORT_CHARS,
} from "@/lib/anthropic-config";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserMessage,
} from "@/lib/prompts/analysis-prompt";

/**
 * POST /api/analyze — one Claude call, one validated AnalysisResponse.
 *
 * Security: the caller's API key is used to construct a client for THIS
 * request and is never logged, persisted, echoed, or stored in a module-level
 * variable. The request body is never logged either, because it carries the key.
 */

export const runtime = "nodejs";

const requestSchema = z.strictObject({
  apiKey: z.string().min(1),
  documentId: z.string().min(1),
  reportText: z.string().min(1).max(MAX_REPORT_CHARS),
});

/** Stable codes the browser maps to user-facing copy. */
type ErrorCode =
  | "invalid_request"
  | "missing_key"
  | "auth_failed"
  | "rate_limited"
  | "upstream_error"
  | "invalid_model_output"
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
    // Never echo the body — it contains the API key.
    const missingKey = parsedRequest.error.issues.some(
      (issue) => issue.path[0] === "apiKey",
    );
    return missingKey
      ? errorResponse(
          "missing_key",
          "Anthropic API key required to analyze this report.",
          400,
        )
      : errorResponse("invalid_request", "Invalid analyze request.", 400);
  }

  const { apiKey, documentId, reportText } = parsedRequest.data;

  let rawText: string;
  try {
    // Per-request client. Not cached, not shared, not module scoped.
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: ANALYSIS_MAX_TOKENS,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildAnalysisUserMessage(documentId, reportText) },
      ],
      output_config: {
        effort: ANALYSIS_EFFORT,
        format: { type: "json_schema", schema: ANALYSIS_RESPONSE_JSON_SCHEMA },
      },
    });

    if (message.stop_reason === "refusal") {
      return errorResponse(
        "upstream_error",
        "The model declined to analyze this report.",
        502,
      );
    }

    if (message.stop_reason === "max_tokens") {
      return errorResponse(
        "invalid_model_output",
        "Unable to interpret the model response safely. Retry analysis.",
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
      // Status only — the full upstream error may quote request contents.
      return errorResponse(
        "upstream_error",
        "Analysis failed. Retry.",
        error.status && error.status >= 500 ? 502 : 400,
      );
    }
    return errorResponse("server_error", "Analysis failed. Retry.", 500);
  }

  // Structured-output enforcement is never treated as sufficient: the response
  // must still satisfy the full Zod contract, refinements included.
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return errorResponse(
      "invalid_model_output",
      "Unable to interpret the model response safely. Retry analysis.",
      502,
    );
  }

  try {
    const analysis = parseAnalysisResponse(parsedJson, "anthropic response");
    return NextResponse.json({ analysis });
  } catch (error) {
    if (error instanceof AnalysisValidationError) {
      // Issue paths are safe to log; the model response contains no secrets.
      console.warn(
        `[analyze] schema validation failed for ${documentId}:`,
        error.issues.map((issue) => issue.path.join(".")).join(", "),
      );
      return errorResponse(
        "invalid_model_output",
        "Unable to interpret the model response safely. Retry analysis.",
        502,
      );
    }
    return errorResponse("server_error", "Analysis failed. Retry.", 500);
  }
}
