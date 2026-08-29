import mongoose, { Schema, Document } from 'mongoose';

export interface ISaleItem {
  product: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  costPrice: number;    // Snapshot of cost price at sale time
  sellingPrice: number; // Snapshot of selling price at sale time
  quantity: number;
  gstRate: number;
  gstAmount: number;
  lineTotal: number;
  itemProfit: number;
}

export interface ISale extends Document {
  invoiceNumber: string;
  customer: mongoose.Types.ObjectId;
  saleDate: Date;
  items: ISaleItem[];
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  totalCost: number;
  totalProfit: number;
  paymentStatus: 'PAID' | 'PENDING' | 'CANCELLED';
  paymentMode: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    gstRate: { type: Number, default: 0, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    itemProfit: { type: Number, required: true },
  },
  { _id: false }
);

const saleSchema = new Schema<ISale>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    saleDate: { type: Date, default: Date.now, index: true },
    items: [saleItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    totalGst: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    totalProfit: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PENDING', 'CANCELLED'],
      default: 'PAID',
    },
    paymentMode: {
      type: String,
      enum: ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'],
      default: 'CASH',
    },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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

export const Sale = mongoose.model<ISale>('Sale', saleSchema);
