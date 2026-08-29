import { NextFunction, Request, Response } from 'express';
import * as productService from '../services/product.service';
import { successResponse } from '../utils/apiResponse';

export const getProducts = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const products = await productService.getProducts();
    res.status(200).json(successResponse('Products retrieved successfully', products));
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const product = await productService.getProductById(req.params.id as string);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    res.status(200).json(successResponse('Product retrieved successfully', product));
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const product = await productService.createProduct(req.body, req.user.id);
    res.status(201).json(successResponse('Product created successfully', product));
  } catch (error) {
    if ((error as any).statusCode === 400) {
      res.status(400).json({ success: false, message: (error as any).message });
      return;
    }
    next(error);
  }
};

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const product = await productService.updateProduct(req.params.id as string, req.body);
    res.status(200).json(successResponse('Product updated successfully', product));
  } catch (error) {
    if ((error as any).statusCode === 404 || (error as any).code === 'P2025') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    if ((error as any).statusCode === 400) {
      res.status(400).json({ success: false, message: (error as any).message });
      return;
    }
    next(error);
  }
};

export const deleteProduct = async (
  _req: Request,
  _res: Response,
  _next: NextFunction
): Promise<void> => {
  // Product delete implementation pending
};

export const getLowStockProducts = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const products = await productService.getLowStockProducts();
    res.status(200).json(successResponse('Low stock products retrieved successfully', products));
  } catch (error) {
    next(error);
  }
};
