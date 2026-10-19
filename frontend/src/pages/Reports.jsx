import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { 
  FaSearch,
  FaTable,
  FaThLarge,
  FaTimes,
  FaExternalLinkAlt,
  FaBuilding,
  FaChartLine,
} from 'react-icons/fa';
import { formatDateToIndian } from '../utils/dateUtils';

const STATUS_BADGES = {
  PLANNING: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ON_HOLD: 'bg-amber-100 text-amber-800 border-amber-200',
  COMPLETED: 'bg-purple-100 text-purple-800 border-purple-200',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
};

const formatIndianCurrency = (val, showDecimals = false) => {
  const num = Number(val) || 0;
  if (showDecimals) {
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const getCardStatusBadge = (status) => {
  if (status === 'COMPLETED') {
    return {
      label: 'Completed',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (status === 'IN_PROGRESS' || status === 'ACTIVE') {
    return {
      label: 'Ongoing',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }
  if (status === 'PLANNING') {
    return {
      label: 'Planning',
      className: 'bg-sky-50 text-sky-700 border-sky-200',
    };
  }
  if (status === 'ON_HOLD') {
    return {
      label: 'On Hold',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: (status || 'N/A').replace('_', ' '),
    className: 'bg-slate-50 text-slate-700 border-slate-200',
  };
};

const Reports = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('projects'); // 'projects'

  // Data States
  const [projectsProfitability, setProjectsProfitability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Projects Profitability interactive states
  const [viewMode, setViewMode] = useState('cards'); // 'cards' (default) | 'table'
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ONGOING' | 'COMPLETED'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/reports/projects-profitability');
      setProjectsProfitability(res.data.data || []);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.response?.data?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  // KPI aggregates for Projects Profitability
  const totalProjectsCount = projectsProfitability.length;
  const totalProfitSum = projectsProfitability.reduce((sum, p) => {
    const profit = p.projectProfit !== undefined ? p.projectProfit : (p.grossProfit || 0);
    return sum + Number(profit || 0);
  }, 0);
  // Filter counts
  const allCount = projectsProfitability.length;
  const ongoingCount = projectsProfitability.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED').length;
  const completedCount = projectsProfitability.filter(p => p.status === 'COMPLETED').length;

  // Filtered projects
  const filteredProjects = projectsProfitability.filter((p) => {
    if (filterStatus === 'ONGOING' && (p.status === 'COMPLETED' || p.status === 'CANCELLED')) {
      return false;
    }
    if (filterStatus === 'COMPLETED' && p.status !== 'COMPLETED') {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const nameMatch = (p.projectName || '').toLowerCase().includes(q);
      const clientMatch = (p.customerName || '').toLowerCase().includes(q);
      const codeMatch = (p.projectCode || '').toLowerCase().includes(q);
      if (!nameMatch && !clientMatch && !codeMatch) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">How each project is doing on budget and cost.</p>
        </div>
      </div>

      {/* Report Tabs Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
              activeTab === 'projects'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
          >
            Projects Profitability
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white border border-gray-200 rounded-2xl">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          <p className="text-sm text-gray-400">Generating report analytics...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Four KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Total Projects */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total projects</span>
                <FaBuilding className="text-slate-300 text-xs" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{totalProjectsCount}</p>
            </div>

            {/* 2. Total Profit */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total profit</span>
                <FaChartLine className="text-emerald-400 text-xs" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-700">₹{formatIndianCurrency(totalProfitSum)}</p>
            </div>

          </div>

          {/* Filter & Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Left Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterStatus === 'ALL'
                    ? 'bg-slate-200 text-slate-900 border border-slate-300 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-transparent'
                }`}
              >
                All · {allCount}
              </button>
              <button
                onClick={() => setFilterStatus('ONGOING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterStatus === 'ONGOING'
                    ? 'bg-slate-200 text-slate-900 border border-slate-300 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-transparent'
                }`}
              >
                Ongoing · {ongoingCount}
              </button>
              <button
                onClick={() => setFilterStatus('COMPLETED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterStatus === 'COMPLETED'
                    ? 'bg-slate-200 text-slate-900 border border-slate-300 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-transparent'
                }`}
              >
                Completed · {completedCount}
              </button>
            </div>

            {/* Right Controls: Search + View Toggle */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search project or client"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48 sm:w-60 pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 shadow-xs"
                />
                <FaSearch className="absolute right-2.5 top-2.5 text-slate-300 text-xs pointer-events-none" />
              </div>

              <button
                onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-colors flex items-center space-x-1.5 whitespace-nowrap"
              >
                {viewMode === 'cards' ? (
                  <>
                    <FaTable className="text-slate-400 text-xs" />
                    <span>Table view</span>
                  </>
                ) : (
                  <>
                    <FaThLarge className="text-slate-400 text-xs" />
                    <span>Cards view</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* CARD VIEW (DEFAULT) */}
          {viewMode === 'cards' && (
            filteredProjects.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs">
                No projects found matching the selected filter or search term.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {filteredProjects.map((p) => {
                  const profit = p.projectProfit !== undefined ? p.projectProfit : (p.grossProfit || 0);
                  const margin = p.projectMargin !== undefined ? p.projectMargin : (p.grossMargin || 0);
                  const budget = p.projectBudget !== undefined ? p.projectBudget : (p.revenue || 0);
                  const cost = p.actualProjectCost !== undefined ? p.actualProjectCost : (p.totalProjectCost || 0);
                  const budgetUsedPercent = budget > 0 ? Math.round((cost / budget) * 100) : 0;
                  const statusBadge = getCardStatusBadge(p.status);
                  const isSelected = selectedProject?.projectId === p.projectId;

                  return (
                    <div
                      key={p.projectId}
                      className={`bg-white rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-2 border-emerald-500 shadow-md ring-2 ring-emerald-50'
                          : 'border border-slate-200 hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      {/* Card Header: Project Name & Status */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                            {p.projectName}
                          </h3>
                          <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border whitespace-nowrap ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                          {p.customerName} · {p.projectCode}
                        </p>

                        {/* Project Profit Section */}
                        <div className="mt-4">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Project profit
                          </span>
                          <div className="flex items-baseline space-x-2 mt-0.5">
                            <span className={`text-2xl font-black ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              ₹{formatIndianCurrency(profit)}
                            </span>
                            {margin > 0 && margin < 100 && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                margin < 25
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}>
                                {margin}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Budget Used & Progress Bar */}
                        <div className="mt-4 space-y-1.5">
                          <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                            <span>Budget used</span>
                            <span className="font-semibold text-slate-700">{budgetUsedPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                budgetUsedPercent > 80 ? 'bg-amber-500' : 'bg-slate-400'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, budgetUsedPercent))}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Compact Financial Summary Lines */}
                        <div className="mt-3.5 space-y-1 text-xs text-slate-500">
                          <p className="truncate">
                            Budget: ₹{formatIndianCurrency(budget)} · Cost: ₹{formatIndianCurrency(cost)}
                          </p>
                        </div>
                      </div>

                      {/* View Details Button */}
                      <div className="mt-5 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => setSelectedProject(p)}
                          className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-xs text-center"
                        >
                          View details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* TABLE VIEW (ALTERNATIVE) */}
          {viewMode === 'table' && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Construction Projects Profitability Directory</h3>
                  <p className="text-xs text-gray-500">Executive comparison of Project Budget, actual costs (materials + expenses), project profit and margins.</p>
                </div>
                <span className="text-xs font-bold bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                  {projectsProfitability.length} Projects
                </span>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No project profitability records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-600 min-w-[1150px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Budget</th>
                        <th className="px-4 py-3 text-right">Materials</th>
                        <th className="px-4 py-3 text-right">Expenses</th>
                        <th className="px-4 py-3 text-right">Labour</th>
                        <th className="px-4 py-3 text-right">Total cost</th>
                        <th className="px-4 py-3 text-right">Profit</th>
                        <th className="px-4 py-3 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {filteredProjects.map((p) => {
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
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded border whitespace-nowrap ${STATUS_BADGES[p.status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                                {p.status ? p.status.replace('_', ' ') : 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-black text-indigo-950">
                              ₹{(p.projectBudget !== undefined ? p.projectBudget : (p.revenue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              ₹{(p.totalMaterialCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              ₹{(p.totalProjectExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600">
                              ₹{(p.totalLabourCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PROJECT DETAILS SLIDE-OVER DRAWER */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedProject(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200">
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{selectedProject.projectName}</h2>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getCardStatusBadge(selectedProject.status).className}`}>
                      {getCardStatusBadge(selectedProject.status).label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {selectedProject.customerName} · <span className="font-mono text-emerald-700 font-bold">{selectedProject.projectCode}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <FaTimes className="text-sm" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Profit Highlight Banner */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Project profit</span>
                    <p className="text-2xl font-black text-emerald-700 mt-0.5">
                      ₹{formatIndianCurrency(selectedProject.projectProfit !== undefined ? selectedProject.projectProfit : (selectedProject.grossProfit || 0), true)}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-white text-emerald-800 rounded-full border border-emerald-200 text-xs font-bold shadow-xs">
                    Margin: {selectedProject.projectMargin !== undefined ? selectedProject.projectMargin : (selectedProject.grossMargin || 0)}%
                  </span>
                </div>

                {/* Section 1: PROJECT DETAILS */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Project details</span>
                  <div className="space-y-2 text-xs divide-y divide-slate-100">
                    <div className="flex justify-between items-center pt-1.5 first:pt-0">
                      <span className="text-slate-500 font-medium">Project Name:</span>
                      <span className="font-bold text-slate-900">{selectedProject.projectName}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-500 font-medium">Project Code:</span>
                      <span className="font-mono font-bold text-slate-900">{selectedProject.projectCode}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-500 font-medium">Client:</span>
                      <span className="font-semibold text-slate-900">{selectedProject.customerName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-500 font-medium">Status:</span>
                      <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded border ${STATUS_BADGES[selectedProject.status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        {selectedProject.status ? selectedProject.status.replace('_', ' ') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-500 font-medium">Start Date:</span>
                      <span className="text-slate-700 font-medium">
                        {selectedProject.startDate ? formatDateToIndian(selectedProject.startDate) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-500 font-medium">End Date:</span>
                      <span className="text-slate-700 font-medium">
                        {selectedProject.expectedEndDate ? formatDateToIndian(selectedProject.expectedEndDate) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-500 font-medium">Location:</span>
                      <span className="text-slate-700 font-medium truncate max-w-[200px] text-right">
                        {selectedProject.siteAddress || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: COSTS */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costs</span>
                  <div className="space-y-2 text-xs divide-y divide-slate-100">
                    <div className="flex justify-between items-center pt-1.5 first:pt-0">
                      <span className="text-slate-500 font-medium">Project Budget (Excl. GST):</span>
                      <span className="font-bold text-slate-900">
                        ₹{formatIndianCurrency(selectedProject.projectBudget !== undefined ? selectedProject.projectBudget : (selectedProject.revenue || 0), true)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-500 font-medium">Material Cost (Excl. GST):</span>
                      <span className="font-semibold text-slate-700">
                        ₹{formatIndianCurrency(selectedProject.totalMaterialCost || 0, true)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-500 font-medium">Other Expenses:</span>
                      <span className="font-semibold text-slate-700">
                        ₹{formatIndianCurrency(selectedProject.totalProjectExpenses || 0, true)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-500 font-medium">Labour (wages earned):</span>
                      <span className="font-semibold text-slate-700">
                        ₹{formatIndianCurrency(selectedProject.totalLabourCost || 0, true)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-900 font-bold">Actual Cost (Excl. GST):</span>
                      <span className="font-extrabold text-slate-900">
                        ₹{formatIndianCurrency(selectedProject.actualProjectCost !== undefined ? selectedProject.actualProjectCost : (selectedProject.totalProjectCost || 0), true)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-slate-200 bg-white">
                <button
                  onClick={() => navigate(`/projects/${selectedProject.projectId}`)}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-2"
                >
                  <FaExternalLinkAlt className="text-xs" />
                  <span>Open Project</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
