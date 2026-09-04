import { z } from "zod";

/**
 * Zod contract for the structured interpretation returned by Claude.
 *
 * This is the canonical implementation of
 * `05_Product_Decisions/Semantic_Input_Schema.md`. It is the single source of
 * truth: the TypeScript types in `types/analytical-input.ts` are inferred from
 * these schemas so the two cannot drift apart.
 *
 * Objects are strict. An unexpected key is a contract violation and must fail
 * visibly rather than be silently dropped.
 */

/* ------------------------------------------------------------------ *
 * Enum-like fields (Semantic_Input_Schema SI-7, SI-8, SI-9, SI-11,
 * SI-12, SI-13, SI-14)
 * ------------------------------------------------------------------ */

/** SI-7. A correct number can still be unsafe under the wrong temporal reading. */
export const temporalTypeSchema = z.enum([
  "actual",
  "forecast",
  "guidance",
  "target",
  "assumption",
  "unknown",
]);

/** SI-8. Accounting/analytical basis. `adjusted` must stay distinct from `reported`. */
export const basisSchema = z.enum([
  "reported",
  "adjusted",
  "gaap",
  "non_gaap",
  "management_defined",
  "pro_forma",
  "consensus",
  "unknown",
  "not_applicable",
]);

/** SI-9. Approximation must not silently become false precision. */
export const precisionSchema = z.enum([
  "exact",
  "approximate",
  "range",
  "qualitative",
  "unknown",
]);

/** SI-11. `none` must not feed consequential Deterministic Skills (SV-6). */
export const evidenceTypeSchema = z.enum([
  "direct",
  "derived_from_source",
  "indirect",
  "none",
]);

/** SI-12. `material_conflict` blocks silent downstream use (SV-5). */
export const conflictStateSchema = z.enum([
  "none",
  "consistent_multiple_sources",
  "possible_conflict",
  "material_conflict",
]);

/** SI-13. Autonomy states from `Autonomy_Policy.md`. */
export const trustStateSchema = z.enum(["auto", "ask", "abstain", "never"]);

/** SI-14. Consequence of using the interpretation incorrectly. */
export const materialitySchema = z.enum(["low", "medium", "high"]);

/** SI-4. Normalized units. Consequential units are never silently inferred. */
export const unitSchema = z.enum([
  "USD",
  "USD_thousands",
  "USD_millions",
  "USD_billions",
  "percent",
  "multiple",
  "count",
  "days",
  "months",
  "years",
  "none",
]);

/* ------------------------------------------------------------------ *
 * Sub-objects
 * ------------------------------------------------------------------ */

/**
 * SI-10. Source evidence.
 *
 * `page` is nullable: the prototype's sample reports are Markdown text
 * fixtures with no pagination (PRD §25 — use section/snippet instead).
 */
export const sourceEvidenceSchema = z.strictObject({
  document_id: z.string().min(1),
  page: z.number().int().positive().nullable(),
  section: z.string().min(1).nullable(),
  text: z.string().min(1),
  char_start: z.number().int().nonnegative().nullable().optional(),
  char_end: z.number().int().nonnegative().nullable().optional(),
});

/** SI-16. Bounded value, used when `precision = "range"`. */
export const valueRangeSchema = z.strictObject({
  min: z.number(),
  max: z.number(),
});

/** SI-19. Analyst correction. Simplified for the prototype. */
export const userCorrectionSchema = z.strictObject({
  corrected: z.boolean(),
  field: z.string().min(1),
  previous_value: z.union([z.string(), z.number(), z.null()]),
  new_value: z.union([z.string(), z.number(), z.null()]),
  timestamp: z.string().min(1),
});

/* ------------------------------------------------------------------ *
 * AnalyticalInput (Semantic_Input_Schema §8)
 * ------------------------------------------------------------------ */

export const analyticalInputSchema = z
  .strictObject({
    /** SI-1 */
    input_id: z.string().min(1),
    /** SI-2 — normalized canonical metric name. */
    metric: z.string().min(1),
    /** Original source wording, preserved separately from the canonical metric. */
    source_label: z.string().min(1).nullable().optional(),
    /** SI-3 — null where no numeric value can be responsibly stated. */
    value: z.number().nullable(),
    /** SI-4 */
    unit: unitSchema,
    /** SI-5 — null where currency does not apply. */
    currency: z.string().min(1).nullable(),
    /** SI-6 */
    period: z.string().min(1).nullable(),
    /** SI-7 */
    temporal_type: temporalTypeSchema,
    /** SI-8 */
    basis: basisSchema,
    /** SI-9 */
    precision: precisionSchema,
    /** SI-16 */
    range: valueRangeSchema.nullable(),
    /** SI-10 */
    source: sourceEvidenceSchema,
    /** SI-11 */
    evidence_type: evidenceTypeSchema,
    /** SI-12 */
    conflict_state: conflictStateSchema,
    /** SI-13 */
    trust_state: trustStateSchema,
    /** SI-14 */
    materiality: materialitySchema,
    /** SI-17 — never the sole basis for trust. */
    confidence: z.number().min(0).max(1).nullable().optional(),
    /** SI-15 — sufficiently interpreted; skill contracts still gate execution. */
    resolved: z.boolean(),
    /** SI-18 */
    notes: z.string().min(1).nullable().optional(),
    /** SI-19 */
    user_correction: userCorrectionSchema.nullable().optional(),
  })
  /* SI-16 / SV-9: a range must actually carry bounds. */
  .refine((input) => input.precision !== "range" || input.range !== null, {
    message: 'precision "range" requires a non-null range object',
    path: ["range"],
  })
  .refine((input) => input.range === null || input.range.min <= input.range.max, {
    message: "range.min must be less than or equal to range.max",
    path: ["range"],
  })
  /* SV-6: unsupported facts cannot be treated as resolved. */
  .refine(
    (input) => input.evidence_type !== "none" || input.resolved === false,
    {
      message: 'evidence_type "none" cannot be resolved',
      path: ["resolved"],
    },
  );

/* ------------------------------------------------------------------ *
 * ReportInsight — implementation-only narrative type
 * ------------------------------------------------------------------ */

/**
 * Navigation/narrative content only (Prototype_Build_Plan §7).
 *
 * Deliberately NOT merged into `AnalyticalInput`: narrative content must never
 * acquire the semantic qualifiers that gate deterministic execution.
 */
export const reportInsightSchema = z.strictObject({
  id: z.string().min(1),
  category: z.enum(["business", "risk", "timeline", "assumption"]),
  label: z.string().min(1),
  summary: z.string().min(1),
  sourceText: z.string().min(1),
});

/* ------------------------------------------------------------------ *
 * Top-level response contract
 * ------------------------------------------------------------------ */

export const analysisResponseSchema = z.strictObject({
  inputs: z.array(analyticalInputSchema),
  insights: z.array(reportInsightSchema),
});
