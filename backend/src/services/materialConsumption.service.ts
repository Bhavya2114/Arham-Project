import mongoose from 'mongoose';
import { MaterialConsumption } from '../models/MaterialConsumption';
import { Project } from '../models/Project';
import { Product } from '../models/Product';
import { roundStoredStock } from '../utils/stockQty';
import { User } from '../models/User';
import { CreateMaterialConsumptionInput } from '../validators/materialConsumption.validator';
import { PROJECT_GST_RATE, PROJECT_GST_MULTIPLIER, roundToTwo, getFixedBillingRate } from '../constants/projectGst.constants';

const mapMaterialConsumptionResponse = (mc: any) => {
  const actualCostPrice = Number(mc.actualCostPrice || 0);
  const actualCostTotal = Number(mc.actualCostTotal || 0);

  // Business Rule: Fixed 18% GST and non-editable billing rate for all project materials
  const gstRate = PROJECT_GST_RATE;
  const inputGst = roundToTwo(actualCostTotal * PROJECT_GST_MULTIPLIER);
  const issuedMaterialValueIncludingGST = roundToTwo(actualCostTotal + inputGst);
  const billingPrice = getFixedBillingRate(actualCostPrice);
  const billingTotal = roundToTwo(Number(mc.quantity || 0) * billingPrice);

  return {
    id: mc._id ? mc._id.toString() : mc.id,
    projectId: mc.project
      ? mc.project._id
        ? mc.project._id.toString()
        : mc.project.toString()
      : undefined,
    project:
      mc.project && typeof mc.project === 'object'
        ? {
            id: mc.project._id ? mc.project._id.toString() : mc.project.id,
            name: mc.project.name,
            projectCode: mc.project.projectCode,
            status: mc.project.status,
          }
        : undefined,
    productId: mc.product
      ? mc.product._id
        ? mc.product._id.toString()
        : mc.product.toString()
      : undefined,
    product:
      mc.product && typeof mc.product === 'object'
        ? {
            id: mc.product._id ? mc.product._id.toString() : mc.product.id,
            name: mc.product.name,
            sku: mc.product.sku,
            unit: mc.product.unit,
            gstRate: PROJECT_GST_RATE,
          }
        : undefined,
    productName: mc.productName,
    sku: mc.sku,
    quantity: Number(mc.quantity),
    unit: mc.unit,
    actualCostPrice,
    billingPrice,
    actualCostTotal,
    billingTotal,
    gstRate,
    inputGst,
    issuedMaterialValueIncludingGST,
    supplierInvoiceTotal: issuedMaterialValueIncludingGST,
    supplierInvoiceValue: issuedMaterialValueIncludingGST,
    billedQuantity: Number(mc.billedQuantity || 0),
    unbilledQuantity: Math.max(0, Number(mc.quantity || 0) - Number(mc.billedQuantity || 0)),
    issueDate: mc.issueDate,
    issuedById: mc.issuedBy
      ? mc.issuedBy._id
        ? mc.issuedBy._id.toString()
        : mc.issuedBy.toString()
      : undefined,
    issuedBy:
      mc.issuedBy && typeof mc.issuedBy === 'object'
        ? {
            id: mc.issuedBy._id ? mc.issuedBy._id.toString() : mc.issuedBy.id,
            name: mc.issuedBy.name,
            email: mc.issuedBy.email,
            role: mc.issuedBy.role,
          }
        : undefined,
    notes: mc.notes,
    createdAt: mc.createdAt,
    updatedAt: mc.updatedAt,
  };
};

export const getMaterialConsumptions = async (query: {
  project?: string;
  product?: string;
}): Promise<any[]> => {
  const filter: any = {};

  if (query.project && query.project.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.project)) {
      filter.project = new mongoose.Types.ObjectId(query.project);
    }
  }

  if (query.product && query.product.trim() !== '') {
    if (mongoose.Types.ObjectId.isValid(query.product)) {
      filter.product = new mongoose.Types.ObjectId(query.product);
    }
  }

  const items = await MaterialConsumption.find(filter)
    .populate('project', 'name projectCode status')
    .populate('product', 'name sku unit gstRate costPrice')
    .populate('issuedBy', 'name email role')
    .sort({ issueDate: -1, createdAt: -1 })
    .lean();

  return items.map(mapMaterialConsumptionResponse);
};

