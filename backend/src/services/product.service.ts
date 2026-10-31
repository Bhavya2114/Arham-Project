import { Product } from '../models/Product';
import {
  CreateProductInput,
  UpdateProductInput,
} from '../validators/product.validator';
import { roundQty } from '../utils/stockQty';

const mapProductResponse = (product: any) => {
  return {
    id: product._id ? product._id.toString() : product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    costPrice: Number(product.costPrice || 0),
    gstRate: Number(product.gstRate || 0),
    currentStock: product.currentStock,
    minStockQuantity: product.minimumStock,
    location: product.warehouseLocation,
    unit: product.unit || 'pcs',
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

export const getProducts = async (): Promise<any[]> => {
  const products = await Product.find().sort({ createdAt: -1 }).lean();
  return products.map(mapProductResponse);
};

export const getProductById = async (id: string): Promise<any> => {
  const product = await Product.findById(id).lean();
  if (!product) return null;
  return mapProductResponse(product);
};

export const createProduct = async (input: CreateProductInput, createdBy: string): Promise<any> => {
  const existing = await Product.findOne({ sku: input.sku.toUpperCase() });
  if (existing) {
    const error = new Error('Product with this SKU already exists');
    (error as any).statusCode = 400;
    throw error;
  }

  const costPrice = (input as any).costPrice || 0;

  const product = await Product.create({
    name: input.name,
    sku: input.sku.toUpperCase(),
    category: input.category,
    costPrice: costPrice,
    gstRate: (input as any).gstRate || 0,
    currentStock: roundQty(input.currentStock ?? 0),
    minimumStock: input.minStockQuantity ?? 5,
    warehouseLocation: input.location || 'Main Warehouse',
    unit: input.unit || 'pcs',
    createdBy,
  });

  return mapProductResponse(product);
};

export const updateProduct = async (
  id: string,
  input: UpdateProductInput
): Promise<any> => {
  const existing = await Product.findById(id);
  if (!existing) {
    const error = new Error('Product not found');
    (error as any).statusCode = 404;
    throw error;
  }

  const duplicateSku = await Product.findOne({
    sku: input.sku.toUpperCase(),
    _id: { $ne: id },
  });
  if (duplicateSku) {
    const error = new Error('Product with this SKU already exists');
    (error as any).statusCode = 400;
    throw error;
  }

  const costPrice = input.costPrice !== undefined ? input.costPrice : existing.costPrice;

  const updateFields: any = {
    name: input.name,
    sku: input.sku.toUpperCase(),
    category: input.category,
    costPrice: costPrice,
    minimumStock: input.minStockQuantity,
    warehouseLocation: input.location,
  };

  if (input.gstRate !== undefined) {
    updateFields.gstRate = input.gstRate;
  }
  if (input.unit !== undefined) {
    updateFields.unit = input.unit;
  }

  const product = await Product.findByIdAndUpdate(
    id,
    updateFields,
    { returnDocument: 'after' }
  ).lean();

  return mapProductResponse(product);
};

export const deleteProduct = async (_id: string): Promise<never> => {
  throw new Error('Product delete service not implemented');
};

export const getLowStockProducts = async (): Promise<any[]> => {
  const lowStockProducts = await Product.find({
    $expr: { $lte: ['$currentStock', '$minimumStock'] },
  })
    .sort({ createdAt: -1 })
    .lean();

  return lowStockProducts.map((product: any) => ({
    id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    category: product.category,
    costPrice: Number(product.costPrice || 0),
    currentStock: product.currentStock,
    minStockQuantity: product.minimumStock,
    location: product.warehouseLocation,
    stockDeficit: Math.max(0, product.minimumStock - product.currentStock),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }));
};
