import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'OTHER';

export interface IProjectInvoicePayment extends Document {
  paymentNumber: string;
  invoice: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;
  amount: number;
  paymentDate: Date;
  paymentMode: PaymentMode;
  transactionReference?: string;
  notes?: string;
  receivedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectInvoicePaymentSchema = new Schema<IProjectInvoicePayment>(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    invoice: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectInvoice',
      required: true,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Payment amount must be greater than 0'],
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    paymentMode: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'],
      required: true,
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

projectInvoicePaymentSchema.index({ invoice: 1, paymentDate: -1 });
projectInvoicePaymentSchema.index({ project: 1, paymentDate: -1 });

export const ProjectInvoicePayment = mongoose.model<IProjectInvoicePayment>(
  'ProjectInvoicePayment',
  projectInvoicePaymentSchema
);
