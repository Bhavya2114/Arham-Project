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
    unitPrice: z.coerce.number().nonnegative().optional().default(0),
    sellingPrice: z.coerce.number().nonnegative().optional().default(0),
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
    sellingPrice: z.coerce.number().nonnegative('Selling price must be non-negative').optional(),
    quantity: z.coerce.number().positive('Quantity must be at least 1'),
    taxRate: z.coerce.number().nonnegative('Tax rate must be non-negative').optional().default(0),
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
