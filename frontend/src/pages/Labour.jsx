import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLabours } from '../utils/labourService';
import FilterSelect from '../components/FilterSelect';
import LabourFormModal from '../components/LabourFormModal';
import LabourPaymentModal from '../components/LabourPaymentModal';
import LabourPaymentHistoryModal from '../components/LabourPaymentHistoryModal';
import axiosInstance from '../utils/api';
import { getErrorMessage } from '../utils/apiError';
import { formatDateShortMonth } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import useFitHeight from '../utils/useFitHeight';
import {
  FaHardHat,
  FaUsers,
  FaUserClock,
  FaSearch,
  FaFilter,
  FaUndo,
  FaPlus,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaCalendarAlt,
  FaRupeeSign,
  FaBuilding,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaTimes,
} from 'react-icons/fa';

// Purple rectangular outlined badge (same style as the profile's BADGE)
const CONTRACTOR_BADGE = 'bg-[#A78BFA]/10 text-[#C4B5FD] border-[#A78BFA]/40';

const Labour = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [labours, setLabours] = useState([]);
  const [projects, setProjects] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Request sequencing and abort controller refs for race-condition prevention
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Active filters count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (projectFilter) count++;
    if (locationFilter) count++;
    if (statusFilter) count++;
    return count;
  }, [searchTerm, projectFilter, locationFilter, statusFilter]);

  // Modal States for Add / Edit (Phase 4)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [modalKind, setModalKind] = useState('LABOUR'); // 'LABOUR' | 'CONTRACTOR'
  const [activeLabour, setActiveLabour] = useState(null);


  // Modal States for Payments (Phase 7)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentLabour, setPaymentLabour] = useState(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyLabour, setHistoryLabour] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Projects for the dropdown
  useEffect(() => {
    const fetchProjectsList = async () => {
      try {
        const res = await axiosInstance.get('/projects');
        setProjects(res.data?.data || []);
      } catch (err) {
        console.error('Error fetching projects dropdown:', err);
      }
    };
    fetchProjectsList();
  }, []);

  // Fetch Labours from API with race-condition prevention and cancellation
  const fetchLabourData = useCallback(async () => {
    // Cancel previous in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const params = { signal: controller.signal };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (projectFilter) params.projectId = projectFilter;
      if (locationFilter) params.location = locationFilter;

      const data = await getLabours(params);

      // Guard: Discard stale response if a newer request was dispatched
      if (currentRequestId === requestIdRef.current) {
        setLabours(data);

        // Track and accumulate known locations for dropdown
        // "kota" and "Kota" are the same place, so keep one spelling per address
        setAvailableLocations((prev) => {
          const byKey = new Map(prev.map((loc) => [loc.toLowerCase(), loc]));
          data.forEach((l) => {
            const loc = l.location && l.location.trim();
            if (loc && !byKey.has(loc.toLowerCase())) {
              byKey.set(loc.toLowerCase(), loc.charAt(0).toUpperCase() + loc.slice(1));
            }
          });
          return Array.from(byKey.values()).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
          );
        });
      }
    } catch (err) {
      // Ignore cancellations cleanly
      if (
        err?.name === 'CanceledError' ||
        err?.code === 'ERR_CANCELED' ||
        err?.message === 'canceled'
      ) {
        return;
      }
      if (currentRequestId === requestIdRef.current) {
        console.error('Error loading labours:', err);
        setError(getErrorMessage(err, 'Failed to load labour records from server.'));
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedSearch, projectFilter, locationFilter]);

  useEffect(() => {
    fetchLabourData();
  }, [fetchLabourData]);

  // Combined location filter fallback (case-insensitive and trimmed)
  const baseLabours = useMemo(() => {
    let list = labours;
    // Inactive workers are not on any project, so a project filter only shows active ones
    if (projectFilter) list = list.filter((l) => l.status === 'ACTIVE');
    if (!locationFilter) return list;
    return list.filter(
      (l) => l.location && l.location.trim().toLowerCase() === locationFilter.trim().toLowerCase()
    );
  }, [labours, projectFilter, locationFilter]);

  // Status is filtered here (not by the API) so the summary cards keep showing both counts
  const displayedLabours = useMemo(() => {
    if (statusFilter === 'ACTIVE') return baseLabours.filter((l) => l.status === 'ACTIVE');
    if (statusFilter === 'INACTIVE') return baseLabours.filter((l) => l.status !== 'ACTIVE');
    return baseLabours;
  }, [baseLabours, statusFilter]);

  // Clicking a summary card filters by it; clicking the selected card again clears it
  const toggleStatusFilter = (value) => setStatusFilter((cur) => (cur === value ? '' : value));
  const cardRing = (selected) =>
    selected ? 'ring-2 ring-[#FFB82E]/60 border-transparent' : 'hover:border-[#FFB82E]/40';

  // Derive Summary Metrics for currently filtered / displayed dataset
  const summaryMetrics = useMemo(() => {
    const total = baseLabours.length;
    const active = baseLabours.filter((l) => l.status === 'ACTIVE').length;
    const inactive = baseLabours.filter((l) => l.status !== 'ACTIVE').length;

    // Projected Monthly Wages for Active Labours ONLY: sum(activeDailyWage * 30 days)
    // Contractors are paid per project, so they are left out
    const activeDailyTotal = baseLabours
      .filter((l) => l.status === 'ACTIVE' && l.type !== 'CONTRACTOR')
      .reduce((acc, l) => acc + (Number(l.dailyWage) || 0), 0);
    const projectedMonthly = activeDailyTotal * 30;

    return { total, active, inactive, projectedMonthly };
  }, [baseLabours]);

  // Wages earned but not yet paid, for the workers in the current filters
  const pendingWages = useMemo(() => {
    const owed = baseLabours.filter((l) => Number(l.balance) > 0);
    return {
      amount: owed.reduce((acc, l) => acc + Number(l.balance), 0),
      workers: owed.length,
    };
  }, [baseLabours]);

  // The page itself never scrolls: the table box fills the rest of the screen and scrolls on its own
  const [tableBoxRef, tableMaxHeight] = useFitHeight([loading, error, displayedLabours.length, activeFilterCount]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setProjectFilter('');
    setLocationFilter('');
    setStatusFilter('');
  };

  // Add / Edit Modal Trigger Handlers
  const handleOpenAdd = () => {
    setActiveLabour(null);
    setModalMode('create');
    setModalKind('LABOUR');
    setIsModalOpen(true);
  };

  const handleOpenAddContractor = () => {
    setActiveLabour(null);
    setModalMode('create');
    setModalKind('CONTRACTOR');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (labour) => {
    setActiveLabour(labour);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleModalSuccess = (message) => {
    toast.success(message);
    fetchLabourData();
  };

  // Payment Handlers (Phase 7)
  const handleOpenPayment = (labour) => {
    setPaymentLabour(labour);
    setIsPaymentModalOpen(true);
  };

  const handleOpenHistory = (labour) => {
    setHistoryLabour(labour);
    setIsHistoryModalOpen(true);
  };

  const handlePaymentSuccess = (message) => {
    toast.success(message);
    fetchLabourData();
  };

  // Informational handler for remaining future placeholder action buttons
  const handleActionPlaceholder = (actionName) => {
    toast?.info?.(`${actionName} functionality will be enabled in upcoming phases.`) ||
      alert(`${actionName} functionality will be enabled in upcoming phases.`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Page Header: title + what is owed, like the Projects header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Labour</h2>
          <p className="text-gray-500 text-sm mt-1">
            {pendingWages.amount > 0 ? (
              <>
                <span className="text-[#FFC14D]">₹{Math.round(pendingWages.amount).toLocaleString('en-IN')} still to pay</span>
                {' to '}
                {pendingWages.workers} {pendingWages.workers === 1 ? 'worker' : 'workers'}
              </>
            ) : (
              'All wages are paid'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleOpenAddContractor}
            className="flex items-center justify-center gap-2 border border-[#FFB82E]/50 text-[#FFC14D] hover:bg-[#FFB82E]/10 font-semibold px-4 py-2.5 rounded-xl transition-all text-sm whitespace-nowrap cursor-pointer"
          >
            <FaPlus className="text-xs" />
            <span>Add contractor</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm whitespace-nowrap cursor-pointer"
          >
            <FaPlus className="text-xs" />
            <span>Add labour</span>
          </button>
        </div>
      </div>

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: TOTAL LABOUR (click to filter) */}
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`text-left bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer ${cardRing(statusFilter === '')}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Total Labour
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {summaryMetrics.total}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                {summaryMetrics.active} Active • {summaryMetrics.inactive} Inactive
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg shadow-inner">
              <FaHardHat />
            </div>
          </div>
        </button>

        {/* Card 2: ACTIVE LABOUR (click to filter) */}
        <button
          type="button"
          onClick={() => toggleStatusFilter('ACTIVE')}
          className={`text-left bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer ${cardRing(statusFilter === 'ACTIVE')}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                Active Labour
              </p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">
                {summaryMetrics.active}
              </h3>
              <p className="text-xs font-semibold text-emerald-700/80 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                Currently Working
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-inner">
              <FaUsers />
            </div>
          </div>
        </button>

        {/* Card 3: INACTIVE LABOUR (click to filter) */}
        <button
          type="button"
          onClick={() => toggleStatusFilter('INACTIVE')}
          className={`text-left bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer ${cardRing(statusFilter === 'INACTIVE')}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Inactive Labour
              </p>
              <h3 className="text-2xl font-black text-slate-700 mt-1">
                {summaryMetrics.inactive}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Unassigned / Available
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center text-lg shadow-inner">
              <FaUserClock />
            </div>
          </div>
        </button>

        {/* Card 4: PROJECTED MONTHLY WAGES */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                Projected Monthly Wages
              </p>
              <h3 className="text-2xl font-black text-indigo-700 mt-1">
                ₹{summaryMetrics.projectedMonthly.toLocaleString('en-IN')}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                For Active Labour (30d)
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shadow-inner">
              <FaRupeeSign />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filters & Search Toolbar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-sm">
            <FaSearch className="absolute left-3.5 top-3.5 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, mobile or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white transition-all text-slate-800 font-medium placeholder-gray-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setDebouncedSearch('');
                }}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-0.5"
                title="Clear search input"
              >
                <FaTimes className="text-xs" />
              </button>
            )}
          </div>

          {/* Project Filter */}
          <div className="w-full sm:w-56">
            <FilterSelect
              value={projectFilter}
              onChange={setProjectFilter}
              placeholder="All projects"
              options={projects
                // Only ongoing projects have workers on site, so others would always show 0
                .filter((proj) => proj.status === 'IN_PROGRESS')
                .map((proj) => ({ value: proj.id, label: proj.name, hint: proj.projectCode }))}
            />
          </div>

          {/* Address Filter */}
          <div className="w-full sm:w-44">
            <FilterSelect
              value={locationFilter}
              onChange={setLocationFilter}
              placeholder="All addresses"
              options={availableLocations.map((loc) => ({ value: loc, label: loc }))}
            />
          </div>

          {/* Counter + Reset, on the same row as the filters */}
          <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap ml-auto">
            <span className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
              <strong className="text-slate-800 font-semibold">{displayedLabours.length}</strong>{' '}
              {displayedLabours.length === 1 ? 'worker' : 'workers'}
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all cursor-pointer"
                title={`${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'} applied`}
              >
                <FaUndo className="text-[10px]" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Labour List Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-500 font-semibold">Loading labour directory...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
              <FaExclamationTriangle />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">Unable to load Labour records</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">{error}</p>
            </div>
            <button
              onClick={fetchLabourData}
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2"
            >
              <FaUndo className="text-xs" />
              <span>Try Again</span>
            </button>
          </div>
        ) : displayedLabours.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
              {activeFilterCount > 0 ? (
                <FaFilter className="text-slate-400" />
              ) : (
                <FaHardHat className="text-slate-400" />
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-800">
                {activeFilterCount > 0
                  ? 'No labour found matching your filters'
                  : 'No labour workers registered yet'}
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {activeFilterCount > 0
                  ? 'No labour records match your active search and filter criteria. Try adjusting your search term or clearing filters.'
                  : 'Start by registering your first labour worker to track daily wages and project assignments.'}
              </p>
            </div>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <FaUndo className="text-xs" />
                <span>Reset All Filters</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <FaPlus className="text-xs" />
                <span>Add Labour</span>
              </button>
            )}
          </div>
        ) : (
          <div
            ref={tableBoxRef}
            className="overflow-y-auto overflow-x-hidden custom-table-scrollbar"
            style={tableMaxHeight ? { maxHeight: tableMaxHeight } : undefined}
          >
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-gray-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wide shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
                <tr>
                  <th className="px-2.5 py-3 text-center w-8">#</th>
                  <th className="px-2.5 py-3">Name</th>
                  <th className="px-2.5 py-3">Address</th>
                  <th className="px-2.5 py-3">Project</th>
                  <th className="px-2.5 py-3 text-right">Daily Wage</th>
                  <th className="px-2.5 py-3">Start Date</th>
                  <th className="px-2.5 py-3 text-center">Status</th>
                  <th className="px-2.5 py-3 text-right">Total Earned</th>
                  <th className="px-2.5 py-3 text-right">Total Paid</th>
                  <th className="px-2.5 py-3 text-right">Balance</th>
                  <th className="px-2.5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {displayedLabours.map((labour, index) => {
                  const isContractor = labour.type === 'CONTRACTOR';
                  // A contractor can be on several projects; the list shows the first one + "+N more"
                  const contractorProjects = isContractor ? labour.activeProjects || [] : [];
                  const shownProject = isContractor ? contractorProjects[0] || null : labour.project;
                  const moreProjects = Math.max(contractorProjects.length - 1, 0);

                  return (
                    // The whole row opens the profile; Pay and Total paid keep their own action
                    <tr
                      key={labour.id}
                      onClick={() => navigate(`/labour/${labour.id}`)}
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                    >
                      {/* # Index */}
                      <td className="px-2.5 py-3.5 text-center font-mono text-xs text-gray-400 font-semibold">
                        {index + 1}
                      </td>

                      {/* Labour Name */}
                      <td className="px-2.5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                            {labour.name}
                          </span>
                          {isContractor && (
                            <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-medium leading-none ${CONTRACTOR_BADGE}`}>
                              Contractor
                            </span>
                          )}
                        </div>
                        {/* Mobile */}
                        <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-semibold mt-0.5 whitespace-nowrap">
                          <FaPhoneAlt className="text-gray-400 text-[10px]" />
                          <span>{labour.mobile}</span>
                        </div>
                      </td>

                      {/* Address */}
                      <td className="px-2.5 py-3.5">
                        <div className="flex items-start space-x-1.5 text-xs text-slate-600 font-medium">
                          <FaMapMarkerAlt className="text-gray-400 text-[11px] flex-shrink-0 mt-0.5" />
                          <span className="break-words">{labour.address || labour.location}</span>
                        </div>
                      </td>

                      {/* Project */}
                      <td className="px-2.5 py-3.5">
                        {shownProject ? (
                          <div className="flex items-center space-x-1.5 text-xs">
                            <FaBuilding className="text-emerald-600 text-[11px] flex-shrink-0" />
                            <div>
                              <span className="font-bold text-slate-800 block">
                                {shownProject.name}
                              </span>
                              {moreProjects > 0 ? (
                                <span
                                  className="text-[10px] text-[#C4B5FD]"
                                  title={contractorProjects.map((p) => p.name).join(', ')}
                                >
                                  +{moreProjects} more
                                </span>
                              ) : (
                                shownProject.projectCode && (
                                  <span className="text-[10px] font-mono text-gray-400 uppercase">
                                    {shownProject.projectCode}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Daily Wage (contractor: rate per sq ft and area) */}
                      <td className="px-2.5 py-3.5 text-right">
                        {isContractor ? (
                          contractorProjects.length > 1 ? (
                            <span className="text-xs text-slate-600 whitespace-nowrap">
                              {contractorProjects.length} projects
                            </span>
                          ) : contractorProjects.length === 1 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-black text-slate-900 font-mono text-xs whitespace-nowrap">
                                ₹{Number(contractorProjects[0].ratePerSqFt || 0).toLocaleString('en-IN')}/sq ft
                              </span>
                              <span className="text-[10px] text-gray-500 font-semibold mt-0.5 whitespace-nowrap">
                                {Number(contractorProjects[0].areaSqFt || 0).toLocaleString('en-IN')} sq ft
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )
                        ) : (
                          <span className="font-black text-slate-900 font-mono text-xs whitespace-nowrap">
                            ₹{Number(labour.dailyWage || 0).toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      {/* Start Date */}
                      <td className="px-2.5 py-3.5 text-xs text-slate-600 font-medium">
                        <div className="flex items-center space-x-1.5 whitespace-nowrap">
                          <FaCalendarAlt className="text-gray-400 text-[10px]" />
                          <span>{labour.startDate ? formatDateShortMonth(labour.startDate, '-') : '-'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-2.5 py-3.5 text-center">
                        {labour.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
                            INACTIVE
                          </span>
                        )}
                      </td>

                      {/* Total Earned (Calculated in Phase 6) */}
                      <td className="px-2.5 py-3.5 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-slate-900 font-mono text-xs">
                            ₹{Number(labour.totalEarned || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[10px] text-gray-500 font-semibold mt-0.5">
                            {isContractor
                              ? contractorProjects.length > 1
                                ? `${contractorProjects.length} projects`
                                : 'contract'
                              : `${labour.earnedDays || 0} ${labour.earnedDays === 1 ? 'day' : 'days'}`}
                          </span>
                        </div>
                      </td>

                      {/* Total Paid (Phase 7) */}
                      <td className="px-2.5 py-3.5 text-right">
                        <div className="flex flex-col items-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenHistory(labour);
                            }}
                            className="font-black text-slate-900 font-mono text-xs hover:text-emerald-700 hover:underline cursor-pointer transition-colors"
                            title="Click to view payment history"
                          >
                            ₹{Number(labour.totalPaid || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </button>
                        </div>
                      </td>

                      {/* Balance (Phase 7) */}
                      <td className="px-2.5 py-3.5 text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-black font-mono text-xs ${
                              (labour.balance ?? 0) < 0
                                ? 'text-rose-600'
                                : (labour.balance ?? 0) === 0
                                ? 'text-slate-500'
                                : 'text-slate-900'
                            }`}
                          >
                            {(labour.balance ?? 0) < 0 ? '-' : ''}₹{Math.abs(Number(labour.balance || 0)).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          {(labour.balance ?? 0) < 0 && (
                            <span className="text-[10px] text-rose-500 font-semibold mt-0.5">
                              Overpaid
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions: Pay only. Stop and Edit live on the worker's profile, so they can't be clicked by mistake here */}
                      <td className="px-2.5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPayment(labour);
                          }}
                          className="px-4 py-1.5 rounded-lg text-xs bg-[#FFB82E]/10 text-[#FFC14D] border border-[#FFB82E]/30 hover:bg-[#FFB82E]/20 transition-colors cursor-pointer whitespace-nowrap"
                          title="Record payment"
                        >
                          Pay
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Add / Edit Labour Modal */}
      <LabourFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveLabour(null);
        }}
        onSuccess={handleModalSuccess}
        mode={modalMode}
        kind={modalKind}
        labour={activeLabour}
      />

      {/* 7. Record Payment Modal (Phase 7) */}
      <LabourPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentLabour(null);
        }}
        onSuccess={handlePaymentSuccess}
        labour={paymentLabour}
      />

      {/* 8. Payment History Modal (Phase 7) */}
      <LabourPaymentHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistoryLabour(null);
        }}
        labour={historyLabour}
        onPaymentChange={fetchLabourData}
      />
    </div>
  );
};

export default Labour;
