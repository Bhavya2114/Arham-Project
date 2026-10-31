import { Router } from 'express';
import {
  handleGetLabours,
  handleGetLabourById,
  handleCreateLabour,
  handleUpdateLabour,
  handleDeleteLabour,
  handleStopLabour,
  handleUpdateStopDate,
  handleDeleteAssignment,
} from '../controllers/labour.controller';
import { handleGetPaymentsByLabourId } from '../controllers/labourPayment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createLabourSchema, updateLabourSchema } from '../validators/labour.validator';

const router = Router();

// All labour routes require authentication
router.use(authenticate);

// GET /api/labours - View all labour records (ADMIN, SALES, WAREHOUSE, ACCOUNTS)
router.get('/', authorize('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), handleGetLabours);

// GET /api/labours/:id - View single labour record (ADMIN, SALES, WAREHOUSE, ACCOUNTS)
router.get('/:id', authorize('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), handleGetLabourById);

// GET /api/labours/:labourId/payments - View all payments for a specific labour (ADMIN, ACCOUNTS, SALES, WAREHOUSE)
router.get('/:labourId/payments', authorize('ADMIN', 'ACCOUNTS', 'SALES', 'WAREHOUSE'), handleGetPaymentsByLabourId);

// POST /api/labours - Create new labour (ADMIN, SALES)
router.post('/', authorize('ADMIN', 'SALES'), validate(createLabourSchema), handleCreateLabour);

// PUT /api/labours/:id - Update labour details (ADMIN, SALES)
router.put('/:id', authorize('ADMIN', 'SALES'), validate(updateLabourSchema), handleUpdateLabour);

// PATCH /api/labours/:id/stop - Stop active labour (ADMIN, SALES)
router.patch('/:id/stop', authorize('ADMIN', 'SALES'), handleStopLabour);

// PATCH /api/labours/:id/assignments/:assignmentId/stop-date - Change a past stop date (ADMIN, SALES)
router.patch('/:id/assignments/:assignmentId/stop-date', authorize('ADMIN', 'SALES'), handleUpdateStopDate);

// DELETE /api/labours/:id/assignments/:assignmentId - Remove a project stint added by mistake (kept as deleted) (ADMIN, SALES)
router.delete('/:id/assignments/:assignmentId', authorize('ADMIN', 'SALES'), handleDeleteAssignment);

// DELETE /api/labours/:id - Delete labour record (ADMIN)
router.delete('/:id', authorize('ADMIN'), handleDeleteLabour);

export default router;
