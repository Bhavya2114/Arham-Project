import React from 'react';

// Line icons for the two kinds of worker: a labourer in a hard hat, and a contractor with his crew.
const strokeProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const LabourIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} className={className} aria-hidden="true" {...strokeProps}>
    <path d="M6.5 10.5a5.5 5.5 0 0 1 11 0" />
    <path d="M10.5 7.5V5.2h3v2.3" />
    <rect x="5" y="10.5" width="14" height="2.5" rx=".8" />
    <path d="M8.5 13.2a3.5 3.5 0 0 0 7 0" />
    <path d="M5 21a7 7 0 0 1 14 0" />
  </svg>
);

export const ContractorIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} className={className} aria-hidden="true" {...strokeProps}>
    <path d="M8 7V4.5a.8.8 0 0 1 .8-.8h1.4a.8.8 0 0 1 .8.8V7" />
    <path d="M11 5a5 5 0 0 1 4.5 5" />
    <path d="M3.5 10a5 5 0 0 1 4.5-5" />
    <rect x="2" y="10" width="15" height="3" rx=".8" />
    <circle cx="18" cy="15" r="2.3" />
    <path d="M14.5 21a3.5 3.5 0 0 1 7 0" />
    <circle cx="9.5" cy="17" r="1.6" />
    <path d="M6.5 21.2a3 3 0 0 1 6 0" />
  </svg>
);

// 44px rounded box with the icon: amber for labour, purple (same as the Contractor badge) for contractors
export const RoleIconBox = ({ kind = 'LABOUR' }) => {
  const isContractor = kind === 'CONTRACTOR';
  return (
    <div
      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
        isContractor
          ? 'bg-[rgba(183,148,246,0.13)] border-[rgba(183,148,246,0.35)] text-[#B794F6]'
          : 'bg-[#FFB82E]/[0.12] border-[#FFB82E]/35 text-[#FFB82E]'
      }`}
    >
      {isContractor ? <ContractorIcon size={22} /> : <LabourIcon size={22} />}
    </div>
  );
};
