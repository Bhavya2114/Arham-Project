import { Router } from 'express';
import {
  getDashboardSummary,
  getPurchaseSummary,
  getInventoryAnalytics,
  getLowStockProducts,
  getGstSummary,
} from '../controllers/reports.controller';
import { handleGetAllProjectsProfitabilityReport } from '../controllers/projectProfitability.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboardSummary);
router.get('/purchases', getPurchaseSummary);
router.get('/inventory', getInventoryAnalytics);
router.get('/low-stock', getLowStockProducts);
router.get('/gst-summary', getGstSummary);
router.get('/projects-profitability', handleGetAllProjectsProfitabilityReport);

export default router;
