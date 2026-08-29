import { Router } from 'express';
import {
  getDashboardSummary,
  getSalesSummary,
  getPurchaseSummary,
  getProfitSummary,
  getInventoryAnalytics,
  getLowStockProducts,
} from '../controllers/reports.controller';
import { handleGetAllProjectsProfitabilityReport } from '../controllers/projectProfitability.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboardSummary);
router.get('/sales', getSalesSummary);
router.get('/purchases', getPurchaseSummary);
router.get('/profit', getProfitSummary);
router.get('/inventory', getInventoryAnalytics);
router.get('/low-stock', getLowStockProducts);
router.get('/projects-profitability', handleGetAllProjectsProfitabilityReport);

export default router;
