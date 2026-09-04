import { z } from "zod";

import { analysisResponseSchema } from "@/lib/analysis-schema";
import type { AnalysisResponse } from "@/types/analytical-input";

/**
 * Validation boundary between structured interpretation output and the
 * application.
 *
 * Nothing reaches React state or a Deterministic Skill without passing through
 * here. Malformed semantic fields are rejected, never coerced.
 */

export class AnalysisValidationError extends Error {
  readonly issues: z.core.$ZodIssue[];

  constructor(context: string, issues: z.core.$ZodIssue[], detail: string) {
    super(`Invalid analysis response (${context}):\n${detail}`);
    this.name = "AnalysisValidationError";
    this.issues = issues;
  }
}

/**
 * Parses an untrusted analysis response.
 *
 * Throws `AnalysisValidationError` on any violation so bad data fails visibly
 * during development and at build time rather than rendering as plausible
 * analysis.
 */
export function parseAnalysisResponse(
  data: unknown,
  context = "unknown source",
): AnalysisResponse {
  const result = analysisResponseSchema.safeParse(data);

  if (!result.success) {
    throw new AnalysisValidationError(
      context,
      result.error.issues,
      z.prettifyError(result.error),
    );
  }

  return result.data;
}

/** Non-throwing variant, for call sites that need to report failure as state. */
export function safeParseAnalysisResponse(data: unknown) {
  return analysisResponseSchema.safeParse(data);
}
