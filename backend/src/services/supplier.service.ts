import mongoose from 'mongoose';
import { Supplier } from '../models/Supplier';
import { Purchase } from '../models/Purchase';
import { CreateSupplierInput, UpdateSupplierInput } from '../validators/supplier.validator';

// Old bill-created suppliers were saved with this placeholder instead of a real number
const PLACEHOLDER_MOBILE = '0000000000';

const emptyStats = { billCount: 0, totalPurchased: 0, monthPurchased: 0, yearPurchased: 0, lastPurchaseDate: null };

const mapSupplierResponse = (sup: any, stats: any = emptyStats) => ({
  id: sup._id ? sup._id.toString() : sup.id,
  name: sup.name,
  companyName: sup.companyName,
  contactPerson: sup.contactPerson,
  mobile: sup.mobile && sup.mobile !== PLACEHOLDER_MOBILE ? sup.mobile : '',
  email: sup.email,
  gstNumber: sup.gstNumber,
  address: sup.address,
  billCount: stats.billCount || 0,
  totalPurchased: Math.round((stats.totalPurchased || 0) * 100) / 100,
  monthPurchased: Math.round((stats.monthPurchased || 0) * 100) / 100,
  yearPurchased: Math.round((stats.yearPurchased || 0) * 100) / 100,
  lastPurchaseDate: stats.lastPurchaseDate || null,
  createdAt: sup.createdAt,
  updatedAt: sup.updatedAt,
});

// Start of the current month and year in Indian time (IST, UTC+5:30), as UTC dates
const IST_OFFSET_MS = 330 * 60 * 1000;
const getIstPeriodStarts = () => {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  return {
    monthStart: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS),
    yearStart: new Date(Date.UTC(y, 0, 1) - IST_OFFSET_MS),
  };
};

// One aggregate for all suppliers: bills, total bought, this month, this year, last bill date
const getPurchaseStats = async (supplierIds?: mongoose.Types.ObjectId[]) => {
  const { monthStart, yearStart } = getIstPeriodStarts();
  const match: any = supplierIds ? { supplier: { $in: supplierIds } } : {};
  const rows = await Purchase.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$supplier',
        billCount: { $sum: 1 },
        totalPurchased: { $sum: { $ifNull: ['$totalAmount', 0] } },
        monthPurchased: {
          $sum: { $cond: [{ $gte: ['$purchaseDate', monthStart] }, { $ifNull: ['$totalAmount', 0] }, 0] },
        },
        yearPurchased: {
          $sum: { $cond: [{ $gte: ['$purchaseDate', yearStart] }, { $ifNull: ['$totalAmount', 0] }, 0] },
        },
        lastPurchaseDate: { $max: '$purchaseDate' },
      },
    },
  ]);
  const byId = new Map<string, any>();
  rows.forEach((r) => {
    if (r._id) byId.set(r._id.toString(), r);
  });
  return byId;
};

const notFound = () => {
  const error = new Error('Supplier not found');
  (error as any).statusCode = 404;
  return error;
};

export const getSuppliers = async (): Promise<any[]> => {
  const [suppliers, stats] = await Promise.all([Supplier.find().sort({ createdAt: -1 }).lean(), getPurchaseStats()]);
  return suppliers.map((s: any) => mapSupplierResponse(s, stats.get(s._id.toString())));
};

export const getSupplierById = async (id: string): Promise<any> => {
  if (!mongoose.isValidObjectId(id)) return null;
  const supplier = await Supplier.findById(id).lean();
  if (!supplier) return null;
  const stats = await getPurchaseStats([supplier._id as mongoose.Types.ObjectId]);
  return mapSupplierResponse(supplier, stats.get(supplier._id.toString()));
};

export const createSupplier = async (input: CreateSupplierInput): Promise<any> => {
  const supplier = await Supplier.create({
    name: input.name,
    companyName: input.companyName,
    contactPerson: input.contactPerson || undefined,
    mobile: input.mobile || undefined,
    email: input.email || undefined,
    gstNumber: input.gstNumber || undefined,
    address: input.address,
  });

  return mapSupplierResponse(supplier.toObject());
};

export const updateSupplier = async (id: string, input: UpdateSupplierInput): Promise<any> => {
  const existing = await Supplier.findById(id);
  if (!existing) throw notFound();

  // Empty fields are cleared; companyName is left alone when the form doesn't send it
  const set: Record<string, any> = { name: input.name };
  const unset: Record<string, ''> = {};
  const fields: [string, string | undefined][] = [
    ['contactPerson', input.contactPerson],
    ['mobile', input.mobile],
    ['email', input.email],
    ['gstNumber', input.gstNumber],
    ['address', input.address],
  ];
  fields.forEach(([key, value]) => {
    if (value) set[key] = value;
    else unset[key] = '';
  });
  if (input.companyName) set.companyName = input.companyName;

  const updated = await Supplier.findByIdAndUpdate(
    id,
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: 'after', runValidators: true }
  ).lean();

  const stats = await getPurchaseStats([existing._id as mongoose.Types.ObjectId]);
  return mapSupplierResponse(updated, stats.get(existing._id.toString()));
};

export const deleteSupplier = async (id: string): Promise<void> => {
  const existing = await Supplier.findById(id);
  if (!existing) throw notFound();

  // Bills keep pointing at their supplier; deleting it would turn them into "Unknown supplier"
  const billCount = await Purchase.countDocuments({ supplier: existing._id });
  if (billCount > 0) {
    const error = new Error(
      `Can't delete "${existing.name}": it has ${billCount} ${billCount === 1 ? 'bill' : 'bills'}`
    );
    (error as any).statusCode = 409;
    throw error;
  }

  await Supplier.findByIdAndDelete(id);
};
