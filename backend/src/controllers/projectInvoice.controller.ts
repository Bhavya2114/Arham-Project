import { Request, Response, NextFunction } from 'express';
import {
  getProjectInvoices,
  getProjectInvoiceById,
  getProjectInvoicesByProject,
  createProjectInvoice,
} from '../services/projectInvoice.service';
import { successResponse } from '../utils/apiResponse';

export const handleGetProjectInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const project = typeof req.query.project === 'string' ? req.query.project : undefined;
    const customer = typeof req.query.customer === 'string' ? req.query.customer : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const items = await getProjectInvoices({ project, customer, status });
    res.status(200).json(successResponse('Project invoices retrieved successfully', items));
  } catch (error) {
    next(error);
  }
};

export const handleGetProjectInvoicesByProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    const items = await getProjectInvoicesByProject(projectId);
    res.status(200).json(successResponse('Project invoices retrieved successfully', items));
  } catch (error) {
    next(error);
  }
};

export const handleGetProjectInvoiceById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const item = await getProjectInvoiceById(id);
    if (!item) {
      res.status(404).json({
        success: false,
        message: 'Project invoice not found',
      });
      return;
    }
    res.status(200).json(successResponse('Project invoice details retrieved successfully', item));
  } catch (error) {
    next(error);
  }
};

export const handleCreateProjectInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id || '';
    const item = await createProjectInvoice(req.body, userId);
    res.status(201).json(successResponse('Project invoice created successfully', item));
  } catch (error) {
    next(error);
  }
};
