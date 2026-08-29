import { Request, Response, NextFunction } from 'express';
import {
  getMaterialConsumptions,
  getMaterialConsumptionById,
  getMaterialConsumptionsByProject,
  createMaterialConsumption,
} from '../services/materialConsumption.service';
import { successResponse } from '../utils/apiResponse';

export const handleGetMaterialConsumptions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const project = typeof req.query.project === 'string' ? req.query.project : undefined;
    const product = typeof req.query.product === 'string' ? req.query.product : undefined;

    const items = await getMaterialConsumptions({ project, product });
    res.status(200).json(successResponse('Material consumption records retrieved successfully', items));
  } catch (error) {
    next(error);
  }
};

export const handleGetMaterialConsumptionsByProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    const items = await getMaterialConsumptionsByProject(projectId);
    res.status(200).json(successResponse('Project material consumptions retrieved successfully', items));
  } catch (error) {
    next(error);
  }
};

export const handleGetMaterialConsumptionById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const item = await getMaterialConsumptionById(id);
    if (!item) {
      res.status(404).json({
        success: false,
        message: 'Material consumption record not found',
      });
      return;
    }
    res.status(200).json(successResponse('Material consumption details retrieved successfully', item));
  } catch (error) {
    next(error);
  }
};

export const handleCreateMaterialConsumption = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id || '';
    const item = await createMaterialConsumption(req.body, userId);
    res.status(201).json(successResponse('Material issued to project successfully', item));
  } catch (error) {
    next(error);
  }
};
