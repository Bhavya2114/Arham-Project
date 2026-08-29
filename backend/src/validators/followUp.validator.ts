import { z } from 'zod';

export const createFollowUpSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  note: z.string().min(1, 'Note is required'),
});

export const updateFollowUpSchema = z.object({
  note: z.string().min(1, 'Note is required'),
});

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
