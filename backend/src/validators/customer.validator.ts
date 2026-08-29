import { z } from 'zod';
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
} from '../constants/statuses';

const customerStatusValues = Object.values(CUSTOMER_STATUSES) as [string, ...string[]];
const customerTypeValues = Object.values(CUSTOMER_TYPES) as [string, ...string[]];

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mobile: z.string().min(1, 'Mobile is required'),
  email: z.string().email('Invalid email address').optional().or(z.null()).or(z.literal('')),
  businessName: z.string().min(1, 'Business name is required'),
  gstNumber: z.string().optional().or(z.null()).or(z.literal('')),
  type: z.enum(customerTypeValues),
  address: z.string().min(1, 'Address is required'),
  status: z.enum(customerStatusValues),
  followUpDate: z.coerce.date().optional().or(z.null()),
  notes: z.string().optional().or(z.null()),
});

export const updateCustomerSchema = createCustomerSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' }
);

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive('Page must be a positive integer').optional().default(1),
  limit: z.coerce.number().int().positive('Limit must be a positive integer').max(100, 'Limit cannot exceed 100').optional().default(10),
  status: z.enum(customerStatusValues).optional(),
  type: z.enum(customerTypeValues).optional(),
});

export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;

export const createFollowUpSchema = z.object({
  note: z.string().min(1, 'Note is required'),
  followUpDate: z.coerce.date().optional().or(z.null()),
});

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
