import { Purchase } from '../models/Purchase';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { User } from '../models/User';
import { CreatePurchaseInput } from '../validators/purchase.validator';

const mapPurchaseResponse = (purchase: any) => {
  const mappedItems = (purchase.items || []).map((item: any) => {
    const prodObj = item.product && typeof item.product === 'object' ? item.product : null;
    const productId = item.product ? (prodObj ? (prodObj._id ? prodObj._id.toString() : prodObj.id) : item.product.toString()) : undefined;
    const productName = item.productName || (prodObj ? prodObj.name : null) || (productId ? `Item (${productId.substring(0, 8)}...)` : 'Unknown Product');
    const sku = item.sku || (prodObj ? prodObj.sku : null) || '';

    const price = Number(item.purchasePrice || 0);
    const qty = Number(item.quantity || 0);
    const taxRate = Number(item.taxRate || 0);
    const itemSubtotal = price * qty;
    const itemTax = (itemSubtotal * taxRate) / 100;
    const calculatedTotalCost = itemSubtotal + itemTax;

    const totalCost = Number(
      item.totalCost !== undefined && item.totalCost !== null && !isNaN(item.totalCost) && item.totalCost > 0
        ? item.totalCost
        : calculatedTotalCost
    );

    return {
      productId,
      productName,
      sku,
      product: prodObj ? {
        id: prodObj._id ? prodObj._id.toString() : prodObj.id,
        name: prodObj.name,
        sku: prodObj.sku,
      } : undefined,
      purchasePrice: price,
      quantity: qty,
      taxRate: taxRate,
      subtotal: itemSubtotal,
      taxAmount: itemTax,
      totalCost: totalCost,
      lineTotal: totalCost,
    };
  });

  let subtotal = Number(purchase.subtotal || 0);
  let taxAmount = Number(purchase.taxAmount || 0);
  let totalAmount = Number(purchase.totalAmount || 0);

  if (totalAmount === 0 && mappedItems.length > 0) {
    subtotal = mappedItems.reduce((sum: number, i: any) => sum + i.subtotal, 0);
    taxAmount = mappedItems.reduce((sum: number, i: any) => sum + i.taxAmount, 0);
    totalAmount = subtotal + taxAmount;
  }

  return {
    id: purchase._id ? purchase._id.toString() : purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    invoiceNumber: purchase.invoiceNumber,
    poNumber: purchase.poNumber,
    paymentTerms: purchase.paymentTerms,
    deliveryNoteNo: purchase.deliveryNoteNo,
    deliveryNoteDate: purchase.deliveryNoteDate,
    ewayBillNo: purchase.ewayBillNo,
    placeOfSupply: purchase.placeOfSupply,
    supplierId: purchase.supplier ? (purchase.supplier._id ? purchase.supplier._id.toString() : purchase.supplier.toString()) : undefined,
    supplier: purchase.supplier && typeof purchase.supplier === 'object' ? {
      id: purchase.supplier._id ? purchase.supplier._id.toString() : purchase.supplier.id,
      name: purchase.supplier.name,
      companyName: purchase.supplier.companyName,
      contactPerson: purchase.supplier.contactPerson,
      mobile: purchase.supplier.mobile,
      email: purchase.supplier.email,
      gstNumber: purchase.supplier.gstNumber,
    } : undefined,
    purchaseDate: purchase.purchaseDate,
    items: mappedItems,
    subtotal: subtotal,
    taxAmount: taxAmount,
    totalGst: taxAmount,
    totalAmount: totalAmount,
    grandTotal: totalAmount,
    notes: purchase.notes,
    createdBy: purchase.createdBy ? (purchase.createdBy._id ? purchase.createdBy._id.toString() : purchase.createdBy.toString()) : undefined,
    creator: purchase.createdBy && typeof purchase.createdBy === 'object' ? {
      id: purchase.createdBy._id ? purchase.createdBy._id.toString() : purchase.createdBy.id,
      name: purchase.createdBy.name,
      email: purchase.createdBy.email,
      role: purchase.createdBy.role,
    } : undefined,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
  };
};

