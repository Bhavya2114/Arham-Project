import colors from 'tailwindcss/colors.js';

/*
 * "Warm electrical" dark theme.
 * The pages were written for a light theme (bg-white, text-slate-900, bg-emerald-600 ...).
 * Instead of rewriting every class, the colour scales are remapped here so the same
 * class names render dark: light backgrounds become charcoal, dark text becomes
 * warm off-white, and the green action colour becomes amber.
 */

const page = '#1A1B1E';
const card = '#212226';
const amber = { 500: '#FFB82E', 600: '#FFB82E', 700: '#F2A516', 800: '#E09410', 900: '#C98208' };

// Mix a colour into the card colour, for soft tinted backgrounds and borders.
const tint = (hex, amount) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(card), p(hex)];
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
};

// Neutrals (gray / slate / zinc / neutral / stone all share these).
const neutralBg = {
  50: '#25262A', 100: '#2A2B30', 200: '#33343A', 300: '#3F4046', 400: '#55565C', 500: '#6E6F75',
  600: '#2E2F34', 700: '#26272B', 800: '#1E1F22', 900: '#141518', 950: '#0E0F10',
};
const neutralText = {
  50: '#F4F1EA', 100: '#DEDAD3', 200: '#C8C4BC', 300: '#A8A49C', 400: '#8A867E', 500: '#9A968F',
  600: '#B0ACA4', 700: '#C8C4BC', 800: '#DEDAD3', 900: '#F4F1EA', 950: '#FAF8F4',
};
const neutralBorder = {
  50: '#26272B', 100: '#2A2B30', 200: '#2E2F34', 300: '#3A3B41', 400: '#4A4B51', 500: '#5A5B61',
  600: '#3A3B41', 700: '#2E2F34', 800: '#2A2B30', 900: '#222327', 950: '#1A1B1E',
};

const neutrals = (scale) => ({ gray: scale, slate: scale, zinc: scale, neutral: scale, stone: scale });

// Coloured families: dark text shades become light ones.
const families = ['red', 'rose', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink'];
const build = (fn) => Object.fromEntries(families.map((f) => [f, fn(colors[f], f)]));

// Only warnings and errors keep a coloured card background. Every other pale card
// (blue, purple, green ...) becomes a plain raised surface, so colour stays on icons,
// dots and badges instead of whole cards.
const alertFamilies = ['red', 'rose', 'orange', 'amber', 'yellow'];
const decorativeFamilies = ['teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink'];
const raised = neutralBg[50];

const bgFamily = (c, f) => ({
  50: alertFamilies.includes(f) ? tint(c[500], 0.07) : raised, 100: tint(c[500], 0.14), 200: tint(c[500], 0.22), 300: tint(c[500], 0.32),
  400: c[400], 500: c[500], 600: c[600], 700: c[700], 800: tint(c[500], 0.3), 900: tint(c[500], 0.2), 950: tint(c[500], 0.12),
});
const textFamily = (c, f) => (decorativeFamilies.includes(f)
  // Labels and headings written in blue / purple ... read as plain text; icons (400-600) keep their colour.
  ? { 50: c[100], 100: c[100], 200: c[200], 300: c[300], 400: c[400], 500: c[400], 600: c[400], 700: '#B0ACA4', 800: '#C8C4BC', 900: '#DEDAD3', 950: '#F4F1EA' }
  : { 50: c[100], 100: c[100], 200: c[200], 300: c[300], 400: c[400], 500: c[400], 600: c[400], 700: c[300], 800: c[200], 900: c[200], 950: c[100] });
const borderFamily = (c, f) => ({
  ...(alertFamilies.includes(f)
    ? { 50: tint(c[500], 0.12), 100: tint(c[500], 0.16), 200: tint(c[500], 0.24), 300: tint(c[500], 0.34) }
    : { 50: neutralBorder[200], 100: neutralBorder[200], 200: neutralBorder[200], 300: neutralBorder[300] }),
  400: c[400], 500: c[500], 600: c[600], 700: c[700], 800: tint(c[500], 0.3), 900: tint(c[500], 0.2), 950: tint(c[500], 0.12),
});

// Emerald was the action colour (buttons, focus rings). Solid emerald becomes amber;
// pale emerald tints and emerald text stay green so paid / profit still reads as good news.
const bgColors = { ...build(bgFamily), ...neutrals(neutralBg) };
bgColors.emerald = { ...bgColors.emerald, ...amber, 500: colors.emerald[400] }; // 500 is used for green status dots
bgColors.green = { ...bgColors.green, 500: amber[500], 600: amber[600], 700: amber[700] };
bgColors.blue = { ...bgColors.blue, 600: amber[600], 700: amber[700] }; // blue Save buttons in forms
bgColors.amber = { ...bgColors.amber, 600: amber[600], 700: amber[700] };
const borderColors = { ...build(borderFamily), ...neutrals(neutralBorder) };
borderColors.emerald = { ...borderColors.emerald, 400: amber[500], 500: amber[500], 600: amber[600], 700: amber[700] };

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        "sevillana": ["Sevillana", "sans-serif"],
        // Codes and amounts used a typewriter font; keep Poppins with even-width digits instead
        mono: ['Poppins', 'system-ui', 'sans-serif'],
      },
      // Lighter weights: only titles stay strong.
      fontWeight: {
        semibold: '500',
        bold: '500',
        extrabold: '600',
        black: '600',
      },
      colors: {
        page,
        card,
      },
      backgroundColor: { white: card, ...bgColors },
      textColor: { ...build(textFamily), ...neutrals(neutralText) },
      borderColor: { DEFAULT: '#2E2F34', white: '#2E2F34', ...borderColors },
      divideColor: { DEFAULT: '#2E2F34', white: '#2E2F34', ...borderColors },
      placeholderColor: { ...neutrals(neutralText) },
      ringColor: { emerald: { ...colors.emerald, 500: amber[500], 600: amber[600] } },
      ringOffsetColor: { white: card },
      gradientColorStops: { white: card },
    },
  },
  plugins: [],
}
