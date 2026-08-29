import { Request, Response, NextFunction } from 'express';
import * as reportsService from '../services/reports.service';
import { successResponse } from '../utils/apiResponse';

export const getDashboardSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const summary = await reportsService.getDashboardSummary();
    res.status(200).json(successResponse('Dashboard summary retrieved successfully', summary));
  } catch (error) {
    next(error);
  }
};

export const getSalesSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = {
      range: req.query.range as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };
    const report = await reportsService.getSalesSummary(query);
    res.status(200).json(successResponse('Sales report retrieved successfully', report));
  } catch (error) {
    next(error);
  }
};

export const getPurchaseSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = {
      range: req.query.range as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };
    const report = await reportsService.getPurchaseSummary(query);
    res.status(200).json(successResponse('Purchase report retrieved successfully', report));
  } catch (error) {
    next(error);
  }
};

export const getProfitSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = {
      range: req.query.range as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };
    const report = await reportsService.getProfitSummary(query);
    res.status(200).json(successResponse('Profit summary retrieved successfully', report));
  } catch (error) {
    next(error);
  }
};

export const getInventoryAnalytics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const analytics = await reportsService.getInventoryAnalytics();
    res.status(200).json(successResponse('Inventory analytics retrieved successfully', analytics));
  } catch (error) {
    next(error);
  }
};

export const getLowStockProducts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const products = await reportsService.getLowStockProducts();
    res.status(200).json(successResponse('Low stock products retrieved successfully', products));
  } catch (error) {
    next(error);
  }
};
