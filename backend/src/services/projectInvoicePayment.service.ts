import mongoose from 'mongoose';
import { ProjectInvoicePayment } from '../models/ProjectInvoicePayment';
import { ProjectInvoice } from '../models/ProjectInvoice';
import { User } from '../models/User';
import { CreateProjectInvoicePaymentInput } from '../validators/projectInvoicePayment.validator';

const generatePaymentNumber = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const prefix = `PAY-${currentYear}-`;

  const lastPayment = await ProjectInvoicePayment.findOne({
    paymentNumber: { $regex: new RegExp(`^${prefix}`) },
  })
    .sort({ createdAt: -1 })
    .lean();

  let nextSequence = 1;
  if (lastPayment && lastPayment.paymentNumber) {
    const parts = lastPayment.paymentNumber.split('-');
    const lastSeqStr = parts[parts.length - 1];
    const parsedSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(parsedSeq)) {
      nextSequence = parsedSeq + 1;
    }
  }

  let paymentNumber = `${prefix}${String(nextSequence).padStart(4, '0')}`;
  let exists = await ProjectInvoicePayment.exists({ paymentNumber });

  while (exists) {
    nextSequence += 1;
    paymentNumber = `${prefix}${String(nextSequence).padStart(4, '0')}`;
    exists = await ProjectInvoicePayment.exists({ paymentNumber });
  }

  return paymentNumber;
};

const mapPaymentResponse = (pmt: any) => ({
  id: pmt._id ? pmt._id.toString() : pmt.id,
  paymentNumber: pmt.paymentNumber,
  invoiceId: pmt.invoice
    ? pmt.invoice._id
      ? pmt.invoice._id.toString()
      : pmt.invoice.toString()
    : undefined,
  invoice:
    pmt.invoice && typeof pmt.invoice === 'object'
      ? {
          id: pmt.invoice._id ? pmt.invoice._id.toString() : pmt.invoice.id,
          invoiceNumber: pmt.invoice.invoiceNumber,
          grandTotal: Number(pmt.invoice.grandTotal),
          amountPaid: Number(pmt.invoice.amountPaid),
          balanceDue: Number(pmt.invoice.balanceDue),
          status: pmt.invoice.status,
        }
      : undefined,
  projectId: pmt.project
    ? pmt.project._id
      ? pmt.project._id.toString()
      : pmt.project.toString()
    : undefined,
  project:
    pmt.project && typeof pmt.project === 'object'
      ? {
          id: pmt.project._id ? pmt.project._id.toString() : pmt.project.id,
          name: pmt.project.name,
          projectCode: pmt.project.projectCode,
        }
      : undefined,
  customerId: pmt.customer
    ? pmt.customer._id
      ? pmt.customer._id.toString()
      : pmt.customer.toString()
    : undefined,
  customer:
    pmt.customer && typeof pmt.customer === 'object'
      ? {
          id: pmt.customer._id ? pmt.customer._id.toString() : pmt.customer.id,
          name: pmt.customer.name,
          businessName: pmt.customer.businessName,
          mobile: pmt.customer.mobile,
        }
      : undefined,
  amount: Number(pmt.amount),
  paymentDate: pmt.paymentDate,
  paymentMode: pmt.paymentMode,
  transactionReference: pmt.transactionReference,
  notes: pmt.notes,
  receivedById: pmt.receivedBy
    ? pmt.receivedBy._id
      ? pmt.receivedBy._id.toString()
      : pmt.receivedBy.toString()
    : undefined,
  receivedBy:
    pmt.receivedBy && typeof pmt.receivedBy === 'object'
      ? {
          id: pmt.receivedBy._id ? pmt.receivedBy._id.toString() : pmt.receivedBy.id,
          name: pmt.receivedBy.name,
          email: pmt.receivedBy.email,
          role: pmt.receivedBy.role,
        }
      : undefined,
  createdAt: pmt.createdAt,
  updatedAt: pmt.updatedAt,
});

export const getProjectInvoicePayments = async (query: {
  invoice?: string;
  project?: string;
  customer?: string;
  paymentMode?: string;
}): Promise<any[]> => {
  const filter: any = {};

  if (query.invoice && query.invoice.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.invoice)) {
      filter.invoice = new mongoose.Types.ObjectId(query.invoice);
    }
  }

  if (query.project && query.project.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.project)) {
      filter.project = new mongoose.Types.ObjectId(query.project);
    }
  }

  if (query.customer && query.customer.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.customer)) {
      filter.customer = new mongoose.Types.ObjectId(query.customer);
    }
  }

  if (query.paymentMode && query.paymentMode.trim() !== '') {
    filter.paymentMode = query.paymentMode.trim().toUpperCase();
  }

  const items = await ProjectInvoicePayment.find(filter)
    .populate('invoice', 'invoiceNumber grandTotal amountPaid balanceDue status')
    .populate('project', 'name projectCode')
    .populate('customer', 'name businessName mobile')
    .populate('receivedBy', 'name email role')
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();

  return items.map(mapPaymentResponse);
};

