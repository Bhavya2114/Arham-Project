import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getLabours, assignLabourToProject } from '../utils/labourService';
import { getErrorMessage } from '../utils/apiError';
import { toApiDateFormat, formatDateToIndian } from '../utils/dateUtils';
import { FaTimes, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import FilterSelect from './FilterSelect';
import IndianDateInput from './IndianDateInput';

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
  const submitLock = useRef(false);
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

  // A returning worker can't start before the last day already counted for them
  const lastStopIso = selectedLabour?.stoppedAt ? toApiDateFormat(selectedLabour.stoppedAt) : '';
  const effectiveMinDateIso =
    lastStopIso && (!projectStartDateIso || lastStopIso > projectStartDateIso)
      ? lastStopIso
      : projectStartDateIso;

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

    if (lastStopIso && startDate < lastStopIso) {
      setStartDateError(
        `This worker already worked till ${formatDateToIndian(selectedLabour.stoppedAt)}. Pick a start date on or after that day.`
      );
      return;
    }

    if (!projectId) {
      setFormError('Invalid project context.');
      return;
    }

    // Ignore a second click while the first assign is still being saved
    if (submitLock.current) return;
    submitLock.current = true;
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
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const capitalise = (t) => (t ? t.trim().charAt(0).toUpperCase() + t.trim().slice(1) : '');
  const labourOptions = labourList.map((l) => ({
    value: l.id || l._id,
    label: l.name,
    hint: `${capitalise(l.address || l.location) || 'No city'} · ₹${Number(l.dailyWage || 0).toLocaleString('en-IN')}/day`,
  }));

  const labelCls = 'block text-xs text-gray-400 mb-1.5';

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      style={{ margin: 0, padding: '1rem' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 animate-scaleUp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-labour-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-1">
          <div>
            <h3 id="assign-labour-modal-title" className="text-lg font-semibold text-slate-900">
              Assign labour
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              to <span className="text-slate-700">{projectName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pt-4 pb-5 space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <FaExclamationTriangle className="text-sm flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Worker */}
          <div>
            <label className={labelCls}>Worker</label>
            {loadingLabours ? (
              <div className="flex items-center gap-2 py-2.5 px-3.5 border border-gray-200 rounded-xl text-xs text-gray-400">
                <FaSpinner className="animate-spin text-[#FFB82E] text-xs" />
                Loading workers...
              </div>
            ) : labourList.length === 0 ? (
              <p className="py-2.5 px-3.5 border border-gray-200 rounded-xl text-xs text-gray-400">
                No free workers. Only inactive workers can be assigned.
              </p>
            ) : (
              <FilterSelect
                size="md"
                value={selectedLabourId}
                placeholder="Choose a worker"
                options={labourOptions}
                onChange={(v) => {
                  setSelectedLabourId(v);
                  if (fieldError) setFieldError('');
                  if (formError) setFormError(null);
                  if (startDateError) setStartDateError('');
                }}
              />
            )}
            {fieldError && <p className="text-rose-400 text-[11px] mt-1">{fieldError}</p>}
            {!loadingLabours && labourList.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-1.5">Only workers not on a site right now are listed.</p>
            )}
          </div>

          {/* Wage + start date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Daily wage</label>
              <div className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900">
                {selectedLabour ? `₹${Number(selectedLabour.dailyWage || 0).toLocaleString('en-IN')}/day` : <span className="text-gray-400 font-sans">-</span>}
              </div>
            </div>
            <div>
              <label htmlFor="assign-labour-start-date" className={labelCls}>
                Start date
              </label>
              <IndianDateInput
                id="assign-labour-start-date"
                name="startDate"
                value={startDate}
                onChange={(iso) => {
                  setStartDate(iso);
                  if (startDateError) setStartDateError('');
                  if (formError) setFormError(null);
                }}
                max={effectiveMaxDateIso}
                min={effectiveMinDateIso || undefined}
                disabled={submitting}
                error={startDateError}
                className="py-2.5 sm:text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingLabours || !selectedLabourId}
              className="px-6 py-2.5 rounded-xl bg-[#FFB82E] hover:bg-[#FFC14D] text-[#1A1B1E] font-medium disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              {submitting && <FaSpinner className="animate-spin text-xs" />}
              {submitting ? 'Assigning...' : 'Assign'}
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
