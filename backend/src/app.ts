import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import supplierRoutes from './routes/supplier.routes';
import purchaseRoutes from './routes/purchase.routes';
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

const parseAllowedOrigins = (): string[] => {
  const raw = env.FRONTEND_URL || 'https://arham-inventory-frontend.vercel.app';
  const list = raw
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  // In development/test environments, also permit local development origins
  if (env.NODE_ENV !== 'production') {
    const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'];
    devOrigins.forEach((o) => {
      if (!list.includes(o)) list.push(o);
    });
  }

  return list;
};

const allowedOrigins = parseAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Reject all unauthorized origins
      return callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Authorization'],
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
