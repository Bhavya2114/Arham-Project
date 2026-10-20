import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required'),
  companyName: z.string().trim().optional(),
  contactPerson: z.string().trim().optional().or(z.literal('')),
  mobile: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email format').optional().or(z.literal('')),
  gstNumber: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional(),
});

export const updateSupplierSchema = createSupplierSchema;

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
