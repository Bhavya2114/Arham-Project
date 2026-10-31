import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getLabourById, stopLabour, updateStopDate } from '../utils/labourService';
import { getPaymentsByLabourId, deletePayment } from '../utils/labourPaymentService';
import LabourFormModal from '../components/LabourFormModal';
import LabourPaymentModal from '../components/LabourPaymentModal';
import ConfirmationModal from '../components/ConfirmationModal';
import StopDateModal from '../components/StopDateModal';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { formatDateShortMonth, formatDateRange, toApiDateFormat } from '../utils/dateUtils';
import {
  FaArrowLeft,
  FaEdit,
  FaBan,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaTrashAlt,
  FaPlus,
  FaCreditCard,
  FaMobileAlt,
  FaPen,
} from 'react-icons/fa';

// Rectangular outlined badges: tinted fill, coloured border and text
const BADGE = {
  green: 'bg-[#22C55E]/10 text-[#4ADE80] border-[#22C55E]/40',
  grey: 'bg-[#908C84]/10 text-[#B8B4AC] border-[#908C84]/40',
  blue: 'bg-[#60A5FA]/10 text-[#93C5FD] border-[#60A5FA]/40',
  amber: 'bg-[#FFB82E]/10 text-[#FFC14D] border-[#FFB82E]/40',
  purple: 'bg-[#A78BFA]/10 text-[#C4B5FD] border-[#A78BFA]/40',
  red: 'bg-[#F87171]/10 text-[#FCA5A5] border-[#F87171]/40',
};

const PROJECT_STATUS = {
  PLANNING: { label: 'Planning', cls: BADGE.blue },
  IN_PROGRESS: { label: 'Ongoing', cls: BADGE.green },
  ON_HOLD: { label: 'On hold', cls: BADGE.amber },
  COMPLETED: { label: 'Completed', cls: BADGE.purple },
  CANCELLED: { label: 'Cancelled', cls: BADGE.red },
};

const formatRupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const LabourDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Opened from a project? Back returns there (to its Labour tab), otherwise to the Labour list
  const backTo = location.state?.backTo || '/labour';
  const backLabel = location.state?.backLabel || 'Back to labour';
  const goBack = () => navigate(backTo, { state: location.state?.backState });
  const toast = useToast();

  const [labour, setLabour] = useState(null);
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Edit Labour Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Stop Labour Confirmation Modal State
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Change stop date of a finished project (a projectHistory row)
  const [stopDateRow, setStopDateRow] = useState(null);
  const [isSavingStopDate, setIsSavingStopDate] = useState(false);

  // Payment Add / Edit Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState(null);

  // Payment Delete Modal State
  const [isDeletePaymentOpen, setIsDeletePaymentOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  // Fetch Projects for Edit Labour dropdown
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

  // Fetch Labour Details and Payment History
  const fetchLabourData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const [labourData, paymentData] = await Promise.all([
        getLabourById(id),
        getPaymentsByLabourId(id),
      ]);

      if (!labourData) {
        setNotFound(true);
      } else {
        setLabour(labourData);
        // Ensure payments are sorted descending by paymentDate
        const sortedPayments = Array.isArray(paymentData)
          ? [...paymentData].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
          : [];
        setPayments(sortedPayments);
      }
    } catch (err) {
      console.error('Error loading labour details:', err);
      if (err?.response?.status === 404 || err?.statusCode === 404) {
        setNotFound(true);
      } else {
        setError(getErrorMessage(err, 'Failed to load labour information from server.'));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLabourData();
  }, [fetchLabourData]);

  // Action: Open Edit Labour
  const handleOpenEdit = () => {
    setIsEditModalOpen(true);
  };

  // Action: Open Stop Labour
  const handleOpenStop = () => {
    if (!labour || labour.status === 'STOPPED') return;
    setIsStopModalOpen(true);
  };

  // Action: Confirm Stop Labour
  const handleConfirmStop = async (stopDate) => {
    if (!labour?.id) return;
    setIsStopping(true);
    try {
      await stopLabour(labour.id, stopDate);
      toast.success('Labour stopped successfully');
      setIsStopModalOpen(false);
      fetchLabourData();
    } catch (err) {
      console.error('Error stopping labour:', err);
      toast.error(getErrorMessage(err, 'Failed to stop labour'));
    } finally {
      setIsStopping(false);
    }
  };

  // Action: Save a changed stop date
  const handleSaveStopDate = async (stopDate) => {
    if (!labour?.id || !stopDateRow?.assignmentId) return;
    setIsSavingStopDate(true);
    try {
      await updateStopDate(labour.id, stopDateRow.assignmentId, stopDate);
      toast.success('Stop date updated');
      setStopDateRow(null);
      fetchLabourData();
    } catch (err) {
      console.error('Error updating stop date:', err);
      toast.error(getErrorMessage(err, 'Failed to update stop date'));
    } finally {
      setIsSavingStopDate(false);
    }
  };

  // Action: Record New Payment
  const handleOpenRecordPayment = () => {
    setPaymentToEdit(null);
    setIsPaymentModalOpen(true);
  };

  // Action: Edit Existing Payment
  const handleOpenEditPayment = (payment) => {
    setPaymentToEdit(payment);
    setIsPaymentModalOpen(true);
  };

  // Action: Confirm Delete Payment
  const handleOpenDeletePayment = (payment) => {
    setPaymentToDelete(payment);
    setIsDeletePaymentOpen(true);
  };

  const handleConfirmDeletePayment = async () => {
    if (!paymentToDelete?.id) return;
    setIsDeletingPayment(true);
    try {
      await deletePayment(paymentToDelete.id);
      toast.success('Payment deleted successfully');
      setIsDeletePaymentOpen(false);
      setPaymentToDelete(null);
      fetchLabourData();
    } catch (err) {
      console.error('Error deleting payment:', err);
      toast.error(getErrorMessage(err, 'Failed to delete payment'));
    } finally {
      setIsDeletingPayment(false);
    }
  };

  // Helper for Payment Method Badge
  const getMethodBadge = (method) => {
    switch (method) {
      case 'CASH':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <FaMoneyBillWave className="text-[10px]" />
            <span>Cash</span>
          </span>
        );
      case 'UPI':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <FaMobileAlt className="text-[10px]" />
            <span>UPI</span>
          </span>
        );
      case 'BANK_TRANSFER':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <FaCreditCard className="text-[10px]" />
            <span>Bank transfer</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">
            {method || 'N/A'}
          </span>
        );
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        <p className="text-sm text-gray-500 font-semibold tracking-wide">Loading worker details...</p>
      </div>
    );
  }

  // 2. Not Found State
  if (notFound) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-rose-100">
            <FaExclamationTriangle />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Labour Not Found</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            The requested labour record could not be found or may have been deleted.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={goBack}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center space-x-2"
            >
              <FaArrowLeft className="text-xs" />
              <span>Back to Labour Directory</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Error State
  if (error || !labour) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="bg-white border border-rose-200 rounded-3xl p-8 shadow-sm space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-rose-100">
            <FaExclamationTriangle />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Failed to Load Labour</h2>
          <p className="text-xs text-rose-600 max-w-sm mx-auto font-medium leading-relaxed">
            {error || 'An unexpected error occurred while loading worker information.'}
          </p>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all"
            >
              Back to Labour
            </button>
            <button
              type="button"
              onClick={fetchLabourData}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isActive = labour.status === 'ACTIVE';
  const balanceVal = Number(labour.balance ?? 0);
  const isOverpaid = balanceVal < 0;
  // Newest project first. If the server sends no history (older records or an old backend),
  // still show the project the worker is on right now.
  const projectHistory = (() => {
    const rows = Array.isArray(labour.projectHistory) ? [...labour.projectHistory] : [];
    const currentId = labour.project?.id || labour.projectId;
    if (isActive && currentId && !rows.some((h) => h.projectId === currentId && h.isActive)) {
      rows.push({
        projectId: currentId,
        name: labour.project?.name,
        projectCode: labour.project?.projectCode,
        projectStatus: labour.project?.status,
        startDate: labour.assignmentStartDate || labour.startDate,
        stoppedAt: null,
        isActive: true,
        earnedDays: rows.length ? null : labour.earnedDays,
        earned: rows.length ? null : labour.totalEarned,
      });
    }
    return rows.sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
  })();
  // Stop popup: the date can be moved back to the day the worker started on this project,
  // and not past today or the project end date
  const activeRow = projectHistory.find((h) => h.isActive);
  const todayIso = toApiDateFormat(new Date());
  const projectEndIso = toApiDateFormat(labour.project?.expectedEndDate);
  const stopRange = activeRow?.stopDateRange || {
    min: toApiDateFormat(activeRow?.startDate || labour.assignmentStartDate || labour.startDate) || null,
    max: projectEndIso && projectEndIso < todayIso ? projectEndIso : todayIso,
  };
  // Finished projects whose stop date can be changed (needs the updated backend)
  const canEditStopDate = (h) => !h.isActive && h.assignmentId && h.stopDateRange;
  const latestRow = projectHistory[0];
  const startDateLabel = formatDateShortMonth(labour.assignmentStartDate || labour.startDate, 'Not set');
  const stoppedDateLabel = labour.stoppedAt
    ? formatDateShortMonth(labour.stoppedAt)
    : isActive
    ? 'Still working'
    : 'Not recorded';
  const rupees = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // Deleted payments are still listed (marked as deleted) but don't count
  const activePaymentCount = payments.filter((p) => !p.isDeleted).length;
  const deletedLabel = (p) =>
    `Deleted${p.deletedAt ? ` ${formatDateShortMonth(p.deletedAt)}` : ''}${p.deletedBy?.name ? ` by ${p.deletedBy.name}` : ''}`;

  const statCards = [
    {
      label: 'Earned days',
      value: `${labour.earnedDays || 0} ${labour.earnedDays === 1 ? 'day' : 'days'}`,
      note: labour.stoppedAt ? `till ${formatDateShortMonth(labour.stoppedAt)}` : isActive ? 'till today' : null,
      valueClass: 'text-slate-900',
    },
    {
      label: 'Total earned',
      value: rupees(labour.totalEarned),
      note: `₹${Number(labour.dailyWage || 0).toLocaleString('en-IN')} / day`,
      valueClass: 'text-slate-900',
    },
    {
      label: 'Total paid',
      value: rupees(labour.totalPaid),
      note: `${activePaymentCount} ${activePaymentCount === 1 ? 'payment' : 'payments'}`,
      valueClass: 'text-emerald-700',
    },
    {
      label: 'Balance',
      value: `${isOverpaid ? '-' : ''}${rupees(Math.abs(balanceVal))}`,
      note: isOverpaid ? 'Overpaid' : balanceVal === 0 ? 'Settled' : 'To pay',
      valueClass: isOverpaid ? 'text-rose-600' : balanceVal === 0 ? 'text-slate-500' : 'text-[#FFC14D]',
      noteClass: isOverpaid ? 'text-rose-500' : balanceVal === 0 ? 'text-gray-400' : 'text-[#FFC14D]/80',
    },
  ];

  const hasNotes = payments.some((p) => p.notes && String(p.notes).trim());

  const workDetails = [
    {
      label: 'Project',
      value: labour.project?.name || 'Unassigned',
      sub: labour.project?.projectCode,
      muted: !labour.project?.name,
    },
    { label: 'Daily wage', value: `₹${Number(labour.dailyWage || 0).toLocaleString('en-IN')} / day` },
    { label: 'Start date', value: startDateLabel, muted: startDateLabel === 'Not set' },
    {
      label: 'Stopped date',
      value: stoppedDateLabel,
      muted: !labour.stoppedAt,
      onEdit: !isActive && latestRow && canEditStopDate(latestRow) ? () => setStopDateRow(latestRow) : null,
    },
  ];

  return (
    <div className="space-y-5 animate-fadeIn pb-16">
      {/* Back link */}
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <FaArrowLeft className="text-xs" />
        {backLabel}
      </button>

      {/* Header: avatar + name, actions on the right */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="w-12 h-12 rounded-full bg-[#FFB82E]/15 text-[#FFC14D] grid place-items-center text-lg font-semibold shrink-0">
            {(labour.name || '?').charAt(0).toUpperCase()}
          </span>
          <h1 className="text-2xl font-semibold text-slate-900 truncate">{labour.name}</h1>
          <span
            className={`px-2.5 py-1 rounded-md border text-[11px] font-medium inline-flex items-center gap-1.5 shrink-0 ${
              isActive ? BADGE.green : BADGE.grey
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenEdit}
            className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-slate-700 text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <FaEdit className="text-xs" />
            Edit
          </button>
          {isActive && (
            <button
              type="button"
              onClick={handleOpenStop}
              className="px-4 py-2 border border-rose-500/30 hover:bg-rose-500/10 text-rose-500 text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <FaBan className="text-xs" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white px-4 py-3.5 rounded-2xl border border-gray-200">
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className={`text-2xl font-semibold font-mono mt-1 ${c.valueClass}`}>{c.value}</p>
            {c.note && <p className={`text-xs mt-0.5 ${c.noteClass || 'text-gray-400'}`}>{c.note}</p>}
          </div>
        ))}
      </div>

      {/* Work details */}
      <div className="bg-white px-5 py-4 border border-gray-200 rounded-2xl">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Work details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5">
          {workDetails.map((d) => (
            <div key={d.label}>
              <p className="text-xs text-gray-400">{d.label}</p>
              <p className={`text-sm mt-1 flex items-center gap-2 ${d.muted ? 'text-gray-400' : 'text-slate-900 font-medium'}`}>
                {d.value}
                {d.onEdit && (
                  <button
                    type="button"
                    onClick={d.onEdit}
                    title="Change stop date"
                    className="text-gray-400 hover:text-[#FFC14D] transition-colors cursor-pointer"
                  >
                    <FaPen className="text-[10px]" />
                  </button>
                )}
              </p>
              {d.sub && <p className="text-xs text-gray-400 mt-0.5">{d.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Project history: every project this worker has been on */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Project history</h2>
          {projectHistory.length > 0 && (
            <span className="text-xs text-gray-400">
              {projectHistory.length} {projectHistory.length === 1 ? 'project' : 'projects'}
            </span>
          )}
        </div>
        {projectHistory.length === 0 ? (
          <p className="px-5 py-6 text-xs text-gray-400">Not assigned to any project yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-gray-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Project status</th>
                <th className="px-5 py-3">Worked</th>
                <th className="px-5 py-3 text-right">Days</th>
                <th className="px-5 py-3 text-right">Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projectHistory.map((h, idx) => {
                const st = PROJECT_STATUS[h.projectStatus];
                return (
                  <tr key={`${h.projectId}-${idx}`} className="hover:bg-[#FFB82E]/[0.05] transition-colors duration-150">
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => h.projectId && navigate(`/projects/${h.projectId}`)}
                        className="text-left cursor-pointer hover:text-[#FFC14D]"
                      >
                        <span className="font-medium text-slate-900">{h.name || 'Deleted project'}</span>
                        {h.projectCode && <span className="block text-[11px] text-gray-400 mt-0.5">{h.projectCode}</span>}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      {st ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${st.cls}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {st.label}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800">
                      {formatDateRange(h.startDate, h.stoppedAt, 'today')}
                      {canEditStopDate(h) && (
                        <button
                          type="button"
                          onClick={() => setStopDateRow(h)}
                          title="Change stop date"
                          className="ml-2 align-middle text-gray-400 hover:text-[#FFC14D] transition-colors cursor-pointer"
                        >
                          <FaPen className="text-[10px]" />
                        </button>
                      )}
                      {h.isActive && (
                        <span className={`ml-2 inline-block px-2 py-0.5 rounded-md border text-[10px] ${BADGE.amber}`}>Current</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-800">{h.earnedDays ?? '-'}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-900">{h.earned == null ? '-' : formatRupees(h.earned)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Payments */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Payments</h2>
          <button
            type="button"
            onClick={handleOpenRecordPayment}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all duration-150 hover:scale-110 flex items-center space-x-1.5 cursor-pointer"
          >
            <FaPlus className="text-[10px]" />
            <span>Record payment</span>
          </button>
        </div>

        {/* Payment History Content */}
        {payments.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center text-xl mx-auto border border-gray-200">
              <FaMoneyBillWave />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">No payments recorded yet</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                No disbursements have been recorded for this worker. Click the button below to record the first payment.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenRecordPayment}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center space-x-2 cursor-pointer"
            >
              <FaPlus className="text-xs" />
              <span>Record First Payment</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-gray-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-center w-12">#</th>
                    <th className="px-5 py-3 w-40">Payment date</th>
                    <th className="px-5 py-3 w-40">Amount</th>
                    <th className="px-5 py-3">Method</th>
                    {hasNotes && <th className="px-5 py-3">Notes</th>}
                    <th className="px-5 py-3">Recorded By</th>
                    <th className="px-5 py-3 text-center w-56">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {payments.map((payment, index) => (
                    <tr
                      key={payment.id}
                      className={`transition-colors duration-150 ${payment.isDeleted ? 'opacity-50' : 'hover:bg-[#FFB82E]/[0.05]'}`}
                    >
                      {/* Index */}
                      <td className="px-5 py-3.5 text-center font-mono text-gray-400 font-semibold">
                        {index + 1}
                      </td>

                      {/* Payment Date */}
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-800">{formatDateShortMonth(payment.paymentDate)}</span>
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5">
                        <span className={`font-black text-slate-900 font-mono text-xs ${payment.isDeleted ? 'line-through' : ''}`}>
                          ₹{Number(payment.amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="px-5 py-3.5">
                        {getMethodBadge(payment.paymentMethod)}
                      </td>

                      {/* Notes (column hidden when no payment has a note) */}
                      {hasNotes && (
                        <td className="px-5 py-3.5">
                          <span className="text-gray-600 font-normal italic">
                            {payment.notes ? payment.notes : <span className="text-gray-300 font-normal">—</span>}
                          </span>
                        </td>
                      )}

                      {/* Recorded By */}
                      <td className="px-5 py-3.5">
                        <div className="text-slate-700 font-semibold">
                          {payment.createdBy?.name || 'System Admin'}
                        </div>
                        {payment.createdBy?.role && (
                          <div className="text-[10px] text-gray-400 font-mono uppercase">
                            {payment.createdBy.role}
                          </div>
                        )}
                      </td>

                      {/* Actions: Edit, Delete (delete asks for confirmation) */}
                      <td className="px-5 py-3.5 text-center">
                        {payment.isDeleted ? (
                          <div className="leading-tight">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] bg-rose-50 text-rose-500">Deleted</span>
                            {(payment.deletedAt || payment.deletedBy?.name) && (
                              <p className="text-[11px] text-gray-400 mt-1">
                                {[payment.deletedAt && formatDateShortMonth(payment.deletedAt), payment.deletedBy?.name && `by ${payment.deletedBy.name}`]
                                  .filter(Boolean)
                                  .join(' ')}
                              </p>
                            )}
                          </div>
                        ) : (
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPayment(payment)}
                            className="w-16 py-1.5 rounded-lg text-xs text-slate-700 border border-gray-200 hover:bg-gray-100 transition-all duration-150 hover:scale-105 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeletePayment(payment)}
                            className="w-16 py-1.5 rounded-lg text-xs text-rose-500 border border-rose-500/30 hover:bg-rose-500/10 transition-all duration-150 hover:scale-105 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-gray-100">
              {payments.map((payment, index) => (
                <div key={payment.id} className={`p-4 space-y-2.5 ${payment.isDeleted ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono font-bold text-gray-400">
                        #{index + 1}
                      </span>
                      <span className="font-bold text-xs text-slate-800">
                        {formatDateShortMonth(payment.paymentDate)}
                      </span>
                    </div>
                    <span className={`font-black text-slate-900 font-mono text-sm ${payment.isDeleted ? 'line-through' : ''}`}>
                      ₹{Number(payment.amount || 0).toLocaleString('en-IN', {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>{getMethodBadge(payment.paymentMethod)}</div>
                    <div className="text-[11px] text-gray-400">
                      By {payment.createdBy?.name || 'Admin'}
                    </div>
                  </div>

                  {payment.notes && (
                    <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg border border-gray-100">
                      {payment.notes}
                    </p>
                  )}

                  {payment.isDeleted ? (
                    <p className="text-xs text-rose-500 text-right">{deletedLabel(payment)}</p>
                  ) : (
                  <div className="flex items-center justify-end space-x-2 pt-1 border-t border-gray-50">
                    <button
                      type="button"
                      onClick={() => handleOpenEditPayment(payment)}
                      className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-emerald-600 border border-gray-200 rounded-lg flex items-center space-x-1"
                    >
                      <FaEdit className="text-[10px]" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeletePayment(payment)}
                      className="px-3 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg flex items-center space-x-1"
                    >
                      <FaTrashAlt className="text-[10px]" />
                      <span>Delete</span>
                    </button>
                  </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL 1: Edit Labour Modal */}
      <LabourFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(msg) => {
          toast.success(msg);
          fetchLabourData();
        }}
        mode="edit"
        labour={labour}
      />

      {/* MODAL 2: Stop Labour, with a stop date that can be changed */}
      <StopDateModal
        isOpen={isStopModalOpen}
        onClose={() => setIsStopModalOpen(false)}
        onConfirm={handleConfirmStop}
        isLoading={isStopping}
        mode="stop"
        name={labour?.name}
        startDate={activeRow?.startDate || labour.assignmentStartDate || labour.startDate}
        minDate={stopRange.min}
        maxDate={stopRange.max}
        initialDate={stopRange.max}
        dailyWage={labour.dailyWage}
        currentEarned={activeRow?.earned ?? 0}
        balance={activeRow?.earned != null ? labour.balance : null}
      />

      {/* MODAL 2b: Change the stop date of a finished project */}
      <StopDateModal
        isOpen={Boolean(stopDateRow)}
        onClose={() => setStopDateRow(null)}
        onConfirm={handleSaveStopDate}
        isLoading={isSavingStopDate}
        mode="edit"
        name={labour?.name}
        projectName={stopDateRow?.name}
        startDate={stopDateRow?.startDate}
        minDate={stopDateRow?.stopDateRange?.min}
        maxDate={stopDateRow?.stopDateRange?.max}
        initialDate={toApiDateFormat(stopDateRow?.stoppedAt)}
        dailyWage={labour.dailyWage}
        currentEarned={stopDateRow?.earned ?? 0}
        balance={labour.balance}
      />

      {/* MODAL 3: Labour Payment Modal (Add or Edit) */}
      <LabourPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentToEdit(null);
        }}
        onSuccess={(msg) => {
          toast.success(msg);
          fetchLabourData();
        }}
        labour={labour}
        payment={paymentToEdit}
      />

      {/* MODAL 4: Delete Payment Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeletePaymentOpen}
        onClose={() => {
          setIsDeletePaymentOpen(false);
          setPaymentToDelete(null);
        }}
        onConfirm={handleConfirmDeletePayment}
        title="Delete Payment Record"
        confirmText="Delete Payment"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeletingPayment}
        message={
          <div className="space-y-2">
            <p className="text-gray-800 text-sm font-medium">
              Are you sure you want to delete this payment of{' '}
              <span className="font-bold text-rose-700">
                ₹{Number(paymentToDelete?.amount || 0).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              ?
            </p>
            <p className="text-xs text-gray-500 font-normal">
              It will stay in the payment history marked as deleted, and will no longer count towards Total Paid and Balance.
            </p>
          </div>
        }
      />
    </div>
  );
};

export default LabourDetails;
