import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  extractPurchaseBill,
} from '../controllers/purchase.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPurchaseSchema } from '../validators/purchase.validator';
import { ROLES } from '../constants/roles';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const handleUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  upload.single('bill')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ success: false, message: 'Purchase bill must not exceed 10 MB.' });
        return;
      }
      res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      return;
    } else if (err) {
      res.status(400).json({ success: false, message: err.message || 'File upload failed' });
      return;
    }
    next();
  });
};

const router = Router();

router.use(authenticate);

router.get('/', getPurchases);
router.get('/:id', getPurchaseById);
router.post(
  '/extract-bill',
  requireRole(ROLES.ADMIN, ROLES.WAREHOUSE, ROLES.ACCOUNTS, ROLES.SALES),
  handleUploadMiddleware,
  extractPurchaseBill
);
router.post('/', requireRole(ROLES.ADMIN, ROLES.WAREHOUSE), validate(createPurchaseSchema), createPurchase);

export default router;
