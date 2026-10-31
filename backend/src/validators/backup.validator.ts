import { z } from 'zod';

export const backupRequestIdParamSchema = z.object({
  requestId: z.string().uuid('Invalid backup request ID'),
});
