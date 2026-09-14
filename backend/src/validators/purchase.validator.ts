import { z } from 'zod';

const optionalString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined));

export const newSupplierSchema = z
  .object({
    name: z.string().trim().min(1, 'Supplier name is required'),
    gstNumber: optionalString,
    mobile: optionalString,
    email: optionalString,
    address: optionalString,
    companyName: optionalString,
    state: optionalString,
    stateCode: optionalString,
  })
  .optional()
  .nullable();

export const newProductSchema = z
  .object({
    name: z.string().trim().min(1, 'Product name is required'),
    unit: z.string().trim().optional().default('Pcs'),
    costPrice: z.coerce.number().nonnegative().optional().default(0),
    unitPrice: z.coerce.number().nonnegative().optional(),
    gstRate: z.coerce.number().nonnegative().optional().default(18),
    sku: optionalString,
    category: optionalString,
    hsnCode: optionalString,
  })
  .optional()
  .nullable();

export const purchaseItemSchema = z
  .object({
    productId: optionalString,
    newProduct: newProductSchema,
    purchasePrice: z.coerce.number().nonnegative('Purchase price must be non-negative'),
    originalPrice: z.coerce.number().nonnegative('Original price must be non-negative').optional(),
    discountPercent: z.coerce
      .number()
      .min(0, 'Discount percent cannot be negative')
      .max(100, 'Discount percent cannot exceed 100%')
      .optional()
      .default(0),
    discountAmount: z.coerce.number().nonnegative('Discount amount must be non-negative').optional().default(0),
    discountedPrice: z.coerce.number().nonnegative('Discounted price must be non-negative').optional(),
    taxableAmount: z.coerce.number().nonnegative('Taxable amount must be non-negative').optional(),
    quantity: z.coerce.number().positive('Quantity must be at least 1'),
    taxRate: z.coerce.number().nonnegative('Tax rate must be non-negative').optional().default(0),
    taxAmount: z.coerce.number().nonnegative('Tax amount must be non-negative').optional(),
    unit: z.string().trim().optional(),
  })
  .refine(
    (data) => Boolean((data.productId && data.productId.trim().length > 0) || (data.newProduct && data.newProduct.name && data.newProduct.name.trim().length > 0)),
    {
      message: 'Either an existing product ID or new product details must be provided.',
      path: ['productId'],
    }
  );

export const createPurchaseSchema = z
  .object({
    supplierId: optionalString,
    newSupplier: newSupplierSchema,
    purchaseDate: optionalString,
    invoiceDate: optionalString,
    invoiceNumber: z.string().trim().optional(),
    poNumber: optionalString,
    paymentTerms: optionalString,
    deliveryNoteNo: optionalString,
    deliveryNoteDate: optionalString,
    ewayBillNo: optionalString,
    placeOfSupply: optionalString,
    totalDiscount: z.coerce.number().nonnegative('Total discount must be non-negative').optional().default(0),
    cgst: z.coerce.number().nonnegative('CGST must be non-negative').optional(),
    sgst: z.coerce.number().nonnegative('SGST must be non-negative').optional(),
    igst: z.coerce.number().nonnegative('IGST must be non-negative').optional(),
    items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
    notes: optionalString,
  })
  .refine(
    (data) => Boolean((data.supplierId && data.supplierId.trim().length > 0) || (data.newSupplier && data.newSupplier.name && data.newSupplier.name.trim().length > 0)),
    {
      message: 'Either an existing supplier ID or new supplier details must be provided.',
      path: ['supplierId'],
    }
  );

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
