import mongoose from 'mongoose';
import { Project, ProjectStatus } from '../models/Project';
import { Customer } from '../models/Customer';
import { User } from '../models/User';
import { CreateProjectInput, UpdateProjectInput } from '../validators/project.validator';

const mapProjectResponse = (project: any) => ({
  id: project._id ? project._id.toString() : project.id,
  projectCode: project.projectCode,
  name: project.name,
  customerId: project.customer
    ? project.customer._id
      ? project.customer._id.toString()
      : project.customer.toString()
    : undefined,
  customer:
    project.customer && typeof project.customer === 'object'
      ? {
          id: project.customer._id ? project.customer._id.toString() : project.customer.id,
          name: project.customer.name,
          mobile: project.customer.mobile,
          email: project.customer.email,
          businessName: project.customer.businessName,
          gstNumber: project.customer.gstNumber,
          type: project.customer.type,
          address: project.customer.address,
        }
      : undefined,
  siteAddress: project.siteAddress,
  startDate: project.startDate,
  expectedEndDate: project.expectedEndDate,
  status: project.status,
  budget: project.budget !== undefined && project.budget !== null ? Number(project.budget) : undefined,
  notes: project.notes,
  createdBy: project.createdBy
    ? project.createdBy._id
      ? project.createdBy._id.toString()
      : project.createdBy.toString()
    : undefined,
  creator:
    project.createdBy && typeof project.createdBy === 'object'
      ? {
          id: project.createdBy._id ? project.createdBy._id.toString() : project.createdBy.id,
          name: project.createdBy.name,
          email: project.createdBy.email,
          role: project.createdBy.role,
        }
      : undefined,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

export const getProjects = async (query: {
  search?: string;
  status?: string;
  customer?: string;
}): Promise<any[]> => {
  const filter: any = {};

  if (query.status && query.status.trim() !== '') {
    filter.status = query.status.trim().toUpperCase();
  }

  if (query.customer && query.customer.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.customer)) {
      filter.customer = new mongoose.Types.ObjectId(query.customer);
    }
  }

  if (query.search && query.search.trim() !== '') {
    const searchRegex = new RegExp(query.search.trim().replace(/[^a-zA-Z0-9\s-]/g, '\\$&'), 'i');
    filter.$or = [
      { projectCode: searchRegex },
      { name: searchRegex },
      { siteAddress: searchRegex },
    ];
  }

  const projects = await Project.find(filter)
    .populate('customer', 'name mobile email businessName gstNumber type address')
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

  return projects.map(mapProjectResponse);
};

export const getProjectById = async (id: string): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const project = await Project.findById(id)
    .populate('customer', 'name mobile email businessName gstNumber type address')
    .populate('createdBy', 'name email role')
    .lean();

  if (!project) return null;
  return mapProjectResponse(project);
};

export const createProject = async (
  input: CreateProjectInput,
  createdBy: string
): Promise<any> => {
  // 1. Authenticated User Check
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

  // 2. Validate Customer Reference
  if (!mongoose.Types.ObjectId.isValid(input.customer)) {
    const error = new Error('Invalid customer ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const customerObj = await Customer.findById(input.customer);
  if (!customerObj) {
    const error = new Error('Customer not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // 3. Unique Project Code Check
  const codeClean = input.projectCode.trim().toUpperCase();
  const existingProject = await Project.findOne({ projectCode: codeClean });
  if (existingProject) {
    const error = new Error(`Project code "${codeClean}" already exists`);
    (error as any).statusCode = 400;
    throw error;
  }

  // 4. Create Project
  const startDate = new Date(input.startDate);
  const expectedEndDate = input.expectedEndDate ? new Date(input.expectedEndDate) : undefined;

  const newProject = await Project.create({
    projectCode: codeClean,
    name: input.name.trim(),
    customer: customerObj._id,
    siteAddress: input.siteAddress.trim(),
    startDate,
    expectedEndDate,
    status: (input.status as ProjectStatus) || 'PLANNING',
    budget: input.budget !== undefined ? Number(input.budget) : undefined,
    notes: input.notes ? input.notes.trim() : undefined,
    createdBy: userObj._id,
  });

  return getProjectById(newProject._id.toString());
};

export const updateProject = async (
  id: string,
  input: UpdateProjectInput
): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const project = await Project.findById(id);
  if (!project) {
    const error = new Error('Project not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Validate Customer if updating customer
  if (input.customer && input.customer !== project.customer.toString()) {
    if (!mongoose.Types.ObjectId.isValid(input.customer)) {
      const error = new Error('Invalid customer ID format');
      (error as any).statusCode = 400;
      throw error;
    }
    const customerObj = await Customer.findById(input.customer);
    if (!customerObj) {
      const error = new Error('Customer not found');
      (error as any).statusCode = 404;
      throw error;
    }
    project.customer = customerObj._id as any;
  }

  // Check unique projectCode if updating code
  if (input.projectCode) {
    const codeClean = input.projectCode.trim().toUpperCase();
    if (codeClean !== project.projectCode) {
      const duplicateCode = await Project.findOne({
        projectCode: codeClean,
        _id: { $ne: id },
      });
      if (duplicateCode) {
        const error = new Error(`Project code "${codeClean}" is already in use by another project`);
        (error as any).statusCode = 400;
        throw error;
      }
      project.projectCode = codeClean;
    }
  }

  if (input.name) project.name = input.name.trim();
  if (input.siteAddress) project.siteAddress = input.siteAddress.trim();
  if (input.startDate) project.startDate = new Date(input.startDate);
  if (input.expectedEndDate !== undefined) {
    project.expectedEndDate = input.expectedEndDate ? new Date(input.expectedEndDate) : undefined;
  }
  if (input.status) project.status = input.status as ProjectStatus;
  if (input.budget !== undefined) project.budget = input.budget !== undefined ? Number(input.budget) : undefined;
  if (input.notes !== undefined) project.notes = input.notes ? input.notes.trim() : undefined;

  await project.save();
  return getProjectById(id);
};

export const deleteProject = async (id: string): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const result = await Project.findByIdAndDelete(id);
  if (!result) {
    const error = new Error('Project not found');
    (error as any).statusCode = 404;
    throw error;
  }

  return true;
};
