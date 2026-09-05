import type { AnalyticalInput } from "@/types/analytical-input";

/**
 * Test-only builders for AnalyticalInput objects.
 *
 * These construct objects in the LIVE schema (lowercase trust states). Ground
 * Truth uses its own eval representation and is never imported by runtime code.
 */

let counter = 0;

export function makeInput(
  overrides: Partial<AnalyticalInput> & Pick<AnalyticalInput, "metric">,
): AnalyticalInput {
  counter += 1;
  return {
    input_id: `test_${counter}`,
    source_label: null,
    value: 0,
    unit: "USD_millions",
    currency: "USD",
    period: "FY2025",
    temporal_type: "actual",
    basis: "reported",
    precision: "exact",
    range: null,
    source: {
      document_id: "test_doc",
      page: null,
      section: "Test",
      text: "Test evidence sentence for the analytical input.",
    },
    evidence_type: "direct",
    conflict_state: "none",
    trust_state: "auto",
    materiality: "high",
    confidence: 0.95,
    resolved: true,
    notes: null,
    user_correction: null,
    ...overrides,
  };
}

/** Report A (Clean), expressed in the live schema. */
export function reportAInputs(): AnalyticalInput[] {
  return [
    makeInput({ input_id: "a_rev24", metric: "Revenue", value: 82.0, period: "FY2024" }),
    makeInput({ input_id: "a_rev25", metric: "Revenue", value: 101.0, period: "FY2025" }),
    makeInput({ input_id: "a_gp25", metric: "Gross Profit", value: 62.0, period: "FY2025" }),
    makeInput({ input_id: "a_ebitda25", metric: "EBITDA", value: 18.6, period: "FY2025", basis: "adjusted" }),
    makeInput({ input_id: "a_cash25", metric: "Cash", value: 30.0, period: "FY2025" }),
    makeInput({ input_id: "a_debt25", metric: "Total Debt", value: 125.0, period: "FY2025" }),
    makeInput({ input_id: "a_ev", metric: "Enterprise Value", value: 650.0, period: "report_date", basis: "not_applicable" }),
  ];
}

/** Report C (Conflict): two materially competing FY2025 EBITDA definitions. */
export function reportCInputs(): AnalyticalInput[] {
  return [
    makeInput({ input_id: "c_rev25", metric: "Revenue", value: 101.0, period: "FY2025" }),
    makeInput({
      input_id: "c_ebitda_adj", metric: "EBITDA", value: 18.6, period: "FY2025",
      basis: "adjusted", conflict_state: "material_conflict", trust_state: "ask", resolved: false,
    }),
    makeInput({
      input_id: "c_ebitda_reported", metric: "EBITDA", value: 14.2, period: "FY2025",
      basis: "reported", conflict_state: "material_conflict", trust_state: "ask", resolved: false,
    }),
    makeInput({ input_id: "c_ev", metric: "Enterprise Value", value: 650.0, period: "report_date", basis: "not_applicable" }),
  ];
}
