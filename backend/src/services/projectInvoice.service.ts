import mongoose from 'mongoose';
import { ProjectInvoice } from '../models/ProjectInvoice';
import { Project } from '../models/Project';
import { MaterialConsumption } from '../models/MaterialConsumption';
import { ProjectExpense } from '../models/ProjectExpense';
import { User } from '../models/User';
import { CreateProjectInvoiceInput } from '../validators/projectInvoice.validator';

const generateInvoiceNumber = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const prefix = `PINV-${currentYear}-`;

  // Find the last invoice for current year
  const lastInvoice = await ProjectInvoice.findOne({
    invoiceNumber: { $regex: new RegExp(`^${prefix}`) },
  })
    .sort({ createdAt: -1 })
    .lean();

  let nextSequence = 1;
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const parts = lastInvoice.invoiceNumber.split('-');
    const lastSeqStr = parts[parts.length - 1];
    const parsedSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(parsedSeq)) {
      nextSequence = parsedSeq + 1;
    }
  }

  let invoiceNumber = `${prefix}${String(nextSequence).padStart(4, '0')}`;
  let exists = await ProjectInvoice.exists({ invoiceNumber });

  while (exists) {
    nextSequence += 1;
    invoiceNumber = `${prefix}${String(nextSequence).padStart(4, '0')}`;
    exists = await ProjectInvoice.exists({ invoiceNumber });
  }

  return invoiceNumber;
};

const mapProjectInvoiceResponse = (inv: any) => ({
  id: inv._id ? inv._id.toString() : inv.id,
  invoiceNumber: inv.invoiceNumber,
  projectId: inv.project
    ? inv.project._id
      ? inv.project._id.toString()
      : inv.project.toString()
    : undefined,
  project:
    inv.project && typeof inv.project === 'object'
      ? {
          id: inv.project._id ? inv.project._id.toString() : inv.project.id,
          name: inv.project.name,
          projectCode: inv.project.projectCode,
          status: inv.project.status,
        }
      : undefined,
  customerId: inv.customer
    ? inv.customer._id
      ? inv.customer._id.toString()
      : inv.customer.toString()
    : undefined,
  customer:
    inv.customer && typeof inv.customer === 'object'
      ? {
          id: inv.customer._id ? inv.customer._id.toString() : inv.customer.id,
          name: inv.customer.name,
          businessName: inv.customer.businessName,
          mobile: inv.customer.mobile,
          email: inv.customer.email,
        }
      : undefined,
  customerSnapshot: inv.customerSnapshot,
  projectSnapshot: inv.projectSnapshot,
  invoiceDate: inv.invoiceDate,
  dueDate: inv.dueDate,
  items: Array.isArray(inv.items)
    ? inv.items.map((item: any) => ({
        type: item.type,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        description: item.description,
        product: item.product,
        quantity: item.quantity,
        unit: item.unit,
        rate: Number(item.rate),
        amount: Number(item.amount),
        gstRate: Number(item.gstRate || 0),
        gstAmount: Number(item.gstAmount || 0),
        lineTotal: Number(item.lineTotal),
      }))
    : [],
  subtotal: Number(inv.subtotal),
  discount: Number(inv.discount || 0),
  taxableAmount: Number(inv.taxableAmount),
  taxAmount: Number(inv.taxAmount),
  grandTotal: Number(inv.grandTotal),
  notes: inv.notes,
  status: inv.status,
  amountPaid: Number(inv.amountPaid || 0),
  balanceDue: Number(inv.balanceDue),
  createdById: inv.createdBy
    ? inv.createdBy._id
      ? inv.createdBy._id.toString()
      : inv.createdBy.toString()
    : undefined,
  createdBy:
    inv.createdBy && typeof inv.createdBy === 'object'
      ? {
          id: inv.createdBy._id ? inv.createdBy._id.toString() : inv.createdBy.id,
          name: inv.createdBy.name,
          email: inv.createdBy.email,
          role: inv.createdBy.role,
        }
      : undefined,
  createdAt: inv.createdAt,
  updatedAt: inv.updatedAt,
});

