/**
 * Builds the styled "project report" Excel workbook.
 * Kept free of network / React code so it can also run in Node (ExcelJS is passed in).
 */
import { parseDateParts, formatDateShortMonth } from './dateUtils.js';
import { PROJECT_GST_RATE } from './projectGst.constants.js';
import { categoryLabel, materialLine, projectBudgetFigures } from './projectCosts.js';

const FONT = 'Poppins';
const C = {
  charcoal: 'FF2B2B2B',
  header: 'FF3A3A3A',
  amber: 'FFF5A623',
  lightAmber: 'FFFDF1DC',
  zebra: 'FFFAF7F2',
  green: 'FF1E8E3E',
  red: 'FFC62828',
  border: 'FFE0D6C6',
  white: 'FFFFFFFF',
  grey: 'FFBBBBBB',
  label: 'FF777777',
  cardLabel: 'FF8A6D3B',
  worker: 'FFB7791F',
  contractor: 'FF7B1FA2',
};

// Indian grouping: 1,23,45,678.00
const MONEY = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"##,##0.00';
const DATE = 'dd-mmm-yyyy';
const TABLE_START = 6;

const STATUS_LABELS = {
  PLANNING: 'Planning',
  IN_PROGRESS: 'In progress',
  ACTIVE: 'In progress',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const font = (extra = {}) => ({ name: FONT, size: 10, color: { argb: 'FF2B2B2B' }, ...extra });
const thin = { style: 'thin', color: { argb: C.border } };
const allThin = { top: thin, left: thin, bottom: thin, right: thin };

// Calendar date (no time) as a UTC midnight Date, which Excel shows as that same day
export const toExcelDate = (val) => {
  const p = parseDateParts(val);
  if (!p) return null;
  return new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const newSheet = (wb, name, tabColor, widths) => {
  const ws = wb.addWorksheet(name, {
    properties: { tabColor: { argb: tabColor } },
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });
  ws.columns = widths.map((width) => ({ width }));
  return ws;
};

// Rows 1-3 charcoal band (brand, title, project line), row 4 thin amber strip
const headerBand = (ws, colCount, title, subtitle) => {
  for (let r = 1; r <= 4; r += 1) {
    for (let c = 1; c <= colCount; c += 1) {
      ws.getCell(r, c).fill = fill(r === 4 ? C.amber : C.charcoal);
    }
  }
  ws.getCell('A1').value = 'ARHAM ELECTRICAL & LIGHTING';
  ws.getCell('A1').font = font({ bold: true, color: { argb: C.amber } });
  ws.getCell('A2').value = title;
  ws.getCell('A2').font = font({ bold: true, size: 18, color: { argb: C.white } });
  ws.getCell('A2').alignment = { vertical: 'middle' };
  ws.getCell('A3').value = subtitle;
  ws.getCell('A3').font = font({ color: { argb: C.grey } });
  ws.getRow(1).height = 18;
  ws.getRow(2).height = 30;
  ws.getRow(3).height = 18;
  ws.getRow(4).height = 4;
};

/**
 * Writes a table at row 6: header, zebra rows, a Total row with SUM formulas.
 * columns: [{ header, key, width, type: 'money' | 'date' | 'number' | 'text', total, align }]
 * rows: plain objects; a cell may also be { value, font } to override the font.
 */
const writeTable = (ws, columns, rows) => {
  if (rows.length === 0) {
    const cell = ws.getCell(TABLE_START, 1);
    cell.value = 'No records';
    cell.font = font({ italic: true, color: { argb: C.label } });
    return;
  }

  const head = ws.getRow(TABLE_START);
  head.height = 26;
  columns.forEach((col, i) => {
    const cell = head.getCell(i + 1);
    cell.value = col.header;
    cell.font = font({ bold: true, color: { argb: C.white } });
    cell.fill = fill(C.header);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = allThin;
  });

  rows.forEach((data, idx) => {
    const row = ws.getRow(TABLE_START + 1 + idx);
    row.height = 18;
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const raw = data[col.key];
      const isRich = raw && typeof raw === 'object' && !(raw instanceof Date) && 'value' in raw;
      cell.value = isRich ? raw.value : raw ?? '';
      cell.font = isRich && raw.font ? font(raw.font) : font();
      cell.fill = fill(idx % 2 ? C.zebra : C.white);
      cell.border = allThin;
      const numeric = col.type === 'money' || col.type === 'number';
      if (col.type === 'money') cell.numFmt = MONEY;
      if (col.type === 'date') cell.numFmt = DATE;
      cell.alignment = {
        vertical: 'middle',
        horizontal: col.align || (numeric ? 'right' : col.type === 'date' ? 'center' : 'left'),
      };
    });
  });

  const first = TABLE_START + 1;
  const last = TABLE_START + rows.length;
  const total = ws.getRow(last + 1);
  total.height = 20;
  columns.forEach((col, i) => {
    const cell = total.getCell(i + 1);
    if (i === 0) cell.value = 'Total';
    if (col.total) {
      const letter = ws.getColumn(i + 1).letter;
      const result = rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
      cell.value = { formula: `SUM(${letter}${first}:${letter}${last})`, result: Math.round(result * 100) / 100 };
      cell.numFmt = col.type === 'money' ? MONEY : '#,##0.##';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    cell.font = font({ bold: true });
    cell.fill = fill(C.lightAmber);
    cell.border = { ...allThin, top: { style: 'thin', color: { argb: C.amber } } };
  });

  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: TABLE_START, xSplit: 0 }];
  ws.autoFilter = { from: { row: TABLE_START, column: 1 }, to: { row: TABLE_START, column: columns.length } };
};

