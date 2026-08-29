import { Request, Response, NextFunction } from 'express';
import {
  getProjectProfitability,
  getAllProjectsProfitabilityReport,
} from '../services/projectProfitability.service';
import { successResponse } from '../utils/apiResponse';

export const handleGetProjectProfitability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    const data = await getProjectProfitability(projectId);
    res.status(200).json(successResponse('Project profitability report retrieved successfully', data));
  } catch (error) {
    next(error);
  }
};

export const handleGetAllProjectsProfitabilityReport = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await getAllProjectsProfitabilityReport();
    res.status(200).json(successResponse('Global projects profitability report retrieved successfully', data));
  } catch (error) {
    next(error);
  }
};