export const getMaterialConsumptionsByProject = async (projectId: string): Promise<any[]> => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const items = await MaterialConsumption.find({ project: new mongoose.Types.ObjectId(projectId) })
    .populate('project', 'name projectCode status')
    .populate('product', 'name sku unit gstRate costPrice')
    .populate('issuedBy', 'name email role')
    .sort({ issueDate: -1, createdAt: -1 })
    .lean();

  return items.map(mapMaterialConsumptionResponse);
};

export const getMaterialConsumptionById = async (id: string): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid material consumption ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const item = await MaterialConsumption.findById(id)
    .populate('project', 'name projectCode status')
    .populate('product', 'name sku unit gstRate costPrice')
    .populate('issuedBy', 'name email role')
    .lean();

  if (!item) return null;
  return mapMaterialConsumptionResponse(item);
};

export const createMaterialConsumption = async (
  input: CreateMaterialConsumptionInput,
  issuedBy: string
): Promise<any> => {
  // 1. Validate Authenticated User
  if (!issuedBy) {
    const error = new Error('User authentication required');
    (error as any).statusCode = 401;
    throw error;
  }

  const userObj = await User.findById(issuedBy);
  if (!userObj) {
    const error = new Error('Authenticated user not found. Please log in again.');
    (error as any).statusCode = 401;
    throw error;
  }

  // 2. Validate Project Exists and is Active (Cannot issue materials to COMPLETED or CANCELLED projects)
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
    const error = new Error(`Cannot issue materials to a ${projectObj.status} project`);
    (error as any).statusCode = 400;
    throw error;
  }

  // 3. Validate Product Exists
  if (!mongoose.Types.ObjectId.isValid(input.product)) {
    const error = new Error('Invalid product ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const productObj = await Product.findById(input.product);
  if (!productObj) {
    const error = new Error('Product not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // 4. Validate Quantity
  const qty = Number(input.quantity);
  if (isNaN(qty) || qty <= 0) {
    const error = new Error('Quantity must be greater than 0');
    (error as any).statusCode = 400;
    throw error;
  }

  // 5. Derive Snapshot Fields
  const actualCostPrice = Number(productObj.costPrice || 0);
  const actualCostTotal = roundToTwo(qty * actualCostPrice);

  // Business Rule: Fixed 18% GST and non-editable billing rate (dealer cost + fixed 18% GST)
  const billingPrice = getFixedBillingRate(actualCostPrice);
  const billingTotal = roundToTwo(qty * billingPrice);

  const gstRate = PROJECT_GST_RATE;
  const inputGst = roundToTwo(actualCostTotal * PROJECT_GST_MULTIPLIER);
  const issuedMaterialValueIncludingGST = roundToTwo(actualCostTotal + inputGst);

  const rawIssueDate = input.issueDate ? new Date(input.issueDate) : new Date();
  const issueDate = !isNaN(rawIssueDate.getTime()) ? rawIssueDate : new Date();

  // 6. Perform Atomic Stock Deduction ({ currentStock: { $gte: qty } })
  const updatedProduct = await Product.findOneAndUpdate(
    { _id: productObj._id, currentStock: { $gte: qty } },
    { $inc: { currentStock: -qty } },
    { returnDocument: 'after' }
  );

  if (!updatedProduct) {
    const error = new Error(
      `Insufficient stock for product: ${productObj.name}. Available: ${productObj.currentStock}, Requested: ${qty}`
    );
    (error as any).statusCode = 409;
    throw error;
  }
  await roundStoredStock([productObj._id]);

  // 7. Create MaterialConsumption Document with Rollback Safeguard
  try {
    const mc = await MaterialConsumption.create({
      project: projectObj._id,
      product: productObj._id,
      productName: productObj.name,
      sku: productObj.sku,
      quantity: qty,
      unit: productObj.unit || 'pcs',
      actualCostPrice,
      billingPrice,
      actualCostTotal,
      billingTotal,
      gstRate,
      inputGst,
      issuedMaterialValueIncludingGST,
      supplierInvoiceTotal: issuedMaterialValueIncludingGST,
      issueDate,
      issuedBy: userObj._id,
      notes: input.notes ? input.notes.trim() : undefined,
    });

    return getMaterialConsumptionById(mc._id.toString());
  } catch (createErr) {
    // Revert stock deduction if record creation fails
    await Product.findByIdAndUpdate(productObj._id, {
      $inc: { currentStock: qty },
    });
    await roundStoredStock([productObj._id]);
    throw createErr;
  }
};
