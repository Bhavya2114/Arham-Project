/**
 * Financial Calculation Utilities for Purchases
 * Provides consistent rounding and discount calculation logic across frontend components.
 */

/**
 * Safely converts any value to a finite number, returning a fallback if invalid or non-finite.
 */
export const toSafeNumber = (val, fallback = 0) => {
  if (val === undefined || val === null || val === '') return fallback;
  const num = typeof val === 'number' ? val : Number(String(val).replace(/[₹,%\s]/g, '').trim());
  return Number.isFinite(num) ? num : fallback;
};

export const roundToTwo = (num) => {
  return Math.round((toSafeNumber(num) + Number.EPSILON) * 100) / 100;
};

/**
 * Safely formats any value as a 2-decimal currency string without throwing TypeError on undefined/null.
 */
export const formatCurrency = (val, fallback = '0.00') => {
  const safe = toSafeNumber(val, null);
  if (safe === null) return fallback;
  return safe.toFixed(2);
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
export const calculateLineItem = (input = {}) => {
  const quantity = Math.max(0, toSafeNumber(input.quantity ?? input.qty, 0));
  const rate = Math.max(0, toSafeNumber(input.rate ?? input.unitPrice ?? input.purchasePrice ?? input.price, 0));
  const taxRate = Math.max(0, toSafeNumber(input.taxRate ?? input.gstPercent ?? input.gstRate ?? input.gstPct, 0));

  const grossAmount = roundToTwo(quantity * rate);

  let discountPercent = Math.max(0, Math.min(100, toSafeNumber(input.discountPercent ?? input.discount, 0)));
  let discountAmount = Math.max(0, toSafeNumber(input.discountAmount, 0));

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
  const discountedUnitPrice = quantity > 0 ? roundToTwo(taxableValue / quantity) : rate;

  const rateGst = roundToTwo((taxableValue * taxRate) / 100);

  let lineTax = rateGst;
  const suppliedTax = toSafeNumber(input.suppliedTaxAmount ?? input.taxAmount, NaN);
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

  // An IGST line carries the whole tax as IGST; CGST/SGST stay 0
  const isIgstLine = input.igstAmount !== undefined && input.igstAmount !== null && Number(input.igstAmount) > 0;
  const igstAmount = isIgstLine ? lineTax : 0;

  const cgstAmount = isIgstLine
    ? 0
    : input.cgstAmount !== undefined && input.cgstAmount !== null && Number(input.cgstAmount) > 0
      ? roundToTwo(Number(input.cgstAmount))
      : roundToTwo(lineTax / 2);

  const sgstAmount = isIgstLine
    ? 0
    : input.sgstAmount !== undefined && input.sgstAmount !== null && Number(input.sgstAmount) > 0
      ? roundToTwo(Number(input.sgstAmount))
      : roundToTwo(lineTax - cgstAmount);

  const totalCost = roundToTwo(taxableValue + lineTax);

  return {
    quantity,
    qty: quantity,
    rate,
    price: rate,
    unitPrice: rate,
    grossAmount,
    gross: grossAmount,
    discountPercent,
    discPct: discountPercent,
    discountAmount,
    taxableValue,
    taxableAmount: taxableValue,
    discountedUnitPrice,
    taxRate,
    gstRate: taxRate,
    gstPercent: taxRate,
    gstPct: taxRate,
    rateGst,
    lineTax,
    taxAmount: lineTax,
    totalGstAmount: lineTax,
    totalGst: lineTax,
    cgstAmount,
    cgst: cgstAmount,
    sgstAmount,
    sgst: sgstAmount,
    igstAmount,
    igst: igstAmount,
    totalCost,
    lineTotal: totalCost,
    total: totalCost,
  };
};

export const parseExplicitRoundOff = (val) => {
  if (val === undefined || val === null) return null;

  if (typeof val === 'number') {
    if (isNaN(val) || Math.abs(val) < 0.0001) return null;
    const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
    return {
      amount: rounded,
      type: rounded < 0 ? 'less' : 'add',
    };
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    const isNegative = /less|deduct|minus|\(-|\(\s*-\s*\)/i.test(trimmed) || trimmed.startsWith('-');
    const match = trimmed.match(/[-+]?\s*\d+(?:\.\d+)?/);
    if (!match) return null;

    let num = parseFloat(match[0].replace(/\s+/g, ''));
    if (isNaN(num) || Math.abs(num) < 0.0001) return null;

    if (isNegative && num > 0) num = -num;
    const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
    return {
      amount: rounded,
      type: rounded < 0 ? 'less' : 'add',
    };
  }

  return null;
};

export const calculatePurchaseTotals = (input = {}) => {
  const items = Array.isArray(input) ? input : (input?.items || []);
  const suppliedCgst = Array.isArray(input) ? undefined : input?.suppliedCgst;
  const suppliedSgst = Array.isArray(input) ? undefined : input?.suppliedSgst;
  const suppliedIgst = Array.isArray(input) ? undefined : input?.suppliedIgst;

  // Primary field priority: roundedOffAmount takes precedence over legacy roundOff
  const rawRound = Array.isArray(input)
    ? null
    : (input?.roundedOffAmount !== undefined && input?.roundedOffAmount !== null ? input?.roundedOffAmount : input?.roundOff);
  const parsedRound = parseExplicitRoundOff(rawRound);
  const roundOff = parsedRound ? parsedRound.amount : 0;

  if (!items || items.length === 0) {
    return {
      grossTotal: 0,
      totalDiscount: 0,
      subtotal: 0,
      taxableTotal: 0,
      taxAmount: 0,
      totalTax: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      roundedOffAmount: parsedRound ? parsedRound.amount : null,
      roundedOffType: parsedRound ? parsedRound.type : null,
      roundOff: parsedRound ? parsedRound.amount : null,
      totalAmount: 0,
      grandTotal: 0,
    };
  }

  const grossTotal = roundToTwo(items.reduce((sum, item) => sum + toSafeNumber(item.grossAmount ?? item.gross ?? ((item.quantity || item.qty || 0) * (item.unitPrice || item.price || 0))), 0));
  const totalDiscount = roundToTwo(items.reduce((sum, item) => sum + toSafeNumber(item.discountAmount), 0));
  const subtotal = roundToTwo(items.reduce((sum, item) => sum + toSafeNumber(item.taxableValue ?? item.taxableAmount), 0));
  const calculatedTax = roundToTwo(items.reduce((sum, item) => sum + toSafeNumber(item.lineTax ?? item.taxAmount ?? item.totalGst), 0));

  let cgst = roundToTwo(items.reduce((sum, item) => sum + toSafeNumber(item.cgstAmount ?? item.cgst), 0));
  let sgst = roundToTwo(items.reduce((sum, item) => sum + toSafeNumber(item.sgstAmount ?? item.sgst), 0));
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
    roundedOffAmount: parsedRound ? parsedRound.amount : null,
    roundedOffType: parsedRound ? parsedRound.type : null,
    roundOff: parsedRound ? parsedRound.amount : null,
    totalAmount,
    grandTotal: totalAmount,
  };
};
