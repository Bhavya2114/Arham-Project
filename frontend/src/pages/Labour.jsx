import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getLabours, stopLabour } from '../utils/labourService';
import LabourFormModal from '../components/LabourFormModal';
import LabourPaymentModal from '../components/LabourPaymentModal';
import LabourPaymentHistoryModal from '../components/LabourPaymentHistoryModal';
import ConfirmationModal from '../components/ConfirmationModal';
import axiosInstance from '../utils/api';
import { getErrorMessage } from '../utils/apiError';
import { formatDateShortMonth } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import {
  FaHardHat,
  FaUsers,
  FaUserClock,
  FaSearch,
  FaFilter,
  FaUndo,
  FaPlus,
  FaEye,
  FaEdit,
  FaBan,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaCalendarAlt,
  FaRupeeSign,
  FaBuilding,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaMoneyBillWave,
  FaHistory,
  FaTimes,
} from 'react-icons/fa';

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
  const [activeLabour, setActiveLabour] = useState(null);

  // Modal States for Stop Labour (Phase 5)
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [labourToStop, setLabourToStop] = useState(null);
  const [isStopping, setIsStopping] = useState(false);

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
      if (statusFilter) params.status = statusFilter;
      if (locationFilter) params.location = locationFilter;

      const data = await getLabours(params);

      // Guard: Discard stale response if a newer request was dispatched
      if (currentRequestId === requestIdRef.current) {
        setLabours(data);

        // Track and accumulate known locations for dropdown
        setAvailableLocations((prev) => {
          const set = new Set(prev);
          data.forEach((l) => {
            if (l.location && l.location.trim()) {
              set.add(l.location.trim());
            }
          });
          return Array.from(set).sort((a, b) =>
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
  }, [debouncedSearch, projectFilter, statusFilter, locationFilter]);

  useEffect(() => {
    fetchLabourData();
  }, [fetchLabourData]);

  // Combined location filter fallback (case-insensitive and trimmed)
  const displayedLabours = useMemo(() => {
    if (!locationFilter) return labours;
    return labours.filter(
      (l) => l.location && l.location.trim().toLowerCase() === locationFilter.trim().toLowerCase()
    );
  }, [labours, locationFilter]);

  // Derive Summary Metrics for currently filtered / displayed dataset
  const summaryMetrics = useMemo(() => {
    const total = displayedLabours.length;
    const active = displayedLabours.filter((l) => l.status === 'ACTIVE').length;
    const inactive = displayedLabours.filter((l) => l.status !== 'ACTIVE').length;

    // Projected Monthly Wages for Active Labours ONLY: sum(activeDailyWage * 30 days)
    const activeDailyTotal = displayedLabours
      .filter((l) => l.status === 'ACTIVE')
      .reduce((acc, l) => acc + (Number(l.dailyWage) || 0), 0);
    const projectedMonthly = activeDailyTotal * 30;

    return { total, active, inactive, projectedMonthly };
  }, [displayedLabours]);

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

  // Stop Labour Handlers (Phase 5)
  const handleOpenStopConfirm = (labour) => {
    if (!labour || labour.status === 'STOPPED') return;
    setLabourToStop(labour);
    setIsStopModalOpen(true);
  };

  const handleCloseStopConfirm = () => {
    if (isStopping) return;
    setIsStopModalOpen(false);
    setLabourToStop(null);
  };

  const handleConfirmStop = async () => {
    if (!labourToStop?.id) return;
    setIsStopping(true);
    try {
      await stopLabour(labourToStop.id);
      toast.success('Labour stopped successfully');
      setIsStopModalOpen(false);
      setLabourToStop(null);
      fetchLabourData();
    } catch (err) {
      console.error('Error stopping labour:', err);
      toast.error(getErrorMessage(err, 'Failed to stop labour'));
    } finally {
      setIsStopping(false);
    }
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
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shadow-sm">
              <FaHardHat />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Labour</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Manage labour workers, track their wages and project assignment
              </p>
            </div>
          </div>
        </div>

        {/* Add Labour Button */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-xs self-start sm:self-auto cursor-pointer"
          title="Add Labour"
        >
          <FaPlus className="text-xs" />
          <span>Add Labour</span>
        </button>
      </div>

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: TOTAL LABOUR */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
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
        </div>

        {/* Card 2: ACTIVE LABOUR */}
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
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
        </div>

        {/* Card 3: INACTIVE LABOUR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
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
        </div>

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
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* Search Box */}
          <div className="relative sm:col-span-2">
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
          <div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full py-2.5 px-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 text-slate-800 font-semibold transition-all cursor-pointer"
            >
              <option value="">All Projects</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} ({proj.projectCode})
                </option>
              ))}
            </select>
          </div>

          {/* Address Filter */}
          <div>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full py-2.5 px-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 text-slate-800 font-semibold transition-all cursor-pointer"
            >
              <option value="">All Addresses</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2.5 px-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 text-slate-800 font-semibold transition-all cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active / Working</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Toolbar Bottom: Counter + Active Filter Badges + Reset Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-gray-100 text-xs gap-2">
          <div className="flex items-center space-x-2 text-gray-500 font-medium">
            <FaFilter className="text-gray-400 text-[11px]" />
            <span>
              Showing <strong className="text-slate-800 font-bold">{displayedLabours.length}</strong>{' '}
              {displayedLabours.length === 1 ? 'Worker' : 'Workers'}
            </span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {activeFilterCount} {activeFilterCount === 1 ? 'filter applied' : 'filters applied'}
              </span>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 font-bold transition-all text-xs cursor-pointer self-start sm:self-auto"
            >
              <FaUndo className="text-[10px]" />
              <span>Reset Filters</span>
            </button>
          )}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[1100px]">
              <thead className="bg-slate-50/80 border-b border-gray-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 text-center w-12">#</th>
                  <th className="px-5 py-3.5">Labour Name</th>
                  <th className="px-5 py-3.5">Mobile</th>
                  <th className="px-5 py-3.5">Address</th>
                  <th className="px-5 py-3.5">Project</th>
                  <th className="px-5 py-3.5 text-right">Daily Wage</th>
                  <th className="px-5 py-3.5">Start Date</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Total Earned</th>
                  <th className="px-5 py-3.5 text-right">Total Paid</th>
                  <th className="px-5 py-3.5 text-right">Balance</th>
                  <th className="px-5 py-3.5 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {displayedLabours.map((labour, index) => {
                  const isStopped = labour.status === 'STOPPED';

                  return (
                    <tr
                      key={labour.id}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* # Index */}
                      <td className="px-5 py-4 text-center font-mono text-xs text-gray-400 font-semibold">
                        {index + 1}
                      </td>

                      {/* Labour Name */}
                      <td className="px-5 py-4">
                        <Link
                          to={`/labour/${labour.id}`}
                          className="font-extrabold text-slate-900 block tracking-tight hover:text-emerald-700 hover:underline transition-colors"
                        >
                          {labour.name}
                        </Link>
                      </td>

                      {/* Mobile */}
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-semibold">
                          <FaPhoneAlt className="text-gray-400 text-[10px]" />
                          <span>{labour.mobile}</span>
                        </div>
                      </td>

                      {/* Address */}
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
                          <FaMapMarkerAlt className="text-gray-400 text-[11px]" />
                          <span>{labour.address || labour.location}</span>
                        </div>
                      </td>

                      {/* Project */}
                      <td className="px-5 py-4">
                        {labour.project ? (
                          <div className="flex items-center space-x-1.5 text-xs">
                            <FaBuilding className="text-emerald-600 text-[11px] flex-shrink-0" />
                            <div>
                              <span className="font-bold text-slate-800 block">
                                {labour.project.name}
                              </span>
                              {labour.project.projectCode && (
                                <span className="text-[10px] font-mono text-gray-400 uppercase">
                                  {labour.project.projectCode}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Daily Wage */}
                      <td className="px-5 py-4 text-right">
                        <span className="font-black text-slate-900 font-mono text-xs">
                          ₹{Number(labour.dailyWage || 0).toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Start Date */}
                      <td className="px-5 py-4 text-xs text-slate-600 font-medium">
                        <div className="flex items-center space-x-1.5">
                          <FaCalendarAlt className="text-gray-400 text-[10px]" />
                          <span>{labour.startDate ? formatDateShortMonth(labour.startDate, '-') : '-'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        {labour.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
                            INACTIVE
                          </span>
                        )}
                      </td>

                      {/* Total Earned (Calculated in Phase 6) */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-slate-900 font-mono text-xs">
                            ₹{Number(labour.totalEarned || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[10px] text-gray-500 font-semibold mt-0.5">
                            {labour.earnedDays || 0} {labour.earnedDays === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                      </td>

                      {/* Total Paid (Phase 7) */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(labour)}
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
                      <td className="px-5 py-4 text-right">
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

                      {/* Actions: Pay, History, View, Edit, Stop */}
                      <td className="px-5 py-4 text-center">
                        <div className="inline-flex items-center space-x-1">
                          {/* Pay Button (Phase 7) */}
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(labour)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Record Payment"
                          >
                            <FaMoneyBillWave className="text-xs" />
                          </button>

                          {/* Payment History Button (Phase 7) */}
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(labour)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Payment History"
                          >
                            <FaHistory className="text-xs" />
                          </button>

                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => navigate(`/labour/${labour.id}`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="View labour details"
                          >
                            <FaEye className="text-xs" />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(labour)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Edit labour details"
                          >
                            <FaEdit className="text-xs" />
                          </button>

                          {/* Stop Button */}
                          {labour.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenStopConfirm(labour)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Stop active labour"
                            >
                              <FaBan className="text-xs" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="p-1.5 rounded-lg text-gray-200 cursor-not-allowed opacity-30"
                              title="Worker is not currently active on a project"
                            >
                              <FaBan className="text-xs" />
                            </button>
                          )}
                        </div>
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
        labour={activeLabour}
      />

      {/* 6. Stop Labour Confirmation Modal */}
      <ConfirmationModal
        isOpen={isStopModalOpen}
        onClose={handleCloseStopConfirm}
        onConfirm={handleConfirmStop}
        title="Stop Labour"
        confirmText="Stop Labour"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isStopping}
        message={
          <div className="space-y-3">
            <p className="text-gray-800 text-sm font-medium">
              Are you sure you want to stop <span className="font-bold text-gray-900">{labourToStop?.name}</span>?
            </p>
            <p className="text-xs text-gray-500 font-normal">
              Once stopped, this labour will no longer be considered active.
            </p>
            <div className="bg-white p-2.5 rounded-lg border border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Stop Date:</span>
              <span className="font-bold text-gray-800">
                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        }
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
