import { Customer } from '../models/Customer';
import { Sale } from '../models/Sale';
import {
  CreateCustomerInput,
  CustomerQueryInput,
  CreateFollowUpInput,
} from '../validators/customer.validator';

export const getCustomers = async (query: CustomerQueryInput): Promise<any> => {
  const { search, page = 1, limit = 10, status, type } = query;
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (status) {
    filter.status = status;
  }

  if (type) {
    filter.type = type;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { businessName: { $regex: search, $options: 'i' } },
      { mobile: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [total, items] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  const data = items.map((item: any) => ({
    ...item,
    id: item._id.toString(),
    creator: item.createdBy ? {
      id: item.createdBy._id ? item.createdBy._id.toString() : item.createdBy,
      name: item.createdBy.name,
      email: item.createdBy.email,
      role: item.createdBy.role,
    } : null,
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

export const getCustomerById = async (id: string): Promise<any> => {
  const customer = await Customer.findById(id).populate('createdBy', 'name email role').lean();
  if (!customer) return null;

  return {
    ...customer,
    id: (customer as any)._id.toString(),
    creator: (customer as any).createdBy ? {
      id: (customer as any).createdBy._id ? (customer as any).createdBy._id.toString() : (customer as any).createdBy,
      name: (customer as any).createdBy.name,
      email: (customer as any).createdBy.email,
      role: (customer as any).createdBy.role,
    } : null,
  };
};

export const createCustomer = async (input: CreateCustomerInput, createdBy: string): Promise<any> => {
  const customer = await Customer.create({
    name: input.name,
    mobile: input.mobile,
    email: input.email || undefined,
    businessName: input.businessName,
    gstNumber: input.gstNumber || undefined,
    type: input.type as any,
    address: input.address,
    status: input.status as any,
    notes: input.notes || undefined,
    createdBy,
  });

  return getCustomerById((customer as any)._id.toString());
};

export const updateCustomer = async (
  id: string,
  input: CreateCustomerInput
): Promise<any> => {
  const existing = await Customer.findById(id);
  if (!existing) {
    const error = new Error('Customer not found');
    (error as any).statusCode = 404;
    throw error;
  }

  await Customer.findByIdAndUpdate(id, {
    name: input.name,
    mobile: input.mobile,
    email: input.email || undefined,
    businessName: input.businessName,
    gstNumber: input.gstNumber || undefined,
    type: input.type,
    address: input.address,
    status: input.status,
    notes: input.notes || undefined,
  });

  return getCustomerById(id);
};

export const deleteCustomer = async (id: string): Promise<void> => {
  const customer = await Customer.findById(id);
  if (!customer) {
    const error = new Error('Customer not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Check if customer has existing sales records
  const existingSale = await Sale.findOne({ customerId: id });
  if (existingSale) {
    const error = new Error('Cannot delete this customer because they have existing sales records.');
    (error as any).statusCode = 400;
    throw error;
  }

  await Customer.findByIdAndDelete(id);
};

export const getFollowUps = async (customerId: string): Promise<any> => {
  const customer = await Customer.findById(customerId).populate('followUps.createdById', 'name email role').lean();
  if (!customer) {
    const error = new Error('Customer not found');
    (error as any).statusCode = 404;
    throw error;
  }

  const followUps = (customer as any).followUps || [];
  return followUps.map((fw: any) => ({
    id: fw._id ? fw._id.toString() : fw.id,
    customerId,
    createdById: fw.createdById ? (fw.createdById._id ? fw.createdById._id.toString() : fw.createdById.toString()) : undefined,
    note: fw.note,
    followUpDate: fw.followUpDate,
    createdAt: fw.createdAt,
    creator: fw.createdById && typeof fw.createdById === 'object' ? {
      id: fw.createdById._id ? fw.createdById._id.toString() : fw.createdById.id,
      name: fw.createdById.name,
      email: fw.createdById.email,
      role: fw.createdById.role,
    } : null,
  }));
};

export const createFollowUp = async (
  customerId: string,
  input: CreateFollowUpInput,
  createdById: string
): Promise<any> => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    const error = new Error('Customer not found');
    (error as any).statusCode = 404;
    throw error;
  }

  const newFollowUp = {
    note: input.note,
    followUpDate: input.followUpDate ? new Date(input.followUpDate) : new Date(),
    createdById: createdById as any,
    createdAt: new Date(),
  };

  customer.followUps.push(newFollowUp as any);
  await customer.save();

  const updatedFollowUps = await getFollowUps(customerId);
  return updatedFollowUps[updatedFollowUps.length - 1];
};
