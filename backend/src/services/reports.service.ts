import { Product } from '../models/Product';
import { Sale } from '../models/Sale';
import { Purchase } from '../models/Purchase';

const buildDateFilter = (query: { range?: string; startDate?: string; endDate?: string }) => {
  const filter: any = { paymentStatus: { $ne: 'CANCELLED' } };

  if (query.range === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    filter.saleDate = { $gte: start, $lte: end };
  } else if (query.range === 'week') {
    const start = new Date();
    const day = start.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    filter.saleDate = { $gte: start, $lte: end };
  } else if (query.range === 'month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    filter.saleDate = { $gte: start, $lte: end };
  } else if (query.startDate || query.endDate) {
    filter.saleDate = {};
    if (query.startDate) {
      const s = new Date(query.startDate);
      s.setHours(0, 0, 0, 0);
      filter.saleDate.$gte = s;
    }
    if (query.endDate) {
      const e = new Date(query.endDate);
      e.setHours(23, 59, 59, 999);
      filter.saleDate.$lte = e;
    }
  }

  return filter;
};

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
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    productStats,
    salesStats,
    todayStats,
    lowStockCount,
    outOfStockCount,
    recentSales,
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
    Sale.aggregate([
      {
        $match: { paymentStatus: { $ne: 'CANCELLED' } },
      },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          netRevenue: { $sum: '$subtotal' },
          grossBilling: { $sum: '$grandTotal' },
          gstCollected: { $sum: '$totalGst' },
          cogs: { $sum: '$totalCost' },
          profit: { $sum: '$totalProfit' },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          paymentStatus: { $ne: 'CANCELLED' },
          saleDate: { $gte: todayStart, $lte: todayEnd },
        },
      },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          salesRevenue: { $sum: '$subtotal' },
          grossBilling: { $sum: '$grandTotal' },
        },
      },
    ]),
    Product.countDocuments({
      $expr: { $and: [{ $lte: ['$currentStock', '$minimumStock'] }, { $gt: ['$currentStock', 0] }] },
    }),
    Product.countDocuments({ currentStock: 0 }),
    Sale.find({ paymentStatus: { $ne: 'CANCELLED' } })
      .populate('customer', 'name businessName')
      .sort({ saleDate: -1 })
      .limit(5)
      .lean(),
    Purchase.find()
      .populate('supplier', 'name companyName')
      .sort({ purchaseDate: -1 })
      .limit(5)
      .lean(),
  ]);

  const pStats = productStats[0] || { totalProducts: 0, totalStock: 0, inventoryValue: 0 };
  const sStats = salesStats[0] || {
    orderCount: 0,
    netRevenue: 0,
    grossBilling: 0,
    gstCollected: 0,
    cogs: 0,
    profit: 0,
  };
  const tStats = todayStats[0] || { orderCount: 0, salesRevenue: 0, grossBilling: 0 };

  const margin = sStats.netRevenue > 0 ? (sStats.profit / sStats.netRevenue) * 100 : 0;

  const recentActivity = [
    ...(recentSales || []).map((s: any) => ({
      id: s._id.toString(),
      type: 'SALE',
      reference: s.invoiceNumber,
      partyName: s.customer ? (s.customer.businessName || s.customer.name) : 'Guest Customer',
      date: s.saleDate || s.createdAt,
      amount: Number(s.grandTotal || 0),
      netAmount: Number(s.subtotal || 0),
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
    totalSales: sStats.orderCount,
    totalRevenue: Number((sStats.grossBilling || 0).toFixed(2)),
    totalCost: Number((sStats.cogs || 0).toFixed(2)),
    totalProfit: Number((sStats.profit || 0).toFixed(2)),
    lowStockCount,
    outOfStockCount,

    inventoryValue: Number((pStats.inventoryValue || 0).toFixed(2)),

    today: {
      salesRevenue: Number((tStats.salesRevenue || 0).toFixed(2)),
      grossBilling: Number((tStats.grossBilling || 0).toFixed(2)),
      orderCount: tStats.orderCount,
    },

    sales: {
      netRevenue: Number((sStats.netRevenue || 0).toFixed(2)),
      grossBilling: Number((sStats.grossBilling || 0).toFixed(2)),
      gstCollected: Number((sStats.gstCollected || 0).toFixed(2)),
      orderCount: sStats.orderCount,
      cogs: Number((sStats.cogs || 0).toFixed(2)),
      profit: Number((sStats.profit || 0).toFixed(2)),
      margin: Number((margin || 0).toFixed(2)),
    },

    stock: {
      totalProducts: pStats.totalProducts,
      totalStock: pStats.totalStock,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      inStock: Math.max(0, pStats.totalProducts - lowStockCount - outOfStockCount),
    },

    recentActivity,
  };
};

export const getSalesSummary = async (query: {
  range?: string;
  startDate?: string;
  endDate?: string;
}): Promise<any> => {
  const filter = buildDateFilter(query);

  const sales = await Sale.find(filter)
    .populate('customer', 'name businessName')
    .sort({ saleDate: -1 })
    .lean();

  let orderCount = sales.length;
  let netSales = 0;
  let grossBilling = 0;
  let gstCollected = 0;
  let cogs = 0;
  let profit = 0;

  const productMap: Record<string, {
    productId: string;
    productName: string;
    sku: string;
    quantitySold: number;
    netSales: number;
    cogs: number;
    profit: number;
  }> = {};

  const customerMap: Record<string, {
    customerId: string;
    customerName: string;
    orderCount: number;
    netSales: number;
    gst: number;
    grossBilling: number;
    cogs: number;
    profit: number;
  }> = {};

  for (const s of sales) {
    netSales += s.subtotal || 0;
    grossBilling += s.grandTotal || 0;
    gstCollected += s.totalGst || 0;
    cogs += s.totalCost || 0;
    profit += s.totalProfit || 0;

    const custObj = s.customer as any;
    const custId: string = custObj
      ? (custObj._id ? custObj._id.toString() : (custObj.id ? String(custObj.id) : String(custObj)))
      : 'WALK_IN';
    const custName: string = custObj
      ? (custObj.businessName || custObj.name || 'Customer')
      : 'Walk-in Customer';

    if (!customerMap[custId]) {
      customerMap[custId] = {
        customerId: custId,
        customerName: custName,
        orderCount: 0,
        netSales: 0,
        gst: 0,
        grossBilling: 0,
        cogs: 0,
        profit: 0,
      };
    }
    customerMap[custId].orderCount += 1;
    customerMap[custId].netSales += s.subtotal || 0;
    customerMap[custId].gst += s.totalGst || 0;
    customerMap[custId].grossBilling += s.grandTotal || 0;
    customerMap[custId].cogs += s.totalCost || 0;
    customerMap[custId].profit += s.totalProfit || 0;

    for (const item of (s.items || [])) {
      const prodId: string = item.product ? item.product.toString() : (item.sku || item.productName);
      const qty = item.quantity || 0;
      const itemNet = (item.sellingPrice || 0) * qty;
      const itemCost = (item.costPrice || 0) * qty;
      const itemProf = item.itemProfit !== undefined ? item.itemProfit : (itemNet - itemCost);

      if (!productMap[prodId]) {
        productMap[prodId] = {
          productId: prodId,
          productName: item.productName || 'Unknown Product',
          sku: item.sku || 'N/A',
          quantitySold: 0,
          netSales: 0,
          cogs: 0,
          profit: 0,
        };
      }
      productMap[prodId].quantitySold += qty;
      productMap[prodId].netSales += itemNet;
      productMap[prodId].cogs += itemCost;
      productMap[prodId].profit += itemProf;
    }
  }

  const margin = netSales > 0 ? (profit / netSales) * 100 : 0;

  const productAnalysis = Object.values(productMap).map((p) => {
    const pMargin = p.netSales > 0 ? (p.profit / p.netSales) * 100 : 0;
    return {
      productId: p.productId,
      productName: p.productName,
      sku: p.sku,
      quantitySold: p.quantitySold,
      netSales: Number(p.netSales.toFixed(2)),
      cogs: Number(p.cogs.toFixed(2)),
      profit: Number(p.profit.toFixed(2)),
      profitMarginPercent: Number(pMargin.toFixed(2)),
    };
  }).sort((a, b) => b.netSales - a.netSales);

  const customerAnalysis = Object.values(customerMap).map((c) => {
    const cMargin = c.netSales > 0 ? (c.profit / c.netSales) * 100 : 0;
    return {
      customerId: c.customerId,
      customerName: c.customerName,
      orderCount: c.orderCount,
      netSales: Number(c.netSales.toFixed(2)),
      gst: Number(c.gst.toFixed(2)),
      grossBilling: Number(c.grossBilling.toFixed(2)),
      cogs: Number(c.cogs.toFixed(2)),
      profit: Number(c.profit.toFixed(2)),
      profitMarginPercent: Number(cMargin.toFixed(2)),
    };
  }).sort((a, b) => b.netSales - a.netSales);

  const topProducts = productAnalysis.slice(0, 5);
  const topCustomers = customerAnalysis.slice(0, 5);

  const transactions = sales.map((s: any) => ({
    id: s._id.toString(),
    invoiceNumber: s.invoiceNumber,
    customerName: s.customer ? (s.customer.businessName || s.customer.name) : 'Walk-in Customer',
    saleDate: s.saleDate,
    subtotal: Number((s.subtotal || 0).toFixed(2)),
    totalGst: Number((s.totalGst || 0).toFixed(2)),
    grandTotal: Number((s.grandTotal || 0).toFixed(2)),
    totalCost: Number((s.totalCost || 0).toFixed(2)),
    totalProfit: Number((s.totalProfit || 0).toFixed(2)),
    paymentStatus: s.paymentStatus,
    itemsCount: (s.items || []).length,
    items: (s.items || []).map((i: any) => ({
      productName: i.productName,
      sku: i.sku,
      quantity: i.quantity,
      sellingPrice: i.sellingPrice,
      costPrice: i.costPrice,
    })),
  }));

  return {
    summary: {
      count: orderCount,
      orderCount,
      revenue: Number(grossBilling.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      grossBilling: Number(grossBilling.toFixed(2)),
      gstCollected: Number(gstCollected.toFixed(2)),
      tax: Number(gstCollected.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      cost: Number(cogs.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      margin: Number(margin.toFixed(2)),
    },

    sales: transactions,
    transactions,

    productAnalysis,
    customerAnalysis,
    topProducts,
    topCustomers,
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
      const itemNet = (item.totalCost !== undefined && item.totalCost > 0)
        ? (item.purchasePrice * qty)
        : (price * qty);

      pQtyTotal += qty;

      if (!productMap[prodId]) {
        productMap[prodId] = {
          productId: prodId,
          productName: item.productName || 'Unknown Product',
          sku: item.sku || 'N/A',
          quantityPurchased: 0,
          netPurchases: 0,
          latestPurchasePrice: price,
        };
      }
      productMap[prodId].quantityPurchased += qty;
      productMap[prodId].netPurchases += itemNet;
      productMap[prodId].latestPurchasePrice = price;
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

export const getProfitSummary = async (query: {
  range?: string;
  startDate?: string;
  endDate?: string;
}): Promise<any> => {
  const filter = buildDateFilter(query);

  const sales = await Sale.find(filter)
    .sort({ saleDate: -1 })
    .lean();

  let netSales = 0;
  let grossBilling = 0;
  let gstCollected = 0;
  let cogs = 0;
  let grossProfit = 0;

  const productMap: Record<string, {
    productId: string;
    productName: string;
    sku: string;
    quantitySold: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
  }> = {};

  const trendMap: Record<string, {
    date: string;
    netSales: number;
    cogs: number;
    grossProfit: number;
  }> = {};

  for (const s of sales) {
    const saleNet = s.subtotal || 0;
    const saleBilling = s.grandTotal || 0;
    const saleGst = s.totalGst || 0;
    const saleCost = s.totalCost || 0;
    const saleProf = s.totalProfit !== undefined ? s.totalProfit : (saleNet - saleCost);

    netSales += saleNet;
    grossBilling += saleBilling;
    gstCollected += saleGst;
    cogs += saleCost;
    grossProfit += saleProf;

    const dStr = new Date(s.saleDate || (s as any).createdAt).toISOString().split('T')[0];
    if (!trendMap[dStr]) {
      trendMap[dStr] = { date: dStr, netSales: 0, cogs: 0, grossProfit: 0 };
    }
    trendMap[dStr].netSales += saleNet;
    trendMap[dStr].cogs += saleCost;
    trendMap[dStr].grossProfit += saleProf;

    for (const item of (s.items || [])) {
      const prodId: string = item.product ? item.product.toString() : (item.sku || item.productName);
      const qty = item.quantity || 0;
      const itemNet = (item.sellingPrice || 0) * qty;
      const itemCost = (item.costPrice || 0) * qty;
      const itemProf = item.itemProfit !== undefined ? item.itemProfit : (itemNet - itemCost);

      if (!productMap[prodId]) {
        productMap[prodId] = {
          productId: prodId,
          productName: item.productName || 'Unknown Product',
          sku: item.sku || 'N/A',
          quantitySold: 0,
          netSales: 0,
          cogs: 0,
          grossProfit: 0,
        };
      }
      productMap[prodId].quantitySold += qty;
      productMap[prodId].netSales += itemNet;
      productMap[prodId].cogs += itemCost;
      productMap[prodId].grossProfit += itemProf;
    }
  }

  const margin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  const productProfit = Object.values(productMap).map((p) => {
    const pMargin = p.netSales > 0 ? (p.grossProfit / p.netSales) * 100 : 0;
    return {
      productId: p.productId,
      productName: p.productName,
      sku: p.sku,
      quantitySold: p.quantitySold,
      netSales: Number(p.netSales.toFixed(2)),
      cogs: Number(p.cogs.toFixed(2)),
      grossProfit: Number(p.grossProfit.toFixed(2)),
      profitMarginPercent: Number(pMargin.toFixed(2)),
      marginPercent: Number(pMargin.toFixed(2)),
    };
  }).sort((a, b) => b.grossProfit - a.grossProfit);

  const trend = Object.values(trendMap).map((t) => ({
    date: t.date,
    netSales: Number(t.netSales.toFixed(2)),
    cogs: Number(t.cogs.toFixed(2)),
    grossProfit: Number(t.grossProfit.toFixed(2)),
  })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    revenue: Number(netSales.toFixed(2)),
    cogs: Number(cogs.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    profitMarginPercent: Number(margin.toFixed(2)),

    summary: {
      netSales: Number(netSales.toFixed(2)),
      grossBilling: Number(grossBilling.toFixed(2)),
      gstCollected: Number(gstCollected.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      margin: Number(margin.toFixed(2)),
    },

    productProfit,
    topProductProfit: productProfit.slice(0, 5),
    trend,
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
  let potentialRetailValue = 0;
  let inStockCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const categoryMap: Record<string, {
    categoryName: string;
    productCount: number;
    totalStock: number;
    inventoryCostValue: number;
    potentialRetailValue: number;
  }> = {};

  const productList: any[] = [];
  const lowStockProducts: any[] = [];
  const outOfStockProducts: any[] = [];

  for (const p of products) {
    const stock = p.currentStock || 0;
    const minStock = p.minimumStock !== undefined ? p.minimumStock : 5;
    const cost = p.costPrice || 0; // Current costPrice
    const sell = p.sellingPrice || p.unitPrice || 0;

    const itemCostVal = stock * cost;
    const itemRetailVal = stock * sell;

    totalStock += stock;
    inventoryCostValue += itemCostVal;
    potentialRetailValue += itemRetailVal;

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
      sellingPrice: Number(sell.toFixed(2)),
      unitPrice: Number(sell.toFixed(2)),
      inventoryCostValue: Number(itemCostVal.toFixed(2)),
      potentialRetailValue: Number(itemRetailVal.toFixed(2)),
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
        potentialRetailValue: 0,
      };
    }
    categoryMap[catKey].productCount += 1;
    categoryMap[catKey].totalStock += stock;
    categoryMap[catKey].inventoryCostValue += itemCostVal;
    categoryMap[catKey].potentialRetailValue += itemRetailVal;
  }

  const potentialGrossMargin = potentialRetailValue - inventoryCostValue;

  const categoryAnalysis = Object.values(categoryMap).map((c) => ({
    categoryName: c.categoryName,
    productCount: c.productCount,
    totalStock: c.totalStock,
    inventoryCostValue: Number(c.inventoryCostValue.toFixed(2)),
    potentialRetailValue: Number(c.potentialRetailValue.toFixed(2)),
    potentialGrossMargin: Number((c.potentialRetailValue - c.inventoryCostValue).toFixed(2)),
  })).sort((a, b) => b.inventoryCostValue - a.inventoryCostValue);

  const topValueProducts = [...productList]
    .sort((a, b) => b.inventoryCostValue - a.inventoryCostValue)
    .slice(0, 10);

  return {
    summary: {
      totalProducts,
      totalStock,
      inventoryCostValue: Number(inventoryCostValue.toFixed(2)),
      potentialRetailValue: Number(potentialRetailValue.toFixed(2)),
      potentialGrossMargin: Number(potentialGrossMargin.toFixed(2)),
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
    unitPrice: Number(p.unitPrice || p.sellingPrice || 0),
    status: p.currentStock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
    deficit: Math.max(0, p.minimumStock - p.currentStock),
  }));
};
