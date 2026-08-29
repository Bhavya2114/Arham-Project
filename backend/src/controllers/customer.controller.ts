import { NextFunction, Request, Response } from 'express';
import * as customerService from '../services/customer.service';
import { successResponse } from '../utils/apiResponse';

export const getCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await customerService.getCustomers(req.query as any);
    res.status(200).json({
      success: true,
      message: 'Customers retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customer = await customerService.getCustomerById(req.params.id as string);
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    res.status(200).json(successResponse('Customer retrieved successfully', customer));
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const customer = await customerService.createCustomer(req.body, req.user.id);
    res.status(201).json(successResponse('Customer created successfully', customer));
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customer = await customerService.updateCustomer(req.params.id as string, req.body);
    res.status(200).json(successResponse('Customer updated successfully', customer));
  } catch (error) {
    if ((error as any).statusCode === 404 || (error as any).code === 'P2025') {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    next(error);
  }
};

export const deleteCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await customerService.deleteCustomer(req.params.id as string);
    res.status(200).json(successResponse('Customer deleted successfully', null));
  } catch (error) {
    if ((error as any).statusCode === 404) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    next(error);
  }
};

export const getFollowUps = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const followUps = await customerService.getFollowUps(req.params.id as string);
    res.status(200).json(successResponse('Follow-up notes retrieved successfully', followUps));
  } catch (error) {
    if ((error as any).statusCode === 404) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    next(error);
  }
};

export const createFollowUp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const followUp = await customerService.createFollowUp(
      req.params.id as string,
      req.body,
      req.user.id
    );
    res.status(201).json(successResponse('Follow-up note created successfully', followUp));
  } catch (error) {
    if ((error as any).statusCode === 404) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    next(error);
  }
};
