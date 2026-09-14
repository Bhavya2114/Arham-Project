import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseItem {
  product: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  purchasePrice: number;
  originalPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
  discountedPrice?: number;
  taxableAmount?: number;
  quantity: number;
  taxRate: number;
  taxAmount?: number;
  totalCost: number;
}

export interface IPurchase extends Document {
  purchaseNumber: string;
  invoiceNumber?: string;
  poNumber?: string;
  paymentTerms?: string;
  deliveryNoteNo?: string;
  deliveryNoteDate?: Date;
  ewayBillNo?: string;
  placeOfSupply?: string;
  supplier: mongoose.Types.ObjectId;
  purchaseDate: Date;
  items: IPurchaseItem[];
  subtotal: number;
  totalDiscount?: number;
  taxAmount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalAmount: number;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseItemSchema = new Schema<IPurchaseItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    discountAmount: { type: Number, default: 0, min: 0 },
    discountedPrice: { type: Number, min: 0 },
    taxableAmount: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseSchema = new Schema<IPurchase>(
  {
    purchaseNumber: { type: String, required: true, unique: true, index: true },
    invoiceNumber: { type: String, trim: true },
    poNumber: { type: String, trim: true },
    paymentTerms: { type: String, trim: true },
    deliveryNoteNo: { type: String, trim: true },
    deliveryNoteDate: { type: Date },
    ewayBillNo: { type: String, trim: true },
    placeOfSupply: { type: String, trim: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    purchaseDate: { type: Date, default: Date.now },
    items: [purchaseItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    totalDiscount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    cgst: { type: Number, min: 0 },
    sgst: { type: Number, min: 0 },
    igst: { type: Number, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
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

export const Purchase = mongoose.model<IPurchase>('Purchase', purchaseSchema);
