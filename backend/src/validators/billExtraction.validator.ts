import { z } from 'zod';

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
  quantity: z.coerce.number().nonnegative().optional().default(0),
  unit: z.string().nullable().optional().default(null),
  unitPrice: z.coerce.number().nonnegative().optional().default(0),
  discountPercent: z.coerce.number().nonnegative().optional().default(0),
  discountAmount: z.coerce.number().nonnegative().optional().default(0),
  taxableAmount: z.coerce.number().nonnegative().optional().default(0),
  gstRate: z.coerce.number().nonnegative().optional().default(0),
  cgstRate: z.coerce.number().nonnegative().optional().default(0),
  cgstAmount: z.coerce.number().nonnegative().optional().default(0),
  sgstRate: z.coerce.number().nonnegative().optional().default(0),
  sgstAmount: z.coerce.number().nonnegative().optional().default(0),
  igstRate: z.coerce.number().nonnegative().optional().default(0),
  igstAmount: z.coerce.number().nonnegative().optional().default(0),
  lineTotal: z.coerce.number().nonnegative().optional().default(0),
});

export const extractedTotalsSchema = z.object({
  taxableAmount: z.coerce.number().optional().default(0),
  totalDiscount: z.coerce.number().optional().default(0),
  totalCGST: z.coerce.number().optional().default(0),
  totalSGST: z.coerce.number().optional().default(0),
  totalIGST: z.coerce.number().optional().default(0),
  totalGST: z.coerce.number().optional().default(0),
  roundOff: z.coerce.number().optional().default(0),
  grandTotal: z.coerce.number().optional().default(0),
});

export const extractedBillSchema = z.object({
  supplier: extractedSupplierSchema,
  invoice: extractedInvoiceSchema,
  items: z.array(extractedItemSchema).default([]),
  totals: extractedTotalsSchema,
});

export type ExtractedBillData = z.infer<typeof extractedBillSchema>;
