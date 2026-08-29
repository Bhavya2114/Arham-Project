import { Request, Response, NextFunction } from 'express';
import {
  getProjectInvoicePayments,
  getProjectInvoicePaymentById,
  getPaymentsByInvoice,
  createProjectInvoicePayment,
} from '../services/projectInvoicePayment.service';
import { successResponse } from '../utils/apiResponse';

export const handleGetProjectInvoicePayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const invoice = typeof req.query.invoice === 'string' ? req.query.invoice : undefined;
    const project = typeof req.query.project === 'string' ? req.query.project : undefined;
    const customer = typeof req.query.customer === 'string' ? req.query.customer : undefined;
    const paymentMode = typeof req.query.paymentMode === 'string' ? req.query.paymentMode : undefined;

    const items = await getProjectInvoicePayments({ invoice, project, customer, paymentMode });
    res.status(200).json(successResponse('Project invoice payments retrieved successfully', items));
  } catch (error) {
    next(error);
  }
};

export const handleGetPaymentsByInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    const items = await getPaymentsByInvoice(invoiceId);
    res.status(200).json(successResponse('Invoice payments history retrieved successfully', items));
  } catch (error) {
    next(error);
  }
};

export const handleGetProjectInvoicePaymentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const item = await getProjectInvoicePaymentById(id);
    if (!item) {
      res.status(404).json({
        success: false,
        message: 'Payment record not found',
      });
      return;
    }
    res.status(200).json(successResponse('Payment details retrieved successfully', item));
  } catch (error) {
    next(error);
  }
};

export const handleCreateProjectInvoicePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id || '';
    const item = await createProjectInvoicePayment(req.body, userId);
    res.status(201).json(successResponse('Payment recorded successfully', item));
  } catch (error) {
    next(error);
  }
};
