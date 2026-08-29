import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { formatIndianNumber, numberToIndianWords } from '../utils/numberToWords';
import {
  FaBuilding,
  FaArrowLeft,
  FaSave,
  FaSpinner,
  FaExclamationTriangle,
  FaUserCheck,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaRupeeSign
} from 'react-icons/fa';

const AddProject = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // If id exists and is not 'new', Edit mode
  const toast = useToast();
  const isEditMode = Boolean(id) && id !== 'new';

  const [customers, setCustomers] = useState([]);
  const [loadingPrereqs, setLoadingPrereqs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [formData, setFormData] = useState({
    projectCode: '',
    name: '',
    customer: '',
    siteAddress: '',
    startDate: new Date().toISOString().split('T')[0],
    expectedEndDate: '',
    status: 'PLANNING',
    budget: '',
    notes: '',
  });

  // Fetch active customers list & project details if edit mode
  useEffect(() => {
    const loadInitialData = async () => {
      setLoadingPrereqs(true);
      try {
        const custRes = await axiosInstance.get('/customers');
        const activeCusts = (custRes.data.data || []).filter((c) => c.status === 'ACTIVE');
        setCustomers(activeCusts);

        if (isEditMode) {
          const projRes = await axiosInstance.get(`/projects/${id}`);
          const p = projRes.data.data;
          if (p) {
            setFormData({
              projectCode: p.projectCode || '',
              name: p.name || '',
              customer: p.customerId || p.customer?.id || p.customer?._id || '',
              siteAddress: p.siteAddress || '',
              startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
              expectedEndDate: p.expectedEndDate ? new Date(p.expectedEndDate).toISOString().split('T')[0] : '',
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
    if (!formData.customer) {
      setFormError('Please select a valid Customer/Client.');
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
      customer: formData.customer,
      siteAddress: formData.siteAddress.trim(),
      startDate: formData.startDate,
      expectedEndDate: formData.expectedEndDate ? formData.expectedEndDate : undefined,
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
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
        <p className="text-sm text-gray-400 font-medium">Loading form prerequisites...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6 animate-fadeIn pb-16">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg shadow-sm">
            <FaBuilding />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">
              {isEditMode ? 'Edit Project' : 'Create New Construction Project'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Fill in project code, client allocation, site details, and timeline.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all flex items-center space-x-2 bg-white"
        >
          <FaArrowLeft />
          <span>Cancel</span>
        </button>
      </div>

      {/* Error Alert */}
      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center space-x-3 shadow-sm">
          <FaExclamationTriangle className="text-red-500 text-base flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Project Basic Info */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            1. Basic Project Identity
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Code */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Project Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="projectCode"
                value={formData.projectCode}
                onChange={handleChange}
                placeholder="e.g. PRJ-2026-001"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white uppercase"
                required
              />
            </div>

            {/* Project Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. XYZ Building Construction"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white"
                required
              />
            </div>
          </div>
        </div>

        {/* Client & Location */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            2. Customer & Construction Site
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                <span>Customer / Client <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-gray-400 font-normal">Active Clients Only</span>
              </label>
              <div className="relative">
                <select
                  name="customer"
                  value={formData.customer}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white text-slate-900"
                  required
                >
                  <option value="">-- Select Client --</option>
                  {customers.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.name} {c.businessName ? `(${c.businessName})` : ''} {c.gstNumber ? `- GST: ${c.gstNumber}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Site Address */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Site Location Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="siteAddress"
                  value={formData.siteAddress}
                  onChange={handleChange}
                  placeholder="e.g. Plot 45, Kothrud, Pune, Maharashtra"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Schedule & Budget */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            3. Schedule, Budget & Status
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white"
                required
              />
            </div>

            {/* Expected End Date */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Expected End Date
              </label>
              <input
                type="date"
                name="expectedEndDate"
                value={formData.expectedEndDate}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Project Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white text-slate-900"
              >
                <option value="PLANNING">Planning</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Budget */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Project Target Budget (₹)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  name="budget"
                  value={formData.budget}
                  onChange={handleBudgetChange}
                  placeholder="e.g. 50,00,000"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white text-slate-900"
                />
              </div>
              {numberToIndianWords(formData.budget) && (
                <div className="mt-1.5 px-3 py-1.5 bg-emerald-50/70 border border-emerald-100/80 rounded-xl flex items-center space-x-1.5 text-xs text-emerald-800 animate-fadeIn">
                  <span className="font-bold text-emerald-600">In words:</span>
                  <span className="font-semibold">{numberToIndianWords(formData.budget)}</span>
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-1">
                Enter total estimated budget for this project
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Notes & Descriptions
              </label>
              <input
                type="text"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Optional notes or project scope comments"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => navigate('/projects')}
            className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50 bg-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin text-sm" />
                <span>Saving Project...</span>
              </>
            ) : (
              <>
                <FaSave className="text-xs" />
                <span>{isEditMode ? 'Update Project' : 'Save Project'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProject;