const writeSummary = (wb, data, subtitle) => {
  const { project, profitability, labours, materials } = data;
  const ws = newSheet(wb, 'Summary', C.amber, [3, 30, 28, 4, 30, 6]);
  headerBand(ws, 6, 'Project report', subtitle);

  const fig = projectBudgetFigures(project, profitability, labours);
  const lines = materials.map(materialLine);
  const inputGst = lines.reduce((s, l) => s + l.gst, 0);

  // Left block: project details
  ws.getCell('B6').value = 'PROJECT DETAILS';
  ws.getCell('B6').font = font({ bold: true, size: 11 });
  ['B7', 'C7'].forEach((a) => {
    ws.getCell(a).border = { top: { style: 'medium', color: { argb: C.amber } } };
  });
  ws.getRow(7).height = 6;

  const customer = project.customer;
  const customerName =
    (customer && typeof customer === 'object' ? customer.businessName || customer.name : customer) || '-';
  const details = [
    ['Project code', project.projectCode || '-'],
    ['Project name', project.name || '-'],
    ['Customer', customerName],
    ['Site', project.siteAddress || '-'],
    ['Start date', toExcelDate(project.startDate) || '-'],
    ['Expected end', toExcelDate(project.expectedEndDate) || '-'],
    ['Status', STATUS_LABELS[project.status] || project.status || '-'],
  ];
  if (project.notes && String(project.notes).trim()) details.push(['Notes', String(project.notes).trim()]);

  let r = 8;
  details.forEach(([label, value]) => {
    const l = ws.getCell(r, 2);
    const v = ws.getCell(r, 3);
    l.value = label;
    l.font = font({ color: { argb: C.label } });
    v.value = value;
    const isDone = label === 'Status' && project.status === 'COMPLETED';
    v.font = font({ bold: true, ...(isDone ? { color: { argb: C.green } } : {}) });
    if (value instanceof Date) v.numFmt = DATE;
    v.alignment = { horizontal: 'left', vertical: 'middle', wrapText: label === 'Notes' || label === 'Site' };
    l.alignment = { vertical: 'middle' };
    [l, v].forEach((c) => {
      c.border = { bottom: thin };
    });
    ws.getRow(r).height = label === 'Notes' ? 32 : 20;
    r += 1;
  });

  // Right block: "at a glance" cards
  ws.getCell('E6').value = 'AT A GLANCE';
  ws.getCell('E6').font = font({ bold: true, size: 11 });

  const workers = labours.filter((l) => l.type !== 'CONTRACTOR').length;
  const contractors = labours.length - workers;
  const good = (n) => ({ argb: n >= 0 ? C.green : C.red });
  const cards = [
    { label: 'BUDGET (EXCL. GST)', value: fig.budget, numFmt: MONEY },
    { label: 'TOTAL COST', value: fig.totalSpent, numFmt: MONEY },
    { label: 'REMAINING', value: fig.remaining, numFmt: MONEY, color: good(fig.remaining) },
    { label: 'MARGIN', value: fig.marginLeft / 100, numFmt: '0.0%', color: good(fig.remaining) },
    { label: 'LABOUR ON SITE', value: `${plural(workers, 'worker')} · ${plural(contractors, 'contractor')}`, size: 13 },
  ];
  let cr = 7;
  cards.forEach((card, i) => {
    const labelRow = cr;
    const valueRow = cr + 1;
    [labelRow, valueRow].forEach((row) => {
      ws.getCell(row, 5).fill = fill(C.lightAmber);
      ws.getCell(row, 6).fill = fill(C.lightAmber);
      ws.getCell(row, 5).border = { left: { style: 'thick', color: { argb: C.amber } } };
    });
    const lc = ws.getCell(labelRow, 5);
    lc.value = card.label;
    lc.font = font({ bold: true, size: 9, color: { argb: C.cardLabel } });
    lc.alignment = { indent: 1, vertical: 'bottom' };
    const vc = ws.getCell(valueRow, 5);
    vc.value = card.value;
    vc.font = font({ bold: true, size: card.size || 16, ...(card.color ? { color: card.color } : {}) });
    if (card.numFmt) vc.numFmt = card.numFmt;
    vc.alignment = { horizontal: 'left', indent: 1, vertical: 'middle' };
    ws.getRow(labelRow).height = Math.max(ws.getRow(labelRow).height || 0, 16);
    ws.getRow(valueRow).height = 26;
    cr += i < cards.length - 1 ? 3 : 2;
  });

  // Cost breakdown under the details block
  let br = Math.max(r + 1, 17);
  ws.getCell(br, 2).value = 'COST BREAKDOWN';
  ws.getCell(br, 2).font = font({ bold: true, size: 11 });
  br += 1;
  const head = [ws.getCell(br, 2), ws.getCell(br, 3)];
  ['Item', 'Amount'].forEach((h, i) => {
    head[i].value = h;
    head[i].font = font({ bold: true, color: { argb: C.white } });
    head[i].fill = fill(C.header);
    head[i].alignment = { horizontal: 'center', vertical: 'middle' };
    head[i].border = allThin;
  });
  ws.getRow(br).height = 22;
  const items = [
    ['Inventory used (excl. GST)', fig.materialCost],
    ['Project expenses', fig.expenseCost],
    ['Labour', fig.labourCost],
  ];
  const firstItem = br + 1;
  items.forEach(([label, value], i) => {
    const row = br + 1 + i;
    const a = ws.getCell(row, 2);
    const b = ws.getCell(row, 3);
    a.value = label;
    b.value = Math.round(value * 100) / 100;
    b.numFmt = MONEY;
    b.alignment = { horizontal: 'right' };
    [a, b].forEach((c) => {
      c.font = font();
      c.fill = fill(i % 2 ? C.zebra : C.white);
      c.border = allThin;
    });
    ws.getRow(row).height = 18;
  });
  const totalRow = br + 1 + items.length;
  const ta = ws.getCell(totalRow, 2);
  const tb = ws.getCell(totalRow, 3);
  ta.value = 'Total cost';
  tb.value = { formula: `SUM(C${firstItem}:C${totalRow - 1})`, result: fig.totalSpent };
  tb.numFmt = MONEY;
  tb.alignment = { horizontal: 'right' };
  [ta, tb].forEach((c) => {
    c.font = font({ bold: true });
    c.fill = fill(C.lightAmber);
    c.border = { ...allThin, top: { style: 'thin', color: { argb: C.amber } } };
  });
  ws.getRow(totalRow).height = 20;
  const gstRow = totalRow + 1;
  const ga = ws.getCell(gstRow, 2);
  const gb = ws.getCell(gstRow, 3);
  ga.value = `Input GST on materials (${PROJECT_GST_RATE}%)`;
  gb.value = Math.round(inputGst * 100) / 100;
  gb.numFmt = MONEY;
  gb.alignment = { horizontal: 'right' };
  [ga, gb].forEach((c) => {
    c.font = font({ color: { argb: C.label } });
    c.border = allThin;
  });

  const note = ws.getCell(gstRow + 2, 2);
  note.value = 'All amounts are excl. GST. Workers = days × daily wage. Contractors = sq ft × rate.';
  note.font = font({ italic: true, size: 9, color: { argb: C.label } });
  ws.pageSetup.printArea = `A1:F${gstRow + 2}`;
};

