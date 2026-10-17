import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Project } from '../models/Project';
import {
  getLabours,
  getLabourById,
  createLabour,
  updateLabour,
  deleteLabour,
  stopLabour,
  assignLabourToProject,
} from '../services/labour.service';
import { successResponse } from '../utils/apiResponse';

export const handleGetLabours = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const location = typeof req.query.location === 'string' ? req.query.location : undefined;

    const labours = await getLabours({ search, status, projectId, location });
    res.status(200).json(successResponse('Labours retrieved successfully', labours));
  } catch (error) {
    next(error);
  }
};

export const handleGetLabourById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const labour = await getLabourById(id);
    if (!labour) {
      res.status(404).json({
        success: false,
        message: 'Labour not found',
      });
      return;
    }
    res.status(200).json(successResponse('Labour retrieved successfully', labour));
  } catch (error) {
    next(error);
  }
};

export const handleCreateLabour = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const labour = await createLabour(req.body);
    res.status(201).json(successResponse('Labour created successfully', labour));
  } catch (error) {
    next(error);
  }
};

export const handleUpdateLabour = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const labour = await updateLabour(id, req.body);
    res.status(200).json(successResponse('Labour updated successfully', labour));
  } catch (error) {
    next(error);
  }
};

export const handleDeleteLabour = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    await deleteLabour(id);
    res.status(200).json(successResponse('Labour deleted successfully'));
  } catch (error) {
    next(error);
  }
};

export const handleStopLabour = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const labour = await stopLabour(id);
    res.status(200).json(successResponse('Labour stopped successfully', labour));
  } catch (error) {
    next(error);
  }
};

export const handleGetLaboursByProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid project ID format',
      });
      return;
    }
    const project = await Project.findById(projectId).select('_id expectedEndDate');
    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }
    const labours = await getLabours({ projectId }, { expectedEndDate: project.expectedEndDate });
    res.status(200).json(successResponse('Project labour records retrieved successfully', labours));
  } catch (error) {
    next(error);
  }
};

export const handleAssignLabourToProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    const { labourId, startDate } = req.body;
    const labour = await assignLabourToProject(projectId, labourId, startDate);
    res.status(200).json(successResponse('Labour assigned to project successfully', labour));
  } catch (error) {
    next(error);
  }
};
