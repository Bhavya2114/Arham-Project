import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  sku: string;
  category: string;
  supplier?: mongoose.Types.ObjectId;
  costPrice: number;
  unitPrice: number; // selling price
  sellingPrice: number;
  gstRate: number; // e.g. 0, 5, 12, 18, 28
  currentStock: number;
  minimumStock: number;
  warehouseLocation?: string;
  unit: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    category: { type: String, required: true, trim: true, index: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    costPrice: { type: Number, required: true, default: 0, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    currentStock: { type: Number, default: 0, index: true },
    minimumStock: { type: Number, default: 5 },
    warehouseLocation: { type: String, trim: true, default: 'Main Store' },
    unit: { type: String, trim: true, default: 'pcs' },
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

productSchema.index({ createdBy: 1 });
productSchema.index({ currentStock: 1, minimumStock: 1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);