const writeInventory = (wb, data, subtitle) => {
  const ws = newSheet(wb, 'Inventory used', C.header, [14, 34, 16, 9, 10, 14, 17, 15, 17]);
  headerBand(ws, 9, 'Inventory used on this project', subtitle);
  const lines = data.materials
    .map(materialLine)
    .sort((a, b) => (a.dateKey || '').localeCompare(b.dateKey || '') || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const rows = lines.map((l) => ({
    date: toExcelDate(l.issueDate),
    material: l.productName || l.product?.name || '-',
    sku: l.sku || l.product?.sku || '-',
    unit: l.unit || l.product?.unit || '-',
    qty: Number(l.quantity) || 0,
    unitCost: Number(l.actualCostPrice || 0),
    cost: l.cost,
    gst: l.gst,
    value: l.value,
  }));
  writeTable(
    ws,
    [
      { header: 'Date', key: 'date', type: 'date' },
      { header: 'Material', key: 'material' },
      { header: 'SKU', key: 'sku' },
      { header: 'Unit', key: 'unit', align: 'center' },
      { header: 'Qty', key: 'qty', type: 'number' },
      { header: 'Cost / unit', key: 'unitCost', type: 'money' },
      { header: 'Cost (excl. GST)', key: 'cost', type: 'money', total: true },
      { header: `GST ${PROJECT_GST_RATE}%`, key: 'gst', type: 'money', total: true },
      { header: 'Total (incl. GST)', key: 'value', type: 'money', total: true },
    ],
    rows
  );
};

const writeExpenses = (wb, data, subtitle) => {
  const ws = newSheet(wb, 'Expenses', C.header, [14, 20, 28, 16, 17]);
  headerBand(ws, 5, 'Project expenses', subtitle);
  const rows = [...data.expenses]
    .sort((a, b) => String(a.expenseDate || '').localeCompare(String(b.expenseDate || '')))
    .map((e) => ({
      date: toExcelDate(e.expenseDate),
      category: categoryLabel(e.category),
      vendor: e.vendorName || '-',
      bill: e.billNumber || '-',
      amount: Number(e.amount) || 0,
    }));
  writeTable(
    ws,
    [
      { header: 'Date', key: 'date', type: 'date' },
      { header: 'Category', key: 'category' },
      { header: 'Vendor', key: 'vendor' },
      { header: 'Bill no.', key: 'bill' },
      { header: 'Amount', key: 'amount', type: 'money', total: true },
    ],
    rows
  );
};

const writeLabour = (wb, data, subtitle) => {
  const ws = newSheet(wb, 'Labour', C.header, [26, 13, 15, 14, 14, 15, 17, 17]);
  headerBand(ws, 8, 'Labour on this project', subtitle);
  const projectEnd = data.project.expectedEndDate;
  const rows = data.labourRows.map((a) => {
    const isContractor = a.type === 'CONTRACTOR';
    return {
      name: a.name || '-',
      type: isContractor
        ? { value: 'Contractor', font: { bold: true, color: { argb: C.contractor } } }
        : { value: 'Worker', font: { bold: true, color: { argb: C.worker } } },
      mobile: a.mobile || '-',
      start: toExcelDate(a.startDate) || '-',
      end: toExcelDate(a.stoppedAt || projectEnd) || '-',
      measure: isContractor ? `${inr(a.areaSqFt)} sq ft` : plural(Number(a.earnedDays) || 0, 'day'),
      rate: isContractor ? `₹${inr(a.ratePerSqFt)} / sq ft` : `₹${inr(a.dailyWage)} / day`,
      amount: Math.round((Number(a.amount) || 0) * 100) / 100,
    };
  });
  writeTable(
    ws,
    [
      { header: 'Name', key: 'name' },
      { header: 'Type', key: 'type', align: 'center' },
      { header: 'Mobile', key: 'mobile', align: 'center' },
      { header: 'Start', key: 'start', type: 'date' },
      { header: 'End', key: 'end', type: 'date' },
      { header: 'Days / Area', key: 'measure', align: 'right' },
      { header: 'Rate', key: 'rate', align: 'right' },
      { header: 'Total amount', key: 'amount', type: 'money', total: true },
    ],
    rows
  );
};

/**
 * data: { project, profitability, materials, expenses,
 *         labours (rows from /projects/:id/labours),
 *         labourRows (one per assignment: name, type, mobile, startDate, stoppedAt,
 *                     earnedDays, dailyWage, areaSqFt, ratePerSqFt, amount) }
 */
export const buildProjectReportWorkbook = (ExcelJS, data, now = new Date()) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Arham Electrical & Lighting';
  wb.created = now;
  const { project } = data;
  const subtitle = `${project.projectCode || '-'} · ${project.name || '-'} · Exported ${formatDateShortMonth(now)}`;
  writeSummary(wb, data, subtitle);
  writeInventory(wb, data, subtitle);
  writeExpenses(wb, data, subtitle);
  writeLabour(wb, data, subtitle);
  return wb;
};

export const projectReportFileName = (project, now = new Date()) => {
  const p = parseDateParts(now);
  const clean = (s) =>
    String(s || '')
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim()
      .replace(/\s+/g, '_');
  return `${clean(project.projectCode) || 'project'}_${clean(project.name) || 'report'}_report_${p.day}-${p.month}-${p.year}.xlsx`;
};
