import mongoose, { Schema, Document } from 'mongoose';
import { CustomerStatus, CUSTOMER_STATUSES, CustomerType, CUSTOMER_TYPES } from '../constants/statuses';

export interface ICustomerFollowUp {
  _id?: mongoose.Types.ObjectId;
  note: string;
  followUpDate: Date;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface ICustomer extends Document {
  name: string;
  mobile: string;
  email?: string;
  businessName?: string;
  gstNumber?: string;
  type: CustomerType;
  address?: string;
  status: CustomerStatus;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  followUps: ICustomerFollowUp[];
  createdAt: Date;
  updatedAt: Date;
}

const followUpSchema = new Schema<ICustomerFollowUp>(
  {
    note: { type: String, required: true },
    followUpDate: { type: Date, required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
      },
    },
  }
);

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    businessName: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    type: { type: String, enum: Object.values(CUSTOMER_TYPES), default: CUSTOMER_TYPES.RETAIL },
    address: { type: String, trim: true },
    status: { type: String, enum: Object.values(CUSTOMER_STATUSES), default: CUSTOMER_STATUSES.ACTIVE },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    followUps: [followUpSchema],
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

customerSchema.index({ status: 1 });
customerSchema.index({ type: 1 });
customerSchema.index({ createdBy: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
