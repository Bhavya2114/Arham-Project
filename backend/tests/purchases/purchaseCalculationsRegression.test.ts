/**
 * Regression Test Suite for Purchase Calculations, Defensive Normalization, and Empty State Handling
 *
 * Covers:
 * - toSafeNumber utility with undefined, null, NaN, strings, and fallbacks
 * - Protecting .toFixed() calls against TypeError
 * - calculateLineItem with missing numeric fields
 * - calculateLineItem with undefined discount fields
 * - Valid complete invoice line calculations with 62% discount (Raj Laxmi Enterprises #560)
 * - calculatePurchaseTotals with empty items array
 * - Review page empty state validation guard
 */

export const toSafeNumber = (val: any, fallback = 0): number => {
  if (val === undefined || val === null || val === '') return fallback;
  const num = typeof val === 'number' ? val : Number(String(val).replace(/[₹,%\s]/g, '').trim());
  return Number.isFinite(num) ? num : fallback;
};

export const roundToTwo = (num: number | string | undefined | null): number => {
  return Math.round((toSafeNumber(num) + Number.EPSILON) * 100) / 100;
};

export const formatCurrency = (val: any, fallback = '0.00'): string => {
  const safe = toSafeNumber(val, null as any);
  if (safe === null) return fallback;
  return safe.toFixed(2);
};

