const round = (n: number, places = 2) => {
  const f = 10 ** places;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export interface BillLineForNormalization {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxableAmount?: number;
  gstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  lineTotal?: number;
  [key: string]: any;
}

/**
 * Some bills print a rate that already includes GST: qty x rate equals the line total, and the
 * taxable amount is smaller (e.g. 100 x 60 = 6,000 total, taxable 5,084.75 at 18%).
 * When that is the case the rate and discount are scaled down so qty x rate - discount equals the
 * printed taxable amount. Returns true when the line was changed.
 */
export const normalizeTaxInclusiveLine = (item: BillLineForNormalization): boolean => {
  const qty = Number(item.quantity || 0);
  const rate = Number(item.unitPrice || 0);
  const discount = Number(item.discountAmount || 0);
  const lineValue = round(qty * rate - discount); // what the bill calls this line before tax
  if (qty <= 0 || rate <= 0 || lineValue <= 0) return false;

  const igst = Number(item.igstAmount || 0);
  const taxSum = igst > 0 ? igst : Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0);
  const gstRate = Number(item.gstRate || 0) ||
    Number(item.igstRate || 0) ||
    Number(item.cgstRate || 0) + Number(item.sgstRate || 0);
  if (gstRate <= 0 && taxSum <= 0) return false;

  const printedTaxable = Number(item.taxableAmount || 0);
  const printedTotal = Number(item.lineTotal || 0);
  let taxable = 0;

  if (printedTaxable > 0 && Math.abs(printedTaxable - lineValue) > 1) {
    // Printed taxable is smaller; it must be the rate with GST taken out
    const withGst = gstRate > 0 ? printedTaxable * (1 + gstRate / 100) : printedTaxable + taxSum;
    if (Math.abs(withGst - lineValue) <= 1) taxable = printedTaxable;
  } else if (printedTotal > 0 && Math.abs(printedTotal - lineValue) <= 1 && taxSum > 0) {
    // Reader copied qty x rate as taxable, but the line total equals it and tax is printed separately
    const candidate = round(lineValue - taxSum);
    const expectedTax = gstRate > 0 ? candidate * (gstRate / 100) : taxSum;
    if (candidate > 0 && Math.abs(expectedTax - taxSum) <= 1) taxable = candidate;
  }

  if (taxable <= 0) return false;

  const factor = taxable / lineValue;
  item.printedUnitPrice = rate;
  item.rateIncludesGst = true;
  item.unitPrice = round(rate * factor, 4);
  item.discountAmount = round(discount * factor);
  item.taxableAmount = round(taxable);
  if (!printedTotal) item.lineTotal = lineValue;
  return true;
};

/**
 * On an IGST bill every line's tax is IGST and CGST/SGST are zero, so the screens never show all three.
 * Call after normalizeTaxInclusiveLine so a missing IGST amount is worked out on the right taxable value.
 */
export const normalizeIgstBill = (
  items: BillLineForNormalization[],
  totals: { totalIGST?: number; totalCGST?: number; totalSGST?: number }
): boolean => {
  const isIgstBill = Number(totals.totalIGST || 0) > 0 || items.some((i) => Number(i.igstAmount || 0) > 0);
  if (!isIgstBill) return false;

  for (const item of items) {
    let igst = Number(item.igstAmount || 0);
    if (igst <= 0) igst = Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0);
    const rate = Number(item.gstRate || 0) || Number(item.igstRate || 0) || Number(item.cgstRate || 0) + Number(item.sgstRate || 0);
    if (igst <= 0 && rate > 0) igst = Number(item.taxableAmount || 0) * (rate / 100);
    item.igstAmount = round(igst);
    if (rate > 0) item.igstRate = rate;
    item.cgstAmount = 0;
    item.sgstAmount = 0;
    item.cgstRate = 0;
    item.sgstRate = 0;
  }
  totals.totalCGST = 0;
  totals.totalSGST = 0;
  return true;
};
