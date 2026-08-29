import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').trim(),
  companyName: z.string().trim().optional(),
  mobile: z.string().min(1, 'Mobile number is required').trim(),
  email: z.string().email('Invalid email format').trim().optional().or(z.literal('')),
  gstNumber: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional(),
});

export const updateSupplierSchema = createSupplierSchema;

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
