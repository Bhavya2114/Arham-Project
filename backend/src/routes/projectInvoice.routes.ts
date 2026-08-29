import { Router } from 'express';
import {
  handleGetProjectInvoices,
  handleGetProjectInvoiceById,
  handleCreateProjectInvoice,
} from '../controllers/projectInvoice.controller';
import { handleGetPaymentsByInvoice } from '../controllers/projectInvoicePayment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createProjectInvoiceSchema } from '../validators/projectInvoice.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/project-invoices - View all project invoices (ADMIN, SALES, ACCOUNTS, WAREHOUSE)
router.get('/', authorize('ADMIN', 'SALES', 'ACCOUNTS', 'WAREHOUSE'), handleGetProjectInvoices);

// GET /api/project-invoices/:invoiceId/payments - View payment history for an invoice (ADMIN, SALES, ACCOUNTS, WAREHOUSE)
router.get('/:invoiceId/payments', authorize('ADMIN', 'SALES', 'ACCOUNTS', 'WAREHOUSE'), handleGetPaymentsByInvoice);

// GET /api/project-invoices/:id - View single project invoice (ADMIN, SALES, ACCOUNTS, WAREHOUSE)
router.get('/:id', authorize('ADMIN', 'SALES', 'ACCOUNTS', 'WAREHOUSE'), handleGetProjectInvoiceById);

// POST /api/project-invoices - Create project invoice (ADMIN, SALES, ACCOUNTS)
router.post('/', authorize('ADMIN', 'SALES', 'ACCOUNTS'), validate(createProjectInvoiceSchema), handleCreateProjectInvoice);

export default router;
