import { z } from 'zod';

const cleanNumber = (val: any, defaultVal = 0): number => {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[₹,%]/g, '').trim();
    const num = Number(cleaned);
    return isNaN(num) ? defaultVal : num;
  }
  return defaultVal;
};

export const extractedSupplierSchema = z.object({
  supplierName: z.string().nullable().optional().default(null),
  supplierGSTIN: z.string().nullable().optional().default(null),
  supplierAddress: z.string().nullable().optional().default(null),
  supplierState: z.string().nullable().optional().default(null),
  supplierStateCode: z.string().nullable().optional().default(null),
  supplierPhone: z.string().nullable().optional().default(null),
});

export const extractedInvoiceSchema = z.object({
  invoiceNumber: z.string().nullable().optional().default(null),
  invoiceDate: z.string().nullable().optional().default(null),
  poNumber: z.string().nullable().optional().default(null),
  paymentTerms: z.string().nullable().optional().default(null),
  deliveryNoteNo: z.string().nullable().optional().default(null),
  deliveryNoteDate: z.string().nullable().optional().default(null),
  ewayBillNo: z.string().nullable().optional().default(null),
  placeOfSupply: z.string().nullable().optional().default(null),
  irn: z.string().nullable().optional().default(null),
  acknowledgementNumber: z.string().nullable().optional().default(null),
  acknowledgementDate: z.string().nullable().optional().default(null),
});

export const extractedItemSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  hsnSac: z.string().nullable().optional().default(null),
  quantity: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  unit: z.string().nullable().optional().default(null),
  unitPrice: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  discountPercent: z.preprocess((v) => cleanNumber(v, 0), z.number().min(0).max(100).optional().default(0)),
  discountAmount: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  taxableAmount: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  gstRate: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  cgstRate: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  cgstAmount: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  sgstRate: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  sgstAmount: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  igstRate: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  igstAmount: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  taxAmount: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional()),
  totalAmount: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional()),
  lineTotal: z.preprocess((v) => cleanNumber(v, 0), z.number().nonnegative().optional().default(0)),
  // Allow alternative alias names
  discount: z.any().optional(),
  discount_percent: z.any().optional(),
  discountPercentage: z.any().optional(),
  discount_amount: z.any().optional(),
}).transform((item) => {
  let discPct = item.discountPercent;
  if ((discPct === 0 || discPct === undefined) && (item.discount || item.discount_percent || item.discountPercentage)) {
    discPct = cleanNumber(item.discount || item.discount_percent || item.discountPercentage, 0);
  }

  let discAmt = item.discountAmount;
  if ((discAmt === 0 || discAmt === undefined) && item.discount_amount) {
    discAmt = cleanNumber(item.discount_amount, 0);
  }

  const gross = item.quantity * item.unitPrice;
  if (discPct === 0 && discAmt > 0 && gross > 0) {
    discPct = Math.round(((discAmt / gross) * 100) * 100) / 100;
  }
  if (discPct > 0 && (!discAmt || discAmt === 0) && gross > 0) {
    discAmt = Math.round(((gross * discPct) / 100) * 100) / 100;
  }

  let taxable = item.taxableAmount;
  if (!taxable || taxable === 0) {
    taxable = Math.max(0, Math.round((gross - discAmt) * 100) / 100);
  }

  return {
    ...item,
    discountPercent: discPct,
    discountAmount: discAmt,
    taxableAmount: taxable,
  };
});

/**
 * Safely parses an explicit rounded-off value and its sign.
 * Handles numbers and strings such as:
 * - 0.37, +0.37, -0.50
 * - "Add : Rounded Off (+) 0.37"
 * - "Less: Rounded Off (-) 0.50"
 * - "Round Off 0.37"
 * Returns null if absent, 0, "0.00", or if text exists without a numeric value.
 */
