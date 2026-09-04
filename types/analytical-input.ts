import type { z } from "zod";

import type {
  analysisResponseSchema,
  analyticalInputSchema,
  basisSchema,
  conflictStateSchema,
  evidenceTypeSchema,
  materialitySchema,
  precisionSchema,
  reportInsightSchema,
  sourceEvidenceSchema,
  temporalTypeSchema,
  trustStateSchema,
  unitSchema,
  userCorrectionSchema,
  valueRangeSchema,
} from "@/lib/analysis-schema";

/**
 * Canonical types for AI-interpreted analytical content.
 *
 * Every type is inferred from its Zod schema in `lib/analysis-schema.ts`, so
 * the runtime contract and the compile-time contract cannot drift apart.
 */

export type TemporalType = z.infer<typeof temporalTypeSchema>;
export type Basis = z.infer<typeof basisSchema>;
export type Precision = z.infer<typeof precisionSchema>;
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;
export type ConflictState = z.infer<typeof conflictStateSchema>;
export type TrustState = z.infer<typeof trustStateSchema>;
export type Materiality = z.infer<typeof materialitySchema>;
export type Unit = z.infer<typeof unitSchema>;

export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;
export type ValueRange = z.infer<typeof valueRangeSchema>;
export type UserCorrection = z.infer<typeof userCorrectionSchema>;

/** One interpreted fact, estimate, or metric candidate from a report. */
export type AnalyticalInput = z.infer<typeof analyticalInputSchema>;

/** Narrative navigation content. Never gates deterministic execution. */
export type ReportInsight = z.infer<typeof reportInsightSchema>;

/** The whole validated interpretation of one report. */
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
