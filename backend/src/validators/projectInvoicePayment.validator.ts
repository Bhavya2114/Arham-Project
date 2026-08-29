import { z } from 'zod';

const optionalString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined));

export const createProjectInvoicePaymentSchema = z.object({
  invoice: z.string().trim().min(1, 'Invoice ID is required'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: optionalString,
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER']),
  transactionReference: optionalString,
  notes: optionalString,
});

export type CreateProjectInvoicePaymentInput = z.infer<
  typeof createProjectInvoicePaymentSchema
>;
