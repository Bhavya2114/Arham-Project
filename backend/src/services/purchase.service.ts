import { Purchase } from '../models/Purchase';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { User } from '../models/User';
import { CreatePurchaseInput } from '../validators/purchase.validator';
import { calculateLineItem } from '../utils/purchaseCalculations';

const mapPurchaseResponse = (purchase: any) => {
  const mappedItems = (purchase.items || []).map((item: any) => {
    const prodObj = item.product && typeof item.product === 'object' ? item.product : null;
    const productId = item.product ? (prodObj ? (prodObj._id ? prodObj._id.toString() : prodObj.id) : item.product.toString()) : undefined;
    const productName = item.productName || (prodObj ? prodObj.name : null) || (productId ? `Item (${productId.substring(0, 8)}...)` : 'Unknown Product');
    const sku = item.sku || (prodObj ? prodObj.sku : null) || '';

    const price = Number(item.purchasePrice || item.originalPrice || 0);
    const qty = Number(item.quantity || 0);
    const taxRate = Number(item.taxRate || 0);
    const discountPercent = Number(item.discountPercent || 0);
    const grossAmount = price * qty;
    const discountAmount = item.discountAmount !== undefined && item.discountAmount !== null && !isNaN(Number(item.discountAmount))
      ? Number(item.discountAmount)
      : (grossAmount * discountPercent) / 100;
    const taxableAmount = item.taxableAmount !== undefined && item.taxableAmount !== null && !isNaN(Number(item.taxableAmount))
      ? Number(item.taxableAmount)
      : Math.max(0, grossAmount - discountAmount);
    const discountedPrice = item.discountedPrice !== undefined && item.discountedPrice !== null && !isNaN(Number(item.discountedPrice))
      ? Number(item.discountedPrice)
      : (qty > 0 ? Math.round((taxableAmount / qty) * 100) / 100 : price);

    const itemSubtotal = taxableAmount;
    const itemTax = item.taxAmount !== undefined && item.taxAmount !== null && !isNaN(Number(item.taxAmount))
      ? Number(item.taxAmount)
      : (itemSubtotal * taxRate) / 100;
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
      unit: item.unit || (prodObj ? prodObj.unit : undefined) || undefined,
      product: prodObj ? {
        id: prodObj._id ? prodObj._id.toString() : prodObj.id,
        name: prodObj.name,
        sku: prodObj.sku,
      } : undefined,
      purchasePrice: price,
      originalPrice: price,
      discountPercent,
      discountAmount,
      discountedPrice,
      discountedUnitPrice: discountedPrice,
      taxableAmount,
      grossAmount,
      quantity: qty,
      taxRate: taxRate,
      subtotal: itemSubtotal,
      taxAmount: itemTax,
      totalCost: totalCost,
      lineTotal: totalCost,
    };
  });

  let subtotal = Number(purchase.subtotal || 0);
  let totalDiscount = Number(purchase.totalDiscount || 0);
  let taxAmount = Number(purchase.taxAmount || 0);
  let totalAmount = Number(purchase.totalAmount || 0);

  if (totalAmount === 0 && mappedItems.length > 0) {
    subtotal = mappedItems.reduce((sum: number, i: any) => sum + i.subtotal, 0);
    totalDiscount = mappedItems.reduce((sum: number, i: any) => sum + (i.discountAmount || 0), 0);
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
    totalDiscount: totalDiscount,
    taxAmount: taxAmount,
    totalGst: taxAmount,
    cgst: purchase.cgst !== undefined && purchase.cgst !== null ? Number(purchase.cgst) : undefined,
    sgst: purchase.sgst !== undefined && purchase.sgst !== null ? Number(purchase.sgst) : undefined,
    igst: purchase.igst !== undefined && purchase.igst !== null ? Number(purchase.igst) : undefined,
    roundedOffAmount: purchase.roundedOffAmount !== undefined && purchase.roundedOffAmount !== null ? Number(purchase.roundedOffAmount) : null,
    roundedOffType: purchase.roundedOffType || (purchase.roundedOffAmount !== undefined && purchase.roundedOffAmount !== null ? (Number(purchase.roundedOffAmount) < 0 ? 'less' : 'add') : null),
    roundOff: purchase.roundedOffAmount !== undefined && purchase.roundedOffAmount !== null ? Number(purchase.roundedOffAmount) : null,
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
    .populate('items.product', 'name sku category unit')
    .populate('createdBy', 'name email role')
    .sort({ purchaseDate: -1, createdAt: -1 })
    .lean();

  return purchases.map(mapPurchaseResponse);
};

