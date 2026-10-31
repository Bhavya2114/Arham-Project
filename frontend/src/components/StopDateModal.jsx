import React, { useState, useEffect } from 'react';
import ConfirmationModal from './ConfirmationModal';
import IndianDateInput from './IndianDateInput';
import { formatDateShortMonth, toApiDateFormat } from '../utils/dateUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

const dayDiff = (fromIso, toIso) =>
  Math.round((Date.UTC(...isoParts(toIso)) - Date.UTC(...isoParts(fromIso))) / DAY_MS);

const isoParts = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m - 1, d];
};

const rupees = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/**
 * Stop popup with a stop date the user can change (mode "stop"),
 * and the same popup for changing a past stop date (mode "edit").
 * The date can only be picked between minDate and maxDate ('YYYY-MM-DD').
 */
const StopDateModal = ({
  isOpen,
  onClose,
  onConfirm, // receives 'YYYY-MM-DD'
  isLoading = false,
  mode = 'stop',
  name,
  projectName,
  startDate,
  minDate,
  maxDate,
  initialDate,
  dailyWage,
  currentEarned, // earned on this project with the current date
  balance, // optional: shows a warning when the new date leaves the worker overpaid
}) => {
  const [stopDate, setStopDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStopDate(initialDate || maxDate || '');
      setError('');
    }
  }, [isOpen, initialDate, maxDate]);

  const isEdit = mode === 'edit';
  const startIso = toApiDateFormat(startDate);
  const isValid = Boolean(stopDate) && (!minDate || stopDate >= minDate) && (!maxDate || stopDate <= maxDate);

  let preview = null;
  if (isValid && startIso) {
    const days = Math.max(dayDiff(startIso, stopDate) + 1, 0);
    const earned = days * (Number(dailyWage) || 0);
    const newBalance = balance == null ? null : Number(balance) + (earned - Number(currentEarned || 0));
    preview = { days, earned, overpaidBy: newBalance != null && newBalance < 0 ? -newBalance : 0 };
  }

  const rangeText =
    minDate && maxDate
      ? `Pick a date from ${formatDateShortMonth(minDate)} to ${formatDateShortMonth(maxDate)}.`
      : maxDate
      ? `Pick a date up to ${formatDateShortMonth(maxDate)}.`
      : '';

  const handleConfirm = () => {
    if (!isValid) {
      setError(rangeText || 'Please choose a valid stop date.');
      return;
    }
    onConfirm(stopDate);
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title={isEdit ? 'Change stop date' : 'Stop Labour'}
      confirmText={isEdit ? 'Save' : 'Stop Labour'}
      cancelText="Cancel"
      isDanger={!isEdit}
      isLoading={isLoading}
      message={
        <div className="space-y-3">
          {isEdit ? (
            <p className="text-gray-800 text-sm font-medium">
              When did <span className="font-bold text-gray-900">{name}</span> stop working
              {projectName ? <> on <span className="font-bold text-gray-900">{projectName}</span></> : ''}?
            </p>
          ) : (
            <>
              <p className="text-gray-800 text-sm font-medium">
                Are you sure you want to stop <span className="font-bold text-gray-900">{name}</span>?
              </p>
              <p className="text-xs text-gray-500 font-normal">
                Once stopped, this labour will no longer be considered active.
              </p>
            </>
          )}
          <div className="bg-white p-2.5 rounded-lg border border-gray-200 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 font-medium shrink-0">Stop date</span>
              <div className="w-40">
                <IndianDateInput
                  id="labour-stop-date"
                  value={stopDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(v) => {
                    setStopDate(v);
                    setError('');
                  }}
                  ariaLabel="Stop date"
                />
              </div>
            </div>
            {preview ? (
              <p className="text-gray-400 font-normal">
                {preview.days} {preview.days === 1 ? 'day' : 'days'} worked · {rupees(preview.earned)} earned
              </p>
            ) : (
              rangeText && <p className="text-gray-400 font-normal">{rangeText}</p>
            )}
            {error && <p className="text-rose-500 font-normal">{error}</p>}
            {preview?.overpaidBy > 0 && (
              <p className="text-amber-500 font-normal">
                With this date, {name} has been paid {rupees(preview.overpaidBy)} more than earned.
              </p>
            )}
          </div>
        </div>
      }
    />
  );
};

export default StopDateModal;
