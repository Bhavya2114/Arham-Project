import { z } from 'zod';

const optionalString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined));

export const createProjectSchema = z
  .object({
    projectCode: z.string().trim().min(1, 'Project code is required'),
    name: z.string().trim().min(1, 'Project name is required'),
    customer: z.string().trim().min(1, 'Customer ID is required'),
    siteAddress: z.string().trim().min(1, 'Site address is required'),
    startDate: z.string().trim().min(1, 'Start date is required'),
    expectedEndDate: optionalString,
    status: z
      .enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
      .optional()
      .default('PLANNING'),
    budget: z.coerce.number().nonnegative('Budget must be non-negative').optional(),
    notes: optionalString,
  })
  .refine(
    (data) => {
      if (data.startDate && data.expectedEndDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.expectedEndDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          return end >= start;
        }
      }
      return true;
    },
    {
      message: 'Expected end date cannot be before start date',
      path: ['expectedEndDate'],
    }
  );

export const updateProjectSchema = z
  .object({
    projectCode: z.string().trim().min(1, 'Project code cannot be empty').optional(),
    name: z.string().trim().min(1, 'Project name cannot be empty').optional(),
    customer: z.string().trim().min(1, 'Customer ID cannot be empty').optional(),
    siteAddress: z.string().trim().min(1, 'Site address cannot be empty').optional(),
    startDate: z.string().trim().min(1, 'Start date cannot be empty').optional(),
    expectedEndDate: optionalString,
    status: z
      .enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
      .optional(),
    budget: z.coerce.number().nonnegative('Budget must be non-negative').optional(),
    notes: optionalString,
  })
  .refine(
    (data) => {
      if (data.startDate && data.expectedEndDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.expectedEndDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          return end >= start;
        }
      }
      return true;
    },
    {
      message: 'Expected end date cannot be before start date',
      path: ['expectedEndDate'],
    }
  );

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
