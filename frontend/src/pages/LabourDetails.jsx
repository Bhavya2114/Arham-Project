import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getLabourById, stopLabour } from '../utils/labourService';
import { getPaymentsByLabourId, deletePayment } from '../utils/labourPaymentService';
import LabourFormModal from '../components/LabourFormModal';
import LabourPaymentModal from '../components/LabourPaymentModal';
import ConfirmationModal from '../components/ConfirmationModal';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { formatDateShortMonth } from '../utils/dateUtils';
import {
  FaHardHat,
  FaArrowLeft,
  FaEdit,
  FaBan,
  FaMoneyBillWave,
  FaHistory,
  FaPhoneAlt,
  FaMapMarkerAlt,
  FaBuilding,
  FaCalendarAlt,
  FaRupeeSign,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTrashAlt,
  FaPlus,
  FaCreditCard,
  FaMobileAlt,
  FaUserCheck,
} from 'react-icons/fa';

const LabourDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const handleConfirmStop = async () => {
    if (!labour?.id) return;
    setIsStopping(true);
    try {
      await stopLabour(labour.id);
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
            <span>CASH</span>
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
            <span>BANK TRANSFER</span>
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
              onClick={() => navigate('/labour')}
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
              onClick={() => navigate('/labour')}
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

  const isStopped = labour.status === 'STOPPED';
  const balanceVal = Number(labour.balance ?? 0);
  const isOverpaid = balanceVal < 0;

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6 animate-fadeIn pb-16">
      {/* SECTION 1 — TOP BREADCRUMB & BACK NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-semibold mb-1 flex items-center space-x-1.5">
            <Link to="/labour" className="hover:text-emerald-600 transition-colors">
              Labour
            </Link>
            <span>&gt;</span>
            <span className="text-emerald-700 font-bold">{labour.name}</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shadow-sm border border-emerald-200">
              <FaHardHat />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{labour.name}</h1>
                {/* Status Badge */}
                {labour.status === 'ACTIVE' ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full font-black text-[11px] inline-flex items-center space-x-1.5 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>ACTIVE</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full font-black text-[11px] inline-flex items-center space-x-1.5 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span>INACTIVE</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1 font-medium">
                <span className="flex items-center space-x-1">
                  <FaPhoneAlt className="text-[10px] text-gray-400" />
                  <span className="font-semibold text-slate-700">{labour.mobile}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <FaMapMarkerAlt className="text-[11px] text-gray-400" />
                  <span>{labour.location}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <FaBuilding className="text-[11px] text-emerald-600" />
                  <span className="font-semibold text-slate-800">
                    {labour.project?.name || 'Unassigned'}
                  </span>
                  {labour.project?.projectCode && (
                    <span className="text-[10px] font-mono text-gray-400 uppercase">
                      ({labour.project.projectCode})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons: Back, Edit, Stop, Pay */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate('/labour')}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all flex items-center space-x-2 bg-white shadow-xs cursor-pointer"
          >
            <FaArrowLeft className="text-xs" />
            <span>Back</span>
          </button>

          {/* Edit Labour Button */}
          <button
            type="button"
            onClick={handleOpenEdit}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-gray-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
            title="Edit worker profile"
          >
            <FaEdit className="text-xs text-emerald-600" />
            <span>Edit</span>
          </button>

          {/* Stop Labour Button */}
          {labour.status === 'ACTIVE' ? (
            <button
              type="button"
              onClick={handleOpenStop}
              className="px-4 py-2 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
              title="Stop active worker"
            >
              <FaBan className="text-xs text-rose-600" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="px-4 py-2 bg-gray-100 border border-gray-200 text-gray-400 font-bold text-xs rounded-xl cursor-not-allowed opacity-60 flex items-center space-x-2"
              title="Worker is not currently active on a project"
            >
              <FaBan className="text-xs" />
              <span>Stop</span>
            </button>
          )}

          {/* Record Payment Button */}
          <button
            type="button"
            onClick={handleOpenRecordPayment}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
            title="Record payment to worker"
          >
            <FaMoneyBillWave className="text-xs" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* SECTION 2 — FINANCIAL SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Earned Days */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              EARNED DAYS
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
              <FaCalendarAlt />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {labour.earnedDays || 0}
              </span>
              <span className="text-xs font-bold text-gray-500">
                {labour.earnedDays === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-medium mt-1">
              Started {formatDateShortMonth(labour.startDate)}
            </p>
          </div>
        </div>

        {/* Card 2: Total Earned */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              TOTAL EARNED
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
              <FaRupeeSign />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{Number(labour.totalEarned || 0).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-[11px] text-gray-400 font-medium mt-1">
              ₹{Number(labour.dailyWage || 0).toLocaleString('en-IN')} / day
            </p>
          </div>
        </div>

        {/* Card 3: Total Paid */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              TOTAL PAID
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
              <FaMoneyBillWave />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700 font-mono">
              ₹{Number(labour.totalPaid || 0).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-[11px] text-gray-400 font-medium mt-1">
              {payments.length} {payments.length === 1 ? 'payment recorded' : 'payments recorded'}
            </p>
          </div>
        </div>

        {/* Card 4: Balance */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              NET BALANCE
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs ${
                isOverpaid
                  ? 'bg-rose-50 text-rose-600'
                  : balanceVal === 0
                  ? 'bg-gray-50 text-gray-500'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              <FaRupeeSign />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-black font-mono ${
                isOverpaid
                  ? 'text-rose-600'
                  : balanceVal === 0
                  ? 'text-slate-500'
                  : 'text-slate-900'
              }`}
            >
              {isOverpaid ? '-' : ''}₹{Math.abs(balanceVal).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1">
              {isOverpaid ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                  Overpaid by ₹{Math.abs(balanceVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              ) : balanceVal === 0 ? (
                <span className="text-[11px] text-slate-500 font-semibold">Settled in full</span>
              ) : (
                <span className="text-[11px] text-amber-700 font-semibold">Pending settlement</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3 — WORK INFORMATION DETAILS CARD */}
      <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <FaHardHat className="text-emerald-600 text-xs" />
            <span>Employment & Work Information</span>
          </h2>
          <span
            className={`px-3 py-0.5 text-xs font-extrabold rounded-lg border ${
              !isStopped
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {labour.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
          {/* Labour Name */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              WORKER NAME
            </span>
            <div className="font-extrabold text-slate-900 text-sm">{labour.name}</div>
          </div>

          {/* Mobile */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              MOBILE NUMBER
            </span>
            <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
              <FaPhoneAlt className="text-gray-400 text-[10px]" />
              <span>{labour.mobile}</span>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              ADDRESS (CITY)
            </span>
            <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
              <FaMapMarkerAlt className="text-gray-400 text-[11px]" />
              <span>{labour.address || labour.location}</span>
            </div>
          </div>

          {/* Assigned Project */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              ASSIGNED PROJECT
            </span>
            <div className="font-extrabold text-slate-900 flex items-center space-x-1.5">
              <FaBuilding className="text-emerald-600 text-xs flex-shrink-0" />
              <span>{labour.project?.name || 'Unassigned / Not Found'}</span>
              {labour.project?.projectCode && (
                <span className="text-[10px] font-mono text-gray-400 uppercase">
                  ({labour.project.projectCode})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs pt-4 border-t border-gray-100">
          {/* Daily Wage */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              DAILY WAGE RATE
            </span>
            <div className="font-black text-slate-900 text-sm font-mono flex items-center">
              <FaRupeeSign className="text-xs text-gray-400 mr-0.5" />
              {Number(labour.dailyWage || 0).toLocaleString('en-IN')}
              <span className="text-[10px] text-gray-400 font-normal ml-1">/ day</span>
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              START DATE
            </span>
            <div className="font-bold text-slate-800 flex items-center space-x-1.5">
              <FaCalendarAlt className="text-emerald-600 text-xs" />
              <span>{formatDateShortMonth(labour.startDate)}</span>
            </div>
          </div>

          {/* Stopped At */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              STOPPED DATE
            </span>
            <div className="font-bold text-slate-800">
              {isStopped && labour.stoppedAt ? (
                <span className="text-rose-600 flex items-center space-x-1.5">
                  <FaBan className="text-xs" />
                  <span>{formatDateShortMonth(labour.stoppedAt)}</span>
                </span>
              ) : (
                <span className="text-gray-400 font-normal">— (Active Worker)</span>
              )}
            </div>
          </div>

          {/* Earned Days */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
              TOTAL EARNED DAYS
            </span>
            <div className="font-black text-slate-900 font-mono text-sm">
              {labour.earnedDays || 0} {labour.earnedDays === 1 ? 'day' : 'days'}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4 — PAYMENT HISTORY SECTION */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
              <FaHistory />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Payment History</h2>
              <p className="text-[11px] text-gray-500 font-medium">
                Record of all monetary disbursements made to this worker
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenRecordPayment}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
          >
            <FaPlus className="text-[10px]" />
            <span>Record Payment</span>
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
                    <th className="px-5 py-3">Payment Date</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-center">Method</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3">Recorded By</th>
                    <th className="px-5 py-3 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {payments.map((payment, index) => (
                    <tr key={payment.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Index */}
                      <td className="px-5 py-3.5 text-center font-mono text-gray-400 font-semibold">
                        {index + 1}
                      </td>

                      {/* Payment Date */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                          <FaCalendarAlt className="text-gray-400 text-[10px]" />
                          <span>{formatDateShortMonth(payment.paymentDate)}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-black text-slate-900 font-mono text-xs">
                          ₹{Number(payment.amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="px-5 py-3.5 text-center">
                        {getMethodBadge(payment.paymentMethod)}
                      </td>

                      {/* Notes */}
                      <td className="px-5 py-3.5">
                        <span className="text-gray-600 font-normal italic">
                          {payment.notes ? payment.notes : <span className="text-gray-300 font-normal">—</span>}
                        </span>
                      </td>

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

                      {/* Actions: Edit, Delete */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPayment(payment)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Edit Payment"
                          >
                            <FaEdit className="text-xs" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeletePayment(payment)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Payment"
                          >
                            <FaTrashAlt className="text-xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-gray-100">
              {payments.map((payment, index) => (
                <div key={payment.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono font-bold text-gray-400">
                        #{index + 1}
                      </span>
                      <span className="font-bold text-xs text-slate-800">
                        {formatDateShortMonth(payment.paymentDate)}
                      </span>
                    </div>
                    <span className="font-black text-slate-900 font-mono text-sm">
                      ₹{Number(payment.amount || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
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

      {/* MODAL 2: Stop Labour Confirmation */}
      <ConfirmationModal
        isOpen={isStopModalOpen}
        onClose={() => setIsStopModalOpen(false)}
        onConfirm={handleConfirmStop}
        title="Stop Labour"
        confirmText="Stop Labour"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isStopping}
        message={
          <div className="space-y-3">
            <p className="text-gray-800 text-sm font-medium">
              Are you sure you want to stop <span className="font-bold text-gray-900">{labour?.name}</span>?
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
              This action cannot be undone. Total Paid and Balance will automatically be recalculated.
            </p>
          </div>
        }
      />
    </div>
  );
};

export default LabourDetails;
