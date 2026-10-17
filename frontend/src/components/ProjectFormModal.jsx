import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { formatIndianNumber } from '../utils/numberToWords';
import { toApiDateFormat } from '../utils/dateUtils';
import IndianDateInput from './IndianDateInput';
import {
  FaTimes,
  FaLock,
  FaInfoCircle,
  FaSpinner,
} from 'react-icons/fa';

/**
 * ProjectFormModal component
 *
 * Renders a centered modal popup for creating a new Construction Project.
 * Matches the reference design with exactly 7 fields:
 * - Row 1: Project Code (read-only), Project Name *
 * - Row 2: Site Location Address *, Target Budget (₹)
 * - Row 3: Start Date *, Expected End Date, Status
 *
 * Customer and Notes fields are completely removed from the UI.
 */
const ProjectFormModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();

  const generateProjectCode = () => {
    return `PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  };

  const getInitialState = () => ({
    projectCode: generateProjectCode(),
    name: '',
    siteAddress: '',
    targetBudget: '',
    startDate: toApiDateFormat(new Date()),
    expectedEndDate: '',
    status: 'PLANNING',
  });

  const [formData, setFormData] = useState(getInitialState);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Reset form with a fresh project code every time modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialState());
      setFormError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBudgetChange = (e) => {
    const rawVal = e.target.value.replace(/,/g, '');
    if (rawVal !== '' && !/^\d*\.?\d*$/.test(rawVal)) {
      return;
    }
    const formatted = formatIndianNumber(rawVal);
    setFormData((prev) => ({ ...prev, targetBudget: formatted }));
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.name.trim()) {
      setFormError('Project Name is required.');
      return;
    }
    if (!formData.siteAddress.trim()) {
      setFormError('Site Location Address is required.');
      return;
    }
    if (!formData.startDate) {
      setFormError('Start Date is required.');
      return;
    }
    if (formData.expectedEndDate && new Date(formData.expectedEndDate) < new Date(formData.startDate)) {
      setFormError('Expected End Date cannot be before Start Date.');
      return;
    }

    const rawBudget = formData.targetBudget ? String(formData.targetBudget).replace(/,/g, '').trim() : '';
    if (rawBudget !== '' && (isNaN(Number(rawBudget)) || Number(rawBudget) < 0)) {
      setFormError('Target Budget cannot be negative.');
      return;
    }

    setSubmitting(true);

    const payload = {
      projectCode: formData.projectCode.trim(),
      name: formData.name.trim(),
      siteAddress: formData.siteAddress.trim(),
      startDate: toApiDateFormat(formData.startDate),
      expectedEndDate: formData.expectedEndDate ? toApiDateFormat(formData.expectedEndDate) : undefined,
      status: formData.status,
      budget: rawBudget !== '' ? Number(rawBudget) : undefined,
    };

    try {
      const res = await axiosInstance.post('/projects', payload);
      toast.success(`Project "${formData.name.trim()}" created successfully!`);
      if (onSuccess) {
        onSuccess(res.data?.data);
      }
      onClose();
    } catch (err) {
      console.error('Error creating project:', err);
      const msg = getErrorMessage(err, 'Failed to create project. Please verify inputs.');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="bg-white rounded-[24px] shadow-2xl w-full max-w-[620px] overflow-hidden transition-all transform scale-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-2">
          <h2 id="modal-title" className="text-xl font-bold text-slate-900 tracking-tight">
            New Project
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="w-8 h-8 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors focus:outline-none cursor-pointer"
            aria-label="Close modal"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="px-7 py-4 space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {formError}
            </div>
          )}

          {/* Row 1: Project Code & Project Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Project Code (Read-Only) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <span>Project Code</span>
                <FaInfoCircle className="text-slate-400 text-[11px]" title="Automatically generated unique project code" />
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 select-none">
                <FaLock className="text-emerald-600 text-xs flex-shrink-0" />
                <span className="font-mono tracking-wide">{formData.projectCode}</span>
              </div>
            </div>

            {/* Project Name * */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. XYZ Building Construction"
                required
                className="w-full px-3.5 py-2.5 border border-emerald-600 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Row 2: Site Location Address & Target Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Site Location Address * */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Site Location Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="siteAddress"
                value={formData.siteAddress}
                onChange={handleChange}
                placeholder="e.g. Plot 45, Kothrud, Pune"
                required
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition-colors"
              />
            </div>

            {/* Target Budget (₹) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Target Budget (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-xs sm:text-sm">
                  ₹
                </span>
                <input
                  type="text"
                  name="targetBudget"
                  value={formData.targetBudget}
                  onChange={handleBudgetChange}
                  placeholder="50,00,000"
                  className="w-full pl-8 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Start Date *, Expected End Date, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Start Date * */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <IndianDateInput
                id="modal-start-date"
                name="startDate"
                value={formData.startDate}
                onChange={(iso) => setFormData((prev) => ({ ...prev, startDate: iso }))}
                placeholder="DD/MM/YYYY"
                className="py-2.5"
              />
            </div>

            {/* Expected End Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Expected End Date
              </label>
              <IndianDateInput
                id="modal-expected-end-date"
                name="expectedEndDate"
                value={formData.expectedEndDate}
                onChange={(iso) => setFormData((prev) => ({ ...prev, expectedEndDate: iso }))}
                min={formData.startDate || undefined}
                placeholder="DD/MM/YYYY"
                className="py-2.5"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-emerald-600 bg-white cursor-pointer transition-colors"
              >
                <option value="PLANNING">Planning</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Divider & Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting && <FaSpinner className="animate-spin text-xs" />}
              <span>Save Project</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ProjectFormModal;
