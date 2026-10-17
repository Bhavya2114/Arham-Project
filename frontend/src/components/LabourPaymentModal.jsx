import React, { useState, useEffect } from 'react';
import IndianDateInput from './IndianDateInput';
import { createPayment, updatePayment } from '../utils/labourPaymentService';
import { getErrorMessage } from '../utils/apiError';
import { toApiDateFormat } from '../utils/dateUtils';
import {
  FaRupeeSign,
  FaTimes,
  FaMoneyBillWave,
  FaCreditCard,
  FaMobileAlt,
  FaCalendarAlt,
  FaFileAlt,
  FaExclamationTriangle,
  FaCheck,
} from 'react-icons/fa';

const LabourPaymentModal = ({
  isOpen,
  onClose,
  onSuccess,
  labour,
  payment = null, // null for create mode, or existing payment object for edit mode
}) => {
  const isEdit = Boolean(payment);

  const [formData, setFormData] = useState({
    amount: '',
    paymentDate: '',
    paymentMethod: 'CASH',
    notes: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync state whenever modal opens or labour/payment changes
  useEffect(() => {
    if (!isOpen) return;

    setFieldErrors({});
    setFormError(null);
    setSubmitting(false);

    if (isEdit && payment) {
      setFormData({
        amount: String(payment.amount || ''),
        paymentDate: payment.paymentDate ? toApiDateFormat(payment.paymentDate) : '',
        paymentMethod: payment.paymentMethod || 'CASH',
        notes: payment.notes || '',
      });
    } else {
      setFormData({
        amount: '',
        paymentDate: toApiDateFormat(new Date()),
        paymentMethod: 'CASH',
        notes: '',
      });
    }
  }, [isOpen, isEdit, payment]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !labour) return null;

  const validate = () => {
    const errors = {};

    const amountNum = Number(formData.amount);
    if (!formData.amount || isNaN(amountNum) || amountNum <= 0) {
      errors.amount = 'Payment amount must be greater than 0';
    }

    if (!formData.paymentDate || !formData.paymentDate.trim()) {
      errors.paymentDate = 'Payment date is required';
    }

    if (!['CASH', 'UPI', 'BANK_TRANSFER'].includes(formData.paymentMethod)) {
      errors.paymentMethod = 'Please select a valid payment method';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isEdit && payment) {
        await updatePayment(payment.id, {
          amount: Number(formData.amount),
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes?.trim() || undefined,
        });
        onSuccess?.('Payment updated successfully');
      } else {
        await createPayment({
          labourId: labour.id,
          amount: Number(formData.amount),
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes?.trim() || undefined,
        });
        onSuccess?.('Payment recorded successfully');
      }
      onClose();
    } catch (err) {
      console.error('Error saving payment:', err);
      setFormError(getErrorMessage(err, 'Failed to save payment. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const balance = Number(labour.balance || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label="Close modal"
        >
          <FaTimes className="text-base" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shadow-sm">
            <FaRupeeSign />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {isEdit ? 'Edit Labour Payment' : 'Record Labour Payment'}
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              Record money paid to worker and update account balance
            </p>
          </div>
        </div>

        {/* Worker Financial Position Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 font-semibold">Labour Worker:</span>
            <span className="font-extrabold text-slate-900">{labour.name}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="block text-[10px] font-bold text-gray-400 uppercase">
                Total Earned
              </span>
              <span className="block text-xs font-black text-slate-800 font-mono mt-0.5">
                ₹{Number(labour.totalEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="block text-[10px] font-bold text-gray-400 uppercase">
                Total Paid
              </span>
              <span className="block text-xs font-black text-emerald-700 font-mono mt-0.5">
                ₹{Number(labour.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="block text-[10px] font-bold text-gray-400 uppercase">
                Balance
              </span>
              <span
                className={`block text-xs font-black font-mono mt-0.5 ${
                  balance < 0 ? 'text-rose-600' : balance === 0 ? 'text-slate-500' : 'text-indigo-700'
                }`}
              >
                {balance < 0 ? '-' : ''}₹{Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700">
            <FaExclamationTriangle className="text-sm mt-0.5 flex-shrink-0" />
            <span className="font-semibold">{formError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          {/* Payment Amount */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Payment Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400 font-mono font-bold text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 3000"
                value={formData.amount}
                onChange={(e) => {
                  setFormData({ ...formData, amount: e.target.value });
                  if (fieldErrors.amount) setFieldErrors({ ...fieldErrors, amount: null });
                }}
                disabled={submitting}
                className={`w-full pl-8 pr-3 py-2.5 border rounded-xl font-mono font-bold text-slate-800 transition-all focus:outline-none ${
                  fieldErrors.amount
                    ? 'border-red-500 bg-red-50/30 focus:border-red-500'
                    : 'border-gray-200 bg-gray-50/50 focus:bg-white focus:border-emerald-500'
                }`}
              />
            </div>
            {fieldErrors.amount && (
              <p className="text-[11px] text-red-600 font-semibold mt-1">{fieldErrors.amount}</p>
            )}
          </div>

          {/* Payment Date & Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Payment Date */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <IndianDateInput
                value={formData.paymentDate}
                onChange={(val) => {
                  setFormData({ ...formData, paymentDate: val });
                  if (fieldErrors.paymentDate) setFieldErrors({ ...fieldErrors, paymentDate: null });
                }}
                disabled={submitting}
                hasError={Boolean(fieldErrors.paymentDate)}
              />
              {fieldErrors.paymentDate && (
                <p className="text-[11px] text-red-600 font-semibold mt-1">{fieldErrors.paymentDate}</p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => {
                  setFormData({ ...formData, paymentMethod: e.target.value });
                  if (fieldErrors.paymentMethod) setFieldErrors({ ...fieldErrors, paymentMethod: null });
                }}
                disabled={submitting}
                className="w-full py-2.5 px-3 border border-gray-200 rounded-xl text-xs font-semibold text-slate-800 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500 transition-all"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
              {fieldErrors.paymentMethod && (
                <p className="text-[11px] text-red-600 font-semibold mt-1">{fieldErrors.paymentMethod}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Notes <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Weekly settlement, transaction reference, cheque number..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={submitting}
              className="w-full py-2 px-3 border border-gray-200 rounded-xl text-xs font-medium text-slate-800 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500 transition-all placeholder-gray-400 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FaCheck className="text-xs" />
                  <span>{isEdit ? 'Save Changes' : 'Record Payment'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LabourPaymentModal;