export const parseExplicitRoundOff = (val: any): { amount: number; type: 'add' | 'less' } | null => {
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

    // Check if label explicitly specifies deduction / subtraction
    const isNegative = /less|deduct|minus|\(-|\(\s*-\s*\)/i.test(trimmed) || trimmed.startsWith('-');

    // Match numeric digits (e.g. 0.37 or 12.00)
    const match = trimmed.match(/[-+]?\s*\d+(?:\.\d+)?/);
    if (!match) {
      // Label present with no numeric value (e.g. "Rounded Off") -> return null
      return null;
    }

    let num = parseFloat(match[0].replace(/\s+/g, ''));
    if (isNaN(num) || Math.abs(num) < 0.0001) {
      return null;
    }

    if (isNegative && num > 0) {
      num = -num;
    }

    const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
    return {
      amount: rounded,
      type: rounded < 0 ? 'less' : 'add',
    };
  }

  return null;
};

export const extractedTotalsSchema = z.object({
  taxableAmount: z.preprocess((v) => cleanNumber(v, 0), z.number().optional().default(0)),
  subtotal: z.preprocess((v) => cleanNumber(v, 0), z.number().optional()),
  totalDiscount: z.preprocess((v) => cleanNumber(v, 0), z.number().optional().default(0)),
  totalCGST: z.preprocess((v) => cleanNumber(v, 0), z.number().optional().default(0)),
  totalSGST: z.preprocess((v) => cleanNumber(v, 0), z.number().optional().default(0)),
  totalIGST: z.preprocess((v) => cleanNumber(v, 0), z.number().optional().default(0)),
  totalGST: z.preprocess((v) => cleanNumber(v, 0), z.number().optional().default(0)),
  cgst: z.preprocess((v) => cleanNumber(v, 0), z.number().optional()),
  sgst: z.preprocess((v) => cleanNumber(v, 0), z.number().optional()),
  igst: z.preprocess((v) => cleanNumber(v, 0), z.number().optional()),
  totalTax: z.preprocess((v) => cleanNumber(v, 0), z.number().optional()),
  roundOff: z.any().optional(),
  roundedOffAmount: z.any().optional(),
  roundedOffType: z.enum(['add', 'less']).nullable().optional(),
  grandTotal: z.preprocess((v) => cleanNumber(v, 0), z.number().optional().default(0)),
  round_off: z.any().optional(),
  rounding: z.any().optional(),
}).transform((totals) => {
  // Primary field priority: roundedOffAmount takes precedence over legacy roundOff / round_off / rounding
  const rawRound = totals.roundedOffAmount !== undefined && totals.roundedOffAmount !== null
    ? totals.roundedOffAmount
    : (totals.roundOff ?? totals.round_off ?? totals.rounding);

  const parsed = parseExplicitRoundOff(rawRound);
  const finalAmount = parsed ? parsed.amount : null;
  const finalType = parsed ? (totals.roundedOffType || parsed.type) : null;

  return {
    ...totals,
    roundedOffAmount: finalAmount,
    roundedOffType: finalType,
    // Keep roundOff as legacy mirror of roundedOffAmount
    roundOff: finalAmount,
  };
});

export type ExtractedTotals = {
  taxableAmount: number;
  subtotal?: number;
  totalDiscount: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalGST: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalTax?: number;
  roundedOffAmount?: number | null;
  roundedOffType?: 'add' | 'less' | null;
  roundOff?: number | null;
  grandTotal: number;
  round_off?: any;
  rounding?: any;
};

export const extractedBillSchema = z.object({
  supplier: extractedSupplierSchema,
  invoice: extractedInvoiceSchema,
  items: z.array(extractedItemSchema).default([]),
  totals: extractedTotalsSchema,
});

export type ExtractedBillData = {
  supplier: z.infer<typeof extractedSupplierSchema>;
  invoice: z.infer<typeof extractedInvoiceSchema>;
  items: Array<z.infer<typeof extractedItemSchema>>;
  totals: ExtractedTotals;
};

