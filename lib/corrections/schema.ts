import { z } from "zod";

import { basisSchema, temporalTypeSchema } from "../analysis-schema";

/**
 * Analyst correction contract (BUILD-7).
 *
 * A correction is an analyst-authored overlay on one interpreted input. It is
 * NOT a resolution: BUILD-6 selects among existing model candidates, whereas a
 * correction introduces a value the model never produced. The two compose but
 * are never the same thing.
 *
 * Deliberately narrow. Only fields whose meaning an analyst can reasonably
 * restate are correctable; unit, currency, evidence, trust state and conflict
 * state are not, because editing those would turn a correction into a safety
 * override rather than a semantic fix.
 */

/** Fields an analyst may correct. */
export const CORRECTABLE_FIELDS = [
  "value",
  "period",
  "temporal_type",
  "basis",
  "precision",
] as const;

export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

/**
 * Precision values an analyst may set.
 *
 * `range` is excluded: BUILD-7 has no min/max editor, and manufacturing bounds
 * for a range the analyst never stated would invent precision.
 */
export const CORRECTABLE_PRECISIONS = [
  "exact",
  "approximate",
  "qualitative",
  "unknown",
] as const;

export const correctablePrecisionSchema = z.enum(CORRECTABLE_PRECISIONS);

export type CorrectablePrecision = (typeof CORRECTABLE_PRECISIONS)[number];

/**
 * A corrected numeric value.
 *
 * Finite numbers or null. No sign restriction — a negative EBITDA is
 * semantically valid. The value is interpreted in the input's EXISTING unit;
 * no unit is parsed from what the analyst typed.
 */
const correctedValueSchema = z
  .number()
  .refine((n) => Number.isFinite(n), { message: "value must be a finite number" })
  .nullable();

/**
 * A corrected period.
 *
 * Trimmed, with blank becoming null. No fiscal-period ontology: "2025" is not
 * silently normalized to "FY2025" — the skill contracts decide whether what the
 * analyst wrote is usable.
 */
const correctedPeriodSchema = z
  .string()
  .nullable()
  .transform((period) => {
    if (period === null) return null;
    const trimmed = period.trim();
    return trimmed === "" ? null : trimmed;
  });

/** Only the correctable fields. Strict: anything else is rejected. */
export const correctionChangesSchema = z
  .strictObject({
    value: correctedValueSchema.optional(),
    period: correctedPeriodSchema.optional(),
    temporal_type: temporalTypeSchema.optional(),
    basis: basisSchema.optional(),
    precision: correctablePrecisionSchema.optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "a correction must change at least one field",
  });

export const analystCorrectionSchema = z.strictObject({
  /** Authoritative anchor. Never a metric label, source label, or index. */
  inputId: z.string().min(1),
  changes: correctionChangesSchema,
  correctedAt: z.string().min(1),
});

export type AnalystCorrection = z.infer<typeof analystCorrectionSchema>;

/** Current overlay per input. One correction each; re-editing replaces it. */
export type CorrectionsById = Record<string, AnalystCorrection>;

/** Validates an untrusted correction, returning null when invalid. */
export function parseCorrection(data: unknown): AnalystCorrection | null {
  const result = analystCorrectionSchema.safeParse(data);
  return result.success ? result.data : null;
}
