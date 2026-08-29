export const CUSTOMER_STATUSES = {
  LEAD: 'LEAD',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[keyof typeof CUSTOMER_STATUSES];

export const CUSTOMER_TYPES = {
  RETAIL: 'RETAIL',
  WHOLESALE: 'WHOLESALE',
  DISTRIBUTOR: 'DISTRIBUTOR',
} as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[keyof typeof CUSTOMER_TYPES];
