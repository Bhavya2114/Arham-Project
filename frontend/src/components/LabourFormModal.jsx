import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createLabour, updateLabour } from '../utils/labourService';
import { getErrorMessage } from '../utils/apiError';
import { FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { LuUser, LuMapPin, LuInfo } from 'react-icons/lu';
import { RoleIconBox } from './RoleIcons';

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
  // 'CONTRACTOR' asks only name, mobile and address (paid per project, no daily wage).
  // When editing, the record's own type decides.
  kind = 'LABOUR',
}) => {
  const isEdit = mode === 'edit';
  const isContractor = (isEdit ? labour?.type : kind) === 'CONTRACTOR';
  const noun = isContractor ? 'contractor' : 'labour';

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
      errors.name = isContractor ? 'Contractor name is required' : 'Labour name is required';
    }

    if (!formData.address || !formData.address.trim()) {
      errors.address = 'City is required';
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
    if (isContractor) {
      // no daily wage for a contractor
    } else if (
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
        };
        if (!isContractor) payload.dailyWage = Number(formData.dailyWage);
        await updateLabour(labourId, payload);
        onSuccess?.(isContractor ? 'Contractor updated successfully' : 'Labour worker updated successfully');
      } else {
        const payload = {
          name: formData.name.trim(),
          address: trimmedAddress,
          mobile: formData.mobile.trim(),
        };
        if (isContractor) payload.type = 'CONTRACTOR';
        else payload.dailyWage = Number(formData.dailyWage);
        await createLabour(payload);
        onSuccess?.(isContractor ? 'Contractor added successfully' : 'Labour created successfully');
      }

      onClose();
    } catch (err) {
      console.error(`Error ${isEdit ? 'updating' : 'creating'} labour:`, err);
      let msg = getErrorMessage(
        err,
        `Failed to ${isEdit ? 'update' : 'add'} ${noun}. Please check input.`
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

  // One input box: optional prefix segment (icon or "+91" / "₹"), the input, optional suffix ("/ day")
  const boxCls = (hasError) =>
    `flex items-center w-full border rounded-xl bg-gray-50/50 focus-within:bg-white transition-all ${
      hasError ? 'border-red-500' : 'border-gray-200 focus-within:border-emerald-500'
    }`;
  const inputCls =
    'flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-slate-800 font-medium placeholder-gray-400 focus:outline-none';
  const noSpinnerCls =
    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';
  const errorText = (msg) => msg && <p className="text-red-500 text-[11px] mt-1 font-medium">{msg}</p>;
  const setField = (key, value) => {
    setFormData({ ...formData, [key]: value });
    if (fieldErrors[key]) setFieldErrors({ ...fieldErrors, [key]: null });
  };

  const title = isContractor
    ? isEdit ? 'Edit contractor' : 'Add contractor'
    : isEdit ? 'Edit labour' : 'Add labour';
  const submitLabel = isEdit ? 'Save changes' : isContractor ? 'Add contractor' : 'Add labour';

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
        {/* Header: icon + title only */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <RoleIconBox kind={isContractor ? 'CONTRACTOR' : 'LABOUR'} />
            <h3 id="labour-modal-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h3>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center space-x-2.5 animate-fadeIn">
              <FaExclamationTriangle className="text-red-500 text-sm flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="labour-name" className={labelCls}>
              Name <span className="text-red-500">*</span>
            </label>
            <div className={boxCls(fieldErrors.name)}>
              <LuUser className="ml-3.5 text-gray-400 text-base shrink-0" />
              <input
                id="labour-name"
                type="text"
                placeholder="e.g. Rajesh Kumar"
                value={formData.name}
                onChange={(e) => setField('name', e.target.value)}
                className={inputCls}
              />
            </div>
            {errorText(fieldErrors.name)}
          </div>

          {/* Mobile + City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="labour-mobile" className={labelCls}>
                Mobile <span className="text-red-500">*</span>
              </label>
              <div className={boxCls(fieldErrors.mobile)}>
                <span className="pl-3.5 pr-3 text-sm font-medium text-slate-700 border-r border-gray-200 self-stretch flex items-center">
                  +91
                </span>
                <input
                  id="labour-mobile"
                  type="tel"
                  placeholder="98765 43210"
                  value={formData.mobile}
                  onChange={(e) => setField('mobile', e.target.value)}
                  className={inputCls}
                />
              </div>
              {errorText(fieldErrors.mobile)}
            </div>

            <div>
              <label htmlFor="labour-city" className={labelCls}>
                City <span className="text-red-500">*</span>
              </label>
              <div className={boxCls(fieldErrors.address)}>
                <LuMapPin className="ml-3.5 text-gray-400 text-base shrink-0" />
                <input
                  id="labour-city"
                  type="text"
                  placeholder="e.g. Kota"
                  value={formData.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className={inputCls}
                />
              </div>
              {errorText(fieldErrors.address)}
            </div>
          </div>

          {/* Labour: daily wage. Contractor: a note that his pay is set per project */}
          {isContractor ? (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[rgba(183,148,246,0.35)] bg-[rgba(183,148,246,0.08)] text-xs text-gray-600">
              <LuInfo className="text-[#B794F6] text-sm shrink-0" />
              <span>Area and rate are added when you assign him to a project.</span>
            </div>
          ) : (
            <div className="sm:w-1/2 sm:pr-1.5">
              <label htmlFor="labour-wage" className={labelCls}>
                Daily wage <span className="text-red-500">*</span>
              </label>
              <div className={boxCls(fieldErrors.dailyWage)}>
                <span className="pl-3.5 pr-3 text-sm font-medium text-slate-700 border-r border-gray-200 self-stretch flex items-center">
                  ₹
                </span>
                <input
                  id="labour-wage"
                  type="number"
                  min="1"
                  step="any"
                  placeholder="800"
                  value={formData.dailyWage}
                  onChange={(e) => setField('dailyWage', e.target.value)}
                  className={`${inputCls} font-mono ${noSpinnerCls}`}
                />
                <span className="pr-3.5 text-sm text-gray-400 whitespace-nowrap">/ day</span>
              </div>
              {errorText(fieldErrors.dailyWage)}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#FFB82E] hover:bg-[#FFC14D] active:scale-95 disabled:opacity-50 text-[#1A1B1E] font-semibold transition-all text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              {submitting && <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#1A1B1E]"></div>}
              <span>{submitting ? 'Saving...' : submitLabel}</span>
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