export const getPurchases = async (): Promise<any[]> => {
  const purchases = await Purchase.find()
    .populate('supplier', 'name companyName contactPerson mobile email gstNumber')
    .populate('items.product', 'name sku category')
    .populate('createdBy', 'name email role')
    .sort({ purchaseDate: -1, createdAt: -1 })
    .lean();

  return purchases.map(mapPurchaseResponse);
};

export const getPurchaseById = async (id: string): Promise<any> => {
  const purchase = await Purchase.findById(id)
    .populate('supplier', 'name companyName contactPerson mobile email gstNumber')
    .populate('items.product', 'name sku category')
    .populate('createdBy', 'name email role')
    .lean();
  if (!purchase) return null;
  return mapPurchaseResponse(purchase);
};

export const createPurchase = async (
  input: CreatePurchaseInput,
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

  // 2. Resolve Supplier (Existing vs New with Duplicate Protection)
  let supplier: any = null;
  if (input.supplierId && input.supplierId.trim() !== '') {
    try {
      supplier = await Supplier.findById(input.supplierId);
    } catch (_err) {
      supplier = null;
    }
  }

  if (!supplier && input.newSupplier && input.newSupplier.name) {
    const supNameClean = input.newSupplier.name.trim();
    const supGstClean = input.newSupplier.gstNumber ? input.newSupplier.gstNumber.trim().toUpperCase() : '';

    // Duplicate Protection Re-check 1: By GSTIN
    if (supGstClean) {
      supplier = await Supplier.findOne({ gstNumber: supGstClean });
    }

    // Duplicate Protection Re-check 2: By exact / case-insensitive name
    if (!supplier) {
      supplier = await Supplier.findOne({
        name: { $regex: new RegExp(`^${supNameClean.replace(/[^a-zA-Z0-9]/g, '\\$&')}$`, 'i') },
      });
    }

    // Create New Supplier if no duplicate found
    if (!supplier) {
      supplier = await Supplier.create({
        name: supNameClean,
        gstNumber: supGstClean || undefined,
        mobile: input.newSupplier.mobile || '0000000000',
        email: input.newSupplier.email || undefined,
        address: input.newSupplier.address || undefined,
        companyName: input.newSupplier.companyName || supNameClean,
      });
    }
  }

  if (!supplier) {
    const error = new Error('Supplier not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // 3. Resolve Products (Existing vs New with Duplicate Protection)
  const productDocs: Array<{ product: any; itemInput: any }> = [];
  const newlyCreatedProductIds: any[] = [];

  try {
    for (const itemInput of input.items) {
      let product: any = null;
      if (itemInput.productId && itemInput.productId.trim() !== '') {
        try {
          product = await Product.findById(itemInput.productId);
        } catch (_err) {
          product = null;
        }
      }

      if (!product && itemInput.newProduct && itemInput.newProduct.name) {
        const prodNameClean = itemInput.newProduct.name.trim();

        // Duplicate Protection Re-check 1: By case-insensitive name
        product = await Product.findOne({
          name: { $regex: new RegExp(`^${prodNameClean.replace(/[^a-zA-Z0-9]/g, '\\$&')}$`, 'i') },
        });

        // Duplicate Protection Re-check 2: By SKU if provided
        if (!product && itemInput.newProduct.sku) {
          product = await Product.findOne({ sku: itemInput.newProduct.sku.trim().toUpperCase() });
        }

        // Create New Product if no duplicate found
        if (!product) {
          const generatedSku = itemInput.newProduct.sku
            ? itemInput.newProduct.sku.trim().toUpperCase()
            : `PROD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          const costPrice = Number(itemInput.purchasePrice || itemInput.newProduct.unitPrice || 0);
          const inputSellPrice = (itemInput as any).sellingPrice !== undefined
            ? Number((itemInput as any).sellingPrice)
            : (itemInput.newProduct && (itemInput.newProduct as any).sellingPrice !== undefined
            ? Number((itemInput.newProduct as any).sellingPrice)
            : 0);

          const defaultSellingPrice = inputSellPrice >= 0 ? inputSellPrice : 0;

          product = await Product.create({
            name: prodNameClean,
            sku: generatedSku,
            category: itemInput.newProduct.category || 'General',
            supplier: supplier._id,
            costPrice: costPrice,
            unitPrice: defaultSellingPrice,
            sellingPrice: defaultSellingPrice,
            gstRate: itemInput.taxRate !== undefined ? itemInput.taxRate : (itemInput.newProduct.gstRate || 18),
            currentStock: 0, // Current stock will be incremented in standard purchase stock update loop below
            unit: itemInput.unit || itemInput.newProduct.unit || 'Pcs',
            createdBy: userObj._id,
          });

          newlyCreatedProductIds.push(product._id);
        }
      }

      if (!product) {
        const error = new Error(`Product not found with ID: ${itemInput.productId || 'unspecified'}`);
        (error as any).statusCode = 404;
        throw error;
      }

      productDocs.push({ product, itemInput });
    }

    // 4. Perform Product Stock Updates with Rollback Safeguard
    const rollbacks: Array<{ productId: any; qty: number; previousCostPrice: number }> = [];
    const purchaseItems: any[] = [];
    let subtotal = 0;
    let taxAmount = 0;

    for (const { product, itemInput } of productDocs) {
      const itemSubtotal = itemInput.purchasePrice * itemInput.quantity;
      const itemTax = (itemSubtotal * (itemInput.taxRate || 0)) / 100;
      const itemTotalCost = itemSubtotal + itemTax;

      purchaseItems.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        purchasePrice: itemInput.purchasePrice,
        quantity: itemInput.quantity,
        taxRate: itemInput.taxRate || 0,
        totalCost: itemTotalCost,
      });

      subtotal += itemSubtotal;
      taxAmount += itemTax;

      // Update Product currentStock, costPrice, and sellingPrice (if provided)
      const inputSellingPrice = (itemInput as any).sellingPrice !== undefined ? Number((itemInput as any).sellingPrice) : undefined;
      const productSetUpdates: any = { costPrice: itemInput.purchasePrice };

      if (inputSellingPrice !== undefined && !isNaN(inputSellingPrice) && inputSellingPrice >= 0) {
        productSetUpdates.sellingPrice = inputSellingPrice;
        productSetUpdates.unitPrice = inputSellingPrice;
      }

      await Product.findByIdAndUpdate(product._id, {
        $inc: { currentStock: itemInput.quantity },
        $set: productSetUpdates,
      });

      rollbacks.push({
        productId: product._id,
        qty: itemInput.quantity,
        previousCostPrice: product.costPrice || 0,
      });
    }

    const totalAmount = subtotal + taxAmount;
    const purchaseNumber = input.invoiceNumber
      ? input.invoiceNumber
      : `PUR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const rawDateStr = input.purchaseDate || input.invoiceDate;
    let parsedPurchaseDate: Date | undefined;
    if (rawDateStr) {
      const d = new Date(rawDateStr);
      if (!isNaN(d.getTime())) {
        parsedPurchaseDate = d;
      }
    }

    const purchase = await Purchase.create({
      purchaseNumber,
      invoiceNumber: input.invoiceNumber,
      poNumber: input.poNumber,
      paymentTerms: input.paymentTerms,
      deliveryNoteNo: input.deliveryNoteNo,
      deliveryNoteDate: input.deliveryNoteDate ? new Date(input.deliveryNoteDate) : undefined,
      ewayBillNo: input.ewayBillNo,
      placeOfSupply: input.placeOfSupply,
      supplier: supplier._id,
      purchaseDate: parsedPurchaseDate || new Date(),
      items: purchaseItems,
      subtotal,
      taxAmount,
      totalAmount,
      notes: input.notes,
      createdBy: userObj._id,
    });

    return getPurchaseById(purchase._id.toString());
  } catch (err) {
    // Revert created new products if purchase creation fails
    if (newlyCreatedProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: newlyCreatedProductIds } });
    }
    throw err;
  }
};
