import { Request, Response, NextFunction } from 'express';
import {
  getProjectExpenses,
  getProjectExpenseById,
  getProjectExpensesByProject,
  createProjectExpense,
} from '../services/projectExpense.service';
import { successResponse } from '../utils/apiResponse';

export const handleGetProjectExpenses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const project = typeof req.query.project === 'string' ? req.query.project : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;

    const items = await getProjectExpenses({ project, category });
    res.status(200).json(successResponse('Project expense records retrieved successfully', items));
  } catch (error) {
    next(error);
  }
};

export const handleGetProjectExpensesByProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    const items = await getProjectExpensesByProject(projectId);
    res.status(200).json(successResponse('Project expenses retrieved successfully', items));
  } catch (error) {
    next(error);
  }
};

export const handleGetProjectExpenseById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const item = await getProjectExpenseById(id);
    if (!item) {
      res.status(404).json({
        success: false,
        message: 'Project expense record not found',
      });
      return;
    }
    res.status(200).json(successResponse('Project expense details retrieved successfully', item));
  } catch (error) {
    next(error);
  }
};

export const handleCreateProjectExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id || '';
    const item = await createProjectExpense(req.body, userId);
    res.status(201).json(successResponse('Project expense recorded successfully', item));
  } catch (error) {
    next(error);
  }
};
