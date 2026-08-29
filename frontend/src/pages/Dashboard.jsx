import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/api';
import { 
  FaEnvelope, 
  FaShieldAlt, 
  FaBox, 
  FaExclamationTriangle, 
  FaArrowRight, 
  FaBoxes,
  FaCalendarAlt,
  FaRupeeSign,
  FaShoppingCart,
  FaChartLine,
  FaTimesCircle,
  FaReceipt,
  FaCalendarDay
} from 'react-icons/fa';

const Dashboard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardSummary();
  }, []);

  const fetchDashboardSummary = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/reports/dashboard');
      setSummary(res.data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <p className="text-gray-500 font-medium">Loading inventory & business metrics...</p>
      </div>
    );
  }

  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-500 text-white';
      case 'SALES': return 'bg-blue-500 text-white';
      case 'WAREHOUSE': return 'bg-purple-500 text-white';
      case 'ACCOUNTS': return 'bg-amber-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const todayRevenue = (summary?.today?.salesRevenue || 0).toLocaleString('en-IN');
  const todayOrders = summary?.today?.orderCount || 0;

  const netRevenue = (summary?.sales?.netRevenue || 0).toLocaleString('en-IN');
  const grossBilling = (summary?.sales?.grossBilling || summary?.totalRevenue || 0).toLocaleString('en-IN');
  const gstCollected = (summary?.sales?.gstCollected || 0).toLocaleString('en-IN');
  const totalProfit = (summary?.sales?.profit || summary?.totalProfit || 0).toLocaleString('en-IN');
  const cogs = (summary?.sales?.cogs || summary?.totalCost || 0).toLocaleString('en-IN');
  const inventoryValuation = (summary?.inventoryValue || 0).toLocaleString('en-IN');
  const profitMargin = summary?.sales?.margin || 0;

  return (
    <div className="space-y-8">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl shadow-md p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 border border-slate-800">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name || 'Manager'}!
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-slate-300 text-sm mt-1">
            <span className="flex items-center"><FaEnvelope className="mr-1.5 text-xs text-slate-400" /> {user?.email}</span>
            <span className="h-3 w-px bg-slate-700 hidden sm:inline"></span>
            <span className="flex items-center gap-1">
              <FaShieldAlt className="text-xs text-slate-400" />
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getRoleBadgeClass(user?.role)}`}>
                {user?.role}
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-300 bg-slate-950 px-4 py-2 rounded-xl text-sm border border-slate-800 self-start md:self-auto">
          <FaCalendarAlt className="text-emerald-400" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* 2. Key Performance Indicators — Row 1 (Core Operations) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today's Sales */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Today's Sales</span>
            <div className="text-2xl font-extrabold text-slate-900 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-gray-500" />
              {todayRevenue}
            </div>
            <span className="text-xs text-emerald-600 font-semibold">{todayOrders} Orders Completed Today</span>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
            <FaCalendarDay className="text-2xl" />
          </div>
        </div>

        {/* Total Products & Stock */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Products</span>
            <div className="text-2xl font-extrabold text-gray-900">{summary?.totalProducts || 0}</div>
            <span className="text-xs text-gray-500 font-medium">{summary?.totalStock || 0} Total Units in Stock</span>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 text-blue-600">
            <FaBox className="text-2xl" />
          </div>
        </div>

        {/* Total Inventory Asset Value */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Inventory Asset Value</span>
            <div className="text-2xl font-extrabold text-indigo-700 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-indigo-500" />
              {inventoryValuation}
            </div>
            <span className="text-xs text-indigo-600 font-semibold">Valued at Cost Price</span>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
            <FaBoxes className="text-2xl" />
          </div>
        </div>

        {/* Total Sales Transactions */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Orders</span>
            <div className="text-2xl font-extrabold text-gray-900">{summary?.sales?.orderCount || summary?.totalSales || 0}</div>
            <span className="text-xs text-purple-600 font-semibold">All-time Completed Orders</span>
          </div>
          <div className="p-4 rounded-2xl bg-purple-50 text-purple-600">
            <FaShoppingCart className="text-2xl" />
          </div>
        </div>
      </div>

      {/* 3. Financial Performance KPIs — Row 2 (Revenue & Profit Separation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Net Sales Revenue */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Net Sales Revenue</span>
            <div className="text-2xl font-extrabold text-slate-900 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-gray-500" />
              {netRevenue}
            </div>
            <span className="text-xs text-slate-500 font-semibold">Excludes GST Tax</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-100 text-slate-700">
            <FaReceipt className="text-2xl" />
          </div>
        </div>

        {/* Gross Billing */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Gross Billing</span>
            <div className="text-2xl font-extrabold text-blue-700 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-blue-500" />
              {grossBilling}
            </div>
            <span className="text-xs text-blue-600 font-semibold">Includes GST Tax</span>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 text-blue-600">
            <FaRupeeSign className="text-2xl" />
          </div>
        </div>

        {/* GST Collected */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">GST Tax Collected</span>
            <div className="text-2xl font-extrabold text-amber-700 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-amber-500" />
              {gstCollected}
            </div>
            <span className="text-xs text-amber-600 font-semibold">Total GST Output Tax</span>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 text-amber-600">
            <FaReceipt className="text-2xl" />
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Gross Profit</span>
            <div className="text-2xl font-extrabold text-emerald-600 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-emerald-500" />
              {totalProfit}
            </div>
            <span className="text-xs text-emerald-600 font-semibold">Profit Margin: {profitMargin}%</span>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
            <FaChartLine className="text-2xl" />
          </div>
        </div>
      </div>

      {/* 4. Secondary Alerts & COGS Grid — Row 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Cost of Goods Sold */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl text-xl">
            <FaBoxes />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-semibold uppercase">Total COGS (Cost)</span>
            <p className="text-lg font-bold text-gray-800">₹{cogs}</p>
          </div>
        </div>

        {/* Low Stock Counter */}
        <Link to="/stock" className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm flex items-center justify-between hover:bg-amber-50/50 transition-colors">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl text-xl">
              <FaExclamationTriangle />
            </div>
            <div>
              <span className="text-xs text-amber-800 font-semibold uppercase">Low Stock Products</span>
              <p className="text-lg font-bold text-amber-900">{summary?.stock?.lowStock || summary?.lowStockCount || 0} Items</p>
            </div>
          </div>
          <FaArrowRight className="text-amber-500" />
        </Link>

        {/* Out of Stock Counter */}
        <Link to="/stock" className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm flex items-center justify-between hover:bg-red-50/50 transition-colors">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-xl text-xl">
              <FaTimesCircle />
            </div>
            <div>
              <span className="text-xs text-red-800 font-semibold uppercase">Out of Stock</span>
              <p className="text-lg font-bold text-red-900">{summary?.stock?.outOfStock || summary?.outOfStockCount || 0} Items</p>
            </div>
          </div>
          <FaArrowRight className="text-red-500" />
        </Link>
      </div>

      {/* 5. Recent Activity List */}
      {summary?.recentActivity && summary.recentActivity.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
            <span>Recent Activity (Sales & Purchases)</span>
            <span className="text-xs font-semibold text-gray-400">Latest Transactions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Reference #</th>
                  <th className="px-6 py-3">Party Name</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.recentActivity.map((act) => (
                  <tr key={`${act.type}-${act.id}`} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                        act.type === 'SALE' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {act.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono font-bold text-slate-900">{act.reference}</td>
                    <td className="px-6 py-3 font-semibold text-gray-800">{act.partyName}</td>
                    <td className="px-6 py-3 text-gray-500">{new Date(act.date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-right font-extrabold text-slate-900">
                      ₹{act.amount?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Quick Operations Navigation Bar */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-800">Quick Operations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Link
            to="/billing"
            className="flex items-center justify-between p-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-emerald-700">
                <FaShoppingCart className="text-lg" />
              </div>
              <span className="font-bold text-sm">⚡ New Sale / POS</span>
            </div>
            <FaArrowRight />
          </Link>

          <Link
            to="/purchases/new"
            className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-md group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-slate-800">
                <FaBoxes className="text-lg" />
              </div>
              <span className="font-bold text-sm">+ Add Purchase</span>
            </div>
            <FaArrowRight />
          </Link>

          <Link
            to="/products"
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                <FaBox className="text-lg" />
              </div>
              <span className="font-semibold text-gray-800 text-sm">Products Directory</span>
            </div>
            <FaArrowRight className="text-gray-400 group-hover:text-gray-600" />
          </Link>

          <Link
            to="/reports"
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                <FaChartLine className="text-lg" />
              </div>
              <span className="font-semibold text-gray-800 text-sm">Reports & Profit</span>
            </div>
            <FaArrowRight className="text-gray-400 group-hover:text-gray-600" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
