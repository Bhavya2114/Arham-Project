import { z } from 'zod';
import mongoose from 'mongoose';

export const createLabourPaymentSchema = z.object({
  labourId: z
    .string()
    .trim()
    .min(1, 'Labour ID is required')
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid labour ID format',
    }),
  amount: z.coerce
    .number()
    .positive('Payment amount must be greater than 0'),
  paymentDate: z
    .string()
    .trim()
    .min(1, 'Payment date is required')
    .refine((val) => !isNaN(new Date(val).getTime()), {
      message: 'Invalid payment date format',
    }),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER'], {
    message: 'Invalid payment method. Allowed: CASH, UPI, BANK_TRANSFER',
  }),
  notes: z.string().trim().optional(),
});

export const updateLabourPaymentSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Payment amount must be greater than 0')
    .optional(),
  paymentDate: z
    .string()
    .trim()
    .min(1, 'Payment date cannot be empty')
    .refine((val) => !isNaN(new Date(val).getTime()), {
      message: 'Invalid payment date format',
    })
    .optional(),
  paymentMethod: z
    .enum(['CASH', 'UPI', 'BANK_TRANSFER'], {
      message: 'Invalid payment method. Allowed: CASH, UPI, BANK_TRANSFER',
    })
    .optional(),
  notes: z.string().trim().optional(),
});

export type CreateLabourPaymentInput = z.infer<typeof createLabourPaymentSchema>;
export type UpdateLabourPaymentInput = z.infer<typeof updateLabourPaymentSchema>;
