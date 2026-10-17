import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Validator for Project Assignment:
 * POST /api/projects/:projectId/labours
 * Assigns an existing Labour worker to an active Project.
 */
export const assignLabourToProjectSchema = z.object({
  labourId: z
    .string()
    .trim()
    .min(1, 'Labour ID is required')
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid labour ID format',
    }),
  startDate: z.any().optional(),
});

/**
 * Validator for Labour Master Record Creation:
 * POST /api/labours
 * User enters ONLY worker info: name, address (or location), mobile, dailyWage.
 * Project ID and startDate are optional (unassigned master record by default).
 */
export const createLabourSchema = z
  .object({
    name: z.string().trim().min(1, 'Labour name is required'),
    mobile: z.string().trim().min(1, 'Mobile number is required'),
    location: z.string().trim().min(1, 'Address is required').optional(),
    address: z.string().trim().min(1, 'Address is required').optional(),
    projectId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine((val) => !val || mongoose.Types.ObjectId.isValid(val), {
        message: 'Invalid project ID format',
      }),
    dailyWage: z.coerce.number().positive('Daily wage must be greater than 0'),
    startDate: z.any().optional().nullable(),
  })
  .refine((data) => !!(data.location?.trim() || data.address?.trim()), {
    message: 'Address is required',
    path: ['address'],
  })
  .transform((data) => ({
    ...data,
    location: (data.location || data.address || '').trim(),
    address: (data.address || data.location || '').trim(),
  }));

export const updateLabourSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').optional(),
  mobile: z.string().trim().min(1, 'Mobile cannot be empty').optional(),
  location: z.string().trim().min(1, 'Location cannot be empty').optional(),
  address: z.string().trim().min(1, 'Address cannot be empty').optional(),
  dailyWage: z.coerce.number().positive('Daily wage must be greater than 0').optional(),
  // Kept optional for backwards compatibility; ignored in actual update service
  projectId: z.string().optional(),
  startDate: z.any().optional(),
});

export type AssignLabourToProjectInput = z.infer<typeof assignLabourToProjectSchema>;
export type CreateLabourInput = {
  name: string;
  mobile: string;
  location?: string;
  address?: string;
  projectId?: string | null;
  dailyWage: number;
  startDate?: Date | string | null;
};
export type UpdateLabourInput = {
  name?: string;
  mobile?: string;
  location?: string;
  address?: string;
  dailyWage?: number;
  projectId?: string;
  startDate?: Date | string;
};
