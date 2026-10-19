import React, { useState, useEffect } from 'react';
import {
  getPaymentsByLabourId,
  deletePayment,
} from '../utils/labourPaymentService';
import LabourPaymentModal from './LabourPaymentModal';
import ConfirmationModal from './ConfirmationModal';
import { formatDateShortMonth } from '../utils/dateUtils';
import { getErrorMessage } from '../utils/apiError';
import { useToast } from '../context/ToastContext';
import {
  FaTimes,
  FaRupeeSign,
  FaHistory,
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaExclamationTriangle,
} from 'react-icons/fa';

const LabourPaymentHistoryModal = ({
  isOpen,
  onClose,
  labour,
  onPaymentChange, // callback to refresh parent Labour page when payments are added, edited, or deleted
}) => {
  const toast = useToast();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sub-modal states
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPayments = async () => {
    if (!labour?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPaymentsByLabourId(labour.id);
      setPayments(data);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError(getErrorMessage(err, 'Failed to load payments for this worker.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && labour) {
      fetchPayments();
    }
  }, [isOpen, labour]);

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isAddEditOpen && !isDeleteOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAddEditOpen, isDeleteOpen, onClose]);

  if (!isOpen || !labour) return null;

  const handleOpenAdd = () => {
    setPaymentToEdit(null);
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (payment) => {
    setPaymentToEdit(payment);
    setIsAddEditOpen(true);
  };

  const handleOpenDelete = (payment) => {
    setPaymentToDelete(payment);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!paymentToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deletePayment(paymentToDelete.id);
      toast.success('Payment deleted successfully');
      setIsDeleteOpen(false);
      setPaymentToDelete(null);
      fetchPayments();
      onPaymentChange?.();
    } catch (err) {
      console.error('Error deleting payment:', err);
      toast.error(getErrorMessage(err, 'Failed to delete payment'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddEditSuccess = (message) => {
    toast.success(message);
    fetchPayments();
    onPaymentChange?.();
  };

  // Derive dynamic total paid from current fetched payments
  // Deleted payments stay in the list for history but don't count towards totals
  const totalPaidCurrent = payments
    .filter((p) => !p.isDeleted)
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalEarnedCurrent = Number(labour.totalEarned || 0);
  const balanceCurrent = totalEarnedCurrent - totalPaidCurrent;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 relative max-h-[85vh] flex flex-col">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close modal"
          >
            <FaTimes className="text-base" />
          </button>

          {/* Modal Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shadow-sm">
                <FaHistory />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Payment History
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {labour.name} &bull; {labour.mobile}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-sm transition-all self-start sm:self-auto cursor-pointer"
            >
              <FaPlus className="text-[10px]" />
              <span>Record Payment</span>
            </button>
          </div>

          {/* Financial Position Ribbon */}
          <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase">
                Total Earned
              </span>
              <span className="block text-xs font-black text-slate-900 font-mono mt-0.5">
                ₹{totalEarnedCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase">
                Total Paid
              </span>
              <span className="block text-xs font-black text-emerald-700 font-mono mt-0.5">
                ₹{totalPaidCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase">
                Balance
              </span>
              <span
                className={`block text-xs font-black font-mono mt-0.5 ${
                  balanceCurrent < 0 ? 'text-rose-600' : balanceCurrent === 0 ? 'text-slate-500' : 'text-indigo-700'
                }`}
              >
                {balanceCurrent < 0 ? '-' : ''}₹{Math.abs(balanceCurrent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Table Container (Scrollable) */}
          <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                <p className="text-xs text-gray-500 font-semibold">Loading payment history...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center space-y-2 text-xs text-red-600">
                <FaExclamationTriangle className="text-xl mx-auto text-red-500" />
                <p className="font-semibold">{error}</p>
                <button
                  onClick={fetchPayments}
                  className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-bold text-xs"
                >
                  Retry
                </button>
              </div>
            ) : payments.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center mx-auto text-gray-400 text-lg">
                  <FaMoneyBillWave />
                </div>
                <h4 className="text-xs font-bold text-slate-800">No payments recorded yet</h4>
                <p className="text-[11px] text-gray-500 max-w-xs mx-auto">
                  Click "Record Payment" to record cash, UPI, or bank transfer payments made to {labour.name}.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-slate-50/80 border-b border-gray-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-8">#</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5 text-center">Method</th>
                    <th className="px-3 py-2.5">Notes</th>
                    <th className="px-3 py-2.5">Recorded By</th>
                    <th className="px-3 py-2.5 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {payments.map((p, idx) => (
                    <tr key={p.id} className={`transition-colors ${p.isDeleted ? 'opacity-50' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-3 py-2.5 text-center font-mono text-gray-400 font-semibold">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 font-semibold">
                        {formatDateShortMonth(p.paymentDate, '-')}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-black font-mono text-slate-900 whitespace-nowrap ${p.isDeleted ? 'line-through' : ''}`}>
                        ₹{Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 max-w-[140px] truncate" title={p.notes || ''}>
                        {p.notes || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 max-w-[100px] truncate" title={p.createdBy?.email || ''}>
                        {p.createdBy?.name || 'Admin'}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {p.isDeleted ? (
                          <span
                            className="inline-flex px-2 py-0.5 rounded-full text-[10px] bg-rose-50 text-rose-600"
                            title={`Deleted${p.deletedAt ? ` on ${formatDateShortMonth(p.deletedAt)}` : ''}${p.deletedBy?.name ? ` by ${p.deletedBy.name}` : ''}`}
                          >
                            Deleted
                          </span>
                        ) : (
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Edit payment"
                          >
                            <FaEdit className="text-[11px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(p)}
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete payment"
                          >
                            <FaTrashAlt className="text-[11px]" />
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Record / Edit Payment Modal */}
      <LabourPaymentModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setPaymentToEdit(null);
        }}
        onSuccess={handleAddEditSuccess}
        labour={labour}
        payment={paymentToEdit}
      />

      {/* Delete Payment Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setPaymentToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Payment Record"
        confirmText="Delete Payment"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeleting}
        message={
          <div className="space-y-2 text-xs">
            <p className="text-gray-800 font-medium">
              Are you sure you want to delete this payment of{' '}
              <strong className="text-slate-900 font-bold font-mono">
                ₹{Number(paymentToDelete?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>{' '}
              recorded on {paymentToDelete?.paymentDate ? formatDateShortMonth(paymentToDelete.paymentDate, '-') : 'this date'}?
            </p>
            <p className="text-gray-500">
              Deleting this record will recompute the total paid amount and balance for {labour.name}.
            </p>
          </div>
        }
      />
    </>
  );
};

export default LabourPaymentHistoryModal;
