import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { downloadProjectReport } from '../utils/projectReportExcel';
import {
  FaSearch,
  FaTable,
  FaThLarge,
  FaTimes,
  FaExternalLinkAlt,
  FaArrowUp,
  FaArrowDown,
  FaHashtag,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaDownload,
  FaSpinner,
} from 'react-icons/fa';
import { parseDateParts, formatDateRange } from '../utils/dateUtils';

// Rectangular outlined badges, same colours as the Projects page
const STATUS_BADGES = {
  PLANNING: { label: 'Planning', cls: 'bg-[#60A5FA]/10 text-[#93C5FD] border-[#60A5FA]/40' },
  IN_PROGRESS: { label: 'Ongoing', cls: 'bg-[#22C55E]/10 text-[#4ADE80] border-[#22C55E]/40' },
  ACTIVE: { label: 'Ongoing', cls: 'bg-[#22C55E]/10 text-[#4ADE80] border-[#22C55E]/40' },
  ON_HOLD: { label: 'On hold', cls: 'bg-[#FFB82E]/10 text-[#FFC14D] border-[#FFB82E]/40' },
  COMPLETED: { label: 'Completed', cls: 'bg-[#A78BFA]/10 text-[#C4B5FD] border-[#A78BFA]/40' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-[#F87171]/10 text-[#FCA5A5] border-[#F87171]/40' },
};

const getStatusBadge = (status) =>
  STATUS_BADGES[status] || {
    label: status ? status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ') : 'N/A',
    cls: 'bg-[#908C84]/10 text-[#B8B4AC] border-[#908C84]/40',
  };

const StatusBadge = ({ status }) => {
  const badge = getStatusBadge(status);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 text-[11px] font-medium rounded-md border ${badge.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {badge.label}
    </span>
  );
};

// Excel report for one project; doesn't open the card / row it sits on
const DownloadReportButton = ({ projectId }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await downloadProjectReport(projectId);
      toast.success('Project report downloaded.');
    } catch (err) {
      console.error('Error generating project report:', err);
      toast.error('Could not create the project report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={(e) => e.stopPropagation()}
      disabled={busy}
      title="Download Excel report"
      aria-label="Download Excel report"
      className="w-7 h-7 shrink-0 rounded-lg border border-slate-200 text-slate-400 hover:text-[#FFC14D] hover:border-[#FFB82E]/60 hover:bg-[#FFB82E]/10 flex items-center justify-center transition-colors cursor-pointer focus:outline-none disabled:cursor-wait"
    >
      {busy ? <FaSpinner className="text-[11px] animate-spin" /> : <FaDownload className="text-[11px]" />}
    </button>
  );
};

const capitalise = (text) => (text ? text.trim().charAt(0).toUpperCase() + text.trim().slice(1) : '');

// Whole rupees everywhere on this page
const formatRupees = (val) => `₹${Math.round(Number(val) || 0).toLocaleString('en-IN')}`;

// Normalise the old and new field names coming from the API
const getFigures = (p) => {
  const budget = Number(p.projectBudget !== undefined ? p.projectBudget : (p.revenue || 0)) || 0;
  const cost = Number(p.actualProjectCost !== undefined ? p.actualProjectCost : (p.totalProjectCost || 0)) || 0;
  const profit = Number(p.projectProfit !== undefined ? p.projectProfit : (p.grossProfit || 0)) || 0;
  const margin = Math.round(Number(p.projectMargin !== undefined ? p.projectMargin : (p.grossMargin || 0)) || 0);
  const budgetUsed = budget > 0 ? Math.round((cost / budget) * 100) : 0;
  return { budget, cost, profit, margin, budgetUsed };
};

const marginBadgeCls = (margin) => {
  if (margin < 0) return 'bg-[#F87171]/10 text-[#FCA5A5] border-[#F87171]/40';
  if (margin < 25) return 'bg-[#FFB82E]/10 text-[#FFC14D] border-[#FFB82E]/40';
  return 'bg-[#22C55E]/10 text-[#4ADE80] border-[#22C55E]/40';
};

const MarginBadge = ({ margin }) => (
  <span className={`px-1.5 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${marginBadgeCls(margin)}`}>
    {margin}%
  </span>
);

const budgetBarCls = (used) => {
  if (used > 100) return 'bg-[#F87171]';
  if (used > 80) return 'bg-[#FFB82E]';
  return 'bg-slate-400';
};

const profitCls = (profit) => (profit >= 0 ? 'text-[#4ADE80]' : 'text-[#FCA5A5]');

const SORT_OPTIONS = [
  { field: 'profit', label: 'Profit' },
  { field: 'margin', label: 'Margin' },
  { field: 'budgetUsed', label: 'Budget used' },
];

const Reports = () => {
  const navigate = useNavigate();

  const [projectsProfitability, setProjectsProfitability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ONGOING' | 'COMPLETED'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState(null); // null keeps the API order
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    fetchReportData();
  }, []);

  // Esc closes the project pop-up
  useEffect(() => {
    if (!selectedProject) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSelectedProject(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedProject]);

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

  // Summary figures across all projects
  const totals = projectsProfitability.reduce(
    (acc, p) => {
      const f = getFigures(p);
      acc.budget += f.budget;
      acc.cost += f.cost;
      acc.profit += f.profit;
      return acc;
    },
    { budget: 0, cost: 0, profit: 0 }
  );
  const averageMargin = totals.budget > 0 ? Math.round((totals.profit / totals.budget) * 100) : 0;

  const allCount = projectsProfitability.length;
  const ongoingCount = projectsProfitability.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED').length;
  const completedCount = projectsProfitability.filter(p => p.status === 'COMPLETED').length;

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

  const sortedProjects = sortBy
    ? [...filteredProjects].sort((a, b) => {
        const diff = getFigures(a)[sortBy] - getFigures(b)[sortBy];
        return sortAsc ? diff : -diff;
      })
    : filteredProjects;

  // Totals row for the table follows the current filter and search
  const listTotals = sortedProjects.reduce(
    (acc, p) => {
      const f = getFigures(p);
      acc.budget += f.budget;
      acc.materials += Number(p.totalMaterialCost) || 0;
      acc.expenses += Number(p.totalProjectExpenses) || 0;
      acc.labour += Number(p.totalLabourCost) || 0;
      acc.cost += f.cost;
      acc.profit += f.profit;
      return acc;
    },
    { budget: 0, materials: 0, expenses: 0, labour: 0, cost: 0, profit: 0 }
  );
  const listMargin = listTotals.budget > 0 ? Math.round((listTotals.profit / listTotals.budget) * 100) : 0;

  // First click sorts weakest first; clicking again reverses
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(field !== 'budgetUsed');
    }
  };

  const filterBtnCls = (active) =>
    `px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
      active
        ? 'bg-slate-200 text-slate-900 border border-slate-300'
        : 'bg-white hover:bg-slate-100 text-slate-600 border border-transparent'
    }`;

  const summaryCards = [
    { label: 'Total projects', value: allCount, cls: 'text-slate-900' },
    { label: 'Total budget', value: formatRupees(totals.budget), cls: 'text-slate-900' },
    { label: 'Total cost', value: formatRupees(totals.cost), cls: 'text-slate-900' },
    { label: 'Total profit', value: formatRupees(totals.profit), cls: profitCls(totals.profit) },
    { label: 'Average margin', value: `${averageMargin}%`, cls: profitCls(averageMargin) },
  ];

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-3rem)]">
      {/* Page Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports</h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-0.5">How each project is doing on budget and cost.</p>
      </div>

      {error && (
        <div className="shrink-0 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white border border-gray-200 rounded-2xl">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FFB82E]"></div>
          <p className="text-sm text-gray-400">Loading report...</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="shrink-0 grid grid-cols-2 lg:grid-cols-5 gap-3">
            {summaryCards.map((c, i) => (
              <div
                key={c.label}
                className={`bg-white border border-slate-200/90 rounded-2xl px-4 py-3.5 ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}
              >
                <span className="text-xs font-medium text-slate-400 block">{c.label}</span>
                <p className={`text-xl font-bold mt-1 ${c.cls}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Filters, sort, search and view toggle */}
          <div className="shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button onClick={() => setFilterStatus('ALL')} className={filterBtnCls(filterStatus === 'ALL')}>
                  All · {allCount}
                </button>
                <button onClick={() => setFilterStatus('ONGOING')} className={filterBtnCls(filterStatus === 'ONGOING')}>
                  Ongoing · {ongoingCount}
                </button>
                <button onClick={() => setFilterStatus('COMPLETED')} className={filterBtnCls(filterStatus === 'COMPLETED')}>
                  Completed · {completedCount}
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-400 mr-1">Sort by</span>
                {SORT_OPTIONS.map(({ field, label }) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => handleSort(field)}
                    className={`px-3 py-1.5 rounded-xl border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                      sortBy === field
                        ? 'bg-[#FFB82E]/10 border-[#FFB82E]/40 text-[#FFC14D]'
                        : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                    }`}
                    title={sortBy === field ? 'Click to reverse order' : `Sort by ${label.toLowerCase()}`}
                  >
                    {label}
                    {sortBy === field && (sortAsc ? <FaArrowUp className="text-[9px]" /> : <FaArrowDown className="text-[9px]" />)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 xl:flex-none">
                <input
                  type="text"
                  placeholder="Search project or client"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full xl:w-60 pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                />
                <FaSearch className="absolute right-2.5 top-2.5 text-slate-300 text-xs pointer-events-none" />
              </div>

              <button
                onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors flex items-center space-x-1.5 whitespace-nowrap"
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

          {/* CARD VIEW: only this box scrolls */}
          {viewMode === 'cards' && (
            sortedProjects.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs">
                No projects match this filter or search.
              </div>
            ) : (
              <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto custom-table-scrollbar lg:pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {sortedProjects.map((p) => {
                    const { budget, cost, profit, margin, budgetUsed } = getFigures(p);
                    const isSelected = selectedProject?.projectId === p.projectId;
                    const isOngoing = p.status !== 'COMPLETED' && p.status !== 'CANCELLED';
                    const isOverBudget = cost > budget;
                    const noCosts = cost === 0;

                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        key={p.projectId}
                        onClick={() => setSelectedProject(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedProject(p);
                          }
                        }}
                        title="View details"
                        className={`text-left bg-white rounded-2xl p-4 transition-all cursor-pointer flex flex-col justify-start gap-3 ${
                          isSelected
                            ? 'border border-[#FFB82E]/60 ring-1 ring-[#FFB82E]/30'
                            : 'border border-slate-200 hover:border-[#FFB82E]/40'
                        }`}
                      >
                        <div className="w-full">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                                {capitalise(p.projectName)}
                              </h3>
                              <span className="shrink-0">
                                <StatusBadge status={p.status} />
                              </span>
                            </div>
                            <DownloadReportButton projectId={p.projectId} />
                          </div>
                          <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                            {p.projectCode}
                          </p>
                        </div>

                        {/* Ongoing work leads with budget left; finished work with final profit */}
                        {isOngoing ? (
                          <div className="w-full">
                            <span className="text-xs font-medium text-slate-400 block">
                              {isOverBudget ? 'Over budget' : 'Budget left'}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-2xl font-bold ${isOverBudget ? 'text-[#FCA5A5]' : 'text-slate-900'}`}>
                                {formatRupees(Math.abs(budget - cost))}
                              </span>
                              {noCosts && <span className="text-[11px] text-slate-400">No costs yet</span>}
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-500 font-medium mt-2.5">
                              <span>Budget used</span>
                              <span className={`font-semibold ${isOverBudget ? 'text-[#FCA5A5]' : 'text-slate-700'}`}>{budgetUsed}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1.5">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${budgetBarCls(budgetUsed)}`}
                                style={{ width: `${Math.min(100, Math.max(0, budgetUsed))}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full">
                            <span className="text-xs font-medium text-slate-400 block">Project profit</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-2xl font-bold ${profitCls(profit)}`}>{formatRupees(profit)}</span>
                              {noCosts
                                ? <span className="text-[11px] text-slate-400">No costs yet</span>
                                : <MarginBadge margin={margin} />}
                            </div>
                          </div>
                        )}

                        {/* Pinned to the bottom so every card lines up */}
                        <div className="w-full mt-auto pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[11px] text-slate-400 block">Budget</span>
                            <span className="text-sm font-semibold text-slate-900">{formatRupees(budget)}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block">{isOngoing ? 'Cost so far' : 'Final cost'}</span>
                            <span className="text-sm font-semibold text-slate-900">{formatRupees(cost)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* TABLE VIEW: only this box scrolls */}
          {viewMode === 'table' && (
            <div className="lg:flex-1 lg:min-h-0 flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="shrink-0 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-base">Projects</h3>
                <span className="text-xs text-slate-400">{sortedProjects.length} shown</span>
              </div>

              {sortedProjects.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No projects match this filter or search.
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-auto custom-table-scrollbar">
                  <table className="w-full text-left text-xs text-gray-600 min-w-[1050px]">
                    <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
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
                        <th className="px-4 py-3 text-right">Margin</th>
                        <th className="px-4 py-3 text-center">Report</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {sortedProjects.map((p) => {
                        const { budget, cost, profit, margin } = getFigures(p);

                        return (
                          <tr
                            key={p.projectId}
                            onClick={() => setSelectedProject(p)}
                            className="hover:bg-[#FFB82E]/[0.05] transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-900 block">{capitalise(p.projectName)}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500">{p.projectCode}</td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRupees(budget)}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatRupees(p.totalMaterialCost)}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatRupees(p.totalProjectExpenses)}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatRupees(p.totalLabourCost)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupees(cost)}</td>
                            <td className={`px-4 py-3 text-right font-bold ${profitCls(profit)}`}>{formatRupees(profit)}</td>
                            <td className="px-4 py-3 text-right">
                              <MarginBadge margin={margin} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center">
                                <DownloadReportButton projectId={p.projectId} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-gray-50 border-t border-gray-200 font-bold text-slate-900">
                      <tr>
                        <td className="px-4 py-3" colSpan={3}>Total</td>
                        <td className="px-4 py-3 text-right">{formatRupees(listTotals.budget)}</td>
                        <td className="px-4 py-3 text-right">{formatRupees(listTotals.materials)}</td>
                        <td className="px-4 py-3 text-right">{formatRupees(listTotals.expenses)}</td>
                        <td className="px-4 py-3 text-right">{formatRupees(listTotals.labour)}</td>
                        <td className="px-4 py-3 text-right">{formatRupees(listTotals.cost)}</td>
                        <td className={`px-4 py-3 text-right ${profitCls(listTotals.profit)}`}>{formatRupees(listTotals.profit)}</td>
                        <td className="px-4 py-3 text-right">
                          <MarginBadge margin={listMargin} />
                        </td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* PROJECT DETAILS POP-UP */}
      {selectedProject && (() => {
        const p = selectedProject;
        const { budget, cost, profit, margin, budgetUsed } = getFigures(p);
        const isOngoing = p.status !== 'COMPLETED' && p.status !== 'CANCELLED';
        const isOverBudget = cost > budget;
        const noCosts = cost === 0;

        const toDate = (val) => {
          const parts = parseDateParts(val);
          return parts ? new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) : null;
        };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = toDate(p.startDate);
        const end = toDate(p.expectedEndDate);

        // Days left or overdue, only for ongoing work with an end date
        let timelineNote = null;
        if (isOngoing && end) {
          const days = Math.round((end - today) / 86400000);
          if (days < 0) timelineNote = { text: `${-days} ${days === -1 ? 'day' : 'days'} overdue`, late: true };
          else if (days === 0) timelineNote = { text: 'Due today', late: false };
          else timelineNote = { text: `${days} ${days === 1 ? 'day' : 'days'} left`, late: false };
        }

        // Share of the schedule already gone, to compare with budget used
        let timeUsed = null;
        if (isOngoing && start && end && end > start) {
          timeUsed = Math.round(Math.min(1, Math.max(0, (today - start) / (end - start))) * 100);
        }
        let paceNote = null;
        if (timelineNote?.late) {
          // Past the end date, comparing pace with time no longer makes sense
          paceNote = isOverBudget
            ? { text: 'Past end date and over budget', cls: 'text-[#FCA5A5]' }
            : { text: `Past end date, ${formatRupees(budget - cost)} still unspent`, cls: 'text-[#FFC14D]' };
        } else if (timeUsed !== null && !noCosts) {
          if (budgetUsed > timeUsed + 10) paceNote = { text: 'Money is going faster than time', cls: 'text-[#FFC14D]' };
          else if (budgetUsed < timeUsed - 10) paceNote = { text: 'Money is going slower than time', cls: 'text-[#4ADE80]' };
          else paceNote = { text: 'Spending is on track with time', cls: 'text-slate-400' };
        }

        const costParts = [
          { label: 'Materials', note: 'excl. GST', value: Number(p.totalMaterialCost) || 0, color: 'bg-[#FFB82E]' },
          { label: 'Labour', note: 'wages earned', value: Number(p.totalLabourCost) || 0, color: 'bg-[#60A5FA]' },
          { label: 'Other expenses', note: '', value: Number(p.totalProjectExpenses) || 0, color: 'bg-[#A78BFA]' },
        ];

        const metaItems = [
          { icon: FaHashtag, text: p.projectCode, title: 'Project code' },
          p.siteAddress && { icon: FaMapMarkerAlt, text: capitalise(p.siteAddress), title: 'Site' },
        ].filter(Boolean);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-fade"
              onClick={() => setSelectedProject(null)}
            />

            <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 modal-pop">
              {/* Header: name, status, then labelled details */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{capitalise(p.projectName)}</h2>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500">
                    {metaItems.map(({ icon: Icon, text, title }) => (
                      <span key={title} className="inline-flex items-center gap-1.5" title={title}>
                        <Icon className="text-slate-400 text-[11px]" />
                        {text}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1.5" title="Dates">
                      <FaCalendarAlt className="text-slate-400 text-[11px]" />
                      {formatDateRange(p.startDate, p.expectedEndDate, 'No end date', 'No dates set')}
                      {timelineNote && (
                        <span className={timelineNote.late ? 'text-[#FCA5A5] font-semibold' : 'text-slate-400'}>
                          · {timelineNote.text}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                  title="Close (Esc)"
                >
                  <FaTimes className="text-sm" />
                </button>
              </div>

              {/* Content: two equal-height boxes */}
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-4 custom-table-scrollbar">
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-4">
                  {isOngoing ? (
                    <>
                      <div>
                        <span className="text-xs font-medium text-slate-400 block">{isOverBudget ? 'Over budget' : 'Budget left'}</span>
                        <p className={`text-2xl font-bold mt-0.5 ${isOverBudget ? 'text-[#FCA5A5]' : 'text-slate-900'}`}>
                          {formatRupees(Math.abs(budget - cost))}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {timeUsed !== null && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>Time used</span>
                              <span className="font-semibold text-slate-700">{timeUsed}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-[#60A5FA]" style={{ width: `${timeUsed}%` }}></div>
                            </div>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Budget used</span>
                            <span className={`font-semibold ${isOverBudget ? 'text-[#FCA5A5]' : 'text-slate-700'}`}>{budgetUsed}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${budgetBarCls(budgetUsed)}`}
                              style={{ width: `${Math.min(100, Math.max(0, budgetUsed))}%` }}
                            ></div>
                          </div>
                        </div>
                        {paceNote && <p className={`text-xs font-medium ${paceNote.cls}`}>{paceNote.text}</p>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-xs font-medium text-slate-400 block">Project profit</span>
                        <p className="mt-0.5 flex items-baseline gap-2">
                          <span className={`text-2xl font-bold ${profitCls(profit)}`}>{formatRupees(profit)}</span>
                          <span className="text-xs text-slate-400">
                            {noCosts ? 'No costs yet' : `· ${margin}% margin`}
                          </span>
                        </p>
                      </div>
                      {!noCosts && budget > 0 && (
                        <div className="space-y-2">
                          {/* How the budget split between cost and profit */}
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                            <div className="h-full bg-slate-400" style={{ width: `${Math.min(100, budgetUsed)}%` }}></div>
                            {!isOverBudget && <div className="h-full bg-[#22C55E]" style={{ width: `${100 - budgetUsed}%` }}></div>}
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="inline-flex items-center text-slate-500">
                              <span className="w-2 h-2 rounded-sm mr-1.5 bg-slate-400"></span>Spent {budgetUsed}%
                            </span>
                            {!isOverBudget && (
                              <span className="inline-flex items-center text-slate-500">
                                <span className="w-2 h-2 rounded-sm mr-1.5 bg-[#22C55E]"></span>Kept {100 - budgetUsed}%
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        {!noCosts && (
                          <p className={`text-xs font-medium ${isOverBudget ? 'text-[#FCA5A5]' : 'text-[#4ADE80]'}`}>
                            {isOverBudget
                              ? `Finished ${formatRupees(cost - budget)} over budget`
                              : `Finished ${formatRupees(budget - cost)} under budget`}
                          </p>
                        )}
                        {start && end && end > start && (
                          <p className="text-xs text-slate-400">
                            Ran {Math.round((end - start) / 86400000)} days ({formatDateRange(p.startDate, p.expectedEndDate)})
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Budget</span>
                      <span className="text-sm font-semibold text-slate-900">{formatRupees(budget)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">{isOngoing ? 'Cost so far' : 'Final cost'}</span>
                      <span className="text-sm font-semibold text-slate-900">{formatRupees(cost)}</span>
                    </div>
                  </div>
                </div>

                {/* Where the money went: one stacked bar */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-4">
                  <span className="text-xs font-semibold text-slate-400">Where the money went</span>
                  {noCosts ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 py-6">
                      <span className="text-sm font-semibold text-slate-600">No costs recorded yet</span>
                      <span className="text-xs text-slate-400">Materials, labour and expenses will show here once they're added.</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                        {costParts.map((c) => (
                          <div key={c.label} className={c.color} style={{ width: `${(c.value / cost) * 100}%` }} title={c.label}></div>
                        ))}
                      </div>
                      <div className="space-y-2.5">
                        {costParts.map((c) => (
                          <div key={c.label} className="flex justify-between items-center text-xs">
                            <span className="text-slate-600 font-medium inline-flex items-center">
                              <span className={`w-2 h-2 rounded-sm mr-2 ${c.color}`}></span>
                              {c.label}
                              {c.note && <span className="text-slate-400 font-normal ml-1">({c.note})</span>}
                            </span>
                            <span className="text-slate-900 font-semibold">
                              {formatRupees(c.value)}
                              <span className="text-slate-400 font-normal ml-1.5 inline-block w-8 text-right">{Math.round((c.value / cost) * 100)}%</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-auto flex justify-between items-center pt-3 border-t border-slate-100 text-sm">
                        <span className="text-slate-900 font-bold">Actual cost <span className="text-xs text-slate-400 font-normal">(excl. GST)</span></span>
                        <span className="font-bold text-slate-900">{formatRupees(cost)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => navigate(`/projects/${p.projectId}`)}
                  className="py-2 px-5 bg-[#FFB82E] hover:bg-[#F2A516] text-[#1A1B1E] rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  <FaExternalLinkAlt className="text-xs" />
                  <span>Open project</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Reports;
