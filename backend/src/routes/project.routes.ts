import { Router } from 'express';
import {
  handleGetProjects,
  handleGetProjectById,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
} from '../controllers/project.controller';
import { handleGetMaterialConsumptionsByProject } from '../controllers/materialConsumption.controller';
import { handleGetProjectExpensesByProject } from '../controllers/projectExpense.controller';
import { handleGetProjectInvoicesByProject } from '../controllers/projectInvoice.controller';
import { handleGetProjectProfitability } from '../controllers/projectProfitability.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createProjectSchema, updateProjectSchema } from '../validators/project.validator';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// GET /api/projects - View all projects (ADMIN, SALES, WAREHOUSE, ACCOUNTS)
router.get('/', authorize('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), handleGetProjects);

// GET /api/projects/:projectId/material-consumptions - View materials for a project (ADMIN, SALES, WAREHOUSE, ACCOUNTS)
router.get('/:projectId/material-consumptions', authorize('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), handleGetMaterialConsumptionsByProject);

// GET /api/projects/:projectId/expenses - View expenses for a project (ADMIN, SALES, WAREHOUSE, ACCOUNTS)
router.get('/:projectId/expenses', authorize('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), handleGetProjectExpensesByProject);

// GET /api/projects/:projectId/invoices - View invoices for a project (ADMIN, SALES, WAREHOUSE, ACCOUNTS)
router.get('/:projectId/invoices', authorize('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), handleGetProjectInvoicesByProject);

// GET /api/projects/:projectId/profitability - View project profitability financial report (ADMIN, SALES, WAREHOUSE, ACCOUNTS)
router.get('/:projectId/profitability', authorize('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), handleGetProjectProfitability);

// GET /api/projects/:id - View single project (ADMIN, SALES, WAREHOUSE, ACCOUNTS)
router.get('/:id', authorize('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), handleGetProjectById);

// POST /api/projects - Create project (ADMIN, SALES)
router.post('/', authorize('ADMIN', 'SALES'), validate(createProjectSchema), handleCreateProject);

// PUT /api/projects/:id - Update project (ADMIN, SALES)
router.put('/:id', authorize('ADMIN', 'SALES'), validate(updateProjectSchema), handleUpdateProject);

// DELETE /api/projects/:id - Delete project (ADMIN)
router.delete('/:id', authorize('ADMIN'), handleDeleteProject);

export default router;
