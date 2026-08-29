import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  supplier: z.string().optional(),
  costPrice: z.coerce.number().nonnegative('Cost price must be non-negative').optional().default(0),
  unitPrice: z.coerce.number().nonnegative('Unit price must be non-negative').optional().default(0),
  sellingPrice: z.coerce.number().nonnegative('Selling price must be non-negative').optional(),
  gstRate: z.coerce.number().nonnegative('GST rate must be non-negative').optional().default(0),
  currentStock: z.coerce.number().int().nonnegative('Current stock must be non-negative').optional().default(0),
  minStockQuantity: z.coerce.number().int().nonnegative('Minimum stock quantity must be non-negative').optional().default(5),
  location: z.string().optional().default('Main Warehouse'),
  unit: z.string().optional().default('pcs'),
});

export const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  supplier: z.string().optional(),
  costPrice: z.coerce.number().nonnegative('Cost price must be non-negative').optional(),
  unitPrice: z.coerce.number().nonnegative('Unit price must be non-negative'),
  sellingPrice: z.coerce.number().nonnegative('Selling price must be non-negative').optional(),
  gstRate: z.coerce.number().nonnegative('GST rate must be non-negative').optional(),
  minStockQuantity: z.coerce.number().int().nonnegative('Minimum stock quantity must be non-negative'),
  location: z.string().min(1, 'Location is required'),
  unit: z.string().optional(),
  currentStock: z.any().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
