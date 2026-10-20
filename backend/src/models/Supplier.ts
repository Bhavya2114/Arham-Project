import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  companyName?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    // Optional: suppliers created from a bill often have no phone number
    mobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    address: { type: String, trim: true },
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

export const Supplier = mongoose.model<ISupplier>('Supplier', supplierSchema);
