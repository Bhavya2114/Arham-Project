import { Request, Response, NextFunction } from 'express';
import * as saleService from '../services/sale.service';
import { successResponse } from '../utils/apiResponse';

export const getSales = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sales = await saleService.getSales();
    res.status(200).json(successResponse('Sales retrieved successfully', sales));
  } catch (error) {
    next(error);
  }
};

export const getSaleById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const sale = await saleService.getSaleById(id);
    if (!sale) {
      res.status(404).json({ success: false, message: 'Sale invoice record not found' });
      return;
    }
    res.status(200).json(successResponse('Sale invoice retrieved successfully', sale));
  } catch (error) {
    next(error);
  }
};

export const createSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const createdBy = req.user!.id;
    const sale = await saleService.createSale(req.body, createdBy);
    res.status(201).json(successResponse('Sale created successfully', sale));
  } catch (error) {
    next(error);
  }
};
