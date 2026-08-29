import { z } from 'zod';

const optionalString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined));

export const createMaterialConsumptionSchema = z.object({
  project: z.string().trim().min(1, 'Project ID is required'),
  product: z.string().trim().min(1, 'Product ID is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  billingPrice: z.coerce.number().nonnegative('Billing price cannot be negative').optional(),
  issueDate: optionalString,
  notes: optionalString,
});

export type CreateMaterialConsumptionInput = z.infer<typeof createMaterialConsumptionSchema>;
