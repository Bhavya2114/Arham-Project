/**
 * Formats a numeric value or string using the Indian numbering system (Lakhs, Crores).
 *
 * Examples:
 * 1000       → 1,000
 * 10000      → 10,000
 * 100000     → 1,00,000
 * 1000000    → 10,00,000
 * 10000000   → 1,00,00,000
 * 50000000   → 5,00,00,000
 */
export const formatIndianNumber = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';

  // Strip pre-existing commas
  const clean = str.replace(/,/g, '');

  // If not a valid numeric structure (digits, optional single decimal point)
  if (!/^-?\d*\.?\d*$/.test(clean)) {
    return str;
  }

  const isNegative = clean.startsWith('-');
  const absStr = isNegative ? clean.slice(1) : clean;

  const parts = absStr.split('.');
  let integerPart = parts[0];
  const hasDecimal = parts.length > 1;
  const decimalPart = parts[1];

  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherDigits = integerPart.substring(0, integerPart.length - 3);
    const formattedOther = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    integerPart = formattedOther + ',' + lastThree;
  }

  let formatted = (isNegative ? '-' : '') + integerPart;
  if (hasDecimal) {
    formatted += '.' + decimalPart;
  }

  return formatted;
};

/**
 * Converts a numeric value into English words using the Indian numbering system.
 *
 * Examples:
 * 1,000       → One Thousand Only
 * 10,000      → Ten Thousand Only
 * 1,00,000    → One Lakh Only
 * 5,00,000    → Five Lakh Only
 * 10,00,000   → Ten Lakh Only
 * 1,00,00,000 → One Crore Only
 * 1,25,50,000 → One Crore Twenty Five Lakh Fifty Thousand Only
 */
export const numberToIndianWords = (val) => {
  if (val === null || val === undefined || val === '') return '';

  const cleanStr = String(val).replace(/,/g, '').trim();
  if (!cleanStr || isNaN(cleanStr)) return '';

  const num = Number(cleanStr);
  if (num < 0) return '';
  if (num === 0) return 'Zero Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tensMultiple = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTwoDigit = (n) => {
    if (n < 10) return singleDigits[n];
    if (n < 20) return twoDigits[n - 10];
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return (tensMultiple[tens] + (ones > 0 ? ' ' + singleDigits[ones] : '')).trim();
  };

  const convertUnderThousand = (n) => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = '';
    if (hundred > 0) {
      str += singleDigits[hundred] + ' Hundred';
    }
    if (rest > 0) {
      str += (str ? ' ' : '') + convertTwoDigit(rest);
    }
    return str;
  };

  const convertSection = (n) => {
    if (n === 0) return '';
    let str = '';
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    const remaining = n;

    if (crore > 0) {
      str += convertSection(crore) + ' Crore ';
    }
    if (lakh > 0) {
      str += convertTwoDigit(lakh) + ' Lakh ';
    }
    if (thousand > 0) {
      str += convertTwoDigit(thousand) + ' Thousand ';
    }
    if (remaining > 0) {
      str += convertUnderThousand(remaining);
    }
    return str.trim();
  };

  // Split integer and decimal parts
  const parts = cleanStr.split('.');
  const integerVal = parseInt(parts[0], 10) || 0;
  let paiseVal = 0;
  if (parts.length > 1 && parts[1]) {
    const decStr = parts[1].slice(0, 2).padEnd(2, '0');
    paiseVal = parseInt(decStr, 10) || 0;
  }

  const words = convertSection(integerVal);

  if (words && paiseVal > 0) {
    return `${words} And ${convertTwoDigit(paiseVal)} Paise Only`;
  } else if (words) {
    return `${words} Only`;
  } else if (paiseVal > 0) {
    return `${convertTwoDigit(paiseVal)} Paise Only`;
  }

  return 'Zero Only';
};
