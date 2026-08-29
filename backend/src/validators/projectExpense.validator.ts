import { z } from 'zod';

const optionalString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined));

export const EXPENSE_CATEGORIES = [
  'TRANSPORT',
  'LABOUR',
  'MACHINERY_RENTAL',
  'LOADING_UNLOADING',
  'SITE_EXPENSE',
  'MISCELLANEOUS',
  'OTHER',
] as const;

export const createProjectExpenseSchema = z.object({
  project: z.string().trim().min(1, 'Project ID is required'),
  category: z.enum(EXPENSE_CATEGORIES, {
    message: 'Invalid expense category',
  }),
  description: z.string().trim().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  expenseDate: optionalString,
  vendorName: optionalString,
  billNumber: optionalString,
  notes: optionalString,
});

export type CreateProjectExpenseInput = z.infer<typeof createProjectExpenseSchema>;
