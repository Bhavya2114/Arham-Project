import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';
import { ROLES } from '../constants/roles';

const router = Router();

router.use(authenticate);

router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/', requireRole(ROLES.ADMIN, ROLES.SALES, ROLES.WAREHOUSE), validate(createCategorySchema), createCategory);
router.put('/:id', requireRole(ROLES.ADMIN, ROLES.WAREHOUSE), validate(updateCategorySchema), updateCategory);
router.delete('/:id', requireRole(ROLES.ADMIN), deleteCategory);

export default router;
