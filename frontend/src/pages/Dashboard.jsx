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
  FaHardHat,
  FaUsers,
  FaBan,
  FaMoneyBillWave,
  FaBuilding
} from 'react-icons/fa';
import { formatDateToIndian } from '../utils/dateUtils';

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

  const totalInvoiced = (summary?.invoices?.totalInvoiced || 0).toLocaleString('en-IN');
  const totalCollected = (summary?.invoices?.totalPaid || 0).toLocaleString('en-IN');
  const outstandingBalance = (summary?.invoices?.totalBalanceDue || 0).toLocaleString('en-IN');
  const totalPurchaseSpend = (summary?.purchases?.totalSpent || 0).toLocaleString('en-IN');
  const inventoryValuation = (summary?.inventoryValue || 0).toLocaleString('en-IN');

  // Labour KPI and Analytics Extraction (Single backend source of truth)
  const labourData = summary?.labour || {};
  const totalLabour = Number(labourData.totalLabour || 0);
  const activeLabour = Number(labourData.activeLabour || 0);
  const inactiveLabour = Number(labourData.inactiveLabour || 0);
  const stoppedLabour = Number(labourData.stoppedLabour || 0);
  const totalLabourEarned = Number(labourData.totalEarned || 0);
  const totalLabourPaid = Number(labourData.totalPaid || 0);
  const labourBalance = Number(labourData.balance || 0);
  const projectedMonthlyWages = Number(labourData.projectedMonthlyWages || 0);
  const isLabourOverpaid = labourBalance < 0;
  const byProject = Array.isArray(labourData.byProject) ? labourData.byProject : [];
  const recentLabourPayments = Array.isArray(labourData.recentPayments) ? labourData.recentPayments : [];
  const activePercentage = totalLabour > 0 ? Math.round((activeLabour / totalLabour) * 100) : 0;

  const formattedLabourEarned = totalLabourEarned.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedLabourPaid = totalLabourPaid.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedLabourBalance = Math.abs(labourBalance).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedProjectedWages = projectedMonthlyWages.toLocaleString('en-IN');

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

      {/* 2. Key Performance Indicators — Row 1 (Core Operations & Projects) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Projects */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Active Projects</span>
            <div className="text-2xl font-extrabold text-slate-900 flex items-center">
              {summary?.projects?.active || 0}
            </div>
            <span className="text-xs text-emerald-600 font-semibold">{summary?.projects?.total || 0} Total Projects Tracked</span>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
            <FaChartLine className="text-2xl" />
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

        {/* Total Purchases Spend */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Procurement</span>
            <div className="text-2xl font-extrabold text-purple-700 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-purple-500" />
              {totalPurchaseSpend}
            </div>
            <span className="text-xs text-purple-600 font-semibold">{summary?.purchases?.count || 0} Orders Procured</span>
          </div>
          <div className="p-4 rounded-2xl bg-purple-50 text-purple-600">
            <FaShoppingCart className="text-2xl" />
          </div>
        </div>
      </div>

      {/* 3. Financial Performance KPIs — Row 2 (Project Invoicing & Cash Flow) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Customer Invoiced */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Billed Invoices</span>
            <div className="text-2xl font-extrabold text-slate-900 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-gray-500" />
              {totalInvoiced}
            </div>
            <span className="text-xs text-slate-500 font-semibold">{summary?.invoices?.count || 0} Customer Invoices Issued</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-100 text-slate-700">
            <FaReceipt className="text-2xl" />
          </div>
        </div>

        {/* Total Invoice Collections */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Payments Collected</span>
            <div className="text-2xl font-extrabold text-emerald-600 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-emerald-500" />
              {totalCollected}
            </div>
            <span className="text-xs text-emerald-600 font-semibold">Realized Customer Collections</span>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
            <FaRupeeSign className="text-2xl" />
          </div>
        </div>

        {/* Outstanding Invoices */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Outstanding Receivables</span>
            <div className="text-2xl font-extrabold text-amber-700 flex items-center">
              <FaRupeeSign className="text-lg mr-0.5 text-amber-500" />
              {outstandingBalance}
            </div>
            <span className="text-xs text-amber-600 font-semibold">Balance Due Across Invoices</span>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 text-amber-600">
            <FaReceipt className="text-2xl" />
          </div>
        </div>
      </div>

      {/* 4. Inventory Alerts Grid — Row 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

      {/* 5. Labour & Workforce Management Section */}
      <div className="space-y-6 pt-2">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg shadow-sm">
              <FaHardHat />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Labour & Workforce Operations</h3>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">
                Site deployment, wage liabilities, calendar earnings & project allocations
              </p>
            </div>
          </div>
          <Link
            to="/labour"
            className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl transition-colors self-start sm:self-auto border border-emerald-200 shadow-sm"
          >
            <span>Manage Workforce</span>
            <FaArrowRight className="text-[10px]" />
          </Link>
        </div>

        {/* 5A. Workforce Headcount & Run Rate (4 Cards Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Labour */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Labour</span>
              <div className="text-2xl font-extrabold text-slate-900 flex items-center">
                {totalLabour}
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                {activeLabour} Active · {inactiveLabour > 0 ? `${inactiveLabour} Inactive · ` : ''}{stoppedLabour} Stopped
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-100 text-slate-700">
              <FaHardHat className="text-2xl" />
            </div>
          </div>

          {/* Card 2: Active Labour */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider block">Active Labour</span>
              <div className="text-2xl font-extrabold text-emerald-600 flex items-center">
                {activeLabour}
              </div>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                Currently Deployed on Sites
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
              <FaUsers className="text-2xl" />
            </div>
          </div>

          {/* Card 3: Stopped Labour */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-xs text-rose-700 font-bold uppercase tracking-wider block">Stopped Labour</span>
              <div className="text-2xl font-extrabold text-rose-600 flex items-center">
                {stoppedLabour}
              </div>
              <span className="text-xs text-slate-500 font-semibold">Work Concluded</span>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 text-rose-600">
              <FaBan className="text-2xl" />
            </div>
          </div>

          {/* Card 4: Projected Monthly Wages */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-xs text-indigo-700 font-bold uppercase tracking-wider block">Projected Monthly</span>
              <div className="text-2xl font-extrabold text-indigo-700 flex items-center">
                <FaRupeeSign className="text-lg mr-0.5 text-indigo-500" />
                {formattedProjectedWages}
              </div>
              <span className="text-xs text-indigo-600 font-semibold">30-Day Active Wage Run Rate</span>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
              <FaCalendarAlt className="text-2xl" />
            </div>
          </div>
        </div>

        {/* 5B. Labour Wages & Cash Flow (3 Cards Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Card 1: Total Wages Earned */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Wages Earned</span>
              <div className="text-2xl font-extrabold text-slate-900 flex items-center">
                <FaRupeeSign className="text-lg mr-0.5 text-gray-500" />
                {formattedLabourEarned}
              </div>
              <span className="text-xs text-slate-500 font-semibold">Cumulative Calendar Wages</span>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 text-blue-600">
              <FaRupeeSign className="text-2xl" />
            </div>
          </div>

          {/* Card 2: Total Wages Paid */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider block">Total Wages Paid</span>
              <div className="text-2xl font-extrabold text-emerald-600 flex items-center">
                <FaRupeeSign className="text-lg mr-0.5 text-emerald-500" />
                {formattedLabourPaid}
              </div>
              <span className="text-xs text-emerald-600 font-semibold">Disbursed to Workers</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
              <FaMoneyBillWave className="text-2xl" />
            </div>
          </div>

          {/* Card 3: Net Balance Payable / Overpaid */}
          <div className={`bg-white border rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow ${
            isLabourOverpaid ? 'border-purple-200 bg-purple-50/20' : labourBalance > 0 ? 'border-amber-200' : 'border-gray-200'
          }`}>
            <div className="space-y-1">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">
                {isLabourOverpaid ? 'Net Advance / Overpaid' : labourBalance > 0 ? 'Outstanding Wage Dues' : 'Wage Balance'}
              </span>
              <div className={`text-2xl font-extrabold flex items-center ${
                isLabourOverpaid ? 'text-purple-700' : labourBalance > 0 ? 'text-amber-700' : 'text-emerald-600'
              }`}>
                {isLabourOverpaid ? '-' : ''}
                <FaRupeeSign className={`text-lg mr-0.5 ${
                  isLabourOverpaid ? 'text-purple-500' : labourBalance > 0 ? 'text-amber-500' : 'text-emerald-500'
                }`} />
                {formattedLabourBalance}
              </div>
              <span className={`text-xs font-semibold ${
                isLabourOverpaid ? 'text-purple-600' : labourBalance > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {isLabourOverpaid
                  ? `Overpaid by ₹${formattedLabourBalance}`
                  : labourBalance > 0
                  ? 'Outstanding Payable Across Workers'
                  : 'All Labour Wages Fully Settled'}
              </span>
            </div>
            <div className={`p-4 rounded-2xl ${
              isLabourOverpaid ? 'bg-purple-100 text-purple-700' : labourBalance > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <FaReceipt className="text-2xl" />
            </div>
          </div>
        </div>

        {/* 5C. Two-Column Layout: Labour Allocation by Project & Workforce Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Labour by Project (2 spans) */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center space-x-2">
                  <FaBuilding className="text-gray-400 text-sm" />
                  <span className="font-bold text-gray-800 text-sm">Labour Allocation by Project</span>
                </div>
                <span className="text-xs font-semibold text-gray-500 bg-gray-200/60 px-2.5 py-0.5 rounded-full">
                  {byProject.length} {byProject.length === 1 ? 'Project' : 'Projects'}
                </span>
              </div>

              {byProject.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[500px]">
                    <thead className="bg-gray-50/50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Project</th>
                        <th className="px-6 py-3 text-center">Workers</th>
                        <th className="px-6 py-3 text-right">Total Earned</th>
                        <th className="px-6 py-3 text-right">Total Paid</th>
                        <th className="px-6 py-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {byProject.map((proj) => {
                        const isOverpaid = proj.balance < 0;
                        return (
                          <tr key={proj.projectId} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-6 py-3.5">
                              <div className="font-bold text-slate-900">{proj.projectName}</div>
                              <span className="font-mono text-[10px] text-gray-400 font-semibold">{proj.projectCode}</span>
                            </td>
                            <td className="px-6 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                {proj.activeLabour} Active
                              </span>
                              {proj.stoppedLabour > 0 && (
                                <span className="ml-1 text-[11px] text-gray-400 font-medium">
                                  ({proj.stoppedLabour} stopped)
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-right font-semibold text-slate-800">
                              ₹{(proj.totalEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-3.5 text-right font-semibold text-emerald-600">
                              ₹{(proj.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-3.5 text-right font-extrabold">
                              {isOverpaid ? (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800">
                                  -₹{Math.abs(proj.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              ) : proj.balance > 0 ? (
                                <span className="text-amber-700">
                                  ₹{proj.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-emerald-600">₹0.00</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto text-xl">
                    <FaHardHat />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No Labour Assigned to Projects</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Workers assigned to active projects will appear here with wage breakdown and payment status.
                  </p>
                  <Link
                    to="/labour"
                    className="inline-block mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    + Assign Labour in Directory
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Status Distribution & Recent Labour Payments */}
          <div className="space-y-6">
            {/* Status Breakdown Box */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-800 text-sm">Workforce Status</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  {activePercentage}% Active
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${activePercentage}%` }}
                  title={`Active: ${activeLabour}`}
                ></div>
                <div
                  className="bg-rose-400 h-full transition-all duration-500"
                  style={{ width: `${100 - activePercentage}%` }}
                  title={`Stopped: ${stoppedLabour}`}
                ></div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-0.5">
                  <div className="flex items-center space-x-1.5 text-emerald-800 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>ACTIVE</span>
                  </div>
                  <p className="text-lg font-extrabold text-emerald-900">{activeLabour}</p>
                  <p className="text-[10px] text-emerald-700">Currently Working</p>
                </div>

                <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl space-y-0.5">
                  <div className="flex items-center space-x-1.5 text-rose-800 font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                    <span>STOPPED</span>
                  </div>
                  <p className="text-lg font-extrabold text-rose-900">{stoppedLabour}</p>
                  <p className="text-[10px] text-rose-700">Work Concluded</p>
                </div>
              </div>
            </div>

            {/* Recent Labour Payments Quick Widget */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-800 text-sm">Recent Labour Payments</span>
                <Link to="/labour" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                  View All
                </Link>
              </div>

              {recentLabourPayments.length > 0 ? (
                <div className="space-y-2.5">
                  {recentLabourPayments.slice(0, 3).map((pay) => (
                    <div
                      key={pay.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100/60 transition-colors text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800">{pay.labourName}</div>
                        <div className="flex items-center space-x-2 text-[10px] text-gray-400">
                          <span>{formatDateToIndian(pay.paymentDate)}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-600">{pay.paymentMethod}</span>
                        </div>
                      </div>
                      <div className="font-extrabold text-emerald-700 text-right">
                        ₹{(pay.amount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-3 text-center italic">
                  No labour payments recorded yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Recent Activity List */}
      {summary?.recentActivity && summary.recentActivity.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800 text-base flex justify-between items-center">
            <span>Recent Activity (Project Invoices, Purchases & Labour Payments)</span>
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
                        act.type === 'INVOICE'
                          ? 'bg-blue-100 text-blue-800'
                          : act.type === 'PURCHASE'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {act.type === 'LABOUR_PAY' ? 'LABOUR PAY' : act.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono font-bold text-slate-900">{act.reference}</td>
                    <td className="px-6 py-3 font-semibold text-gray-800">{act.partyName}</td>
                    <td className="px-6 py-3 text-gray-500 font-medium">{formatDateToIndian(act.date)}</td>
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

      {/* 7. Quick Operations Navigation Bar */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-800">Quick Operations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Link
            to="/projects"
            className="flex items-center justify-between p-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-emerald-700">
                <FaChartLine className="text-lg" />
              </div>
              <span className="font-bold text-sm">🏗️ Manage Projects</span>
            </div>
            <FaArrowRight />
          </Link>

          <Link
            to="/labour"
            className="flex items-center justify-between p-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-md group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-amber-700">
                <FaHardHat className="text-lg" />
              </div>
              <span className="font-bold text-sm">👷 Manage Labour</span>
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
