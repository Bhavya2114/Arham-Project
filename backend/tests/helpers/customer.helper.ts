import mongoose from 'mongoose';
import { Customer } from '../../src/models/Customer';
import { User } from '../../src/models/User';

export const createTestCustomer = async (data: {
  name?: string;
  mobile?: string;
  email?: string;
  businessName?: string;
  gstNumber?: string;
  type?: any;
  address?: string;
  status?: any;
} = {}): Promise<any> => {
  let admin = await User.findOne({ role: 'ADMIN' });
  if (!admin) {
    admin = await User.findOne();
  }
  const timestamp = Date.now();
  const customer = await Customer.create({
    name: data.name || `Test Customer ${timestamp}`,
    mobile: data.mobile || `9${Math.floor(100000000 + Math.random() * 900000000)}`,
    email: data.email || `customer_${timestamp}@test.com`,
    businessName: data.businessName || `${data.name || 'Test Customer'} Ltd`,
    gstNumber: data.gstNumber || '27ABCDE1234F1Z5',
    type: data.type || 'WHOLESALE',
    status: data.status || 'ACTIVE',
    address: data.address || 'Test Address, Pune',
    createdBy: admin?._id || new mongoose.Types.ObjectId(),
  });
  return customer;
};
