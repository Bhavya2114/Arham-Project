import { Request, Response, NextFunction } from 'express';
import * as supplierService from '../services/supplier.service';
import { successResponse } from '../utils/apiResponse';

export const getSuppliers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const suppliers = await supplierService.getSuppliers();
    res.status(200).json(successResponse('Suppliers retrieved successfully', suppliers));
  } catch (error) {
    next(error);
  }
};

export const getSupplierById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const supplier = await supplierService.getSupplierById(id);
    if (!supplier) {
      res.status(404).json({ success: false, message: 'Supplier not found' });
      return;
    }
    res.status(200).json(successResponse('Supplier retrieved successfully', supplier));
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const supplier = await supplierService.createSupplier(req.body);
    res.status(201).json(successResponse('Supplier created successfully', supplier));
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const supplier = await supplierService.updateSupplier(id, req.body);
    res.status(200).json(successResponse('Supplier updated successfully', supplier));
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    await supplierService.deleteSupplier(id);
    res.status(200).json(successResponse('Supplier deleted successfully'));
  } catch (error) {
    next(error);
  }
};
