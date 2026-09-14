/**
 * Financial Calculation Utilities for Purchases
 * Provides consistent rounding and discount calculation logic across the backend.
 */

export interface LineItemCalculationInput {
  quantity: number;
  rate: number; // original unit rate / purchasePrice
  discountPercent?: number;
  discountAmount?: number;
  taxRate?: number; // GST %
  suppliedTaxAmount?: number;
}

export interface LineItemCalculationResult {
  quantity: number;
  rate: number;
  grossAmount: number;
  discountPercent: number;
  discountAmount: number;
  taxableValue: number;
  discountedUnitPrice: number;
  taxRate: number;
  rateGst: number;
  lineTax: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalCost: number;
}

/**
 * Safely rounds a number to 2 decimal places using standard financial half-up rounding.
 */
export const roundToTwo = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Calculates line item values:
 * grossAmount = quantity * originalUnitRate
 * discountAmount = grossAmount * discountPercent / 100 (or supplied discountAmount)
 * taxableValue = grossAmount - discountAmount
 * discountedUnitPrice = taxableValue / quantity (or originalUnitRate * (1 - discountPercent / 100))
 * taxAmount = taxableValue * gstRate / 100
 * totalCost = taxableValue + taxAmount
 */
export const calculateLineItem = (input: LineItemCalculationInput): LineItemCalculationResult => {
  const quantity = Math.max(0, Number(input.quantity || 0));
  const rate = Math.max(0, Number(input.rate || 0));
  const taxRate = Math.max(0, Number(input.taxRate || 0));

  const grossAmount = roundToTwo(quantity * rate);

  let discountPercent = Number(input.discountPercent || 0);
  let discountAmount = Number(input.discountAmount || 0);

  if (discountPercent > 0) {
    discountAmount = roundToTwo((grossAmount * discountPercent) / 100);
  } else if (discountAmount > 0 && grossAmount > 0) {
    discountPercent = roundToTwo((discountAmount / grossAmount) * 100);
  } else {
    discountPercent = 0;
    discountAmount = 0;
  }

  // Cap discount amount at gross amount
  if (discountAmount > grossAmount) {
    discountAmount = grossAmount;
  }

  const taxableValue = roundToTwo(Math.max(0, grossAmount - discountAmount));

  const discountedUnitPrice = quantity > 0 ? roundToTwo(taxableValue / quantity) : 0;

  const rateGst = roundToTwo((taxableValue * taxRate) / 100);

  let lineTax = rateGst;
  if (input.suppliedTaxAmount !== undefined && input.suppliedTaxAmount !== null && !isNaN(Number(input.suppliedTaxAmount))) {
    const supplied = roundToTwo(Number(input.suppliedTaxAmount));
    if (taxRate > 0) {
      // 1-rupee tolerance for rounding variations from OCR or unit-rate splits
      if (Math.abs(supplied - rateGst) <= 1.0) {
        lineTax = supplied;
      } else {
        lineTax = rateGst;
      }
    } else {
      lineTax = supplied;
    }
  }

  // Half split for CGST/SGST by default
  const cgstAmount = roundToTwo(lineTax / 2);
  const sgstAmount = roundToTwo(lineTax - cgstAmount); // Exact sum preservation
  const igstAmount = 0;

  const totalCost = roundToTwo(taxableValue + lineTax);

  return {
    quantity,
    rate,
    grossAmount,
    discountPercent,
    discountAmount,
    taxableValue,
    discountedUnitPrice,
    taxRate,
    rateGst,
    lineTax,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalCost,
  };
};

export interface PurchaseTotalsCalculationInput {
  items: LineItemCalculationResult[];
  suppliedCgst?: number;
  suppliedSgst?: number;
  suppliedIgst?: number;
  roundOff?: number;
}

export interface PurchaseTotalsResult {
  grossTotal: number;
  totalDiscount: number;
  subtotal: number; // sum of taxable values
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  grandTotal: number;
}

export const calculatePurchaseTotals = (input: PurchaseTotalsCalculationInput): PurchaseTotalsResult => {
  const { items, suppliedCgst, suppliedSgst, suppliedIgst, roundOff = 0 } = input;

  const grossTotal = roundToTwo(items.reduce((sum, item) => sum + item.grossAmount, 0));
  const totalDiscount = roundToTwo(items.reduce((sum, item) => sum + item.discountAmount, 0));
  const subtotal = roundToTwo(items.reduce((sum, item) => sum + item.taxableValue, 0));
  const calculatedTax = roundToTwo(items.reduce((sum, item) => sum + item.lineTax, 0));

  let cgst = roundToTwo(items.reduce((sum, item) => sum + item.cgstAmount, 0));
  let sgst = roundToTwo(items.reduce((sum, item) => sum + item.sgstAmount, 0));
  let igst = 0;

  if (suppliedIgst !== undefined && suppliedIgst !== null && !isNaN(Number(suppliedIgst)) && Number(suppliedIgst) > 0) {
    igst = roundToTwo(Number(suppliedIgst));
    cgst = 0;
    sgst = 0;
  } else {
    if (suppliedCgst !== undefined && !isNaN(Number(suppliedCgst))) {
      cgst = roundToTwo(Number(suppliedCgst));
    }
    if (suppliedSgst !== undefined && !isNaN(Number(suppliedSgst))) {
      sgst = roundToTwo(Number(suppliedSgst));
    }
  }

  const taxAmount = igst > 0 ? igst : roundToTwo(cgst + sgst);
  const effectiveTax = Math.abs(taxAmount - calculatedTax) <= 1.5 ? taxAmount : calculatedTax;

  const totalAmount = roundToTwo(subtotal + effectiveTax + roundOff);

  return {
    grossTotal,
    totalDiscount,
    subtotal,
    taxAmount: effectiveTax,
    cgst,
    sgst,
    igst,
    totalAmount,
    grandTotal: totalAmount,
  };
};
