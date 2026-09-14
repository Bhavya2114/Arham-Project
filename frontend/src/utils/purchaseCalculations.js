/**
 * Financial Calculation Utilities for Purchases
 * Provides consistent rounding and discount calculation logic across frontend components.
 */

export const roundToTwo = (num) => {
  return Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;
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
export const calculateLineItem = (input) => {
  const quantity = Math.max(0, parseFloat(input.quantity) || 0);
  const rate = Math.max(0, parseFloat(input.rate || input.unitPrice || input.purchasePrice) || 0);
  const taxRate = Math.max(0, parseFloat(input.taxRate || input.gstPercent || input.gstRate) || 0);

  const grossAmount = roundToTwo(quantity * rate);

  let discountPercent = parseFloat(input.discountPercent) || 0;
  let discountAmount = parseFloat(input.discountAmount) || 0;

  if (discountPercent > 0) {
    discountAmount = roundToTwo((grossAmount * discountPercent) / 100);
  } else if (discountAmount > 0 && grossAmount > 0) {
    discountPercent = roundToTwo((discountAmount / grossAmount) * 100);
  } else {
    discountPercent = 0;
    discountAmount = 0;
  }

  // Cap discount at gross amount
  if (discountAmount > grossAmount) {
    discountAmount = grossAmount;
  }

  const taxableValue = roundToTwo(Math.max(0, grossAmount - discountAmount));
  const discountedUnitPrice = quantity > 0 ? roundToTwo(taxableValue / quantity) : 0;

  const rateGst = roundToTwo((taxableValue * taxRate) / 100);

  let lineTax = rateGst;
  const suppliedTax = parseFloat(input.suppliedTaxAmount || input.taxAmount);
  if (!isNaN(suppliedTax) && suppliedTax > 0) {
    if (taxRate > 0) {
      if (Math.abs(suppliedTax - rateGst) <= 1.0) {
        lineTax = suppliedTax;
      } else {
        lineTax = rateGst;
      }
    } else {
      lineTax = suppliedTax;
    }
  }

  const cgstAmount = input.cgstAmount !== undefined && input.cgstAmount !== null && Number(input.cgstAmount) > 0
    ? roundToTwo(Number(input.cgstAmount))
    : roundToTwo(lineTax / 2);

  const sgstAmount = input.sgstAmount !== undefined && input.sgstAmount !== null && Number(input.sgstAmount) > 0
    ? roundToTwo(Number(input.sgstAmount))
    : roundToTwo(lineTax - cgstAmount);

  const igstAmount = input.igstAmount !== undefined && input.igstAmount !== null && Number(input.igstAmount) > 0
    ? roundToTwo(Number(input.igstAmount))
    : 0;

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

export const calculatePurchaseTotals = (input) => {
  const items = Array.isArray(input) ? input : (input?.items || []);
  const suppliedCgst = Array.isArray(input) ? undefined : input?.suppliedCgst;
  const suppliedSgst = Array.isArray(input) ? undefined : input?.suppliedSgst;
  const suppliedIgst = Array.isArray(input) ? undefined : input?.suppliedIgst;
  const roundOff = Array.isArray(input) ? 0 : (input?.roundOff || 0);

  const grossTotal = roundToTwo(items.reduce((sum, item) => sum + (item.grossAmount || item.gross || 0), 0));
  const totalDiscount = roundToTwo(items.reduce((sum, item) => sum + (item.discountAmount || 0), 0));
  const subtotal = roundToTwo(items.reduce((sum, item) => sum + (item.taxableValue || item.taxableAmount || 0), 0));
  const calculatedTax = roundToTwo(items.reduce((sum, item) => sum + (item.lineTax || item.taxAmount || item.totalGst || 0), 0));

  let cgst = roundToTwo(items.reduce((sum, item) => sum + (item.cgstAmount || 0), 0));
  let sgst = roundToTwo(items.reduce((sum, item) => sum + (item.sgstAmount || 0), 0));
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
    taxableTotal: subtotal,
    taxAmount: effectiveTax,
    totalTax: effectiveTax,
    cgst,
    sgst,
    igst,
    totalAmount,
    grandTotal: totalAmount,
  };
};