export const getPurchaseById = async (id: string): Promise<any> => {
  const purchase = await Purchase.findById(id)
    .populate('supplier', 'name companyName contactPerson mobile email gstNumber')
    .populate('items.product', 'name sku category unit')
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

    // Duplicate Protection Re-check 3: By exact / case-insensitive companyName
    if (!supplier) {
      supplier = await Supplier.findOne({
        companyName: { $regex: new RegExp(`^${supNameClean.replace(/[^a-zA-Z0-9]/g, '\\$&')}$`, 'i') },
      });
    }

    // Create New Supplier if no duplicate found
    if (!supplier) {
      supplier = await Supplier.create({
        name: supNameClean,
        gstNumber: supGstClean || undefined,
        mobile: input.newSupplier.mobile || (input.newSupplier as any).phone || undefined,
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
  const rollbacks: Array<{ productId: any; qty: number; previousCostPrice: number }> = [];

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

          const calc = calculateLineItem({
            quantity: itemInput.quantity,
            rate: itemInput.purchasePrice,
            discountPercent: itemInput.discountPercent,
            discountAmount: itemInput.discountAmount,
            taxRate: itemInput.taxRate,
            suppliedTaxAmount: itemInput.taxAmount,
          });
          const costPrice = calc.discountedUnitPrice > 0 ? calc.discountedUnitPrice : Number(itemInput.purchasePrice || 0);

          product = await Product.create({
            name: prodNameClean,
            sku: generatedSku,
            category: itemInput.newProduct.category || 'General',
            supplier: supplier._id,
            costPrice: costPrice,
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
    const purchaseItems: any[] = [];
    let subtotal = 0;
    let totalDiscount = 0;
    let taxAmount = 0;

    for (const { product, itemInput } of productDocs) {
      const calc = calculateLineItem({
        quantity: itemInput.quantity,
        rate: itemInput.purchasePrice,
        discountPercent: itemInput.discountPercent,
        discountAmount: itemInput.discountAmount,
        taxRate: itemInput.taxRate,
        suppliedTaxAmount: itemInput.taxAmount,
      });

      purchaseItems.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        purchasePrice: calc.rate,
        originalPrice: calc.rate,
        discountPercent: calc.discountPercent,
        discountAmount: calc.discountAmount,
        discountedPrice: calc.discountedUnitPrice,
        taxableAmount: calc.taxableValue,
        quantity: calc.quantity,
        taxRate: calc.taxRate,
        taxAmount: calc.lineTax,
        totalCost: calc.totalCost,
      });

      subtotal += calc.taxableValue;
      totalDiscount += calc.discountAmount;
      taxAmount += calc.lineTax;

      // Update Product currentStock and costPrice (authoritative effective discounted unit price)
      await Product.findByIdAndUpdate(product._id, {
        $inc: { currentStock: calc.quantity },
        $set: { costPrice: calc.discountedUnitPrice },
      });

      rollbacks.push({
        productId: product._id,
        qty: calc.quantity,
        previousCostPrice: product.costPrice || 0,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    totalDiscount = Math.round(totalDiscount * 100) / 100;
    taxAmount = Math.round(taxAmount * 100) / 100;

    // Use the GST printed on the bill (CGST+SGST or IGST) when it is within ₹1.50 of the item-by-item sum,
    // so the saved total matches the bill and the Review purchase page (same rule as calculatePurchaseTotals)
    const billIgst = Number(input.igst);
    const billCgst = Number(input.cgst);
    const billSgst = Number(input.sgst);
    const billTax = !isNaN(billIgst) && billIgst > 0
      ? billIgst
      : (!isNaN(billCgst) && !isNaN(billSgst) && (billCgst > 0 || billSgst > 0) ? billCgst + billSgst : null);
    if (billTax !== null && Math.abs(billTax - taxAmount) <= 1.5) {
      taxAmount = Math.round(billTax * 100) / 100;
    }

    const roundedOffAmount = input.roundedOffAmount !== undefined && input.roundedOffAmount !== null && !isNaN(Number(input.roundedOffAmount))
      ? Number(input.roundedOffAmount)
      : null;
    const roundedOffType = input.roundedOffType || (roundedOffAmount !== null ? (roundedOffAmount < 0 ? 'less' : 'add') : null);

    const totalAmount = Math.round((subtotal + taxAmount + (roundedOffAmount || 0)) * 100) / 100;
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
      totalDiscount,
      taxAmount,
      cgst: input.cgst !== undefined && input.cgst !== null && !isNaN(Number(input.cgst)) ? Number(input.cgst) : undefined,
      sgst: input.sgst !== undefined && input.sgst !== null && !isNaN(Number(input.sgst)) ? Number(input.sgst) : undefined,
      igst: input.igst !== undefined && input.igst !== null && !isNaN(Number(input.igst)) ? Number(input.igst) : undefined,
      roundedOffAmount,
      roundedOffType,
      totalAmount,
      notes: input.notes,
      createdBy: userObj._id,
    });

    return getPurchaseById(purchase._id.toString());
  } catch (err) {
    // Rollback stock & price updates on existing products if purchase creation fails
    for (const rb of rollbacks) {
      await Product.findByIdAndUpdate(rb.productId, {
        $inc: { currentStock: -rb.qty },
        $set: {
          costPrice: rb.previousCostPrice,
        },
      });
    }

    // Revert created new products if purchase creation fails
    if (newlyCreatedProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: newlyCreatedProductIds } });
    }
    throw err;
  }
};
