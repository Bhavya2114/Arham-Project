import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLabours, assignLabourToProject } from '../utils/labourService';
import { getErrorMessage } from '../utils/apiError';
import { toApiDateFormat, formatDateToIndian } from '../utils/dateUtils';
import {
  FaHardHat,
  FaTimes,
  FaBuilding,
  FaUserCheck,
  FaRupeeSign,
  FaExclamationTriangle,
  FaCheck,
  FaSpinner,
} from 'react-icons/fa';

/**
 * AssignLabourModal Component
 *
 * Used exclusively within Project Details to assign an existing Labour worker
 * from the Labour directory to an ACTIVE Project.
 *
 * Portal backdrop covers the full viewport without white strips.
 */
const AssignLabourModal = ({
  isOpen,
  onClose,
  onSuccess,
  project,
}) => {
  const [labourList, setLabourList] = useState([]);
  const [loadingLabours, setLoadingLabours] = useState(false);
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [startDate, setStartDate] = useState(() => toApiDateFormat(new Date()));
  const [fieldError, setFieldError] = useState('');
  const [startDateError, setStartDateError] = useState('');
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch existing labour records on open
  useEffect(() => {
    if (!isOpen) return;

    setSelectedLabourId('');
    const projectExpectedEndDateIso = project?.expectedEndDate
      ? toApiDateFormat(project.expectedEndDate)
      : '';
    const todayIso = toApiDateFormat(new Date());
    const initialDate =
      projectExpectedEndDateIso && projectExpectedEndDateIso < todayIso
        ? projectExpectedEndDateIso
        : todayIso;
    setStartDate(initialDate);
    setFieldError('');
    setStartDateError('');
    setFormError(null);
    setSubmitting(false);

    const loadLabours = async () => {
      setLoadingLabours(true);
      try {
        const data = await getLabours({ status: 'INACTIVE' });
        const inactiveOnly = (data || []).filter((l) => l.status === 'INACTIVE');
        setLabourList(inactiveOnly);
      } catch (err) {
        console.error('Error fetching labours for assignment:', err);
        setFormError('Failed to load existing labour workers from database.');
      } finally {
        setLoadingLabours(false);
      }
    };

    loadLabours();
  }, [isOpen]);

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

  const projectId = project?.id || project?._id;
  const projectName = project?.name || 'Current Project';

  const selectedLabour = labourList.find(
    (l) => (l.id || l._id) === selectedLabourId
  );

  const projectStartDateIso = project?.startDate
    ? toApiDateFormat(project.startDate)
    : '';
  const projectExpectedEndDateIso = project?.expectedEndDate
    ? toApiDateFormat(project.expectedEndDate)
    : '';
  const todayIso = toApiDateFormat(new Date());

  const effectiveMaxDateIso =
    projectExpectedEndDateIso && projectExpectedEndDateIso < todayIso
      ? projectExpectedEndDateIso
      : todayIso;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFieldError('');
    setStartDateError('');

    if (!selectedLabourId) {
      setFieldError('Please select an existing labour worker');
      return;
    }

    if (!startDate || !startDate.trim()) {
      setStartDateError('Start date is required');
      return;
    }

    const currentTodayIso = toApiDateFormat(new Date());
    if (startDate > currentTodayIso) {
      setStartDateError('Start date cannot be in the future');
      return;
    }

    if (projectExpectedEndDateIso && startDate > projectExpectedEndDateIso) {
      setStartDateError(
        `Start date cannot be after project expected completion date (${formatDateToIndian(projectExpectedEndDateIso)})`
      );
      return;
    }

    if (projectStartDateIso && startDate < projectStartDateIso) {
      setStartDateError(
        `Start date cannot be earlier than project start date (${formatDateToIndian(projectStartDateIso)})`
      );
      return;
    }

    if (!projectId) {
      setFormError('Invalid project context.');
      return;
    }

    setSubmitting(true);
    try {
      const assigned = await assignLabourToProject(projectId, selectedLabourId, startDate);
      onSuccess?.(assigned);
      onClose();
    } catch (err) {
      console.error('Error assigning labour to project:', err);
      const msg = getErrorMessage(
        err,
        'Failed to assign labour to this project.'
      );
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
        aria-labelledby="assign-labour-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-base shadow-sm">
              <FaHardHat />
            </div>
            <div>
              <h3
                id="assign-labour-modal-title"
                className="text-base font-black text-slate-900 tracking-tight"
              >
                Assign Labour to Project
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Associate an existing worker from the Labour directory
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

          {/* Project (Read-only) */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Project
            </label>
            <div className="px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl flex items-center space-x-2 text-xs text-slate-800">
              <FaBuilding className="text-amber-600 text-xs flex-shrink-0" />
              <span className="font-bold truncate">{projectName}</span>
              <span className="text-[10px] text-gray-400 font-semibold ml-auto flex-shrink-0">
                (read-only)
              </span>
            </div>
          </div>

          {/* Select Labour * */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Select Labour <span className="text-red-500">*</span>
            </label>
            {loadingLabours ? (
              <div className="flex items-center space-x-2 py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500">
                <FaSpinner className="animate-spin text-amber-600 text-xs" />
                <span>Loading available labours...</span>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedLabourId}
                  onChange={(e) => {
                    setSelectedLabourId(e.target.value);
                    if (fieldError) setFieldError('');
                    if (formError) setFormError(null);
                    if (startDateError) setStartDateError('');
                  }}
                  className={`w-full px-3 py-2.5 border rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none transition-all text-slate-800 font-bold ${
                    fieldError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-200 focus:border-amber-500'
                  }`}
                >
                  <option value="">-- Select an eligible labour (Inactive) --</option>
                  {labourList.length === 0 ? (
                    <option value="" disabled>
                      No inactive labour workers available
                    </option>
                  ) : (
                    labourList.map((l) => {
                      const lId = l.id || l._id;
                      return (
                        <option key={lId} value={lId}>
                          {l.name} ({l.address || l.location || 'No City'}) — ₹{l.dailyWage}/day
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            )}
            {labourList.length === 0 && !loadingLabours && (
              <p className="text-gray-400 text-[11px] mt-1 font-medium">
                Only unassigned (inactive) labour workers can be assigned to a project.
              </p>
            )}
            {fieldError && (
              <p className="text-red-500 text-[11px] mt-1 font-medium">
                {fieldError}
              </p>
            )}
          </div>

          {/* Daily Wage (Informational / Read-only) */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Daily Wage
            </label>
            <div className="px-3.5 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 text-slate-900 font-black font-mono">
                <FaRupeeSign className="text-gray-400 text-xs" />
                <span>
                  {selectedLabour
                    ? `₹${Number(selectedLabour.dailyWage || 0).toLocaleString('en-IN')}/day`
                    : 'Select a worker to view'}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">
                (informational)
              </span>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="assign-labour-start-date" className="block font-bold text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              id="assign-labour-start-date"
              name="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (startDateError) setStartDateError('');
                if (formError) setFormError(null);
              }}
              max={effectiveMaxDateIso}
              min={projectStartDateIso || undefined}
              disabled={submitting}
              className={`w-full px-3 py-2.5 border rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none transition-all text-slate-800 font-bold ${
                startDateError
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-200 focus:border-amber-500'
              }`}
              required
            />
            {startDateError && (
              <p className="text-red-500 text-[11px] mt-1 font-medium">
                {startDateError}
              </p>
            )}
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
              disabled={submitting || loadingLabours || !selectedLabourId}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white font-bold transition-all text-xs inline-flex items-center space-x-2 shadow-sm cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  <span>Assigning Labour...</span>
                </>
              ) : (
                <>
                  <FaUserCheck className="text-xs" />
                  <span>Assign Labour</span>
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

export default AssignLabourModal;