export const getProjectInvoices = async (query: {
  project?: string;
  customer?: string;
  status?: string;
}): Promise<any[]> => {
  const filter: any = {};

  if (query.project && query.project.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.project)) {
      filter.project = new mongoose.Types.ObjectId(query.project);
    }
  }

  if (query.customer && query.customer.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.customer)) {
      filter.customer = new mongoose.Types.ObjectId(query.customer);
    }
  }

  if (query.status && query.status.trim() !== '') {
    filter.status = query.status.trim().toUpperCase();
  }

  const items = await ProjectInvoice.find(filter)
    .populate('project', 'name projectCode status')
    .populate('customer', 'name businessName mobile email')
    .populate('createdBy', 'name email role')
    .sort({ invoiceDate: -1, createdAt: -1 })
    .lean();

  return items.map(mapProjectInvoiceResponse);
};

export const getProjectInvoicesByProject = async (projectId: string): Promise<any[]> => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const items = await ProjectInvoice.find({ project: new mongoose.Types.ObjectId(projectId) })
    .populate('project', 'name projectCode status')
    .populate('customer', 'name businessName mobile email')
    .populate('createdBy', 'name email role')
    .sort({ invoiceDate: -1, createdAt: -1 })
    .lean();

  return items.map(mapProjectInvoiceResponse);
};

export const getProjectInvoiceById = async (id: string): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid project invoice ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const item = await ProjectInvoice.findById(id)
    .populate('project', 'name projectCode status')
    .populate('customer', 'name businessName mobile email')
    .populate('createdBy', 'name email role')
    .lean();

  if (!item) return null;
  return mapProjectInvoiceResponse(item);
};

