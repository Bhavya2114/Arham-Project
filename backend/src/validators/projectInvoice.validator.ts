import { z } from 'zod';

const optionalString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined));

export const projectInvoiceItemSchema = z.object({
  type: z.enum(['MATERIAL', 'EXPENSE', 'SERVICE', 'OTHER']),
  sourceType: z.enum(['MATERIAL_CONSUMPTION', 'PROJECT_EXPENSE', 'MANUAL']),
  sourceId: optionalString,
  description: z.string().trim().min(1, 'Item description is required'),
  product: optionalString,
  quantity: z.coerce.number().positive('Quantity must be greater than 0').optional().default(1),
  unit: optionalString,
  rate: z.coerce.number().nonnegative('Rate cannot be negative'),
  gstRate: z.coerce.number().nonnegative('GST rate cannot be negative').optional().default(0),
});

export const createProjectInvoiceSchema = z.object({
  project: z.string().trim().min(1, 'Project ID is required'),
  items: z.array(projectInvoiceItemSchema).min(1, 'At least one line item is required'),
  discount: z.coerce.number().nonnegative('Discount cannot be negative').optional().default(0),
  invoiceDate: optionalString,
  dueDate: optionalString,
  notes: optionalString,
});

export type CreateProjectInvoiceInput = z.infer<typeof createProjectInvoiceSchema>;
export type ProjectInvoiceItemInput = z.infer<typeof projectInvoiceItemSchema>;
