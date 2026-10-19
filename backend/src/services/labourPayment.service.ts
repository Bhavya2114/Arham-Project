import mongoose from 'mongoose';
import { LabourPayment } from '../models/LabourPayment';
import { Labour } from '../models/Labour';
import {
  CreateLabourPaymentInput,
  UpdateLabourPaymentInput,
} from '../validators/labourPayment.validator';

export const mapLabourPaymentResponse = (payment: any) => ({
  id: payment._id ? payment._id.toString() : payment.id,
  labourId:
    payment.labourId && typeof payment.labourId === 'object' && payment.labourId._id
      ? payment.labourId._id.toString()
      : payment.labourId
      ? payment.labourId.toString()
      : undefined,
  labour:
    payment.labourId && typeof payment.labourId === 'object' && payment.labourId._id
      ? {
          id: payment.labourId._id.toString(),
          name: payment.labourId.name,
          mobile: payment.labourId.mobile,
          status: payment.labourId.status,
        }
      : undefined,
  amount: Number(payment.amount),
  paymentDate: payment.paymentDate,
  paymentMethod: payment.paymentMethod,
  notes: payment.notes || null,
  createdBy:
    payment.createdBy && typeof payment.createdBy === 'object' && payment.createdBy._id
      ? {
          id: payment.createdBy._id.toString(),
          name: payment.createdBy.name,
          email: payment.createdBy.email,
        }
      : payment.createdBy
      ? payment.createdBy.toString()
      : undefined,
  isDeleted: Boolean(payment.isDeleted),
  deletedAt: payment.deletedAt || null,
  deletedBy:
    payment.deletedBy && typeof payment.deletedBy === 'object' && payment.deletedBy._id
      ? {
          id: payment.deletedBy._id.toString(),
          name: payment.deletedBy.name,
          email: payment.deletedBy.email,
        }
      : payment.deletedBy
      ? payment.deletedBy.toString()
      : null,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});

// Deleted payments stay in the collection for history; totals must skip them
const NOT_DELETED = { isDeleted: { $ne: true } };

/**
 * Record a new labour payment.
 * Allowed for both ACTIVE and STOPPED labour workers.
 */
export const createPayment = async (
  input: CreateLabourPaymentInput,
  userId: string
): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(input.labourId)) {
    const error = new Error('Invalid labour ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const labour = await Labour.findById(input.labourId);
  if (!labour) {
    const error = new Error('Labour not found');
    (error as any).statusCode = 404;
    throw error;
  }

  const newPayment = await LabourPayment.create({
    labourId: labour._id,
    amount: Number(input.amount),
    paymentDate: new Date(input.paymentDate),
    paymentMethod: input.paymentMethod,
    notes: input.notes?.trim() || undefined,
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  return getPaymentById(newPayment._id.toString());
};

/**
 * Retrieve list of payments with optional labourId filter.
 * Deleted payments are left out; the per-labour history endpoint includes them.
 */
export const getPayments = async (query: { labourId?: string }): Promise<any[]> => {
  const filter: any = { ...NOT_DELETED };

  if (query.labourId && query.labourId.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.labourId)) {
      filter.labourId = new mongoose.Types.ObjectId(query.labourId);
    }
  }

  const payments = await LabourPayment.find(filter)
    .populate('createdBy', 'name email')
    .populate('labourId', 'name mobile status')
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();

  return payments.map(mapLabourPaymentResponse);
};

/**
 * Retrieve single payment by ID.
 */
export const getPaymentById = async (id: string): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid payment ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const payment = await LabourPayment.findById(id)
    .populate('createdBy', 'name email')
    .populate('deletedBy', 'name email')
    .populate('labourId', 'name mobile status')
    .lean();

  if (!payment) return null;
  return mapLabourPaymentResponse(payment);
};

/**
 * Update an existing payment.
 * Note: labourId and createdBy are protected and cannot be changed.
 */
export const updatePayment = async (
  id: string,
  input: UpdateLabourPaymentInput
): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid payment ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const payment = await LabourPayment.findById(id);
  if (!payment) {
    const error = new Error('Payment not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (payment.isDeleted) {
    const error = new Error('Deleted payments cannot be edited');
    (error as any).statusCode = 400;
    throw error;
  }

  if (input.amount !== undefined) payment.amount = Number(input.amount);
  if (input.paymentDate !== undefined) payment.paymentDate = new Date(input.paymentDate);
  if (input.paymentMethod !== undefined) payment.paymentMethod = input.paymentMethod;
  if (input.notes !== undefined) payment.notes = input.notes.trim() || undefined;

  await payment.save();
  return getPaymentById(id);
};

/**
 * Delete a payment record.
 * The record is kept and marked as deleted so the payment history still shows it;
 * it no longer counts towards Total Paid or Balance.
 */
export const deletePayment = async (id: string, userId?: string): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid payment ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const payment = await LabourPayment.findById(id);
  if (!payment || payment.isDeleted) {
    const error = new Error('Payment not found');
    (error as any).statusCode = 404;
    throw error;
  }

  payment.isDeleted = true;
  payment.deletedAt = new Date();
  payment.deletedBy =
    userId && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;
  await payment.save();

  return true;
};

/**
 * Retrieve all payments belonging to a specific labour worker.
 */
export const getPaymentsByLabourId = async (labourId: string): Promise<any[]> => {
  if (!mongoose.Types.ObjectId.isValid(labourId)) {
    const error = new Error('Invalid labour ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const labour = await Labour.findById(labourId);
  if (!labour) {
    const error = new Error('Labour not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Includes deleted payments so the history shows what was paid and later removed
  const payments = await LabourPayment.find({
    labourId: new mongoose.Types.ObjectId(labourId),
  })
    .populate('createdBy', 'name email')
    .populate('deletedBy', 'name email')
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();

  return payments.map(mapLabourPaymentResponse);
};

/**
 * Calculate total paid amount for a single labour via aggregation.
 */
export const getTotalPaidByLabourId = async (
  labourId: string | mongoose.Types.ObjectId
): Promise<number> => {
  if (!mongoose.Types.ObjectId.isValid(labourId)) return 0;

  const result = await LabourPayment.aggregate([
    { $match: { labourId: new mongoose.Types.ObjectId(labourId), ...NOT_DELETED } },
    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
  ]);

  return result.length > 0 ? Math.round(result[0].totalPaid * 100) / 100 : 0;
};

/**
 * Performance optimization: Aggregate total paid for a batch of labours in a single DB query.
 * Prevents N+1 database queries on list endpoints.
 */
export const getTotalPaidMapForLabours = async (
  labourIds: (string | mongoose.Types.ObjectId)[]
): Promise<Map<string, number>> => {
  const map = new Map<string, number>();
  if (!labourIds || labourIds.length === 0) return map;

  const validObjectIds = labourIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (validObjectIds.length === 0) return map;

  const results = await LabourPayment.aggregate([
    { $match: { labourId: { $in: validObjectIds }, ...NOT_DELETED } },
    { $group: { _id: '$labourId', totalPaid: { $sum: '$amount' } } },
  ]);

  results.forEach((r) => {
    map.set(r._id.toString(), Math.round(r.totalPaid * 100) / 100);
  });

  return map;
};
