import mongoose, { Schema, Document } from 'mongoose';
import { PROJECT_GST_RATE } from '../constants/projectGst.constants';

export interface IMaterialConsumption extends Document {
  project: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  actualCostPrice: number;
  billingPrice: number;
  actualCostTotal: number;
  billingTotal: number;
  gstRate?: number;
  inputGst?: number;
  issuedMaterialValueIncludingGST?: number;
  supplierInvoiceTotal?: number;
  issueDate: Date;
  issuedBy: mongoose.Types.ObjectId;
  notes?: string;
  billedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const materialConsumptionSchema = new Schema<IMaterialConsumption>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.0001, 'Quantity must be greater than 0'],
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    actualCostPrice: {
      type: Number,
      required: true,
      min: [0, 'Actual cost price cannot be negative'],
    },
    billingPrice: {
      type: Number,
      required: true,
      min: [0, 'Billing price cannot be negative'],
    },
    actualCostTotal: {
      type: Number,
      required: true,
      min: [0, 'Actual cost total cannot be negative'],
    },
    billingTotal: {
      type: Number,
      required: true,
      min: [0, 'Billing total cannot be negative'],
    },
    gstRate: {
      type: Number,
      default: PROJECT_GST_RATE,
      min: [0.01, 'GST rate must be greater than 0'],
    },
    inputGst: {
      type: Number,
      min: [0, 'Input GST cannot be negative'],
    },
    issuedMaterialValueIncludingGST: {
      type: Number,
      min: [0, 'Issued material value cannot be negative'],
    },
    supplierInvoiceTotal: {
      type: Number,
      min: [0, 'Supplier invoice total cannot be negative'],
    },
    issueDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    billedQuantity: {
      type: Number,
      default: 0,
      min: 0,
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

materialConsumptionSchema.index({ project: 1, issueDate: -1 });
materialConsumptionSchema.index({ product: 1, issueDate: -1 });

export const MaterialConsumption = mongoose.model<IMaterialConsumption>(
  'MaterialConsumption',
  materialConsumptionSchema
);
