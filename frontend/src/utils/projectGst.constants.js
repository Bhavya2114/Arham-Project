/**
 * Centralized Project GST Business Rules & Constants
 * Fixed 18% GST rule applies to all project materials regardless of purchase or product rates.
 */
export const PROJECT_GST_RATE = 18;
export const PROJECT_GST_MULTIPLIER = PROJECT_GST_RATE / 100;

/**
 * Standard rounding utility for 2 decimal places
 */
export const roundToTwo = (num) => {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

/**
 * Fixed customer billing rate for project materials:
 * Always equals dealer cost price + fixed 18% GST (no markup or manual adjustment).
 */
export const getFixedBillingRate = (actualUnitCostExcludingGST) => {
  return roundToTwo(Number(actualUnitCostExcludingGST || 0) * (1 + PROJECT_GST_MULTIPLIER));
};
