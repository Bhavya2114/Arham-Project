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
  const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'purchases', 'profit', 'inventory', 'low-stock'
  const [range, setRange] = useState('month'); // 'today', 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Data States
  const [salesReport, setSalesReport] = useState(null);
  const [purchaseReport, setPurchaseReport] = useState(null);
  const [profitReport, setProfitReport] = useState(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState(null);
  const [lowStockList, setLowStockList] = useState([]);
  const [projectsProfitability, setProjectsProfitability] = useState([]);
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

      if (activeTab === 'sales') {
        const res = await axiosInstance.get(`/reports/sales${params}`);
        setSalesReport(res.data.data);
      } else if (activeTab === 'purchases') {
        const res = await axiosInstance.get(`/reports/purchases${params}`);
        setPurchaseReport(res.data.data);
      } else if (activeTab === 'profit') {
        const res = await axiosInstance.get(`/reports/profit${params}`);
        setProfitReport(res.data.data);
      } else if (activeTab === 'inventory') {
        const res = await axiosInstance.get(`/reports/inventory`);
        setInventoryAnalytics(res.data.data);
      } else if (activeTab === 'low-stock') {
        const res = await axiosInstance.get(`/reports/low-stock`);
        setLowStockList(res.data.data || []);
      } else if (activeTab === 'projects') {
        const res = await axiosInstance.get(`/reports/projects-profitability`);
        setProjectsProfitability(res.data.data || []);
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
          <p className="text-gray-500 text-sm">Analyze sales revenue, purchase procurement, profit margins, and project performance.</p>
        </div>
      </div>

      {/* Tabs & Date Range Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl space-x-1 self-start md:self-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'sales' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Sales Report
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
            onClick={() => setActiveTab('profit')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'profit' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📈 Profit & Loss
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'projects' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏗️ Projects Profitability
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
          {/* TAB 1: SALES REPORT */}
          {activeTab === 'sales' && salesReport && (
            <div className="space-y-8">
              {/* Sales Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Orders</span>
                  <p className="text-3xl font-black text-slate-900">{salesReport.summary?.orderCount || salesReport.summary?.count || 0}</p>
                  <span className="text-xs text-gray-500 font-medium">Completed Transactions</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Net Sales Revenue</span>
                  <p className="text-3xl font-black text-emerald-600">₹{(salesReport.summary?.netSales || salesReport.summary?.revenue || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-emerald-600 font-semibold">Excludes GST Tax</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Gross Billing</span>
                  <p className="text-3xl font-black text-blue-600">₹{(salesReport.summary?.grossBilling || salesReport.summary?.revenue || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-blue-600 font-semibold">Includes GST Tax</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">GST Tax Collected</span>
                  <p className="text-3xl font-black text-amber-600">₹{(salesReport.summary?.gstCollected || salesReport.summary?.tax || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-amber-600 font-semibold">Output GST Tax</span>
                </div>
              </div>

              {/* Secondary Financial KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Cost of Goods Sold (COGS)</span>
                  <p className="text-2xl font-black text-amber-700">₹{(salesReport.summary?.cogs || salesReport.summary?.cost || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-gray-400 font-medium">Historical Cost</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Gross Profit</span>
                  <p className="text-2xl font-black text-emerald-600">₹{(salesReport.summary?.profit || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-emerald-600 font-semibold">Net Sales - COGS</span>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Profit Margin</span>
                  <p className="text-2xl font-black text-emerald-400">{salesReport.summary?.margin || 0}%</p>
                  <span className="text-xs text-slate-400 font-medium">(Profit / Net Sales) × 100</span>
                </div>
              </div>

              {/* Product-Wise Sales Analysis Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <FaBox className="text-blue-600" />
                    <span>Product-Wise Sales Performance</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    {salesReport.productAnalysis?.length || 0} Products Sold
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Product Name</th>
                        <th className="px-6 py-3">SKU</th>
                        <th className="px-6 py-3 text-right">Qty Sold</th>
                        <th className="px-6 py-3 text-right">Net Sales (₹)</th>
                        <th className="px-6 py-3 text-right">COGS (₹)</th>
                        <th className="px-6 py-3 text-right">Gross Profit (₹)</th>
                        <th className="px-6 py-3 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(salesReport.productAnalysis || []).length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-4 text-center text-gray-400 text-sm">No product sales recorded in this period</td>
                        </tr>
                      ) : (
                        (salesReport.productAnalysis || []).map((p, idx) => (
                          <tr key={p.productId || idx} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 font-bold text-gray-900">{p.productName}</td>
                            <td className="px-6 py-3 font-mono text-xs text-gray-400">{p.sku}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-slate-900">{p.quantitySold}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-emerald-600">₹{p.netSales?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right text-amber-700 font-semibold">₹{p.cogs?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-slate-900">+ ₹{p.profit?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-bold text-blue-600">{p.profitMarginPercent}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Customer-Wise Sales Breakdown Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <FaUser className="text-emerald-600" />
                    <span>Customer-Wise Sales Breakdown</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    {salesReport.customerAnalysis?.length || 0} Customers
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Customer Name</th>
                        <th className="px-6 py-3 text-center">Orders</th>
                        <th className="px-6 py-3 text-right">Net Sales (₹)</th>
                        <th className="px-6 py-3 text-right">GST (₹)</th>
                        <th className="px-6 py-3 text-right">Gross Billing (₹)</th>
                        <th className="px-6 py-3 text-right">Profit (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(salesReport.customerAnalysis || []).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-4 text-center text-gray-400 text-sm">No customer sales recorded in this period</td>
                        </tr>
                      ) : (
                        (salesReport.customerAnalysis || []).map((c, idx) => (
                          <tr key={c.customerId || idx} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 font-bold text-gray-900">{c.customerName}</td>
                            <td className="px-6 py-3 text-center font-extrabold text-slate-800">{c.orderCount}</td>
                            <td className="px-6 py-3 text-right font-bold text-slate-900">₹{c.netSales?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right text-amber-600 font-semibold">₹{c.gst?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-blue-600">₹{c.grossBilling?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-emerald-600">+ ₹{c.profit?.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                  <span>Sales Transactions List</span>
                  <span className="text-xs font-semibold text-gray-400">
                    {(salesReport.sales || salesReport.transactions || []).length} Invoices
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Invoice No</th>
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3 text-right">Subtotal</th>
                        <th className="px-6 py-3 text-right">GST</th>
                        <th className="px-6 py-3 text-right">Grand Total</th>
                        <th className="px-6 py-3 text-right">Profit</th>
                        <th className="px-6 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(salesReport.sales || salesReport.transactions || []).map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 font-mono font-bold text-slate-900">{s.invoiceNumber}</td>
                          <td className="px-6 py-3 font-semibold text-gray-800">{s.customerName}</td>
                          <td className="px-6 py-3 text-gray-600">{new Date(s.saleDate).toLocaleDateString()}</td>
                          <td className="px-6 py-3 text-right text-gray-700">₹{(s.subtotal || (s.grandTotal - (s.totalGst || 0)))?.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right text-amber-600 font-medium">₹{(s.totalGst || 0)?.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right font-extrabold text-slate-900">₹{s.grandTotal?.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right font-bold text-emerald-600">+ ₹{s.totalProfit?.toFixed(2)}</td>
                          <td className="px-6 py-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              {s.paymentStatus}
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
                        <th className="px-6 py-3 text-right">Net Value (₹)</th>
                        <th className="px-6 py-3 text-right">GST Paid (₹)</th>
                        <th className="px-6 py-3 text-right">Gross Spend (₹)</th>
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
                        <th className="px-6 py-3 text-right">Subtotal</th>
                        <th className="px-6 py-3 text-right">GST Tax</th>
                        <th className="px-6 py-3 text-right">Total Amount</th>
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

          {/* TAB 3: PROFIT & LOSS REPORT */}
          {activeTab === 'profit' && profitReport && (
            <div className="space-y-8">
              {/* Profit & Loss Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Net Sales Revenue</span>
                  <p className="text-3xl font-black text-slate-900">₹{(profitReport.summary?.netSales || profitReport.revenue || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-slate-500 font-semibold">Excludes GST Tax</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Cost of Goods Sold (COGS)</span>
                  <p className="text-3xl font-black text-amber-700">₹{(profitReport.summary?.cogs || profitReport.cogs || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-amber-700 font-semibold">Historical Cost</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Gross Profit</span>
                  <p className="text-3xl font-black text-emerald-600">₹{(profitReport.summary?.grossProfit || profitReport.grossProfit || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-emerald-600 font-semibold">Net Sales - COGS</span>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Gross Profit Margin</span>
                  <p className="text-3xl font-black text-emerald-400">{profitReport.summary?.margin || profitReport.profitMarginPercent || 0}%</p>
                  <span className="text-xs text-slate-400 font-medium">(Gross Profit / Net Sales) × 100</span>
                </div>
              </div>

              {/* Informational GST & Gross Billing Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-amber-100 text-amber-700 rounded-xl text-xl">
                    <FaReceipt />
                  </div>
                  <div>
                    <span className="text-xs text-amber-800 font-bold uppercase tracking-wider">GST Tax Collected (Output Tax)</span>
                    <p className="text-xl font-black text-amber-900">₹{(profitReport.summary?.gstCollected || 0).toLocaleString('en-IN')}</p>
                    <span className="text-xs text-amber-700 font-medium">Informational only — Not included in P&L Revenue</span>
                  </div>
                </div>

                <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 text-blue-700 rounded-xl text-xl">
                    <FaRupeeSign />
                  </div>
                  <div>
                    <span className="text-xs text-blue-800 font-bold uppercase tracking-wider">Gross Billing (Incl. GST)</span>
                    <p className="text-xl font-black text-blue-900">₹{(profitReport.summary?.grossBilling || 0).toLocaleString('en-IN')}</p>
                    <span className="text-xs text-blue-700 font-medium">Total Cash/Card Billed to Customers</span>
                  </div>
                </div>
              </div>

              {/* Profit & Loss Calculation Breakdown Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 max-w-3xl">
                <h3 className="font-bold text-gray-800 text-lg border-b border-gray-100 pb-3 flex items-center gap-2">
                  <FaChartLine className="text-emerald-600" />
                  <span>Profit & Loss Statement (P&L Breakdown)</span>
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-600 font-semibold">Net Sales Revenue (Excl. GST):</span>
                    <span className="font-extrabold text-slate-900">₹{(profitReport.summary?.netSales || profitReport.revenue || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-600 font-semibold">LESS: Cost of Goods Sold (COGS):</span>
                    <span className="font-extrabold text-amber-700">- ₹{(profitReport.summary?.cogs || profitReport.cogs || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-3 font-extrabold text-lg text-emerald-800 bg-emerald-50 rounded-xl px-4">
                    <span>NET GROSS PROFIT:</span>
                    <span>₹{(profitReport.summary?.grossProfit || profitReport.grossProfit || 0).toFixed(2)}</span>
                  </div>

                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 flex items-start space-x-2.5 mt-2">
                    <FaInfoCircle className="text-blue-500 text-base flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Note:</strong> Operating Expenses (OpEx like Rent, Electricity, Salaries) are not currently tracked in this inventory system. The metric above represents <strong>Gross Profit</strong> (Sales Revenue minus Cost of Goods Sold).
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Profitability Analysis Table */}
              {profitReport.productProfit && profitReport.productProfit.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                  <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <FaBox className="text-emerald-600" />
                      <span>Product Profitability Rankings</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                      Sorted by Gross Profit
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                        <tr>
                          <th className="px-6 py-3">Product Name</th>
                          <th className="px-6 py-3">SKU</th>
                          <th className="px-6 py-3 text-right">Qty Sold</th>
                          <th className="px-6 py-3 text-right">Net Sales (₹)</th>
                          <th className="px-6 py-3 text-right">COGS (₹)</th>
                          <th className="px-6 py-3 text-right">Gross Profit (₹)</th>
                          <th className="px-6 py-3 text-right">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {profitReport.productProfit.map((p, idx) => (
                          <tr key={p.productId || idx} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 font-bold text-gray-900">{p.productName}</td>
                            <td className="px-6 py-3 font-mono text-xs text-gray-400">{p.sku}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-slate-800">{p.quantitySold}</td>
                            <td className="px-6 py-3 text-right font-bold text-slate-900">₹{p.netSales?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-semibold text-amber-700">₹{p.cogs?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-emerald-600">+ ₹{p.grossProfit?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-bold text-blue-600">{p.profitMarginPercent || p.marginPercent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Daily Profit Trend Table */}
              {profitReport.trend && profitReport.trend.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
                  <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <FaChartBar className="text-purple-600" />
                      <span>Daily Profit Performance Trend</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                      {profitReport.trend.length} Days
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 min-w-[600px]">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                        <tr>
                          <th className="px-6 py-3">Date</th>
                          <th className="px-6 py-3 text-right">Net Sales (₹)</th>
                          <th className="px-6 py-3 text-right">COGS (₹)</th>
                          <th className="px-6 py-3 text-right">Gross Profit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {profitReport.trend.map((t, idx) => (
                          <tr key={t.date || idx} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 font-semibold text-gray-800">{new Date(t.date).toLocaleDateString()}</td>
                            <td className="px-6 py-3 text-right font-bold text-slate-900">₹{t.netSales?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-semibold text-amber-700">₹{t.cogs?.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-extrabold text-emerald-600">+ ₹{t.grossProfit?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: INVENTORY ANALYTICS */}
          {activeTab === 'inventory' && inventoryAnalytics && (
            <div className="space-y-8">
              {/* Inventory Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Potential Retail Value</span>
                  <p className="text-3xl font-black text-blue-600">₹{(inventoryAnalytics.summary?.potentialRetailValue || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-blue-600 font-semibold">Selling Price Baseline</span>
                </div>
              </div>

              {/* Secondary Inventory Status KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Potential Gross Margin</span>
                  <p className="text-2xl font-black text-emerald-700">₹{(inventoryAnalytics.summary?.potentialGrossMargin || 0).toLocaleString('en-IN')}</p>
                  <span className="text-xs text-gray-400 font-medium">Retail - Cost Baseline</span>
                </div>

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
                        <th className="px-6 py-3 text-right">Potential Retail Value (₹)</th>
                        <th className="px-6 py-3 text-right">Potential Margin (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(inventoryAnalytics.categoryAnalysis || []).map((c, idx) => (
                        <tr key={c.categoryName || idx} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 font-bold text-gray-900">{c.categoryName}</td>
                          <td className="px-6 py-3 text-center font-extrabold text-slate-800">{c.productCount}</td>
                          <td className="px-6 py-3 text-right font-bold text-indigo-600">{c.totalStock}</td>
                          <td className="px-6 py-3 text-right font-extrabold text-emerald-600">₹{c.inventoryCostValue?.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right font-bold text-blue-600">₹{c.potentialRetailValue?.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-800">₹{c.potentialGrossMargin?.toFixed(2)}</td>
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
                        <th className="px-6 py-3 text-right">Potential Retail Value (₹)</th>
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
                          <td className="px-6 py-3 text-right font-bold text-blue-600">₹{p.potentialRetailValue?.toFixed(2)}</td>
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
                        <th className="px-6 py-3 text-right">Selling (₹)</th>
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
                            <td className="px-6 py-3 text-right text-gray-700">₹{p.sellingPrice?.toFixed(2)}</td>
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
                  <p className="text-xs text-gray-500">Executive comparison of revenue, actual costs, gross margins & outstanding balances.</p>
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
                  <table className="w-full text-left text-xs text-gray-600 min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Project / Client</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3 text-right">Revenue (₹)</th>
                        <th className="px-4 py-3 text-right">Actual Cost (₹)</th>
                        <th className="px-4 py-3 text-right">Gross Profit (₹)</th>
                        <th className="px-4 py-3 text-right">Margin %</th>
                        <th className="px-4 py-3 text-right">Received (₹)</th>
                        <th className="px-4 py-3 text-right">Outstanding (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {projectsProfitability.map((p) => (
                        <tr key={p.projectId} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-extrabold text-slate-900 block">{p.projectName}</span>
                            <span className="text-[10px] text-gray-400 font-semibold">{p.customerName}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-700 font-bold">{p.projectCode}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">
                            ₹{p.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700">
                            ₹{p.totalProjectCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={`px-4 py-3 text-right font-black ${p.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            ₹{p.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-black font-mono">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${p.grossProfit >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                              {p.grossMargin}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700">
                            ₹{p.totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-amber-800">
                            ₹{p.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
