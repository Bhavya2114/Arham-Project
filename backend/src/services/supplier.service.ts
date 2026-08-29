import { Supplier } from '../models/Supplier';
import { CreateSupplierInput, UpdateSupplierInput } from '../validators/supplier.validator';

const mapSupplierResponse = (sup: any) => ({
  id: sup._id ? sup._id.toString() : sup.id,
  name: sup.name,
  companyName: sup.companyName,
  mobile: sup.mobile,
  email: sup.email,
  gstNumber: sup.gstNumber,
  address: sup.address,
  createdAt: sup.createdAt,
  updatedAt: sup.updatedAt,
});

export const getSuppliers = async (): Promise<any[]> => {
  const suppliers = await Supplier.find().sort({ createdAt: -1 }).lean();
  return suppliers.map(mapSupplierResponse);
};

export const getSupplierById = async (id: string): Promise<any> => {
  const supplier = await Supplier.findById(id).lean();
  if (!supplier) return null;
  return mapSupplierResponse(supplier);
};

export const createSupplier = async (input: CreateSupplierInput): Promise<any> => {
  const supplier = await Supplier.create({
    name: input.name,
    companyName: input.companyName,
    mobile: input.mobile,
    email: input.email || undefined,
    gstNumber: input.gstNumber || undefined,
    address: input.address,
  });

  return mapSupplierResponse(supplier);
};

export const updateSupplier = async (id: string, input: UpdateSupplierInput): Promise<any> => {
  const existing = await Supplier.findById(id);
  if (!existing) {
    const error = new Error('Supplier not found');
    (error as any).statusCode = 404;
    throw error;
  }

  const updated = await Supplier.findByIdAndUpdate(
    id,
    {
      name: input.name,
      companyName: input.companyName,
      mobile: input.mobile,
      email: input.email || undefined,
      gstNumber: input.gstNumber || undefined,
      address: input.address,
    },
    { returnDocument: 'after' }
  ).lean();

  return mapSupplierResponse(updated);
};

export const deleteSupplier = async (id: string): Promise<void> => {
  const existing = await Supplier.findById(id);
  if (!existing) {
    const error = new Error('Supplier not found');
    (error as any).statusCode = 404;
    throw error;
  }

  await Supplier.findByIdAndDelete(id);
};
