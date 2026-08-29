import { Router } from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplier.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createSupplierSchema, updateSupplierSchema } from '../validators/supplier.validator';
import { ROLES } from '../constants/roles';

const router = Router();

router.use(authenticate);

router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.post('/', requireRole(ROLES.ADMIN, ROLES.WAREHOUSE), validate(createSupplierSchema), createSupplier);
router.put('/:id', requireRole(ROLES.ADMIN, ROLES.WAREHOUSE), validate(updateSupplierSchema), updateSupplier);
router.delete('/:id', requireRole(ROLES.ADMIN), deleteSupplier);

export default router;
