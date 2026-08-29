import { Router } from 'express';
import * as customerController from '../controllers/customer.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  createCustomerSchema,
  customerQuerySchema,
  createFollowUpSchema,
} from '../validators/customer.validator';

const router = Router();

// Read operations: ADMIN, SALES, WAREHOUSE, ACCOUNTS (all 4 roles allowed)
router.get('/', authenticateToken, requireRole('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), validate(customerQuerySchema, 'query'), customerController.getCustomers);
router.get('/:id', authenticateToken, requireRole('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), customerController.getCustomerById);
router.get('/:id/follow-ups', authenticateToken, requireRole('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), customerController.getFollowUps);

// Write operations: ADMIN, SALES only
router.post('/', authenticateToken, requireRole('ADMIN', 'SALES'), validate(createCustomerSchema), customerController.createCustomer);
router.put('/:id', authenticateToken, requireRole('ADMIN', 'SALES'), validate(createCustomerSchema), customerController.updateCustomer);
router.delete('/:id', authenticateToken, requireRole('ADMIN'), customerController.deleteCustomer);
router.post('/:id/follow-ups', authenticateToken, requireRole('ADMIN', 'SALES'), validate(createFollowUpSchema), customerController.createFollowUp);

export default router;
