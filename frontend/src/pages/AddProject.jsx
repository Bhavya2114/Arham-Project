import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { formatIndianNumber, numberToIndianWords } from '../utils/numberToWords';
import { toApiDateFormat } from '../utils/dateUtils';
import IndianDateInput from '../components/IndianDateInput';
import {
  FaSpinner,
  FaExclamationTriangle,
  FaLock,
} from 'react-icons/fa';

const AddProject = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // If id exists and is not 'new', Edit mode
  const toast = useToast();
  const isEditMode = Boolean(id) && id !== 'new';

  const [loadingPrereqs, setLoadingPrereqs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [formData, setFormData] = useState({
    projectCode: '',
    name: '',
    siteAddress: '',
    startDate: toApiDateFormat(new Date()),
    expectedEndDate: '',
    status: 'PLANNING',
    budget: '',
    notes: '',
  });

  // Fetch project details if edit mode
  useEffect(() => {
    const loadInitialData = async () => {
      setLoadingPrereqs(true);
      try {

        if (isEditMode) {
          const projRes = await axiosInstance.get(`/projects/${id}`);
          const p = projRes.data.data;
          if (p) {
            setFormData({
              projectCode: p.projectCode || '',
              name: p.name || '',
              siteAddress: p.siteAddress || '',
              startDate: p.startDate ? toApiDateFormat(p.startDate) : '',
              expectedEndDate: p.expectedEndDate ? toApiDateFormat(p.expectedEndDate) : '',
              status: p.status || 'PLANNING',
              budget: p.budget !== undefined && p.budget !== null ? formatIndianNumber(p.budget) : '',
              notes: p.notes || '',
            });
          }
        } else {
          // Generate auto code suggestion if new
          const defaultCode = `PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
          setFormData((prev) => ({ ...prev, projectCode: defaultCode }));
        }
      } catch (err) {
        console.error('Error loading form metadata:', err);
        toast.error(getErrorMessage(err, 'Failed to load form prerequisites.'));
      } finally {
        setLoadingPrereqs(false);
      }
    };

    loadInitialData();
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBudgetChange = (e) => {
    const inputEl = e.target;
    const rawVal = inputEl.value.replace(/,/g, '');

    // Allow empty or valid partial numeric values (digits and max 1 decimal point)
    if (rawVal !== '' && !/^\d*\.?\d*$/.test(rawVal)) {
      return;
    }

    const cursorPosition = inputEl.selectionStart || 0;
    const nonCommasBeforeCursor = inputEl.value.slice(0, cursorPosition).replace(/,/g, '').length;

    const formatted = formatIndianNumber(rawVal);

    setFormData((prev) => ({ ...prev, budget: formatted }));

    requestAnimationFrame(() => {
      if (inputEl) {
        let newCursor = 0;
        let count = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (formatted[i] !== ',') {
            count++;
          }
          if (count === nonCommasBeforeCursor) {
            newCursor = i + 1;
            break;
          }
        }
        if (nonCommasBeforeCursor === 0) {
          newCursor = 0;
        }
        inputEl.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validations
    if (!formData.projectCode.trim()) {
      setFormError('Project Code is required.');
      return;
    }
    if (!formData.name.trim()) {
      setFormError('Project Name is required.');
      return;
    }
    if (!formData.siteAddress.trim()) {
      setFormError('Site Address is required.');
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

    const rawBudget = formData.budget ? String(formData.budget).replace(/,/g, '').trim() : '';

    if (rawBudget !== '' && (isNaN(Number(rawBudget)) || Number(rawBudget) < 0)) {
      setFormError('Budget cannot be negative.');
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
      notes: formData.notes.trim() ? formData.notes.trim() : undefined,
    };

    try {
      if (isEditMode) {
        await axiosInstance.put(`/projects/${id}`, payload);
        toast.success(`Project "${formData.name}" updated successfully!`);
      } else {
        await axiosInstance.post('/projects', payload);
        toast.success(`Project "${formData.name}" created successfully!`);
      }
      navigate('/projects');
    } catch (err) {
      console.error('Project save error:', err);
      const errMsg = getErrorMessage(err, `Failed to ${isEditMode ? 'update' : 'create'} project.`);
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPrereqs) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007a4d]"></div>
        <p className="text-xs text-slate-400 font-medium">Loading form prerequisites...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4">
      {/* Page Header - Clean, modern ERP style without any back button */}
      <div className="mb-3.5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {isEditMode ? 'Edit Construction Project' : 'Create New Construction Project'}
        </h1>
      </div>

      {/* Main Form Card Container */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Error Alert */}
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2.5">
            <FaExclamationTriangle className="text-red-500 text-sm shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate={false}>
          {/* Section 1 — Project */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                1
              </div>
              <h2 className="text-base font-bold text-slate-900">Project</h2>
            </div>

            {/* 2-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5">
              {/* Project Code */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label htmlFor="projectCode" className="block text-xs font-semibold text-slate-700">
                    Project Code
                  </label>
                  <span className="text-slate-400 inline-flex items-center" title="Automatically generated identifier">
                    <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-[#007a4d] pointer-events-none flex items-center">
                    <FaLock className="text-xs" />
                  </div>
                  <input
                    type="text"
                    id="projectCode"
                    name="projectCode"
                    value={formData.projectCode}
                    onChange={handleChange}
                    readOnly
                    className="w-full pl-9 pr-3.5 py-2 bg-[#f4f6f8] border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 cursor-default select-all focus:outline-none"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Automatically generated</p>
              </div>

              {/* Project Name */}
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. XYZ Building Construction"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>

              {/* Site Location Address */}
              <div>
                <label htmlFor="siteAddress" className="block text-xs font-semibold text-slate-700 mb-1">
                  Site Location Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="siteAddress"
                  name="siteAddress"
                  value={formData.siteAddress}
                  onChange={handleChange}
                  placeholder="e.g. Plot 45, Kothrud, Pune, Maharashtra"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2 — Schedule & Budget */}
          <div className="mt-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                2
              </div>
              <h2 className="text-base font-bold text-slate-900">Schedule & Budget</h2>
            </div>

            {/* Row 1: 4 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Start Date */}
              <div>
                <label htmlFor="startDate" className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <IndianDateInput
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={(val) => setFormData((prev) => ({ ...prev, startDate: val }))}
                  placeholder="DD/MM/YYYY"
                  className="!py-2 !px-3.5 !pr-9 !text-sm !font-normal !rounded-lg !border-slate-200 !bg-white text-slate-900 focus:!border-emerald-500 focus:!ring-1 focus:!ring-emerald-500"
                />
              </div>

              {/* Expected End Date */}
              <div>
                <label htmlFor="expectedEndDate" className="block text-xs font-semibold text-slate-700 mb-1">
                  Expected End Date
                </label>
                <IndianDateInput
                  id="expectedEndDate"
                  name="expectedEndDate"
                  value={formData.expectedEndDate}
                  onChange={(val) => setFormData((prev) => ({ ...prev, expectedEndDate: val }))}
                  placeholder="DD/MM/YYYY"
                  className="!py-2 !px-3.5 !pr-9 !text-sm !font-normal !rounded-lg !border-slate-200 !bg-white text-slate-900 focus:!border-emerald-500 focus:!ring-1 focus:!ring-emerald-500"
                />
              </div>

              {/* Project Status */}
              <div>
                <label htmlFor="status" className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Status
                </label>
                <div className="relative">
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 appearance-none pr-9 transition-colors font-normal"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Target Budget (₹) */}
              <div>
                <label htmlFor="budget" className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Budget (₹)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400 text-sm font-normal pointer-events-none">
                    ₹
                  </span>
                  <input
                    type="text"
                    id="budget"
                    inputMode="decimal"
                    name="budget"
                    value={formData.budget}
                    onChange={handleBudgetChange}
                    placeholder="50,00,000"
                    className="w-full pl-8 pr-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
                {numberToIndianWords(formData.budget) && (
                  <p className="text-[11px] text-emerald-700 font-medium mt-0.5 truncate" title={numberToIndianWords(formData.budget)}>
                    {numberToIndianWords(formData.budget)}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Notes Full Width */}
            <div className="mt-3.5">
              <label htmlFor="notes" className="block text-xs font-semibold text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Optional"
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-y min-h-[60px]"
              />
            </div>
          </div>

          {/* Action Buttons at Bottom Right */}
          <div className="flex items-center justify-end gap-5 mt-4 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={() => navigate('/projects')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors focus:outline-none disabled:opacity-50 px-2 py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-[#007a4d] hover:bg-[#006841] active:bg-[#005a38] text-white font-semibold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-w-[130px]"
            >
              {submitting ? (
                <>
                  <FaSpinner className="animate-spin text-sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditMode ? 'Update Project' : 'Save Project'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProject;
