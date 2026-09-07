import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/api';
import { 
  FaChartBar, 
  FaRupeeSign, 
  FaChartLine, 
  FaExclamationTriangle, 
  FaCalendarAlt,
  FaBoxes,
  FaFileAlt,
  FaUser,
  FaBox,
  FaReceipt,
  FaTruckLoading,
  FaShoppingCart,
  FaInfoCircle,
  FaSearch,
  FaLayerGroup
} from 'react-icons/fa';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('projects'); // 'projects', 'purchases', 'gst', 'inventory', 'low-stock'
  const [range, setRange] = useState('month'); // 'today', 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Data States
  const [purchaseReport, setPurchaseReport] = useState(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState(null);
  const [lowStockList, setLowStockList] = useState([]);
  const [projectsProfitability, setProjectsProfitability] = useState([]);
  const [gstSummary, setGstSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReportData();
  }, [activeTab, range, startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      let params = `?range=${range}`;
      if (range === 'custom' && (startDate || endDate)) {
        params = `?startDate=${startDate}&endDate=${endDate}`;
      }

      if (activeTab === 'purchases') {
        const res = await axiosInstance.get(`/reports/purchases${params}`);
        setPurchaseReport(res.data.data);
      } else if (activeTab === 'inventory') {
        const res = await axiosInstance.get(`/reports/inventory`);
        setInventoryAnalytics(res.data.data);
      } else if (activeTab === 'low-stock') {
        const res = await axiosInstance.get(`/reports/low-stock`);
        setLowStockList(res.data.data || []);
      } else if (activeTab === 'projects') {
        const res = await axiosInstance.get(`/reports/projects-profitability`);
        setProjectsProfitability(res.data.data || []);
      } else if (activeTab === 'gst') {
        const res = await axiosInstance.get(`/reports/gst-summary${params}`);
        setGstSummary(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.response?.data?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Reports & Business Analytics</h2>
          <p className="text-gray-500 text-sm">Analyze project performance, purchase procurement, inventory levels, and GST tax summary.</p>
        </div>
      </div>

      {/* Tabs & Date Range Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl space-x-1 self-start md:self-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'projects' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏗️ Projects Profitability
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'purchases' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🛒 Purchase Report
          </button>
          <button
            onClick={() => setActiveTab('gst')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'gst' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏛️ GST & Tax Summary
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📦 Inventory Analytics
          </button>
          <button
            onClick={() => setActiveTab('low-stock')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'low-stock' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ⚠️ Low Stock Alert
          </button>
        </div>

        {/* Date Range Selector */}
        {activeTab !== 'low-stock' && activeTab !== 'inventory' && activeTab !== 'projects' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-gray-600">
              <FaCalendarAlt />
              <span>Range:</span>
            </div>

            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-emerald-500"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Calendar Month</option>
              <option value="custom">Custom Range</option>
            </select>

            {range === 'custom' && (
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1 border border-gray-200 rounded-xl text-xs bg-white"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1 border border-gray-200 rounded-xl text-xs bg-white"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3 bg-white border border-gray-200 rounded-2xl">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          <p className="text-sm text-gray-400">Generating report analytics...</p>
        </div>
      ) : (
        <>
          {/* TAB 2: PURCHASE REPORT */}
          {activeTab === 'purchases' && purchaseReport && (
            <div className="space-y-8">
              {/* Purchase Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Purchase Orders</span>
                  <p className="text-3xl font-black text-slate-900">{purchaseReport.summary?.orderCount || 0}</p>
                  <span className="text-xs text-gray-500 font-medium">Procurement Orders</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Net Purchase Value</span>
                  <p className="text-3xl font-black text-slate-900">₹{(purchaseReport.summary?.netPurchases || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-slate-500 font-semibold">Excludes GST Tax</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">GST Tax Paid</span>
                  <p className="text-3xl font-black text-amber-600">₹{(purchaseReport.summary?.gstPaid || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-amber-600 font-semibold">Input GST Tax</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Gross Purchase Spend</span>
                  <p className="text-3xl font-black text-blue-600">₹{(purchaseReport.summary?.grossPurchases || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-blue-600 font-semibold">Includes GST Tax</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Quantity Purchased</span>
                  <p className="text-3xl font-black text-indigo-600">{purchaseReport.summary?.quantityPurchased || 0}</p>
                  <span className="text-xs text-indigo-600 font-semibold">Total Purchased Units</span>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Average Order Value</span>
                  <p className="text-3xl font-black text-emerald-400">₹{(purchaseReport.summary?.averageOrderValue || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-slate-400 font-medium">Gross Spend / Orders</span>
                </div>
              </div>

              {/* Supplier-Wise Purchase Breakdown Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <FaTruckLoading className="text-slate-800" />
                    <span>Supplier-Wise Purchase Breakdown</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    {purchaseReport.supplierAnalysis?.length || 0} Suppliers
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Supplier Name</th>
                        <th className="px-6 py-3 text-center">Orders</th>
                        <th className="px-6 py-3 text-right">Qty Purchased</th>
                        <th className="px-6 py-3 text-right">Taxable Purchase (₹)</th>
                        <th className="px-6 py-3 text-right">Input GST (₹)</th>
                        <th className="px-6 py-3 text-right">Supplier Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(purchaseReport.supplierAnalysis || []).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-4 text-center text-gray-400 text-sm">No supplier purchases recorded in this period</td>
                        </tr>
                      ) : (
                        (purchaseReport.supplierAnalysis || []).map((s, idx) => (
                          <tr key={s.supplierId || idx} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 font-bold text-gray-900">{s.supplierName}</td>
                            <td className="px-6 py-3 text-center font-extrabold text-slate-800">{s.orderCount}</td>
                            <td className="px-6 py-3 text-right font-semibold text-slate-900">{s.quantityPurchased}</td>
                            <td className="px-6 py-3 text-right font-bold text-gray-800">₹{s.netPurchases?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right text-amber-600 font-semibold">₹{s.gstPaid?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-blue-600">₹{s.grossPurchases?.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Product-Wise Purchase Analysis Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <FaBox className="text-indigo-600" />
                    <span>Product-Wise Purchase Analysis</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    {purchaseReport.productAnalysis?.length || 0} Products Procured
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Product Name</th>
                        <th className="px-6 py-3">SKU</th>
                        <th className="px-6 py-3 text-right">Qty Purchased</th>
                        <th className="px-6 py-3 text-right">Net Spend (₹)</th>
                        <th className="px-6 py-3 text-right">Avg Purchase Price (₹)</th>
                        <th className="px-6 py-3 text-right">Latest Purchase Price (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(purchaseReport.productAnalysis || []).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-4 text-center text-gray-400 text-sm">No product purchases recorded in this period</td>
                        </tr>
                      ) : (
                        (purchaseReport.productAnalysis || []).map((p, idx) => (
                          <tr key={p.productId || idx} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 font-bold text-gray-900">{p.productName}</td>
                            <td className="px-6 py-3 font-mono text-xs text-gray-400">{p.sku}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-slate-900">{p.quantityPurchased}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-slate-900">₹{p.netPurchases?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-semibold text-indigo-600">₹{p.averagePurchasePrice?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-bold text-emerald-600">₹{p.latestPurchasePrice?.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Purchase Transactions Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                  <span>Purchase Transactions List</span>
                  <span className="text-xs font-semibold text-gray-400">
                    {(purchaseReport.transactions || []).length} Procurement Documents
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Purchase #</th>
                        <th className="px-6 py-3">Supplier</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3 text-center">Items</th>
                        <th className="px-6 py-3 text-right">Taxable Subtotal (₹)</th>
                        <th className="px-6 py-3 text-right">Input GST (₹)</th>
                        <th className="px-6 py-3 text-right">Supplier Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(purchaseReport.transactions || []).map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 font-mono font-bold text-slate-900">{p.purchaseNumber}</td>
                          <td className="px-6 py-3 font-semibold text-gray-800">{p.supplierName}</td>
                          <td className="px-6 py-3 text-gray-600">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                          <td className="px-6 py-3 text-center font-bold text-gray-700">{p.itemsCount}</td>
                          <td className="px-6 py-3 text-right text-gray-700">₹{p.subtotal?.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right text-amber-600 font-medium">₹{p.taxAmount?.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right font-extrabold text-slate-900">₹{p.totalAmount?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INVENTORY ANALYTICS */}
          {activeTab === 'inventory' && inventoryAnalytics && (
            <div className="space-y-8">
              {/* Inventory Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Products</span>
                  <p className="text-3xl font-black text-slate-900">{inventoryAnalytics.summary?.totalProducts || 0}</p>
                  <span className="text-xs text-gray-500 font-medium">Catalog Items</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Stock Units</span>
                  <p className="text-3xl font-black text-indigo-600">{inventoryAnalytics.summary?.totalStock || 0}</p>
                  <span className="text-xs text-indigo-600 font-semibold">Physical Stock On Hand</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Inventory Asset Value</span>
                  <p className="text-3xl font-black text-emerald-600">₹{(inventoryAnalytics.summary?.inventoryCostValue || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-emerald-600 font-semibold">Cost Price Baseline</span>
                </div>
              </div>

              {/* Secondary Inventory Status KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">In Stock Products</span>
                  <p className="text-2xl font-black text-emerald-600">{inventoryAnalytics.summary?.inStock || 0}</p>
                  <span className="text-xs text-emerald-600 font-semibold">Above Minimum Stock</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Low Stock Products</span>
                  <p className="text-2xl font-black text-amber-600">{inventoryAnalytics.summary?.lowStock || 0}</p>
                  <span className="text-xs text-amber-600 font-semibold">At or Below Minimum Stock</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Out of Stock Products</span>
                  <p className="text-2xl font-black text-red-600">{inventoryAnalytics.summary?.outOfStock || 0}</p>
                  <span className="text-xs text-red-600 font-semibold">Zero Units Remaining</span>
                </div>
              </div>

              {/* Category-Wise Inventory Analysis Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <FaLayerGroup className="text-indigo-600" />
                    <span>Category-Wise Inventory Valuation</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    {inventoryAnalytics.categoryAnalysis?.length || 0} Categories
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Category Name</th>
                        <th className="px-6 py-3 text-center">Products</th>
                        <th className="px-6 py-3 text-right">Total Stock Units</th>
                        <th className="px-6 py-3 text-right">Inventory Cost Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(inventoryAnalytics.categoryAnalysis || []).map((c, idx) => (
                        <tr key={c.categoryName || idx} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 font-bold text-gray-900">{c.categoryName}</td>
                          <td className="px-6 py-3 text-center font-extrabold text-slate-800">{c.productCount}</td>
                          <td className="px-6 py-3 text-right font-bold text-indigo-600">{c.totalStock}</td>
                          <td className="px-6 py-3 text-right font-extrabold text-emerald-600">₹{c.inventoryCostValue?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Inventory Value Products Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <FaBoxes className="text-emerald-600" />
                    <span>Top Inventory Asset Value Products</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    Top 10 High-Value Products
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Product Name</th>
                        <th className="px-6 py-3">SKU</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3 text-right">Current Stock</th>
                        <th className="px-6 py-3 text-right">Cost Price (₹)</th>
                        <th className="px-6 py-3 text-right">Inventory Cost Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(inventoryAnalytics.topValueProducts || []).map((p, idx) => (
                        <tr key={p.id || idx} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 font-bold text-gray-900">{p.name}</td>
                          <td className="px-6 py-3 font-mono text-xs text-gray-400">{p.sku}</td>
                          <td className="px-6 py-3 text-gray-700">{p.category}</td>
                          <td className="px-6 py-3 text-right font-extrabold text-indigo-600">{p.currentStock}</td>
                          <td className="px-6 py-3 text-right text-gray-700 font-medium">₹{p.costPrice?.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right font-extrabold text-emerald-600">₹{p.inventoryCostValue?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Full Product Inventory Table with Search */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <FaBox className="text-slate-800" />
                    <span>Complete Product Catalog Inventory</span>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <FaSearch className="absolute left-3 top-2.5 text-gray-400 text-xs" />
                    <input
                      type="text"
                      placeholder="Search product name or SKU..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Product Name</th>
                        <th className="px-6 py-3">SKU</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3">Supplier</th>
                        <th className="px-6 py-3 text-right">Stock</th>
                        <th className="px-6 py-3 text-right">Cost (₹)</th>
                        <th className="px-6 py-3 text-right">Asset Value (₹)</th>
                        <th className="px-6 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(inventoryAnalytics.products || [])
                        .filter((p) =>
                          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 font-bold text-gray-900">{p.name}</td>
                            <td className="px-6 py-3 font-mono text-xs text-gray-400">{p.sku}</td>
                            <td className="px-6 py-3 text-gray-700">{p.category}</td>
                            <td className="px-6 py-3 text-gray-600 text-xs">{p.supplierName}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-slate-900">{p.currentStock}</td>
                            <td className="px-6 py-3 text-right text-gray-700">₹{p.costPrice?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-emerald-600">₹{p.inventoryCostValue?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                p.status === 'OUT_OF_STOCK'
                                  ? 'bg-red-100 text-red-800'
                                  : p.status === 'LOW_STOCK'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LOW STOCK REPORT */}
          {activeTab === 'low-stock' && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                <span>Inventory Deficit & Reorder List</span>
                <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                  {lowStockList.length} Deficit Products
                </span>
              </div>
              {lowStockList.length === 0 ? (
                <div className="p-8 text-center text-emerald-600 font-bold text-sm">
                  🎉 All inventory items are currently above minimum stock thresholds!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Product Name</th>
                        <th className="px-6 py-3">SKU</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3 text-right">Current Stock</th>
                        <th className="px-6 py-3 text-right">Min Stock Required</th>
                        <th className="px-6 py-3 text-right">Reorder Deficit</th>
                        <th className="px-6 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lowStockList.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 font-bold text-gray-900">{p.name}</td>
                          <td className="px-6 py-3 font-mono text-gray-400 text-xs">{p.sku}</td>
                          <td className="px-6 py-3">{p.category}</td>
                          <td className="px-6 py-3 text-right font-extrabold text-red-600">{p.currentStock}</td>
                          <td className="px-6 py-3 text-right font-semibold">{p.minStockQuantity}</td>
                          <td className="px-6 py-3 text-right font-extrabold text-amber-700">+{p.deficit}</td>
                          <td className="px-6 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              p.status === 'OUT_OF_STOCK' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PROJECTS PROFITABILITY REPORT */}
          {activeTab === 'projects' && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Construction Projects Profitability Directory</h3>
                  <p className="text-xs text-gray-500">Executive comparison of Project Budget, actual costs (materials + expenses), project profit, margins & cash collections.</p>
                </div>
                <span className="text-xs font-bold bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                  {projectsProfitability.length} Active Projects
                </span>
              </div>

              {projectsProfitability.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No project profitability records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-600 min-w-[1050px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Project / Client</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3 text-right">Project Budget (Excl. GST) (₹)</th>
                        <th className="px-4 py-3 text-right">Material Cost (Excl. GST) (₹)</th>
                        <th className="px-4 py-3 text-right">Expenses (₹)</th>
                        <th className="px-4 py-3 text-right">Actual Cost (Excl. GST) (₹)</th>
                        <th className="px-4 py-3 text-right">Project Profit (₹)</th>
                        <th className="px-4 py-3 text-right">Margin %</th>
                        <th className="px-4 py-3 text-right">Invoiced (Incl. GST) (₹)</th>
                        <th className="px-4 py-3 text-right">Received (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {projectsProfitability.map((p) => {
                        const profit = p.projectProfit !== undefined ? p.projectProfit : p.grossProfit;
                        const margin = p.projectMargin !== undefined ? p.projectMargin : (p.grossMargin || 0);
                        const isPositive = profit >= 0;

                        return (
                          <tr key={p.projectId} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-extrabold text-slate-900 block">{p.projectName}</span>
                              <span className="text-[10px] text-gray-400 font-semibold">{p.customerName}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-emerald-700 font-bold">{p.projectCode}</td>
                            <td className="px-4 py-3 text-right font-black text-indigo-950">
                              ₹{(p.projectBudget !== undefined ? p.projectBudget : (p.revenue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              ₹{(p.totalMaterialCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              ₹{(p.totalProjectExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                              ₹{(p.actualProjectCost !== undefined ? p.actualProjectCost : (p.totalProjectCost || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`px-4 py-3 text-right font-black ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                              ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-black font-mono">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${isPositive ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                                {margin}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              ₹{(p.totalInvoiced !== undefined ? p.totalInvoiced : (p.revenue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-blue-700">
                              ₹{(p.totalReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* GST & Tax Summary Tab */}
          {activeTab === 'gst' && gstSummary && (
            <div className="space-y-6">
              {/* Informational Policy Banner */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 text-sm text-amber-900 shadow-sm flex items-start space-x-3">
                <FaInfoCircle className="text-amber-600 mt-0.5 flex-shrink-0 text-base" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950">Statutory GST & Operational Profitability Separation</p>
                  <p className="text-amber-900 leading-relaxed">
                    Input GST is GST charged by suppliers. Output GST is GST collected from customers. GST amounts are shown separately from operational project profitability.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
                    <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-300">
                      ITC Eligibility Status: UNKNOWN / NOT DETERMINED
                    </span>
                    <span className="bg-white/80 text-slate-700 px-2.5 py-0.5 rounded-full border border-amber-200">
                      Input GST is NOT project material cost
                    </span>
                    <span className="bg-white/80 text-slate-700 px-2.5 py-0.5 rounded-full border border-amber-200">
                      Output GST is NOT project revenue/profit
                    </span>
                  </div>
                </div>
              </div>

              {/* Three KPI Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Input GST (Purchases) */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">PURCHASES / PROCUREMENT</span>
                      <h3 className="text-lg font-black text-slate-900">Input GST Charged</h3>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 text-xs font-black px-2.5 py-1 rounded-full border border-emerald-200">
                      {gstSummary.summary?.purchaseCount || 0} Bills
                    </span>
                  </div>

                  <div className="space-y-2 border-y border-slate-100 py-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Taxable Purchases:</span>
                      <span className="font-bold text-slate-800">
                        ₹{(gstSummary.summary?.taxablePurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-amber-600 font-bold">Input GST Charged:</span>
                      <span className="font-black text-amber-600">
                        ₹{(gstSummary.summary?.inputGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-900 font-bold">Supplier Total (Gross):</span>
                      <span className="font-black text-slate-900">
                        ₹{(gstSummary.summary?.supplierTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs border border-slate-100">
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Tax Component Breakdown</span>
                    <div className="grid grid-cols-3 gap-1 pt-1 font-mono text-center">
                      <div className="bg-white p-1 rounded border border-slate-200">
                        <span className="block text-[9px] text-slate-400 font-bold">CGST</span>
                        <span className="font-bold text-slate-700">₹{(gstSummary.summary?.cgstTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="bg-white p-1 rounded border border-slate-200">
                        <span className="block text-[9px] text-slate-400 font-bold">SGST</span>
                        <span className="font-bold text-slate-700">₹{(gstSummary.summary?.sgstTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="bg-white p-1 rounded border border-slate-200">
                        <span className="block text-[9px] text-slate-400 font-bold">IGST</span>
                        <span className="font-bold text-slate-700">₹{(gstSummary.summary?.igstTotal || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Output GST (Customer Invoices) */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">SALES / CUSTOMER BILLING</span>
                      <h3 className="text-lg font-black text-slate-900">Output GST</h3>
                    </div>
                    <span className="bg-blue-50 text-blue-700 text-xs font-black px-2.5 py-1 rounded-full border border-blue-200">
                      {gstSummary.summary?.outputCount || 0} Invoices
                    </span>
                  </div>

                  <div className="space-y-2 border-y border-slate-100 py-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Taxable Sales/Invoices:</span>
                      <span className="font-bold text-slate-800">
                        ₹{(gstSummary.summary?.taxableOutput || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-600 font-bold">Output GST Charged:</span>
                      <span className="font-black text-blue-600">
                        ₹{(gstSummary.summary?.outputGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-900 font-bold">Customer Invoice Total:</span>
                      <span className="font-black text-slate-900">
                        ₹{(gstSummary.summary?.customerInvoiceTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 rounded-xl p-3 text-xs text-blue-800 border border-blue-100 space-y-1">
                    <p className="font-bold">Customer Billing Independence</p>
                    <p className="text-[11px] text-blue-700 leading-snug">
                      Customer invoice amounts and Output GST reflect billed commitments and do not enter internal project operational cost or project profitability formulas.
                    </p>
                  </div>
                </div>

                {/* 3. GST Difference */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">REPORTING DIFFERENCE</span>
                    <h3 className="text-lg font-black text-white">GST Difference</h3>
                    <p className="text-xs text-slate-400">= Output GST − Input GST</p>
                  </div>

                  <div className="space-y-2 py-2">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-black text-emerald-400">
                        ₹{Math.abs(gstSummary.summary?.netGstPosition || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className="inline-block text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                      Input vs Output GST Difference
                    </span>
                  </div>

                  <div className="bg-slate-800/80 rounded-xl p-3 text-[11px] text-slate-300 border border-slate-700 space-y-1">
                    <p className="font-bold text-slate-200">Reporting Disclaimer</p>
                    <p className="text-slate-400 leading-snug">
                      Output GST minus Input GST. This is a reporting difference only and does not determine legally payable tax or eligible ITC.
                    </p>
                  </div>
                </div>
              </div>

              {/* Purchase / Input GST Ledger Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <FaTruckLoading className="text-slate-800 text-lg" />
                    <div>
                      <h4 className="font-bold text-gray-800 text-base">Purchase Input GST Register</h4>
                      <p className="text-xs text-slate-500">All purchase invoices with taxable values and supplier-charged GST breakdown</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                    {gstSummary.purchaseTransactions?.length || 0} Purchase Records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[900px]">
                    <thead className="bg-slate-50 border-b border-gray-200 text-[11px] font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="px-5 py-3">Purchase #</th>
                        <th className="px-5 py-3">Supplier</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3 text-right">Taxable Subtotal (₹)</th>
                        <th className="px-4 py-3 text-right">CGST (₹)</th>
                        <th className="px-4 py-3 text-right">SGST (₹)</th>
                        <th className="px-4 py-3 text-right">IGST (₹)</th>
                        <th className="px-5 py-3 text-right text-amber-600">Input GST (₹)</th>
                        <th className="px-5 py-3 text-right font-black text-slate-900">Supplier Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(gstSummary.purchaseTransactions || []).length === 0 ? (
                        <tr>
                          <td colSpan="9" className="px-6 py-8 text-center text-gray-400 text-sm font-medium">
                            No purchases recorded in this period
                          </td>
                        </tr>
                      ) : (
                        (gstSummary.purchaseTransactions || []).map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3 font-mono font-bold text-slate-800 text-xs">
                              {p.purchaseNumber}
                            </td>
                            <td className="px-5 py-3 font-semibold text-gray-900">
                              {p.supplierName}
                            </td>
                            <td className="px-5 py-3 text-xs text-slate-500">
                              {new Date(p.date).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-slate-800">
                              ₹{p.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                              {p.hasBreakdown && p.cgst !== null ? `₹${p.cgst.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                              {p.hasBreakdown && p.sgst !== null ? `₹${p.sgst.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                              {p.hasBreakdown && p.igst !== null ? `₹${p.igst.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-amber-600">
                              ₹{p.inputGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-slate-900">
                              ₹{p.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs text-slate-800">
                      <tr>
                        <td colSpan="3" className="px-5 py-3 text-slate-600 uppercase">Total Input GST</td>
                        <td className="px-5 py-3 text-right font-black text-slate-900">
                          ₹{(gstSummary.summary?.taxablePurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          ₹{(gstSummary.summary?.cgstTotal || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          ₹{(gstSummary.summary?.sgstTotal || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          ₹{(gstSummary.summary?.igstTotal || 0).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-amber-600">
                          ₹{(gstSummary.summary?.inputGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-slate-900">
                          ₹{(gstSummary.summary?.supplierTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Customer / Output GST Ledger Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <FaReceipt className="text-slate-800 text-lg" />
                    <div>
                      <h4 className="font-bold text-gray-800 text-base">Customer Output GST Register</h4>
                      <p className="text-xs text-slate-500">Project customer invoices with taxable values and customer-billed GST breakdown</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                    {gstSummary.outputTransactions?.length || 0} Invoices
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
                    <thead className="bg-slate-50 border-b border-gray-200 text-[11px] font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Reference #</th>
                        <th className="px-5 py-3">Customer / Project</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3 text-right">Taxable Value (₹)</th>
                        <th className="px-5 py-3 text-right text-blue-600">Output GST (₹)</th>
                        <th className="px-5 py-3 text-right font-black text-slate-900">Customer Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(gstSummary.outputTransactions || []).length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-8 text-center text-gray-400 text-sm font-medium">
                            No customer invoices recorded in this period
                          </td>
                        </tr>
                      ) : (
                        (gstSummary.outputTransactions || []).map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                Project Invoice
                              </span>
                            </td>
                            <td className="px-5 py-3 font-mono font-bold text-slate-800 text-xs">
                              {o.referenceNumber}
                            </td>
                            <td className="px-5 py-3">
                              <span className="font-semibold text-gray-900 block">{o.customerName}</span>
                              {o.projectName && (
                                <span className="text-[11px] text-slate-400 block font-medium">Project: {o.projectName}</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-xs text-slate-500">
                              {new Date(o.date).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-slate-800">
                              ₹{o.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-blue-600">
                              ₹{o.outputGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-slate-900">
                              ₹{o.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs text-slate-800">
                      <tr>
                        <td colSpan="4" className="px-5 py-3 text-slate-600 uppercase">Total Output GST</td>
                        <td className="px-5 py-3 text-right font-black text-slate-900">
                          ₹{(gstSummary.summary?.taxableOutput || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-blue-600">
                          ₹{(gstSummary.summary?.outputGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-slate-900">
                          ₹{(gstSummary.summary?.customerInvoiceTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
