/**
 * Project money helpers shared by the Project Details page and the Excel project report,
 * so both always show the same numbers.
 */
import { PROJECT_GST_MULTIPLIER, roundToTwo } from './projectGst.constants.js';
import { toApiDateFormat } from './dateUtils.js';

const capitalise = (text) => (text ? text.trim().charAt(0).toUpperCase() + text.trim().slice(1) : '');

export const CATEGORY_SHORT = {
  TRANSPORT: 'Transport',
  LABOUR: 'Labour',
  MACHINERY_RENTAL: 'Machinery rental',
  LOADING_UNLOADING: 'Loading',
  SITE_EXPENSE: 'Site expense',
  MISCELLANEOUS: 'Misc',
  OTHER: 'Other',
};
export const categoryLabel = (cat) => CATEGORY_SHORT[cat] || capitalise((cat || '').replace(/_/g, ' ').toLowerCase());

// Each issue's money split, falling back to the fixed 18% rule for older records
export const materialLine = (m) => {
  const cost = m.actualCostTotal !== undefined ? Number(m.actualCostTotal) : Number(m.quantity) * Number(m.actualCostPrice || 0);
  const gst = m.inputGst != null ? Number(m.inputGst) : roundToTwo(cost * PROJECT_GST_MULTIPLIER);
  const value = m.issuedMaterialValueIncludingGST != null ? Number(m.issuedMaterialValueIncludingGST) : roundToTwo(cost + gst);
  return { ...m, cost, gst, value, dateKey: toApiDateFormat(m.issueDate) || '' };
};

// Wages / contract amounts earned so far, as returned by /projects/:id/labours
export const sumLabourEarned = (labours) => labours.reduce((sum, l) => sum + (Number(l.totalEarned) || 0), 0);

// Labour cost = wages earned so far (same numbers as the Labour tab), so Overview
// is right even when the backend total is older
export const projectBudgetFigures = (project, profitability, labours) => {
  const labourCost = sumLabourEarned(labours);
  const budget = profitability
    ? profitability.projectBudget !== undefined ? profitability.projectBudget : project?.budget || 0
    : 0;
  const materialCost = profitability?.totalMaterialCost || 0;
  const expenseCost = profitability?.totalProjectExpenses || 0;
  const totalSpent = roundToTwo(materialCost + expenseCost + labourCost);
  const remaining = roundToTwo(budget - totalSpent);
  const marginLeft = budget > 0 ? roundToTwo((remaining / budget) * 100) : 0;
  return { budget, materialCost, expenseCost, labourCost, totalSpent, remaining, marginLeft };
};