export const calculateLineItem = (input: any = {}) => {
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

export const calculatePurchaseTotals = ({
  items = [],
  suppliedCgst = undefined,
  suppliedSgst = undefined,
  suppliedIgst = undefined,
}: any = {}) => {
  if (!items || items.length === 0) {
    return {
      grossTotal: 0,
      totalDiscount: 0,
      taxableTotal: 0,
      subtotal: 0,
      totalTax: 0,
      taxAmount: 0,
      grandTotal: 0,
      totalAmount: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      isIgst: false,
    };
  }

  let grossTotal = 0;
  let totalDiscount = 0;
  let taxableTotal = 0;
  let lineTaxTotal = 0;
  let sumCgst = 0;
  let sumSgst = 0;
  let sumIgst = 0;

  items.forEach((item: any) => {
    const line = calculateLineItem(item);
    grossTotal += line.grossAmount;
    totalDiscount += line.discountAmount;
    taxableTotal += line.taxableValue;
    lineTaxTotal += line.lineTax;
    sumCgst += line.cgstAmount;
    sumSgst += line.sgstAmount;
    sumIgst += line.igstAmount;
  });

  grossTotal = roundToTwo(grossTotal);
  totalDiscount = roundToTwo(totalDiscount);
  taxableTotal = roundToTwo(taxableTotal);

  const numSuppliedCgst = toSafeNumber(suppliedCgst, NaN);
  const numSuppliedSgst = toSafeNumber(suppliedSgst, NaN);
  const numSuppliedIgst = toSafeNumber(suppliedIgst, NaN);

  const hasSuppliedSplit = !isNaN(numSuppliedCgst) || !isNaN(numSuppliedSgst) || !isNaN(numSuppliedIgst);

  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  if (hasSuppliedSplit) {
    totalCgst = !isNaN(numSuppliedCgst) ? roundToTwo(numSuppliedCgst) : 0;
    totalSgst = !isNaN(numSuppliedSgst) ? roundToTwo(numSuppliedSgst) : 0;
    totalIgst = !isNaN(numSuppliedIgst) ? roundToTwo(numSuppliedIgst) : 0;
  } else {
    totalCgst = roundToTwo(sumCgst);
    totalSgst = roundToTwo(sumSgst);
    totalIgst = roundToTwo(sumIgst);
  }

  const splitTaxTotal = roundToTwo(totalCgst + totalSgst + totalIgst);
  const totalTax = splitTaxTotal > 0 ? splitTaxTotal : roundToTwo(lineTaxTotal);
  const grandTotal = roundToTwo(taxableTotal + totalTax);

  return {
    grossTotal,
    totalDiscount,
    taxableTotal,
    subtotal: taxableTotal,
    totalTax,
    taxAmount: totalTax,
    grandTotal,
    totalAmount: grandTotal,
    totalCgst,
    totalSgst,
    totalIgst,
    isIgst: totalIgst > 0 && totalCgst === 0 && totalSgst === 0,
  };
};

describe('Purchase Calculations & Defensive Normalization Regression Tests', () => {
  describe('1. toSafeNumber and .toFixed() protection', () => {
    it('returns fallback 0 when input is undefined, null, empty string, or NaN', () => {
      expect(toSafeNumber(undefined)).toBe(0);
      expect(toSafeNumber(null)).toBe(0);
      expect(toSafeNumber('')).toBe(0);
      expect(toSafeNumber(NaN)).toBe(0);
      expect(toSafeNumber(Infinity)).toBe(0);
      expect(toSafeNumber(-Infinity)).toBe(0);
      expect(toSafeNumber('not-a-number')).toBe(0);
    });

    it('returns custom fallback when specified', () => {
      expect(toSafeNumber(undefined, 1)).toBe(1);
      expect(toSafeNumber(null, 5)).toBe(5);
      expect(toSafeNumber('bad', 99)).toBe(99);
    });

    it('parses formatted numeric strings including currency and commas', () => {
      expect(toSafeNumber('₹1,234.50')).toBe(1234.5);
      expect(toSafeNumber('  560.75  ')).toBe(560.75);
      expect(toSafeNumber('62%')).toBe(62);
    });

    it('ensures every value passed to .toFixed() is a safe number and never throws TypeError', () => {
      const unsafeValues = [undefined, null, '', NaN, 'abc', {}, []];

      for (const val of unsafeValues) {
        expect(() => {
          const safe = toSafeNumber(val);
          safe.toFixed(2);
        }).not.toThrow();

        expect(toSafeNumber(val).toFixed(2)).toBe('0.00');
      }
    });

    it('formatCurrency formats values safely without throwing', () => {
      expect(formatCurrency(123.456)).toBe('123.46');
      expect(formatCurrency(undefined)).toBe('0.00');
      expect(formatCurrency(null)).toBe('0.00');
      expect(formatCurrency('abc', 'N/A')).toBe('N/A');
    });
  });

  describe('2. calculateLineItem defensive normalization', () => {
    it('handles missing/undefined numeric fields safely', () => {
      const result = calculateLineItem({});

      expect(result.quantity).toBe(0);
      expect(result.unitPrice).toBe(0);
      expect(result.discountPercent).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.taxableValue).toBe(0);
      expect(result.taxableAmount).toBe(0);
      expect(result.lineTax).toBe(0);
      expect(result.cgstAmount).toBe(0);
      expect(result.sgstAmount).toBe(0);
      expect(result.igstAmount).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.lineTotal).toBe(0);

      // Verify all properties can safely call .toFixed(2)
      expect(result.taxableAmount.toFixed(2)).toBe('0.00');
      expect(result.lineTotal.toFixed(2)).toBe('0.00');
      expect(result.cgstAmount.toFixed(2)).toBe('0.00');
    });

    it('defaults undefined discount fields to 0 without corrupting calculations', () => {
      const result = calculateLineItem({
        quantity: 10,
        unitPrice: 100,
        // discountPercent & discountAmount omitted
        gstRate: 18,
      });

      expect(result.discountPercent).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.taxableValue).toBe(1000);
      expect(result.taxableAmount).toBe(1000);
      expect(result.discountedUnitPrice).toBe(100);
      expect(result.lineTax).toBe(180);
      expect(result.cgstAmount).toBe(90);
      expect(result.sgstAmount).toBe(90);
      expect(result.totalCost).toBe(1180);
      expect(result.lineTotal).toBe(1180);
    });

    it('accurately calculates 62% discount invoice item (Raj Laxmi Enterprises #560)', () => {
      const result = calculateLineItem({
        quantity: 160,
        unitPrice: 180,
        discountPercent: 62,
        gstRate: 18,
      });

      expect(result.grossAmount).toBe(28800);
      expect(result.discountAmount).toBe(17856);
      expect(result.taxableValue).toBe(10944);
      expect(result.taxableAmount).toBe(10944);
      expect(result.discountedUnitPrice).toBe(68.4);
      expect(result.lineTax).toBe(1969.92);
      expect(result.cgstAmount).toBe(984.96);
      expect(result.sgstAmount).toBe(984.96);
      expect(result.totalCost).toBe(12913.92);
      expect(result.lineTotal).toBe(12913.92);

      // Verify .toFixed(2) formatting exactly matches expectations
      expect(result.taxableAmount.toFixed(2)).toBe('10944.00');
      expect(result.discountedUnitPrice.toFixed(2)).toBe('68.40');
      expect(result.cgstAmount.toFixed(2)).toBe('984.96');
      expect(result.sgstAmount.toFixed(2)).toBe('984.96');
      expect(result.lineTotal.toFixed(2)).toBe('12913.92');
    });
  });

  describe('3. calculatePurchaseTotals with empty item array & empty state', () => {
    it('returns clean finite zeros when items array is empty', () => {
      const totals = calculatePurchaseTotals({ items: [] });

      expect(totals.grossTotal).toBe(0);
      expect(totals.totalDiscount).toBe(0);
      expect(totals.taxableTotal).toBe(0);
      expect(totals.totalTax).toBe(0);
      expect(totals.grandTotal).toBe(0);
      expect(totals.totalCgst).toBe(0);
      expect(totals.totalSgst).toBe(0);
      expect(totals.totalIgst).toBe(0);

      // Verify .toFixed(2) works on all totals
      expect(totals.grossTotal.toFixed(2)).toBe('0.00');
      expect(totals.totalDiscount.toFixed(2)).toBe('0.00');
      expect(totals.taxableTotal.toFixed(2)).toBe('0.00');
      expect(totals.totalTax.toFixed(2)).toBe('0.00');
      expect(totals.grandTotal.toFixed(2)).toBe('0.00');
    });

    it('empty state guard detects empty/missing items in ReviewPurchase', () => {
      // Logic mirrored from ReviewPurchase.jsx empty-state guard
      const isReviewValid = (formData: any) => {
        const rawItems = formData && Array.isArray(formData.items) ? formData.items : [];
        return rawItems.length > 0 && rawItems.some(
          (it: any) => it && (it.productName || it.newProduct?.name || it.productId || it.unitPrice !== undefined || it.quantity !== undefined)
        );
      };

      expect(isReviewValid(null)).toBe(false);
      expect(isReviewValid({})).toBe(false);
      expect(isReviewValid({ items: [] })).toBe(false);
      expect(isReviewValid({ items: [null, undefined] })).toBe(false);
      expect(isReviewValid({ items: [{}] })).toBe(false);

      // Valid items return true
      expect(isReviewValid({ items: [{ productName: 'Pipe', quantity: 5, unitPrice: 100 }] })).toBe(true);
    });
  });
});
