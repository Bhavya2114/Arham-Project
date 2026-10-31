import { Router } from 'express';
import {
  handleStartBackup,
  handleGetBackupStatus,
  handleDownloadBackup,
  handleGetLastBackup,
} from '../controllers/backup.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { backupRequestIdParamSchema } from '../validators/backup.validator';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

// GET /api/backup/last - When the last successful backup finished
router.get('/last', handleGetLastBackup);

// POST /api/backup - Start a backup (GitHub Actions -> Google Drive)
router.post('/', handleStartBackup);

// GET /api/backup/:requestId/status - queued | running | done | failed
router.get('/:requestId/status', validate(backupRequestIdParamSchema, 'params'), handleGetBackupStatus);

// GET /api/backup/:requestId/download - The same .gz that went to Google Drive
router.get('/:requestId/download', validate(backupRequestIdParamSchema, 'params'), handleDownloadBackup);

export default router;
