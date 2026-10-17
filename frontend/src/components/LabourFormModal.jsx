import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createLabour, updateLabour } from '../utils/labourService';
import { getErrorMessage } from '../utils/apiError';
import {
  FaHardHat,
  FaTimes,
  FaUser,
  FaPhoneAlt,
  FaMapMarkerAlt,
  FaBuilding,
  FaRupeeSign,
  FaExclamationTriangle,
  FaCheck,
} from 'react-icons/fa';

/**
 * LabourFormModal component
 *
 * Supports adding Labour to a Project (from Project Details) and Editing Labour.
 * User-entered fields are strictly limited to four inputs:
 * 1. Labour Name *
 * 2. Address * (city name only, e.g. Pune, Kota)
 * 3. Mobile Number *
 * 4. Daily Wage (₹) *
 *
 * Project context is derived automatically and Start Date is generated on backend.
 * Modal is portaled directly to document.body to ensure the backdrop covers
 * the entire viewport with zero top/header white strips.
 */
const LabourFormModal = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'create', // 'create' | 'edit'
  labour = null,
  defaultProjectId = '',
  projectName = '',
}) => {
  const isEdit = mode === 'edit';

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    mobile: '',
    dailyWage: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Synchronize form values whenever modal opens or mode/labour changes
  useEffect(() => {
    if (!isOpen) return;

    setFieldErrors({});
    setFormError(null);
    setSubmitting(false);

    if (isEdit && labour) {
      setFormData({
        name: labour.name || '',
        address: labour.address || labour.location || '',
        mobile: labour.mobile || '',
        dailyWage:
          labour.dailyWage !== undefined && labour.dailyWage !== null
            ? String(labour.dailyWage)
            : '',
      });
    } else {
      // Create mode starts with clean 4 fields
      setFormData({
        name: '',
        address: '',
        mobile: '',
        dailyWage: '',
      });
    }
  }, [isOpen, isEdit, labour]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const validate = () => {
    const errors = {};

    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Labour name is required';
    }

    if (!formData.address || !formData.address.trim()) {
      errors.address = 'Address is required';
    }

    if (!formData.mobile || !formData.mobile.trim()) {
      errors.mobile = 'Mobile number is required';
    } else {
      const cleanMobile = formData.mobile.trim().replace(/\D/g, '');
      if (cleanMobile.length < 10) {
        errors.mobile = 'Enter a valid 10-digit mobile number';
      }
    }

    const wageNum = Number(formData.dailyWage);
    if (
      formData.dailyWage === '' ||
      formData.dailyWage === undefined ||
      formData.dailyWage === null
    ) {
      errors.dailyWage = 'Daily wage is required';
    } else if (isNaN(wageNum) || wageNum <= 0) {
      errors.dailyWage = 'Daily wage must be greater than 0';
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
      const trimmedAddress = formData.address.trim();

      if (isEdit) {
        const labourId = labour.id || labour._id;
        const payload = {
          name: formData.name.trim(),
          address: trimmedAddress,
          mobile: formData.mobile.trim(),
          dailyWage: Number(formData.dailyWage),
        };
        await updateLabour(labourId, payload);
        onSuccess?.('Labour worker updated successfully');
      } else {
        const payload = {
          name: formData.name.trim(),
          address: trimmedAddress,
          mobile: formData.mobile.trim(),
          dailyWage: Number(formData.dailyWage),
        };
        await createLabour(payload);
        onSuccess?.('Labour created successfully');
      }

      onClose();
    } catch (err) {
      console.error(`Error ${isEdit ? 'updating' : 'creating'} labour:`, err);
      let msg = getErrorMessage(
        err,
        `Failed to ${isEdit ? 'update' : 'add'} labour. Please check input.`
      );
      if (err.response?.data?.errors && typeof err.response.data.errors === 'object') {
        const errObj = err.response.data.errors;
        const firstField = Object.keys(errObj)[0];
        if (firstField && Array.isArray(errObj[firstField]) && errObj[firstField][0]) {
          msg = `${errObj[firstField][0]}`;
        }
      }
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      style={{ margin: 0, padding: '1rem' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-scaleUp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="labour-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-base shadow-sm">
              <FaHardHat />
            </div>
            <div>
              <h3
                id="labour-modal-title"
                className="text-base font-black text-slate-900 tracking-tight"
              >
                {isEdit ? 'Edit Labour' : 'Add Labour'}
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                {isEdit
                  ? 'Update worker profile and wage'
                  : 'Add a new labour worker to the master directory'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
            aria-label="Close modal"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Form-level Error Banner */}
          {formError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold flex items-center space-x-2.5 animate-fadeIn">
              <FaExclamationTriangle className="text-red-500 text-sm flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Labour Name */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Labour Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FaUser className="absolute left-3.5 top-3 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="e.g. Rajesh Kumar"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: null });
                }}
                className={`w-full pl-9 pr-3 py-2.5 border rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none transition-all text-slate-800 font-medium placeholder-gray-400 ${
                  fieldErrors.name
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-200 focus:border-emerald-500'
                }`}
              />
            </div>
            {fieldErrors.name && (
              <p className="text-red-500 text-[11px] mt-1 font-medium">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* 2. Address (City only) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-gray-700">
                Address <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400 font-normal">
                (City name, e.g. Pune, Kota)
              </span>
            </div>
            <div className="relative">
              <FaMapMarkerAlt className="absolute left-3.5 top-3 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="e.g. Pune"
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  if (fieldErrors.address)
                    setFieldErrors({ ...fieldErrors, address: null });
                }}
                className={`w-full pl-9 pr-3 py-2.5 border rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none transition-all text-slate-800 font-medium placeholder-gray-400 ${
                  fieldErrors.address
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-200 focus:border-emerald-500'
                }`}
              />
            </div>
            {fieldErrors.address && (
              <p className="text-red-500 text-[11px] mt-1 font-medium">
                {fieldErrors.address}
              </p>
            )}
          </div>

          {/* 3 & 4. Mobile Number and Daily Wage (Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Mobile Number */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FaPhoneAlt className="absolute left-3.5 top-3 text-gray-400 text-xs" />
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formData.mobile}
                  onChange={(e) => {
                    setFormData({ ...formData, mobile: e.target.value });
                    if (fieldErrors.mobile)
                      setFieldErrors({ ...fieldErrors, mobile: null });
                  }}
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none transition-all text-slate-800 font-medium placeholder-gray-400 ${
                    fieldErrors.mobile
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-200 focus:border-emerald-500'
                  }`}
                />
              </div>
              {fieldErrors.mobile && (
                <p className="text-red-500 text-[11px] mt-1 font-medium">
                  {fieldErrors.mobile}
                </p>
              )}
            </div>

            {/* Daily Wage */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Daily Wage (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FaRupeeSign className="absolute left-3.5 top-3 text-gray-400 text-xs" />
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 800"
                  value={formData.dailyWage}
                  onChange={(e) => {
                    setFormData({ ...formData, dailyWage: e.target.value });
                    if (fieldErrors.dailyWage)
                      setFieldErrors({ ...fieldErrors, dailyWage: null });
                  }}
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none transition-all text-slate-800 font-mono font-bold placeholder-gray-400 ${
                    fieldErrors.dailyWage
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-200 focus:border-emerald-500'
                  }`}
                />
              </div>
              {fieldErrors.dailyWage && (
                <p className="text-red-500 text-[11px] mt-1 font-medium">
                  {fieldErrors.dailyWage}
                </p>
              )}
            </div>
          </div>

          {/* Modal Footer / Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white font-bold transition-all text-xs inline-flex items-center space-x-2 shadow-sm cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  <span>{isEdit ? 'Saving Changes...' : 'Adding Labour...'}</span>
                </>
              ) : (
                <>
                  <FaCheck className="text-xs" />
                  <span>{isEdit ? 'Save Changes' : 'Add Labour'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default LabourFormModal;
