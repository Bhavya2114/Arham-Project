import React, { useState, useEffect, useRef } from 'react';
import { FaCalendarAlt } from 'react-icons/fa';
import {
  formatDateIndian,
  formatDateForApi,
  isValidIndianDate,
  isValidIsoDate,
} from '../utils/dateUtils';

/**
 * IndianDateInput component
 *
 * Guarantees visual DD/MM/YYYY format regardless of browser/OS locale.
 * - Visible text input displays DD/MM/YYYY (e.g. 17/09/2026).
 * - Clicking the calendar icon opens native date picker popup.
 * - Selecting date from picker immediately formats to DD/MM/YYYY.
 * - Allows typing in DD/MM/YYYY format with validation.
 * - Value passed to parent onChange is strictly API-standard ISO (YYYY-MM-DD).
 */
const IndianDateInput = ({
  id,
  name,
  label,
  value, // ISO format: 'YYYY-MM-DD'
  onChange, // receives 'YYYY-MM-DD' or ''
  min, // ISO format: 'YYYY-MM-DD'
  max, // ISO format: 'YYYY-MM-DD'
  disabled = false,
  error = '',
  placeholder = 'DD/MM/YYYY',
  className = '',
  ariaLabel,
}) => {
  const [textValue, setTextValue] = useState(() => (value ? formatDateIndian(value) : ''));
  const [localError, setLocalError] = useState('');
  const nativePickerRef = useRef(null);

  // Synchronize display text when parent value prop changes externally
  useEffect(() => {
    if (value && isValidIsoDate(value)) {
      const formatted = formatDateIndian(value);
      if (formatDateForApi(textValue) !== value) {
        setTextValue(formatted);
        setLocalError('');
      }
    } else if (!value && textValue && isValidIndianDate(textValue)) {
      setTextValue('');
      setLocalError('');
    }
  }, [value]);

  const handleTextChange = (e) => {
    const raw = e.target.value;
    setTextValue(raw);

    const trimmed = raw.trim();
    if (!trimmed) {
      setLocalError('');
      onChange('');
      return;
    }

    if (isValidIndianDate(trimmed)) {
      const iso = formatDateForApi(trimmed);
      setLocalError('');
      onChange(iso);
    } else {
      // Incomplete or invalid date while typing: do not leave stale valid ISO in parent
      onChange('');
    }
  };

  const handleBlur = () => {
    const trimmed = textValue.trim();
    if (!trimmed) {
      setLocalError('');
      onChange('');
      return;
    }

    if (isValidIndianDate(trimmed)) {
      const iso = formatDateForApi(trimmed);
      setTextValue(formatDateIndian(iso)); // standardize padding e.g. 1/9/2026 -> 01/09/2026
      setLocalError('');
      onChange(iso);
    } else {
      setLocalError('Please enter a valid date in DD/MM/YYYY format.');
      onChange('');
    }
  };

  const handleNativeDateChange = (e) => {
    const isoVal = e.target.value;
    if (isoVal && isValidIsoDate(isoVal)) {
      const formatted = formatDateIndian(isoVal);
      setTextValue(formatted);
      setLocalError('');
      onChange(isoVal);
    }
  };

  const openCalendarPicker = () => {
    if (nativePickerRef.current) {
      if (typeof nativePickerRef.current.showPicker === 'function') {
        try {
          nativePickerRef.current.showPicker();
          return;
        } catch {
          // Fallback to click if showPicker is unsupported or restricted
        }
      }
      nativePickerRef.current.focus();
      nativePickerRef.current.click();
    }
  };

  const displayError = error || localError;

  return (
    <div className="w-full space-y-1">
      <div className="relative flex items-center">
        <input
          id={id}
          name={name || id}
          type="text"
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={10}
          autoComplete="off"
          className={`w-full px-3 py-2 pr-10 border rounded-xl text-xs font-semibold focus:outline-none transition-all ${
            displayError
              ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20 text-rose-900'
              : 'border-gray-200 focus:border-emerald-500 bg-gray-50/50 text-slate-900'
          } ${className}`}
          aria-label={ariaLabel || label || 'Date input DD/MM/YYYY'}
        />

        {/* Calendar Picker Trigger */}
        <div
          onClick={openCalendarPicker}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
          title="Open calendar date picker"
        >
          <FaCalendarAlt className="text-sm pointer-events-none" />
          <input
            ref={nativePickerRef}
            type="date"
            tabIndex={-1}
            min={isValidIsoDate(min) ? min : undefined}
            max={isValidIsoDate(max) ? max : undefined}
            value={isValidIsoDate(value) ? value : ''}
            disabled={disabled}
            onChange={handleNativeDateChange}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            aria-label={label ? `Select ${label}` : 'Select date'}
          />
        </div>
      </div>

      {displayError && (
        <p className="text-[11px] text-rose-600 font-medium px-1">
          {displayError}
        </p>
      )}
    </div>
  );
};

export default IndianDateInput;
