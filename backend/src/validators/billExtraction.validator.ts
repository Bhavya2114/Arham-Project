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
  roundOff: z.preprocess((v) => cleanNumber(v, 0), z.number().optional().default(0)),
  grandTotal: z.preprocess((v) => cleanNumber(v, 0), z.number().optional().default(0)),
});

export const extractedBillSchema = z.object({
  supplier: extractedSupplierSchema,
  invoice: extractedInvoiceSchema,
  items: z.array(extractedItemSchema).default([]),
  totals: extractedTotalsSchema,
});

export type ExtractedBillData = z.infer<typeof extractedBillSchema>;

