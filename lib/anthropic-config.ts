/**
 * Single configuration point for Anthropic inference.
 *
 * Change the model here and nowhere else. There is deliberately no model
 * routing, no provider abstraction, and no UI model picker.
 */

/** BUILD-3 default model. */
export const ANALYSIS_MODEL = "claude-sonnet-5";

/**
 * Output ceiling for one analysis. The sample reports are short, so this is
 * generous for ~20 analytical inputs while still bounding cost.
 */
export const ANALYSIS_MAX_TOKENS = 8000;

/**
 * Effort level for this extraction workload. Structured extraction from a
 * one-page report does not need the default `high`.
 */
export const ANALYSIS_EFFORT = "medium" as const;

/**
 * Defensive ceiling on submitted report text. The built-in samples are ~1 KB;
 * this only exists so an unexpected payload cannot drive up token spend.
 */
export const MAX_REPORT_CHARS = 200_000;
