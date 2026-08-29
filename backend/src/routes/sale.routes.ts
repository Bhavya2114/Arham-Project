import { Router } from 'express';
import {
  getSales,
  getSaleById,
  createSale,
} from '../controllers/sale.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createSaleSchema } from '../validators/sale.validator';
import { ROLES } from '../constants/roles';

const router = Router();

router.use(authenticate);

router.get('/', getSales);
router.get('/:id', getSaleById);
router.post('/', requireRole(ROLES.ADMIN, ROLES.SALES), validate(createSaleSchema), createSale);

export default router;
