import mongoose from 'mongoose';
import { ProjectExpense } from '../models/ProjectExpense';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { CreateProjectExpenseInput } from '../validators/projectExpense.validator';

const mapProjectExpenseResponse = (exp: any) => ({
  id: exp._id ? exp._id.toString() : exp.id,
  projectId: exp.project
    ? exp.project._id
      ? exp.project._id.toString()
      : exp.project.toString()
    : undefined,
  project:
    exp.project && typeof exp.project === 'object'
      ? {
          id: exp.project._id ? exp.project._id.toString() : exp.project.id,
          name: exp.project.name,
          projectCode: exp.project.projectCode,
          status: exp.project.status,
        }
      : undefined,
  category: exp.category,
  description: exp.description,
  amount: Number(exp.amount),
  expenseDate: exp.expenseDate,
  vendorName: exp.vendorName,
  billNumber: exp.billNumber,
  notes: exp.notes,
  isBilled: Boolean(exp.isBilled),
  createdById: exp.createdBy
    ? exp.createdBy._id
      ? exp.createdBy._id.toString()
      : exp.createdBy.toString()
    : undefined,
  createdBy:
    exp.createdBy && typeof exp.createdBy === 'object'
      ? {
          id: exp.createdBy._id ? exp.createdBy._id.toString() : exp.createdBy.id,
          name: exp.createdBy.name,
          email: exp.createdBy.email,
          role: exp.createdBy.role,
        }
      : undefined,
  createdAt: exp.createdAt,
  updatedAt: exp.updatedAt,
});

export const getProjectExpenses = async (query: {
  project?: string;
  category?: string;
}): Promise<any[]> => {
  const filter: any = {};

  if (query.project && query.project.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.project)) {
      filter.project = new mongoose.Types.ObjectId(query.project);
    }
  }

  if (query.category && query.category.trim() !== '') {
    filter.category = query.category.trim().toUpperCase();
  }

  const items = await ProjectExpense.find(filter)
    .populate('project', 'name projectCode status')
    .populate('createdBy', 'name email role')
    .sort({ expenseDate: -1, createdAt: -1 })
    .lean();

  return items.map(mapProjectExpenseResponse);
};

export const getProjectExpensesByProject = async (projectId: string): Promise<any[]> => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const items = await ProjectExpense.find({ project: new mongoose.Types.ObjectId(projectId) })
    .populate('project', 'name projectCode status')
    .populate('createdBy', 'name email role')
    .sort({ expenseDate: -1, createdAt: -1 })
    .lean();

  return items.map(mapProjectExpenseResponse);
};

export const getProjectExpenseById = async (id: string): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid project expense ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const item = await ProjectExpense.findById(id)
    .populate('project', 'name projectCode status')
    .populate('createdBy', 'name email role')
    .lean();

  if (!item) return null;
  return mapProjectExpenseResponse(item);
};

export const createProjectExpense = async (
  input: CreateProjectExpenseInput,
  createdBy: string
): Promise<any> => {
  // 1. Validate Authenticated User
  if (!createdBy) {
    const error = new Error('User authentication required');
    (error as any).statusCode = 401;
    throw error;
  }

  const userObj = await User.findById(createdBy);
  if (!userObj) {
    const error = new Error('Authenticated user not found. Please log in again.');
    (error as any).statusCode = 401;
    throw error;
  }

  // 2. Validate Project Reference & Status Rule
  if (!mongoose.Types.ObjectId.isValid(input.project)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const projectObj = await Project.findById(input.project);
  if (!projectObj) {
    const error = new Error('Project not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (projectObj.status === 'COMPLETED' || projectObj.status === 'CANCELLED') {
    const error = new Error(`Cannot add expenses to a ${projectObj.status} project`);
    (error as any).statusCode = 400;
    throw error;
  }

  const amt = Number(input.amount);
  if (isNaN(amt) || amt <= 0) {
    const error = new Error('Amount must be greater than 0');
    (error as any).statusCode = 400;
    throw error;
  }

  const rawExpenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();
  const expenseDate = !isNaN(rawExpenseDate.getTime()) ? rawExpenseDate : new Date();

  // 3. Create ProjectExpense Document (No Inventory Deduction!)
  const exp = await ProjectExpense.create({
    project: projectObj._id,
    category: input.category,
    description: input.description.trim(),
    amount: amt,
    expenseDate,
    vendorName: input.vendorName ? input.vendorName.trim() : undefined,
    billNumber: input.billNumber ? input.billNumber.trim() : undefined,
    notes: input.notes ? input.notes.trim() : undefined,
    createdBy: userObj._id,
  });

  return getProjectExpenseById(exp._id.toString());
};
