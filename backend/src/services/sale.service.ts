import { Sale } from '../models/Sale';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { User } from '../models/User';
import { CreateSaleInput } from '../validators/sale.validator';
import { calculateItemGst } from '../utils/tax';

const mapSaleResponse = (sale: any) => ({
  id: sale._id ? sale._id.toString() : sale.id,
  invoiceNumber: sale.invoiceNumber,
  customerId: sale.customer ? (sale.customer._id ? sale.customer._id.toString() : sale.customer.toString()) : undefined,
  customer: sale.customer && typeof sale.customer === 'object' ? {
    id: sale.customer._id ? sale.customer._id.toString() : sale.customer.id,
    name: sale.customer.name,
    mobile: sale.customer.mobile,
    email: sale.customer.email,
    businessName: sale.customer.businessName,
    gstNumber: sale.customer.gstNumber,
  } : undefined,
  saleDate: sale.saleDate,
  items: (sale.items || []).map((item: any) => ({
    productId: item.product ? (item.product._id ? item.product._id.toString() : item.product.toString()) : undefined,
    productName: item.productName,
    sku: item.sku,
    costPrice: Number(item.costPrice),
    sellingPrice: Number(item.sellingPrice),
    quantity: item.quantity,
    gstRate: Number(item.gstRate || 0),
    gstAmount: Number(item.gstAmount || 0),
    lineTotal: Number(item.lineTotal),
    itemProfit: Number(item.itemProfit),
  })),
  subtotal: Number(sale.subtotal),
  totalGst: Number(sale.totalGst),
  grandTotal: Number(sale.grandTotal),
  totalCost: Number(sale.totalCost),
  totalProfit: Number(sale.totalProfit),
  paymentStatus: sale.paymentStatus,
  paymentMode: sale.paymentMode,
  notes: sale.notes,
  createdBy: sale.createdBy ? (sale.createdBy._id ? sale.createdBy._id.toString() : sale.createdBy.toString()) : undefined,
  creator: sale.createdBy && typeof sale.createdBy === 'object' ? {
    id: sale.createdBy._id ? sale.createdBy._id.toString() : sale.createdBy.id,
    name: sale.createdBy.name,
    email: sale.createdBy.email,
    role: sale.createdBy.role,
  } : undefined,
  createdAt: sale.createdAt,
  updatedAt: sale.updatedAt,
});

export const getSales = async (): Promise<any[]> => {
  const sales = await Sale.find()
    .populate('customer', 'name mobile email businessName gstNumber')
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

  return sales.map(mapSaleResponse);
};

export const getSaleById = async (id: string): Promise<any> => {
  const sale = await Sale.findById(id)
    .populate('customer', 'name mobile email businessName gstNumber address')
    .populate('createdBy', 'name email role')
    .lean();
  if (!sale) return null;
  return mapSaleResponse(sale);
};

export const createSale = async (
  input: CreateSaleInput,
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

  // 2. Validate Customer
  const customer = await Customer.findById(input.customerId);
  if (!customer) {
    const error = new Error('Customer not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // 3. Aggregate total requested quantities per productId to handle duplicate cart lines cleanly
  const aggregatedQuantities = new Map<string, number>();
  for (const itemInput of input.items) {
    const currentTotal = aggregatedQuantities.get(itemInput.productId) || 0;
    aggregatedQuantities.set(itemInput.productId, currentTotal + itemInput.quantity);
  }

  // 4. Pre-check stock for all unique products before applying any mutations
  const uniqueProductIds = Array.from(aggregatedQuantities.keys());
  const productMap = new Map<string, any>();

  for (const prodId of uniqueProductIds) {
    const product = await Product.findById(prodId);
    if (!product) {
      const error = new Error(`Product not found with ID: ${prodId}`);
      (error as any).statusCode = 404;
      throw error;
    }

    const totalRequested = aggregatedQuantities.get(prodId) || 0;
    if (product.currentStock < totalRequested) {
      const error = new Error(
        `Insufficient stock for product: ${product.name}. Available: ${product.currentStock}, Requested: ${totalRequested}`
      );
      (error as any).statusCode = 409;
      throw error;
    }

    productMap.set(prodId, product);
  }

  // 5. Perform Atomic Stock Deductions per Unique Product with Rollback Safeguard
  const rollbacks: Array<{ productId: any; qty: number }> = [];
  const saleItems: any[] = [];
  let subtotal = 0;
  let totalGst = 0;
  let totalCost = 0;
  let totalProfit = 0;

  try {
    // Deduct stock for each unique product atomically
    for (const [prodId, qtyToDeduct] of aggregatedQuantities.entries()) {
      const product = productMap.get(prodId);

      const updatedProduct = await Product.findOneAndUpdate(
        { _id: product._id, currentStock: { $gte: qtyToDeduct } },
        { $inc: { currentStock: -qtyToDeduct } },
        { returnDocument: 'after' }
      );

      if (!updatedProduct) {
        const error = new Error(`Insufficient stock for product: ${product.name}`);
        (error as any).statusCode = 409;
        throw error;
      }

      rollbacks.push({ productId: product._id, qty: qtyToDeduct });
    }

    // Build line items and financial totals for the Sale document
    for (const itemInput of input.items) {
      const product = productMap.get(itemInput.productId);
      const costPrice = product.costPrice || 0;
      const sellingPrice =
        itemInput.sellingPrice !== undefined
          ? itemInput.sellingPrice
          : product.sellingPrice || product.unitPrice;
      const gstRate = itemInput.gstRate !== undefined ? itemInput.gstRate : (product.gstRate || 0);

      const { gstAmount, lineTotal } = calculateItemGst(sellingPrice, itemInput.quantity, gstRate);
      const itemCost = costPrice * itemInput.quantity;
      const itemProfit = sellingPrice * itemInput.quantity - itemCost;

      saleItems.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        costPrice,
        sellingPrice,
        quantity: itemInput.quantity,
        gstRate,
        gstAmount,
        lineTotal,
        itemProfit,
      });

      subtotal += sellingPrice * itemInput.quantity;
      totalGst += gstAmount;
      totalCost += itemCost;
      totalProfit += itemProfit;
    }

    const grandTotal = subtotal + totalGst;
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const sale = await Sale.create({
      invoiceNumber,
      customer: customer._id,
      saleDate: input.saleDate ? new Date(input.saleDate) : new Date(),
      items: saleItems,
      subtotal,
      totalGst,
      grandTotal,
      totalCost,
      totalProfit,
      paymentStatus: input.paymentStatus || 'PAID',
      paymentMode: input.paymentMode || 'CASH',
      notes: input.notes,
      createdBy: userObj._id,
    });

    return getSaleById(sale._id.toString());
  } catch (err) {
    // Revert product stock deductions if sale creation fails
    for (const rb of rollbacks) {
      await Product.findByIdAndUpdate(rb.productId, {
        $inc: { currentStock: rb.qty },
      });
    }
    throw err;
  }
};
