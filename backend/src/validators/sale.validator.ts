import { z } from 'zod';

export const saleItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  sellingPrice: z.coerce.number().positive('Selling price must be greater than 0').optional(),
  gstRate: z.coerce.number().min(0, 'GST rate must be non-negative').optional(),
  quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
});

export const createSaleSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  saleDate: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  paymentStatus: z.enum(['PAID', 'PENDING', 'CANCELLED']).optional().default('PAID'),
  paymentMode: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER']).optional().default('CASH'),
  notes: z.string().trim().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
