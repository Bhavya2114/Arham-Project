import { Product } from '../models/Product';
import { Project } from '../models/Project';
import { Purchase } from '../models/Purchase';
import { ProjectInvoice } from '../models/ProjectInvoice';


const buildPurchaseDateFilter = (query: { range?: string; startDate?: string; endDate?: string }) => {
  const filter: any = {};

  if (query.range === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    filter.purchaseDate = { $gte: start, $lte: end };
  } else if (query.range === 'week') {
    const start = new Date();
    const day = start.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    filter.purchaseDate = { $gte: start, $lte: end };
  } else if (query.range === 'month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    filter.purchaseDate = { $gte: start, $lte: end };
  } else if (query.startDate || query.endDate) {
    filter.purchaseDate = {};
    if (query.startDate) {
      const s = new Date(query.startDate);
      s.setHours(0, 0, 0, 0);
      filter.purchaseDate.$gte = s;
    }
    if (query.endDate) {
      const e = new Date(query.endDate);
      e.setHours(23, 59, 59, 999);
      filter.purchaseDate.$lte = e;
    }
  }

  return filter;
};

export const getDashboardSummary = async (): Promise<any> => {
  const [
    productStats,
    projectStats,
    invoiceStats,
    purchaseStats,
    lowStockCount,
    outOfStockCount,
    recentInvoices,
    recentPurchases,
  ] = await Promise.all([
    Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$currentStock' },
          inventoryValue: { $sum: { $multiply: ['$currentStock', '$costPrice'] } },
        },
      },
    ]),
    Project.aggregate([
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          activeProjects: {
            $sum: { $cond: [{ $in: ['$status', ['PLANNING', 'IN_PROGRESS']] }, 1, 0] },
          },
        },
      },
    ]),
    ProjectInvoice.aggregate([
      {
        $match: { status: { $ne: 'CANCELLED' } },
      },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalInvoiced: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$amountPaid' },
          totalBalanceDue: { $sum: '$balanceDue' },
        },
      },
    ]),
    Purchase.aggregate([
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
        },
      },
    ]),
    Product.countDocuments({
      $expr: { $and: [{ $lte: ['$currentStock', '$minimumStock'] }, { $gt: ['$currentStock', 0] }] },
    }),
    Product.countDocuments({ currentStock: 0 }),
    ProjectInvoice.find({ status: { $ne: 'CANCELLED' } })
      .populate('customer', 'name businessName')
      .populate('project', 'name projectCode')
      .sort({ invoiceDate: -1 })
      .limit(5)
      .lean(),
    Purchase.find()
      .populate('supplier', 'name companyName')
      .sort({ purchaseDate: -1 })
      .limit(5)
      .lean(),
  ]);

  const pStats = productStats[0] || { totalProducts: 0, totalStock: 0, inventoryValue: 0 };
  const prjStats = projectStats[0] || { totalProjects: 0, activeProjects: 0 };
  const invStats = invoiceStats[0] || { totalInvoices: 0, totalInvoiced: 0, totalPaid: 0, totalBalanceDue: 0 };
  const purchStats = purchaseStats[0] || { totalPurchases: 0, totalSpent: 0 };

  const recentActivity = [
    ...(recentInvoices || []).map((inv: any) => ({
      id: inv._id.toString(),
      type: 'INVOICE',
      reference: inv.invoiceNumber,
      partyName: inv.customer ? (inv.customer.businessName || inv.customer.name) : 'Customer',
      date: inv.invoiceDate || inv.createdAt,
      amount: Number(inv.grandTotal || 0),
      netAmount: Number(inv.taxableAmount || 0),
    })),
    ...(recentPurchases || []).map((p: any) => ({
      id: p._id.toString(),
      type: 'PURCHASE',
      reference: p.purchaseNumber,
      partyName: p.supplier ? (p.supplier.companyName || p.supplier.name) : 'Supplier',
      date: p.purchaseDate || p.createdAt,
      amount: Number(p.totalAmount || 0),
      netAmount: Number(p.subtotal || 0),
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return {
    totalProducts: pStats.totalProducts,
    totalStock: pStats.totalStock,
    lowStockCount,
    outOfStockCount,
    inventoryValue: Number((pStats.inventoryValue || 0).toFixed(2)),

    stock: {
      totalProducts: pStats.totalProducts,
      totalStock: pStats.totalStock,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      inStock: Math.max(0, pStats.totalProducts - lowStockCount - outOfStockCount),
    },

    projects: {
      total: prjStats.totalProjects,
      active: prjStats.activeProjects,
    },

    invoices: {
      count: invStats.totalInvoices,
      totalInvoiced: Number((invStats.totalInvoiced || 0).toFixed(2)),
      totalPaid: Number((invStats.totalPaid || 0).toFixed(2)),
      totalBalanceDue: Number((invStats.totalBalanceDue || 0).toFixed(2)),
    },

    purchases: {
      count: purchStats.totalPurchases,
      totalSpent: Number((purchStats.totalSpent || 0).toFixed(2)),
    },

    recentActivity,
  };
};

export const getPurchaseSummary = async (query: {
  range?: string;
  startDate?: string;
  endDate?: string;
}): Promise<any> => {
  const filter = buildPurchaseDateFilter(query);

  const purchases = await Purchase.find(filter)
    .populate('supplier', 'name companyName mobile')
    .sort({ purchaseDate: -1 })
    .lean();

  let orderCount = purchases.length;
  let netPurchases = 0;
  let gstPaid = 0;
  let grossPurchases = 0;
  let quantityPurchased = 0;

  const supplierMap: Record<string, {
    supplierId: string;
    supplierName: string;
    orderCount: number;
    netPurchases: number;
    gstPaid: number;
    grossPurchases: number;
    quantityPurchased: number;
  }> = {};

  const productMap: Record<string, {
    productId: string;
    productName: string;
    sku: string;
    quantityPurchased: number;
    netPurchases: number;
    latestPurchasePrice: number;
  }> = {};

  for (const p of purchases) {
    netPurchases += p.subtotal || 0;
    gstPaid += p.taxAmount || 0;
    grossPurchases += p.totalAmount || 0;

    const suppObj = p.supplier as any;
    const suppId: string = suppObj
      ? (suppObj._id ? suppObj._id.toString() : (suppObj.id ? String(suppObj.id) : String(suppObj)))
      : 'UNKNOWN_SUPPLIER';
    const suppName: string = suppObj
      ? (suppObj.companyName || suppObj.name || 'Supplier')
      : 'Unknown Supplier';

    let pQtyTotal = 0;

    for (const item of (p.items || [])) {
      const prodId: string = item.product ? item.product.toString() : (item.sku || item.productName);
      const qty = item.quantity || 0;
      const price = item.purchasePrice || 0;
      const effectivePrice = item.discountedPrice !== undefined && item.discountedPrice !== null && !isNaN(Number(item.discountedPrice))
        ? Number(item.discountedPrice)
        : price;
      const itemNet = (item.taxableAmount !== undefined && item.taxableAmount !== null && !isNaN(Number(item.taxableAmount)))
        ? Number(item.taxableAmount)
        : (effectivePrice * qty);

      pQtyTotal += qty;

      if (!productMap[prodId]) {
        productMap[prodId] = {
          productId: prodId,
          productName: item.productName || 'Unknown Product',
          sku: item.sku || 'N/A',
          quantityPurchased: 0,
          netPurchases: 0,
          latestPurchasePrice: effectivePrice,
        };
      }
      productMap[prodId].quantityPurchased += qty;
      productMap[prodId].netPurchases += itemNet;
      productMap[prodId].latestPurchasePrice = effectivePrice;
    }

    quantityPurchased += pQtyTotal;

    if (!supplierMap[suppId]) {
      supplierMap[suppId] = {
        supplierId: suppId,
        supplierName: suppName,
        orderCount: 0,
        netPurchases: 0,
        gstPaid: 0,
        grossPurchases: 0,
        quantityPurchased: 0,
      };
    }
    supplierMap[suppId].orderCount += 1;
    supplierMap[suppId].netPurchases += p.subtotal || 0;
    supplierMap[suppId].gstPaid += p.taxAmount || 0;
    supplierMap[suppId].grossPurchases += p.totalAmount || 0;
    supplierMap[suppId].quantityPurchased += pQtyTotal;
  }

  const averageOrderValue = orderCount > 0 ? grossPurchases / orderCount : 0;

  const supplierAnalysis = Object.values(supplierMap).map((s) => ({
    supplierId: s.supplierId,
    supplierName: s.supplierName,
    orderCount: s.orderCount,
    netPurchases: Number(s.netPurchases.toFixed(2)),
    gstPaid: Number(s.gstPaid.toFixed(2)),
    grossPurchases: Number(s.grossPurchases.toFixed(2)),
    quantityPurchased: s.quantityPurchased,
  })).sort((a, b) => b.grossPurchases - a.grossPurchases);

  const productAnalysis = Object.values(productMap).map((p) => {
    const avgPrice = p.quantityPurchased > 0 ? p.netPurchases / p.quantityPurchased : 0;
    return {
      productId: p.productId,
      productName: p.productName,
      sku: p.sku,
      quantityPurchased: p.quantityPurchased,
      netPurchases: Number(p.netPurchases.toFixed(2)),
      averagePurchasePrice: Number(avgPrice.toFixed(2)),
      latestPurchasePrice: Number(p.latestPurchasePrice.toFixed(2)),
    };
  }).sort((a, b) => b.quantityPurchased - a.quantityPurchased);

  const topSuppliers = supplierAnalysis.slice(0, 5);
  const topProducts = productAnalysis.slice(0, 5);

  const transactions = purchases.map((p: any) => ({
    id: p._id.toString(),
    purchaseNumber: p.purchaseNumber,
    supplierName: p.supplier ? (p.supplier.companyName || p.supplier.name) : 'Unknown Supplier',
    purchaseDate: p.purchaseDate,
    subtotal: Number((p.subtotal || 0).toFixed(2)),
    taxAmount: Number((p.taxAmount || 0).toFixed(2)),
    totalAmount: Number((p.totalAmount || 0).toFixed(2)),
    itemsCount: (p.items || []).length,
    items: (p.items || []).map((i: any) => ({
      productName: i.productName,
      sku: i.sku,
      quantity: i.quantity,
      purchasePrice: i.purchasePrice,
      taxRate: i.taxRate,
    })),
  }));

  return {
    summary: {
      orderCount,
      netPurchases: Number(netPurchases.toFixed(2)),
      grossPurchases: Number(grossPurchases.toFixed(2)),
      gstPaid: Number(gstPaid.toFixed(2)),
      quantityPurchased,
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
    },

    transactions,
    purchases: transactions,

    supplierAnalysis,
    productAnalysis,
    topSuppliers,
    topProducts,
  };
};


export const getInventoryAnalytics = async (): Promise<any> => {
  const products = await Product.find()
    .populate('supplier', 'name companyName mobile')
    .sort({ name: 1 })
    .lean();

  let totalProducts = products.length;
  let totalStock = 0;
  let inventoryCostValue = 0;
  let inStockCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const categoryMap: Record<string, {
    categoryName: string;
    productCount: number;
    totalStock: number;
    inventoryCostValue: number;
  }> = {};

  const productList: any[] = [];
  const lowStockProducts: any[] = [];
  const outOfStockProducts: any[] = [];

  for (const p of products) {
    const stock = p.currentStock || 0;
    const minStock = p.minimumStock !== undefined ? p.minimumStock : 5;
    const cost = p.costPrice || 0; // Current costPrice

    const itemCostVal = stock * cost;

    totalStock += stock;
    inventoryCostValue += itemCostVal;

    let status = 'IN_STOCK';
    if (stock === 0) {
      status = 'OUT_OF_STOCK';
      outOfStockCount += 1;
    } else if (stock <= minStock) {
      status = 'LOW_STOCK';
      lowStockCount += 1;
    } else {
      inStockCount += 1;
    }

    const suppObj = p.supplier as any;
    const suppName = suppObj
      ? (suppObj.companyName || suppObj.name || 'Supplier')
      : 'Unknown Supplier';

    const pFormatted = {
      id: p._id.toString(),
      name: p.name,
      sku: p.sku,
      category: p.category || 'Uncategorized',
      supplierName: suppName,
      supplierId: suppObj ? (suppObj._id ? suppObj._id.toString() : String(suppObj)) : null,
      currentStock: stock,
      minimumStock: minStock,
      costPrice: Number(cost.toFixed(2)),
      inventoryCostValue: Number(itemCostVal.toFixed(2)),
      status,
      reorderQuantity: Math.max(0, minStock - stock),
    };

    productList.push(pFormatted);

    if (status === 'LOW_STOCK') {
      lowStockProducts.push(pFormatted);
    } else if (status === 'OUT_OF_STOCK') {
      outOfStockProducts.push(pFormatted);
    }

    const catKey = (p.category && p.category.trim()) ? p.category.trim() : 'Uncategorized';
    if (!categoryMap[catKey]) {
      categoryMap[catKey] = {
        categoryName: catKey,
        productCount: 0,
        totalStock: 0,
        inventoryCostValue: 0,
      };
    }
    categoryMap[catKey].productCount += 1;
    categoryMap[catKey].totalStock += stock;
    categoryMap[catKey].inventoryCostValue += itemCostVal;
  }

  const categoryAnalysis = Object.values(categoryMap).map((c) => ({
    categoryName: c.categoryName,
    productCount: c.productCount,
    totalStock: c.totalStock,
    inventoryCostValue: Number(c.inventoryCostValue.toFixed(2)),
  })).sort((a, b) => b.inventoryCostValue - a.inventoryCostValue);

  const topValueProducts = [...productList]
    .sort((a, b) => b.inventoryCostValue - a.inventoryCostValue)
    .slice(0, 10);

  return {
    summary: {
      totalProducts,
      totalStock,
      inventoryCostValue: Number(inventoryCostValue.toFixed(2)),
      inStock: inStockCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
    },

    products: productList,
    lowStockProducts,
    outOfStockProducts,
    categoryAnalysis,
    topValueProducts,
  };
};

export const getLowStockProducts = async (): Promise<any[]> => {
  const products = await Product.find({
    $expr: { $lte: ['$currentStock', '$minimumStock'] },
  })
    .sort({ currentStock: 1 })
    .lean();

  return products.map((p: any) => ({
    id: p._id.toString(),
    name: p.name,
    sku: p.sku,
    category: p.category,
    currentStock: p.currentStock,
    minStockQuantity: p.minimumStock,
    costPrice: Number(p.costPrice || 0),
    status: p.currentStock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
    deficit: Math.max(0, p.minimumStock - p.currentStock),
  }));
};

export const getGstSummary = async (query: {
  range?: string;
  startDate?: string;
  endDate?: string;
}): Promise<any> => {
  const purchaseFilter = buildPurchaseDateFilter(query);

  // 1. Fetch Purchases for Input GST
  const purchases = await Purchase.find(purchaseFilter)
    .populate('supplier', 'name companyName gstNumber')
    .sort({ purchaseDate: -1 })
    .lean();

  let taxablePurchases = 0;
  let inputGst = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let supplierTotal = 0;
  let legacyPurchaseCount = 0;

  const purchaseTransactions = purchases.map((p: any) => {
    const sub = Number(p.subtotal || 0);
    const tax = Number(p.taxAmount || 0);
    const tot = Number(p.totalAmount || 0);

    taxablePurchases += sub;
    inputGst += tax;
    supplierTotal += tot;

    const hasExplicitBreakdown =
      p.cgst !== undefined || p.sgst !== undefined || p.igst !== undefined;

    if (hasExplicitBreakdown) {
      cgstTotal += Number(p.cgst || 0);
      sgstTotal += Number(p.sgst || 0);
      igstTotal += Number(p.igst || 0);
    } else {
      legacyPurchaseCount += 1;
    }

    const suppObj = p.supplier as any;
    const supplierName = suppObj
      ? (suppObj.companyName || suppObj.name || 'Supplier')
      : 'Unknown Supplier';

    return {
      id: p._id.toString(),
      purchaseNumber: p.purchaseNumber,
      supplierName,
      supplierGstNumber: suppObj?.gstNumber || undefined,
      purchaseDate: p.purchaseDate,
      taxableAmount: Number(sub.toFixed(2)),
      cgst: p.cgst !== undefined && p.cgst !== null ? Number(p.cgst.toFixed(2)) : null,
      sgst: p.sgst !== undefined && p.sgst !== null ? Number(p.sgst.toFixed(2)) : null,
      igst: p.igst !== undefined && p.igst !== null ? Number(p.igst.toFixed(2)) : null,
      inputGst: Number(tax.toFixed(2)),
      totalAmount: Number(tot.toFixed(2)),
      supplierTotal: Number(tot.toFixed(2)),
      hasBreakdown: hasExplicitBreakdown,
      hasExplicitBreakdown,
    };
  });

  // 2. Build Invoice Date Filter for Output GST
  const invoiceFilter: any = { status: { $in: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] } };

  if (query.range === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    invoiceFilter.invoiceDate = { $gte: start, $lte: end };
  } else if (query.range === 'week') {
    const start = new Date();
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    invoiceFilter.invoiceDate = { $gte: start, $lte: end };
  } else if (query.range === 'month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    invoiceFilter.invoiceDate = { $gte: start, $lte: end };
  } else if (query.startDate || query.endDate) {
    invoiceFilter.invoiceDate = {};
    if (query.startDate) {
      const s = new Date(query.startDate);
      s.setHours(0, 0, 0, 0);
      invoiceFilter.invoiceDate.$gte = s;
    }
    if (query.endDate) {
      const e = new Date(query.endDate);
      e.setHours(23, 59, 59, 999);
      invoiceFilter.invoiceDate.$lte = e;
    }
  }

  // 3. Fetch Project Invoices for Output GST
  const projectInvoices = await ProjectInvoice.find(invoiceFilter)
    .populate('customer', 'name businessName gstNumber')
    .populate('project', 'name projectCode')
    .sort({ invoiceDate: -1 })
    .lean();

  let taxableOutput = 0;
  let outputGst = 0;
  let customerInvoiceTotal = 0;

  const outputTransactions: any[] = [];

  // Map Project Invoices
  for (const inv of projectInvoices) {
    const taxable = Number(inv.taxableAmount || 0);
    const tax = Number(inv.taxAmount || 0);
    const total = Number(inv.grandTotal || 0);

    taxableOutput += taxable;
    outputGst += tax;
    customerInvoiceTotal += total;

    outputTransactions.push({
      id: inv._id.toString(),
      type: 'PROJECT_INVOICE',
      referenceNumber: inv.invoiceNumber,
      customerName: inv.customerSnapshot?.name || (inv.customer as any)?.name || 'Customer',
      projectName: inv.projectSnapshot?.name || (inv.project as any)?.name || undefined,
      date: inv.invoiceDate,
      taxableAmount: Number(taxable.toFixed(2)),
      outputGst: Number(tax.toFixed(2)),
      totalAmount: Number(total.toFixed(2)),
      status: inv.status,
    });
  }

  // Sort output transactions by date descending
  outputTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 4. Net GST Position = Output GST - Input GST
  const netGstPosition = Number((outputGst - inputGst).toFixed(2));

  return {
    summary: {
      // Input GST (Purchases)
      taxablePurchases: Number(taxablePurchases.toFixed(2)),
      inputGst: Number(inputGst.toFixed(2)),
      cgstTotal: Number(cgstTotal.toFixed(2)),
      sgstTotal: Number(sgstTotal.toFixed(2)),
      igstTotal: Number(igstTotal.toFixed(2)),
      supplierTotal: Number(supplierTotal.toFixed(2)),
      purchaseCount: purchases.length,
      legacyPurchaseCount,

      // Output GST (Customer Invoices)
      taxableOutput: Number(taxableOutput.toFixed(2)),
      outputGst: Number(outputGst.toFixed(2)),
      customerInvoiceTotal: Number(customerInvoiceTotal.toFixed(2)),
      outputCount: outputTransactions.length,

      // GST Difference (Output GST - Input GST)
      gstDifference: netGstPosition,
      netGstPosition, // kept for backward compatibility
      isNetPayable: netGstPosition > 0,

      // Statutory & Accounting Policy Notice
      itcEligibilityStatus: 'NOT_DETERMINED',
      clarification:
        'Output GST minus Input GST. This is a reporting difference only and does not determine legally payable tax or eligible ITC. Input GST is GST charged by suppliers. Output GST is GST collected from customers. GST amounts are maintained separately from operational project profitability and do not alter project margins. Input tax credit eligibility is not determined automatically.',
    },
    purchaseTransactions,
    outputTransactions,
  };
};
