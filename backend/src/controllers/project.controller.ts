import { Request, Response, NextFunction } from 'express';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from '../services/project.service';
import { successResponse } from '../utils/apiResponse';

export const handleGetProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const customer = typeof req.query.customer === 'string' ? req.query.customer : undefined;

    const projects = await getProjects({ search, status, customer });
    res.status(200).json(successResponse('Projects retrieved successfully', projects));
  } catch (error) {
    next(error);
  }
};

export const handleGetProjectById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const project = await getProjectById(id);
    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }
    res.status(200).json(successResponse('Project details retrieved successfully', project));
  } catch (error) {
    next(error);
  }
};

export const handleCreateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id || '';
    const project = await createProject(req.body, userId);
    res.status(201).json(successResponse('Project created successfully', project));
  } catch (error) {
    next(error);
  }
};

export const handleUpdateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const project = await updateProject(id, req.body);
    res.status(200).json(successResponse('Project updated successfully', project));
  } catch (error) {
    next(error);
  }
};

export const handleDeleteProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    await deleteProject(id);
    res.status(200).json(successResponse('Project deleted successfully'));
  } catch (error) {
    next(error);
  }
};
