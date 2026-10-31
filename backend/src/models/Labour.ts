import mongoose, { Schema, Document } from 'mongoose';

export type LabourStatus = 'ACTIVE' | 'STOPPED' | 'INACTIVE';

// A contractor brings his own crew and is paid per project (area x rate), not per day
export type LabourType = 'LABOUR' | 'CONTRACTOR';

export interface IProjectAssignment {
  projectId: mongoose.Types.ObjectId;
  startDate: Date;
  stoppedAt?: Date | null;
  status: 'ACTIVE' | 'STOPPED';
  // Contractors only: the contract for this project (contractAmount = areaSqFt x ratePerSqFt)
  areaSqFt?: number | null;
  ratePerSqFt?: number | null;
  contractAmount?: number | null;
}

// A stint removed by mistake: kept for the record, never counted in days or wages
export interface IDeletedAssignment extends IProjectAssignment {
  deletedAt: Date;
  deletedBy?: mongoose.Types.ObjectId | null;
}

export interface ILabour extends Document {
  type: LabourType;
  name: string;
  mobile: string;
  location: string;
  projectId?: mongoose.Types.ObjectId | null;
  assignedProjects?: mongoose.Types.ObjectId[];
  projectAssignments?: IProjectAssignment[];
  deletedAssignments?: IDeletedAssignment[];
  dailyWage: number;
  startDate?: Date | null;
  assignmentStartDate?: Date | null;
  status: LabourStatus;
  stoppedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const labourSchema = new Schema<ILabour>(
  {
    type: {
      type: String,
      enum: ['LABOUR', 'CONTRACTOR'],
      default: 'LABOUR',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: false,
      default: null,
      index: true,
    },
    assignedProjects: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        index: true,
      },
    ],
    projectAssignments: [
      {
        projectId: {
          type: Schema.Types.ObjectId,
          ref: 'Project',
          required: true,
        },
        startDate: {
          type: Date,
          required: true,
        },
        stoppedAt: {
          type: Date,
          default: null,
        },
        status: {
          type: String,
          enum: ['ACTIVE', 'STOPPED'],
          default: 'ACTIVE',
        },
        areaSqFt: {
          type: Number,
          default: null,
        },
        ratePerSqFt: {
          type: Number,
          default: null,
        },
        contractAmount: {
          type: Number,
          default: null,
        },
      },
    ],
    deletedAssignments: [
      {
        projectId: {
          type: Schema.Types.ObjectId,
          ref: 'Project',
          required: true,
        },
        startDate: {
          type: Date,
          required: true,
        },
        stoppedAt: {
          type: Date,
          default: null,
        },
        status: {
          type: String,
          enum: ['ACTIVE', 'STOPPED'],
          default: 'STOPPED',
        },
        areaSqFt: {
          type: Number,
          default: null,
        },
        ratePerSqFt: {
          type: Number,
          default: null,
        },
        contractAmount: {
          type: Number,
          default: null,
        },
        deletedAt: {
          type: Date,
          required: true,
        },
        deletedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
      },
    ],
    // Contractors have no daily wage (stored as 0)
    dailyWage: {
      type: Number,
      required: function (this: any) {
        return this.type !== 'CONTRACTOR';
      },
      validate: {
        validator: function (this: any, v: number) {
          if (this?.type === 'CONTRACTOR') return v == null || v >= 0;
          return v > 0;
        },
        message: 'Daily wage must be greater than 0',
      },
    },
    startDate: {
      type: Date,
      required: false,
      default: null,
    },
    assignmentStartDate: {
      type: Date,
      required: false,
      default: null,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'STOPPED', 'INACTIVE'],
      default: 'INACTIVE',
      required: true,
      index: true,
    },
    stoppedAt: {
      type: Date,
      default: null,
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

labourSchema.index({ projectId: 1, status: 1 });

export const Labour = mongoose.model<ILabour>('Labour', labourSchema);
