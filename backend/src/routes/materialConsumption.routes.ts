import { Router } from 'express';
import {
  handleGetMaterialConsumptions,
  handleGetMaterialConsumptionById,
  handleCreateMaterialConsumption,
} from '../controllers/materialConsumption.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createMaterialConsumptionSchema } from '../validators/materialConsumption.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/material-consumptions - View all material consumption records (ADMIN, WAREHOUSE, SALES, ACCOUNTS)
router.get('/', authorize('ADMIN', 'WAREHOUSE', 'SALES', 'ACCOUNTS'), handleGetMaterialConsumptions);

// GET /api/material-consumptions/:id - View single record (ADMIN, WAREHOUSE, SALES, ACCOUNTS)
router.get('/:id', authorize('ADMIN', 'WAREHOUSE', 'SALES', 'ACCOUNTS'), handleGetMaterialConsumptionById);

// POST /api/material-consumptions - Issue material to project (ADMIN, WAREHOUSE)
router.post('/', authorize('ADMIN', 'WAREHOUSE'), validate(createMaterialConsumptionSchema), handleCreateMaterialConsumption);

export default router;
