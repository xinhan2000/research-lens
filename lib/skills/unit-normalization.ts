import type { AnalyticalInput } from "@/types/analytical-input";

/**
 * Deterministic monetary unit normalization.
 *
 * The schema carries scale explicitly, so conversion is arithmetic rather than
 * interpretation. Scale is NEVER inferred from `source.text`, and the original
 * input object is never mutated — normalization happens only inside skill
 * execution.
 */

/** Multiplier converting each unit into USD millions. */
const TO_USD_MILLIONS: Partial<Record<AnalyticalInput["unit"], number>> = {
  USD: 1e-6,
  USD_thousands: 1e-3,
  USD_millions: 1,
  USD_billions: 1e3,
};

export function isMonetaryUnit(unit: AnalyticalInput["unit"]): boolean {
  return unit in TO_USD_MILLIONS;
}

/**
 * Converts a monetary value to USD millions.
 *
 * Returns null when the unit is not monetary or the value is absent — callers
 * treat null as "cannot execute", never as zero.
 */
export function toUsdMillions(
  value: number | null,
  unit: AnalyticalInput["unit"],
): number | null {
  if (value === null) return null;
  const factor = TO_USD_MILLIONS[unit];
  if (factor === undefined) return null;
  return value * factor;
}
