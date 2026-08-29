import { Router } from 'express';
import {
  handleGetProjectInvoicePayments,
  handleGetProjectInvoicePaymentById,
  handleCreateProjectInvoicePayment,
} from '../controllers/projectInvoicePayment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createProjectInvoicePaymentSchema } from '../validators/projectInvoicePayment.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/project-invoice-payments - View all payments (ADMIN, ACCOUNTS, SALES, WAREHOUSE)
router.get('/', authorize('ADMIN', 'ACCOUNTS', 'SALES', 'WAREHOUSE'), handleGetProjectInvoicePayments);

// GET /api/project-invoice-payments/:id - View single payment details (ADMIN, ACCOUNTS, SALES, WAREHOUSE)
router.get('/:id', authorize('ADMIN', 'ACCOUNTS', 'SALES', 'WAREHOUSE'), handleGetProjectInvoicePaymentById);

// POST /api/project-invoice-payments - Record payment (ADMIN, ACCOUNTS)
router.post('/', authorize('ADMIN', 'ACCOUNTS'), validate(createProjectInvoicePaymentSchema), handleCreateProjectInvoicePayment);

export default router;
