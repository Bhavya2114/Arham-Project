import { Request, Response, NextFunction } from 'express';
import {
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
  getPaymentsByLabourId,
} from '../services/labourPayment.service';
import { successResponse } from '../utils/apiResponse';

export const handleCreateLabourPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const payment = await createPayment(req.body, userId);
    res.status(201).json(successResponse('Payment recorded successfully', payment));
  } catch (error) {
    next(error);
  }
};

export const handleGetLabourPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const labourId =
      typeof req.query.labourId === 'string' ? req.query.labourId : undefined;
    const payments = await getPayments({ labourId });
    res.status(200).json(successResponse('Payments retrieved successfully', payments));
  } catch (error) {
    next(error);
  }
};

export const handleGetLabourPaymentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const payment = await getPaymentById(id);
    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
      return;
    }
    res.status(200).json(successResponse('Payment retrieved successfully', payment));
  } catch (error) {
    next(error);
  }
};

export const handleUpdateLabourPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const payment = await updatePayment(id, req.body);
    res.status(200).json(successResponse('Payment updated successfully', payment));
  } catch (error) {
    next(error);
  }
};

export const handleDeleteLabourPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user?.id || (req as any).user?._id;
    await deletePayment(id, userId ? String(userId) : undefined);
    res.status(200).json(successResponse('Payment deleted successfully'));
  } catch (error) {
    next(error);
  }
};

export const handleGetPaymentsByLabourId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const labourId = req.params.labourId as string;
    const payments = await getPaymentsByLabourId(labourId);
    res
      .status(200)
      .json(successResponse('Labour payments retrieved successfully', payments));
  } catch (error) {
    next(error);
  }
};
