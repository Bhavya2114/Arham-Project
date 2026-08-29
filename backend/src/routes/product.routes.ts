import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { createProductSchema, updateProductSchema } from '../validators/product.validator';

const router = Router();

router.get('/', authenticateToken, requireRole('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), productController.getProducts);
router.post('/', authenticateToken, requireRole('ADMIN', 'WAREHOUSE'), validate(createProductSchema), productController.createProduct);
router.get('/low-stock', authenticateToken, requireRole('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), productController.getLowStockProducts);
router.get('/:id', authenticateToken, requireRole('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), productController.getProductById);
router.put('/:id', authenticateToken, requireRole('ADMIN', 'WAREHOUSE'), validate(updateProductSchema), productController.updateProduct);

export default router;
