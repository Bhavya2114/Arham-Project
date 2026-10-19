import React, { useEffect, useRef, useState } from 'react';
import { LuChevronDown, LuCheck } from 'react-icons/lu';

/**
 * Dark dropdown used for page filters, in place of the browser's own select list.
 * options: [{ value, label, hint? }] — hint is shown muted on the right (e.g. a project code).
 * placeholder: label of the empty "all" option; leave it out when a value must always be picked.
 * size: 'sm' for filter bars, 'md' to match form inputs.
 */
const FilterSelect = ({ value, onChange, options, placeholder, size = 'sm' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const allOptions = placeholder !== undefined ? [{ value: '', label: placeholder }, ...options] : options;
  const textSize = size === 'md' ? 'text-xs sm:text-sm' : 'text-xs';
  // Form-size lists match the field width and wrap long names; filter lists can grow to fit
  const listWidth = size === 'md' ? 'w-full' : 'min-w-full w-max max-w-xs';
  const selected = allOptions.find((o) => o.value === value) || allOptions[0];

  const choose = (v) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 py-2.5 pl-3.5 pr-3 rounded-xl ${textSize} border bg-[#1F2024] transition-colors cursor-pointer ${
          open ? 'border-[#FFB82E]/60' : 'border-[#2A2B30] hover:border-[#3A3B41]'
        }`}
      >
        <span className={`truncate ${value ? 'text-[#F4F1EA]' : 'text-[#B8B4AC]'}`}>{selected.label}</span>
        <LuChevronDown
          className={`shrink-0 text-sm text-[#908C84] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className={`absolute z-30 left-0 mt-1.5 ${listWidth} max-h-72 overflow-y-auto hide-scrollbar rounded-xl border border-[#2A2B30] bg-[#1A1B1E] shadow-xl shadow-black/40 p-1.5`}>
          {allOptions.map((o) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value || '__all'}
                type="button"
                onClick={() => choose(o.value)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${textSize} text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-[#FFB82E]/10 text-[#FFC14D]' : 'text-[#D8D4CC] hover:bg-[#25262B]'
                }`}
              >
                <span className={`flex-1 ${size === 'md' ? 'break-words' : 'truncate'}`}>{o.label}</span>
                {o.hint && <span className="shrink-0 text-[11px] text-[#75716A] whitespace-nowrap">{o.hint}</span>}
                <LuCheck className={`shrink-0 text-sm ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterSelect;