export const createProjectInvoice = async (
  input: CreateProjectInvoiceInput,
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

  // 2. Validate Project & Populate Customer
  if (!mongoose.Types.ObjectId.isValid(input.project)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const projectObj = await Project.findById(input.project).populate('customer');
  if (!projectObj) {
    const error = new Error('Project not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (projectObj.status === 'CANCELLED') {
    const error = new Error('Cannot generate invoice for a CANCELLED project');
    (error as any).statusCode = 400;
    throw error;
  }

  if (!projectObj.customer) {
    const error = new Error('Project does not have an assigned customer');
    (error as any).statusCode = 400;
    throw error;
  }

  const customerObj = projectObj.customer as any;

  // 3. Create Snapshots
  const customerSnapshot = {
    name: customerObj.name,
    businessName: customerObj.businessName || undefined,
    gstNumber: customerObj.gstNumber || undefined,
    mobile: customerObj.mobile,
    email: customerObj.email || undefined,
    address: customerObj.address || undefined,
  };

  const projectSnapshot = {
    name: projectObj.name,
    projectCode: projectObj.projectCode,
    siteAddress: projectObj.siteAddress,
  };

  // 4. Validate Line Items & Check Sources
  const processedItems: any[] = [];
  let subtotal = 0;
  let rawTaxAmount = 0;

  for (const item of input.items) {
    const qty = item.quantity !== undefined ? Number(item.quantity) : 1;
    if (qty <= 0) {
      const error = new Error('Line item quantity must be greater than 0');
      (error as any).statusCode = 400;
      throw error;
    }

    const rate = Number(item.rate);
    if (isNaN(rate) || rate < 0) {
      const error = new Error('Line item rate cannot be negative');
      (error as any).statusCode = 400;
      throw error;
    }

    // Source Integrity & Duplicate Billing Verification
    if (item.sourceType === 'MATERIAL_CONSUMPTION' && item.sourceId) {
      if (!mongoose.Types.ObjectId.isValid(item.sourceId)) {
        const error = new Error('Invalid material consumption source ID');
        (error as any).statusCode = 400;
        throw error;
      }

      const mc = await MaterialConsumption.findById(item.sourceId);
      if (!mc) {
        const error = new Error('Referenced material consumption record not found');
        (error as any).statusCode = 404;
        throw error;
      }

      if (mc.project.toString() !== projectObj._id.toString()) {
        const error = new Error(
          `Material consumption ${mc.productName} belongs to a different project`
        );
        (error as any).statusCode = 400;
        throw error;
      }

      const remainingUnbilled = Number(mc.quantity) - Number(mc.billedQuantity || 0);
      if (qty > remainingUnbilled) {
        const error = new Error(
          `Cannot bill ${qty} units for ${mc.productName}. Maximum remaining unbilled: ${remainingUnbilled}`
        );
        (error as any).statusCode = 400;
        throw error;
      }
    } else if (item.sourceType === 'PROJECT_EXPENSE' && item.sourceId) {
      if (!mongoose.Types.ObjectId.isValid(item.sourceId)) {
        const error = new Error('Invalid project expense source ID');
        (error as any).statusCode = 400;
        throw error;
      }

      const pe = await ProjectExpense.findById(item.sourceId);
      if (!pe) {
        const error = new Error('Referenced project expense record not found');
        (error as any).statusCode = 404;
        throw error;
      }

      if (pe.project.toString() !== projectObj._id.toString()) {
        const error = new Error(
          `Project expense ${pe.description} belongs to a different project`
        );
        (error as any).statusCode = 400;
        throw error;
      }

      if (pe.isBilled) {
        const error = new Error(
          `Project expense "${pe.description}" has already been invoiced`
        );
        (error as any).statusCode = 400;
        throw error;
      }
    }

    const amount = qty * rate;
    const gstRate = Number(item.gstRate || 0);
    const gstAmount = amount * (gstRate / 100);
    const lineTotal = amount + gstAmount;

    subtotal += amount;
    rawTaxAmount += gstAmount;

    processedItems.push({
      type: item.type,
      sourceType: item.sourceType,
      sourceId: item.sourceId || undefined,
      description: item.description.trim(),
      product: item.product && mongoose.Types.ObjectId.isValid(item.product) ? item.product : undefined,
      quantity: qty,
      unit: item.unit ? item.unit.trim() : undefined,
      rate,
      amount,
      gstRate,
      gstAmount,
      lineTotal,
    });
  }

  // 5. Calculate Financial Totals
  const discount = Number(input.discount || 0);
  if (discount < 0) {
    const error = new Error('Discount cannot be negative');
    (error as any).statusCode = 400;
    throw error;
  }

  if (discount > subtotal) {
    const error = new Error('Discount cannot exceed invoice subtotal');
    (error as any).statusCode = 400;
    throw error;
  }

  const taxableAmount = subtotal - discount;
  const taxRatio = subtotal > 0 ? taxableAmount / subtotal : 1;
  const taxAmount = rawTaxAmount * taxRatio;
  const grandTotal = taxableAmount + taxAmount;
  const amountPaid = 0;
  const balanceDue = grandTotal;

  // 6. Dates & Invoice Number
  const rawInvDate = input.invoiceDate ? new Date(input.invoiceDate) : new Date();
  const invoiceDate = !isNaN(rawInvDate.getTime()) ? rawInvDate : new Date();

  let dueDate: Date;
  if (input.dueDate) {
    const rawDueDate = new Date(input.dueDate);
    dueDate = !isNaN(rawDueDate.getTime()) ? rawDueDate : new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else {
    dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  const invoiceNumber = await generateInvoiceNumber();

  // 7. Create ProjectInvoice Document (No stock changes! No expense cost changes!)
  const invoiceDoc = await ProjectInvoice.create({
    invoiceNumber,
    project: projectObj._id,
    customer: customerObj._id,
    customerSnapshot,
    projectSnapshot,
    invoiceDate,
    dueDate,
    items: processedItems,
    subtotal,
    discount,
    taxableAmount,
    taxAmount,
    grandTotal,
    notes: input.notes ? input.notes.trim() : undefined,
    status: 'UNPAID',
    amountPaid,
    balanceDue,
    createdBy: userObj._id,
  });

  // 8. Update Source Tracking
  for (const item of processedItems) {
    if (item.sourceType === 'MATERIAL_CONSUMPTION' && item.sourceId) {
      await MaterialConsumption.findByIdAndUpdate(item.sourceId, {
        $inc: { billedQuantity: item.quantity },
      });
    } else if (item.sourceType === 'PROJECT_EXPENSE' && item.sourceId) {
      await ProjectExpense.findByIdAndUpdate(item.sourceId, {
        isBilled: true,
      });
    }
  }

  return getProjectInvoiceById(invoiceDoc._id.toString());
};
