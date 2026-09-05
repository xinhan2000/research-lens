/**
 * The six MVP formulas.
 *
 * Ordinary TypeScript arithmetic — no model calls, no financial library.
 * Each returns null on an invalid denominator so the caller can BLOCK rather
 * than emit Infinity or NaN.
 *
 * Percent results are decimals: 0.2317 means 23.17%.
 */

function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** (Current Revenue - Prior Revenue) / Prior Revenue */
export function revenueGrowth(
  priorRevenue: number,
  currentRevenue: number,
): number | null {
  return safeDivide(currentRevenue - priorRevenue, priorRevenue);
}

/** Gross Profit / Revenue */
export function grossMargin(
  grossProfit: number,
  revenue: number,
): number | null {
  return safeDivide(grossProfit, revenue);
}

/** EBITDA / Revenue */
export function ebitdaMargin(ebitda: number, revenue: number): number | null {
  return safeDivide(ebitda, revenue);
}

/** Total Debt - Cash */
export function netDebt(totalDebt: number, cash: number): number | null {
  if (!Number.isFinite(totalDebt) || !Number.isFinite(cash)) return null;
  return totalDebt - cash;
}

/** Enterprise Value / Revenue */
export function evRevenue(
  enterpriseValue: number,
  revenue: number,
): number | null {
  return safeDivide(enterpriseValue, revenue);
}

/** Enterprise Value / EBITDA */
export function evEbitda(
  enterpriseValue: number,
  ebitda: number,
): number | null {
  return safeDivide(enterpriseValue, ebitda);
}
