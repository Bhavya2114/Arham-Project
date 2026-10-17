import { Router } from 'express';
import {
  handleCreateLabourPayment,
  handleGetLabourPayments,
  handleGetLabourPaymentById,
  handleUpdateLabourPayment,
  handleDeleteLabourPayment,
} from '../controllers/labourPayment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createLabourPaymentSchema,
  updateLabourPaymentSchema,
} from '../validators/labourPayment.validator';

const router = Router();

// All labour payment routes require authentication
router.use(authenticate);

// GET /api/labour-payments - View all payments (ADMIN, ACCOUNTS, SALES, WAREHOUSE)
router.get(
  '/',
  authorize('ADMIN', 'ACCOUNTS', 'SALES', 'WAREHOUSE'),
  handleGetLabourPayments
);

// GET /api/labour-payments/:id - View single payment (ADMIN, ACCOUNTS, SALES, WAREHOUSE)
router.get(
  '/:id',
  authorize('ADMIN', 'ACCOUNTS', 'SALES', 'WAREHOUSE'),
  handleGetLabourPaymentById
);

// POST /api/labour-payments - Create payment (ADMIN, ACCOUNTS)
router.post(
  '/',
  authorize('ADMIN', 'ACCOUNTS'),
  validate(createLabourPaymentSchema),
  handleCreateLabourPayment
);

// PUT /api/labour-payments/:id - Update payment (ADMIN, ACCOUNTS)
router.put(
  '/:id',
  authorize('ADMIN', 'ACCOUNTS'),
  validate(updateLabourPaymentSchema),
  handleUpdateLabourPayment
);

// DELETE /api/labour-payments/:id - Delete payment (ADMIN, ACCOUNTS)
router.delete(
  '/:id',
  authorize('ADMIN', 'ACCOUNTS'),
  handleDeleteLabourPayment
);

export default router;
