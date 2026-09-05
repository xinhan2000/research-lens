/**
 * EVAL-ONLY mapping between the golden-set document ids and the product's
 * report registry ids.
 *
 * The product registry (`lib/reports.ts`) labels its four built-in reports
 * `clean | forecast | conflict | failure`. `03_Sample_Data/Ground_Truth.jsonl`
 * labels the same reports `report_a_clean | report_b_forecast |
 * report_c_conflict | report_d_failure`.
 *
 * Evaluation code is allowed to know the golden-set ids — it is the thing doing
 * the grading. Product runtime is not: nothing under `app/`, `components/`, or
 * `lib/` imports this file, and no product behaviour branches on these ids.
 *
 * One further rule, easy to get wrong and important: the eval runner passes the
 * PRODUCT registry id to `buildAnalysisUserMessage`, exactly as
 * `ResearchLensShell` does. Inference must see the same request the app sends.
 * The golden-set id is used only after inference, for grading.
 */

/** Canonical golden-set document ids, in dataset order. */
export const GOLDEN_DOCUMENT_IDS = [
  "report_a_clean",
  "report_b_forecast",
  "report_c_conflict",
  "report_d_failure",
] as const;

export type GoldenDocumentId = (typeof GOLDEN_DOCUMENT_IDS)[number];

/** Golden-set id -> product registry id (the id the app sends to inference). */
const PRODUCT_ID_BY_GOLDEN_ID: Record<GoldenDocumentId, string> = {
  report_a_clean: "clean",
  report_b_forecast: "forecast",
  report_c_conflict: "conflict",
  report_d_failure: "failure",
};

/** Short display name used in the scorecard ("REPORT A", "REPORT B", ...). */
const DISPLAY_NAME_BY_GOLDEN_ID: Record<GoldenDocumentId, string> = {
  report_a_clean: "REPORT A",
  report_b_forecast: "REPORT B",
  report_c_conflict: "REPORT C",
  report_d_failure: "REPORT D",
};

export function isGoldenDocumentId(value: string): value is GoldenDocumentId {
  return (GOLDEN_DOCUMENT_IDS as readonly string[]).includes(value);
}

export function productIdForGoldenId(id: GoldenDocumentId): string {
  return PRODUCT_ID_BY_GOLDEN_ID[id];
}

export function displayNameForGoldenId(id: GoldenDocumentId): string {
  return DISPLAY_NAME_BY_GOLDEN_ID[id];
}

/** Golden-set id for a product registry id, or null when unmapped. */
export function goldenIdForProductId(productId: string): GoldenDocumentId | null {
  for (const goldenId of GOLDEN_DOCUMENT_IDS) {
    if (PRODUCT_ID_BY_GOLDEN_ID[goldenId] === productId) return goldenId;
  }
  return null;
}
