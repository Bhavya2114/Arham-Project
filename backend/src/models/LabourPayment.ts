import mongoose, { Schema, Document } from 'mongoose';

export type LabourPaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER';

export interface ILabourPayment extends Document {
  labourId: mongoose.Types.ObjectId;
  amount: number;
  paymentDate: Date;
  paymentMethod: LabourPaymentMethod;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const labourPaymentSchema = new Schema<ILabourPayment>(
  {
    labourId: {
      type: Schema.Types.ObjectId,
      ref: 'Labour',
      required: [true, 'Labour ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be greater than 0'],
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['CASH', 'UPI', 'BANK_TRANSFER'],
        message: 'Invalid payment method. Allowed: CASH, UPI, BANK_TRANSFER',
      },
      required: [true, 'Payment method is required'],
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// Compound index for querying labour payments sorted by paymentDate
labourPaymentSchema.index({ labourId: 1, paymentDate: -1 });

export const LabourPayment = mongoose.model<ILabourPayment>(
  'LabourPayment',
  labourPaymentSchema
);
