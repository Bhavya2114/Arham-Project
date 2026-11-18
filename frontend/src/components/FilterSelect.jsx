import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuChevronDown, LuCheck } from 'react-icons/lu';

/**
 * Dark dropdown used for page filters, in place of the browser's own select list.
 * options: [{ value, label, hint? }] — hint is shown muted on the right (e.g. a project code).
 * placeholder: label of the empty "all" option; leave it out when a value must always be picked.
 * size: 'sm' for filter bars, 'md' to match form inputs.
 * searchable: show a type-to-search box at the top of the open list (matches name or SKU).
 * The open list is drawn in a portal with position: fixed, so a parent scroll box (overflow) can't clip it.
 * It opens upward when there isn't enough room below the field.
 */
const LIST_MAX_HEIGHT = 288; // same as the old max-h-72
const GAP = 6;
const EDGE = 8; // keep this much space from the window edge

const FilterSelect = ({ value, onChange, options, placeholder, size = 'sm', searchable = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  // Place the list under the field (or above it when there's no room below), and follow it on scroll/resize
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    const place = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE;
      const up = below < Math.min(LIST_MAX_HEIGHT, 200) && above > below;
      setPos({
        left: Math.max(EDGE, Math.min(r.left, window.innerWidth - r.width - EDGE)),
        width: r.width,
        top: up ? undefined : r.bottom + GAP,
        bottom: up ? window.innerHeight - r.top + GAP : undefined,
        maxHeight: Math.max(120, Math.min(LIST_MAX_HEIGHT, up ? above : below)),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true); // capture: catches scrolling inside any parent box
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Fresh search each time the list opens, with the cursor already in the box
  useEffect(() => {
    if (!open || !searchable) return;
    setQuery('');
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, searchable]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
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
  const listWidth = size === 'md' ? '' : 'w-max max-w-xs';
  const selected = allOptions.find((o) => o.value === value) || allOptions[0];
  // Every typed word must appear in the name or SKU, in any order ("cable 4mm" finds "4MM 4C CABLE")
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shownOptions =
    searchable && words.length
      ? allOptions.filter((o) => {
          if (!o.value) return false;
          const text = `${o.label} ${o.searchText || ''}`.toLowerCase();
          return words.every((w) => text.includes(w));
        })
      : allOptions;

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

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className={`fixed z-[10000] ${listWidth} overflow-y-auto hide-scrollbar rounded-xl border border-[#2A2B30] bg-[#1A1B1E] shadow-xl shadow-black/40 p-1.5`}
          style={{
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            maxHeight: pos.maxHeight,
            ...(size === 'md' ? { width: pos.width } : { minWidth: pos.width }),
          }}
        >
          {searchable && (
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = shownOptions.find((o) => o.value);
                  if (first) choose(first.value);
                }
              }}
              placeholder="Type to search..."
              className={`sticky top-0 z-10 w-full mb-1.5 px-3 py-2 rounded-lg ${textSize} bg-[#1F2024] border border-[#2A2B30] focus:border-[#FFB82E]/60 outline-none text-[#F4F1EA] placeholder-[#75716A]`}
            />
          )}
          {searchable && shownOptions.length === 0 && (
            <p className={`px-3 py-2 ${textSize} text-[#75716A]`}>No matching items</p>
          )}
          {shownOptions.map((o) => {
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default FilterSelect;
