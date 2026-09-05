import type { SkillResult } from "./skills/types";

/**
 * Presentation formatting for skill results.
 *
 * Extracted from SkillPanel so the benchmark comparison can render the same
 * values without duplicating the rules. Presentation only — no calculation, no
 * rounding of internal values, and no mutation of the SkillResult.
 */

export const SKILL_STATUS_LABEL: Record<SkillResult["status"], string> = {
  READY: "READY",
  NEEDS_REVIEW: "NEEDS REVIEW",
  BLOCKED: "BLOCKED",
};

/** Formatted result, or "" when the skill did not execute. */
export function formatSkillResult(result: SkillResult): string {
  if (result.value === undefined || result.unit === undefined) return "";
  const { value, unit } = result;
  if (unit === "percent") return `${(value * 100).toFixed(2)}%`;
  if (unit === "multiple") return `${value.toFixed(2)}x`;
  return `$${value.toFixed(2).replace(/\.00$/, "")}M`;
}
