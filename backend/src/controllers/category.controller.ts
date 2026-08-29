import { Request, Response, NextFunction } from 'express';
import * as categoryService from '../services/category.service';
import { successResponse } from '../utils/apiResponse';

export const getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await categoryService.getCategories();
    res.status(200).json(successResponse('Categories retrieved successfully', categories));
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const category = await categoryService.getCategoryById(id);
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }
    res.status(200).json(successResponse('Category retrieved successfully', category));
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json(successResponse('Category created successfully', category));
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const category = await categoryService.updateCategory(id, req.body);
    res.status(200).json(successResponse('Category updated successfully', category));
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    await categoryService.deleteCategory(id);
    res.status(200).json(successResponse('Category deleted successfully'));
  } catch (error) {
    next(error);
  }
};
