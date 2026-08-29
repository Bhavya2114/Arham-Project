import mongoose, { Schema, Document } from 'mongoose';

export type InvoiceItemType = 'MATERIAL' | 'EXPENSE' | 'SERVICE' | 'OTHER';
export type InvoiceSourceType = 'MATERIAL_CONSUMPTION' | 'PROJECT_EXPENSE' | 'MANUAL';
export type ProjectInvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface IProjectInvoiceItem {
  type: InvoiceItemType;
  sourceType: InvoiceSourceType;
  sourceId?: string;
  description: string;
  product?: mongoose.Types.ObjectId;
  quantity?: number;
  unit?: string;
  rate: number;
  amount: number;
  gstRate: number;
  gstAmount: number;
  lineTotal: number;
}

export interface ICustomerSnapshot {
  name: string;
  businessName?: string;
  gstNumber?: string;
  mobile: string;
  email?: string;
  address?: string;
}

export interface IProjectSnapshot {
  name: string;
  projectCode: string;
  siteAddress: string;
}

export interface IProjectInvoice extends Document {
  invoiceNumber: string;
  project: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;
  customerSnapshot: ICustomerSnapshot;
  projectSnapshot: IProjectSnapshot;
  invoiceDate: Date;
  dueDate: Date;
  items: IProjectInvoiceItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;
  notes?: string;
  status: ProjectInvoiceStatus;
  amountPaid: number;
  balanceDue: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectInvoiceItemSchema = new Schema<IProjectInvoiceItem>(
  {
    type: {
      type: String,
      enum: ['MATERIAL', 'EXPENSE', 'SERVICE', 'OTHER'],
      required: true,
    },
    sourceType: {
      type: String,
      enum: ['MATERIAL_CONSUMPTION', 'PROJECT_EXPENSE', 'MANUAL'],
      required: true,
    },
    sourceId: { type: String },
    description: { type: String, required: true, trim: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
    unit: { type: String, trim: true },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    gstAmount: { type: Number, required: true, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const customerSnapshotSchema = new Schema<ICustomerSnapshot>(
  {
    name: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { _id: false }
);

const projectSnapshotSchema = new Schema<IProjectSnapshot>(
  {
    name: { type: String, required: true, trim: true },
    projectCode: { type: String, required: true, trim: true },
    siteAddress: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const projectInvoiceSchema = new Schema<IProjectInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
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
    customerSnapshot: {
      type: customerSnapshotSchema,
      required: true,
    },
    projectSnapshot: {
      type: projectSnapshotSchema,
      required: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    items: {
      type: [projectInvoiceItemSchema],
      required: true,
      validate: [(val: any[]) => val.length > 0, 'Invoice must contain at least one line item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'],
      default: 'UNPAID',
      index: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceDue: {
      type: Number,
      required: true,
      min: 0,
    },
    createdBy: {
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

projectInvoiceSchema.index({ project: 1, invoiceDate: -1 });
projectInvoiceSchema.index({ customer: 1, invoiceDate: -1 });

export const ProjectInvoice = mongoose.model<IProjectInvoice>(
  'ProjectInvoice',
  projectInvoiceSchema
);
