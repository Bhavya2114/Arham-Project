import { Router } from 'express';
import {
  handleGetProjectExpenses,
  handleGetProjectExpenseById,
  handleCreateProjectExpense,
  handleDeleteProjectExpense,
} from '../controllers/projectExpense.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createProjectExpenseSchema } from '../validators/projectExpense.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/project-expenses - View all project expense records (ADMIN, ACCOUNTS, SALES, WAREHOUSE)
router.get('/', authorize('ADMIN', 'ACCOUNTS', 'SALES', 'WAREHOUSE'), handleGetProjectExpenses);

// GET /api/project-expenses/:id - View single record (ADMIN, ACCOUNTS, SALES, WAREHOUSE)
router.get('/:id', authorize('ADMIN', 'ACCOUNTS', 'SALES', 'WAREHOUSE'), handleGetProjectExpenseById);

// POST /api/project-expenses - Create project expense (ADMIN, ACCOUNTS)
router.post('/', authorize('ADMIN', 'ACCOUNTS'), validate(createProjectExpenseSchema), handleCreateProjectExpense);

// DELETE /api/project-expenses/:id - Delete an unbilled expense (ADMIN only)
router.delete('/:id', authorize('ADMIN'), handleDeleteProjectExpense);

export default router;