export const getPaymentsByInvoice = async (invoiceId: string): Promise<any[]> => {
  if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
    const error = new Error('Invalid invoice ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const items = await ProjectInvoicePayment.find({
    invoice: new mongoose.Types.ObjectId(invoiceId),
  })
    .populate('invoice', 'invoiceNumber grandTotal amountPaid balanceDue status')
    .populate('project', 'name projectCode')
    .populate('customer', 'name businessName mobile')
    .populate('receivedBy', 'name email role')
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();

  return items.map(mapPaymentResponse);
};

export const getProjectInvoicePaymentById = async (id: string): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid payment ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const item = await ProjectInvoicePayment.findById(id)
    .populate('invoice', 'invoiceNumber grandTotal amountPaid balanceDue status')
    .populate('project', 'name projectCode')
    .populate('customer', 'name businessName mobile')
    .populate('receivedBy', 'name email role')
    .lean();

  if (!item) return null;
  return mapPaymentResponse(item);
};

export const createProjectInvoicePayment = async (
  input: CreateProjectInvoicePaymentInput,
  receivedBy: string
): Promise<any> => {
  // 1. Validate Authenticated User
  if (!receivedBy) {
    const error = new Error('User authentication required');
    (error as any).statusCode = 401;
    throw error;
  }

  const userObj = await User.findById(receivedBy);
  if (!userObj) {
    const error = new Error('Authenticated user not found. Please log in again.');
    (error as any).statusCode = 401;
    throw error;
  }

  // 2. Validate Invoice
  if (!mongoose.Types.ObjectId.isValid(input.invoice)) {
    const error = new Error('Invalid project invoice ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const invoice = await ProjectInvoice.findById(input.invoice);
  if (!invoice) {
    const error = new Error('Project invoice not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (invoice.status === 'CANCELLED') {
    const error = new Error('Cannot record payment for a CANCELLED invoice');
    (error as any).statusCode = 400;
    throw error;
  }

  if (invoice.status === 'PAID' || invoice.balanceDue <= 0.005) {
    const error = new Error('Invoice is already fully paid');
    (error as any).statusCode = 400;
    throw error;
  }

  // 3. Clean & Validate Payment Amount
  const payAmount = Math.round(Number(input.amount) * 100) / 100;
  if (isNaN(payAmount) || payAmount <= 0) {
    const error = new Error('Payment amount must be greater than 0');
    (error as any).statusCode = 400;
    throw error;
  }

  const currentBalance = Math.round(Number(invoice.balanceDue) * 100) / 100;
  if (payAmount > currentBalance) {
    const error = new Error(
      `Payment amount (₹${payAmount.toFixed(2)}) cannot exceed outstanding balance (₹${currentBalance.toFixed(2)})`
    );
    (error as any).statusCode = 400;
    throw error;
  }

  // 4. Concurrency Safety: Atomic Conditional Update
  // Only update if balanceDue >= payAmount - 0.005 and status != CANCELLED
  const updatedInvoice = await ProjectInvoice.findOneAndUpdate(
    {
      _id: invoice._id,
      balanceDue: { $gte: payAmount - 0.005 },
      status: { $ne: 'CANCELLED' },
    },
    {
      $inc: { amountPaid: payAmount },
    },
    { new: true }
  );

  if (!updatedInvoice) {
    const error = new Error(
      'Payment failed due to concurrent update or insufficient balance'
    );
    (error as any).statusCode = 400;
    throw error;
  }

  // Recalculate balanceDue and status on the updated invoice
  const newAmountPaid = Math.round(Number(updatedInvoice.amountPaid) * 100) / 100;
  const grandTotal = Math.round(Number(updatedInvoice.grandTotal) * 100) / 100;
  let newBalanceDue = Math.max(0, Math.round((grandTotal - newAmountPaid) * 100) / 100);

  let newStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
  if (newBalanceDue <= 0.005) {
    newBalanceDue = 0;
    newStatus = 'PAID';
  } else if (newAmountPaid > 0) {
    newStatus = 'PARTIALLY_PAID';
  }

  updatedInvoice.balanceDue = newBalanceDue;
  updatedInvoice.status = newStatus;
  await updatedInvoice.save();

  // 5. Generate Payment Number & Create Payment Document
  const rawPmtDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
  const paymentDate = !isNaN(rawPmtDate.getTime()) ? rawPmtDate : new Date();

  const paymentNumber = await generatePaymentNumber();

  const paymentDoc = await ProjectInvoicePayment.create({
    paymentNumber,
    invoice: updatedInvoice._id,
    project: updatedInvoice.project,
    customer: updatedInvoice.customer,
    amount: payAmount,
    paymentDate,
    paymentMode: input.paymentMode,
    transactionReference: input.transactionReference ? input.transactionReference.trim() : undefined,
    notes: input.notes ? input.notes.trim() : undefined,
    receivedBy: userObj._id,
  });

  return getProjectInvoicePaymentById(paymentDoc._id.toString());
};
