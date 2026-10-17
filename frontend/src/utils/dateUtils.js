/**
 * Date formatting and normalization utilities for Indian Standard Format (DD/MM/YYYY).
 *
 * Guarantees:
 * 1. 2026-09-04 (September 4, 2026) formats as 04/09/2026 and never swaps to April 9 (09/04).
 * 2. Pure string regex parsing prevents any browser timezone-induced date shifts (e.g., UTC midnight shifting to previous day).
 * 3. Preserves API/backend required format as YMD: YYYY-MM-DD.
 */

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Extracts { year, month, day } as 2-digit/4-digit strings.
 * Zero timezone shifting for YYYY-MM-DD or ISO strings.
 */
export function parseDateParts(val) {
  if (!val) return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // 1. Matches YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      return { year, month, day };
    }

    // 2. Matches DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      return { year, month, day };
    }
  }

  // 3. Fallback for Date objects or timestamps
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const year = parts.find((p) => p.type === 'year')?.value || '';
    return { year, month, day };
  } catch {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return { year, month, day };
  }
}

/**
 * Formats a date into Indian format: DD/MM/YYYY.
 * Example: '2026-09-04' -> '04/09/2026'
 */
export function formatDateToIndian(val, fallback = '-') {
  const parts = parseDateParts(val);
  if (!parts) return fallback;
  return `${parts.day}/${parts.month}/${parts.year}`;
}

/**
 * Formats a date into: DD Mon YYYY.
 * Example: '2026-09-04' -> '04 Sep 2026'
 */
export function formatDateShortMonth(val, fallback = '') {
  const parts = parseDateParts(val);
  if (!parts) return fallback;
  const mIdx = parseInt(parts.month, 10) - 1;
  const mName = MONTHS_SHORT[mIdx] || parts.month;
  return `${parts.day} ${mName} ${parts.year}`;
}

/**
 * Formats a date into: DD MMMM YYYY.
 * Example: '2026-09-04' -> '04 September 2026'
 */
export function formatDateFull(val, fallback = '') {
  const parts = parseDateParts(val);
  if (!parts) return fallback;
  const mIdx = parseInt(parts.month, 10) - 1;
  const mName = MONTHS_FULL[mIdx] || parts.month;
  return `${parts.day} ${mName} ${parts.year}`;
}

/**
 * Formats a date into: DD/MM/YYYY (DD Mon YYYY).
 * Example: '2026-09-04' -> '04/09/2026 (04 Sep 2026)'
 */
export function formatDateWithMonth(val, fallback = '-') {
  const parts = parseDateParts(val);
  if (!parts) return fallback;
  const mIdx = parseInt(parts.month, 10) - 1;
  const mName = MONTHS_SHORT[mIdx] || parts.month;
  return `${parts.day}/${parts.month}/${parts.year} (${parts.day} ${mName} ${parts.year})`;
}

/**
 * Normalizes any valid date string or Date object into API format: YYYY-MM-DD.
 * Example: '04/09/2026' -> '2026-09-04'
 * Example: '2026-09-04' -> '2026-09-04'
 */
export function toApiDateFormat(val) {
  const parts = parseDateParts(val);
  if (!parts) return '';
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Validates if a string represents a real, calendar-valid Indian date (DD/MM/YYYY).
 * Example: '17/09/2026' -> true, '31/02/2026' -> false
 */
export function isValidIndianDate(str) {
  if (!str || typeof str !== 'string') return false;
  const match = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return false;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Validates if a string represents a real, calendar-valid ISO date (YYYY-MM-DD).
 * Example: '2026-09-17' -> true, '2026-02-31' -> false
 */
export function isValidIsoDate(str) {
  if (!str || typeof str !== 'string') return false;
  const match = str.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Converts an ISO date (YYYY-MM-DD) into Indian format (DD/MM/YYYY).
 * Validates the date before converting it.
 * Example: '2026-09-17' -> '17/09/2026'
 */
export function formatDateIndian(isoDate) {
  if (!isoDate) return '';
  if (typeof isoDate === 'string') {
    const trimmed = isoDate.trim();
    if (isValidIsoDate(trimmed)) {
      const [year, month, day] = trimmed.split('-');
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    if (isValidIndianDate(trimmed)) {
      const [day, month, year] = trimmed.split('/');
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }
  const parts = parseDateParts(isoDate);
  if (!parts) return '';
  return `${parts.day}/${parts.month}/${parts.year}`;
}

/**
 * Converts an Indian date (DD/MM/YYYY) into API format (YYYY-MM-DD).
 * Validates the date before converting it.
 * Example: '17/09/2026' -> '2026-09-17'
 */
export function formatDateForApi(indianDate) {
  if (!indianDate) return '';
  if (typeof indianDate === 'string') {
    const trimmed = indianDate.trim();
    if (isValidIndianDate(trimmed)) {
      const [day, month, year] = trimmed.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    if (isValidIsoDate(trimmed)) {
      const [year, month, day] = trimmed.split('-');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  const parts = parseDateParts(indianDate);
  if (!parts) return '';
  return `${parts.year}-${parts.month}-${parts.day}`;
}
