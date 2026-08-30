import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import supplierRoutes from './routes/supplier.routes';
import purchaseRoutes from './routes/purchase.routes';
import saleRoutes from './routes/sale.routes';
import reportsRoutes from './routes/reports.routes';
import projectRoutes from './routes/project.routes';
import materialConsumptionRoutes from './routes/materialConsumption.routes';
import projectExpenseRoutes from './routes/projectExpense.routes';
import projectInvoiceRoutes from './routes/projectInvoice.routes';
import projectInvoicePaymentRoutes from './routes/projectInvoicePayment.routes';
import { notFoundHandler } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';
import { successResponse } from './utils/apiResponse';
import { connectDB } from './config/database';
import { env } from './config/env';
import './types/express.types';

connectDB();

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL
      ? env.FRONTEND_URL.includes(',')
        ? env.FRONTEND_URL.split(',').map((url) => url.trim())
        : env.FRONTEND_URL
      : '*',
    credentials: true,
  })
);
app.use(express.json());

app.use(async (_req: Request, _res: Response, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json(successResponse('API is running'));
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/material-consumptions', materialConsumptionRoutes);
app.use('/api/project-expenses', projectExpenseRoutes);
app.use('/api/project-invoices', projectInvoiceRoutes);
app.use('/api/project-invoice-payments', projectInvoicePaymentRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json(successResponse('Arham Inventory API is running'));
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
