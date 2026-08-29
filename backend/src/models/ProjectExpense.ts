import mongoose, { Schema, Document } from 'mongoose';

export type ExpenseCategory =
  | 'TRANSPORT'
  | 'LABOUR'
  | 'MACHINERY_RENTAL'
  | 'LOADING_UNLOADING'
  | 'SITE_EXPENSE'
  | 'MISCELLANEOUS'
  | 'OTHER';

export interface IProjectExpense extends Document {
  project: mongoose.Types.ObjectId;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: Date;
  vendorName?: string;
  billNumber?: string;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  isBilled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const projectExpenseSchema = new Schema<IProjectExpense>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'TRANSPORT',
        'LABOUR',
        'MACHINERY_RENTAL',
        'LOADING_UNLOADING',
        'SITE_EXPENSE',
        'MISCELLANEOUS',
        'OTHER',
      ],
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than 0'],
    },
    expenseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    vendorName: {
      type: String,
      trim: true,
    },
    billNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isBilled: {
      type: Boolean,
      default: false,
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

projectExpenseSchema.index({ project: 1, expenseDate: -1 });
projectExpenseSchema.index({ category: 1, expenseDate: -1 });

export const ProjectExpense = mongoose.model<IProjectExpense>(
  'ProjectExpense',
  projectExpenseSchema
);
