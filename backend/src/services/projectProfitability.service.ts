import mongoose from 'mongoose';
import { Project } from '../models/Project';
import { MaterialConsumption } from '../models/MaterialConsumption';
import { ProjectExpense } from '../models/ProjectExpense';
import { ProjectInvoice } from '../models/ProjectInvoice';
import { ProjectInvoicePayment } from '../models/ProjectInvoicePayment';
import { PROJECT_GST_MULTIPLIER, roundToTwo } from '../constants/projectGst.constants';

export interface ICategoryCost {
  category: string;
  amount: number;
}

export interface IProjectProfitability {
  projectId: string;
  projectName: string;
  projectCode: string;
  status: string;
  customerName?: string;
  siteAddress?: string;
  startDate?: Date;
  expectedEndDate?: Date;

  // Authoritative Budget vs Actual Cost Profitability (GST-Exclusive)
  projectBudget: number;
  totalMaterialCost: number;
  totalProjectExpenses: number;
  totalLabourCost: number;
  actualProjectCost: number;
  remainingBudget: number;
  projectProfit: number; // Backward-compatibility alias to remainingBudget
  projectMargin: number;

  // Separate GST Tracking (Isolated from project budget and expenditure)
  inputGstPurchasedMaterials: number | null; // Purchase reference only (not project claimable)
  inputGstIssuedMaterials: number; // Proportional GST on issued materials
  totalInputGstClaimable: number; // Equal to inputGstIssuedMaterials
  issuedMaterialValueIncludingGST: number; // actualCostTotal + inputGst
  totalSupplierInvoiceValue: number; // Alias to issuedMaterialValueIncludingGST
  missingGstCount: number; // Count of historical records missing GST data

  // Expense Breakdown
  expenseCategoryBreakdown: Record<string, number>;

  // Invoicing & Collections (Independent Tracking)
  totalInvoiced: number;
  totalReceived: number;
  outstanding: number;

  // Backward-compatibility aliases
  revenue: number; // Aliased to projectBudget for profitability context
  totalProjectCost: number; // Aliased to actualProjectCost
  grossProfit: number; // Aliased to remainingBudget
  grossMargin: number; // Aliased to projectMargin
  totalProjectCostExcludingGST: number; // Aliased to actualProjectCost
  materialCostExcludingGST: number; // Aliased to totalMaterialCost
}

export const getProjectProfitability = async (projectId: string): Promise<IProjectProfitability> => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const project = await Project.findById(projectId).populate('customer', 'name businessName').lean();
  if (!project) {
    const error = new Error('Project not found');
    (error as any).statusCode = 404;
    throw error;
  }

  const projIdObj = new mongoose.Types.ObjectId(projectId);

  // 1. Project Budget (Authoritative revenue/budget baseline)
  const projectBudget = Math.round(Number(project.budget || 0) * 100) / 100;

  // 2. Material Actual Cost & Input GST (@ Fixed 18% Business Rule)
  const consumptions = await MaterialConsumption.find({ project: projIdObj }).lean();

  let totalMaterialCost = 0;
  let inputGstIssuedMaterials = 0;
  let issuedMaterialValueIncludingGST = 0;

  for (const mc of consumptions) {
    const actTotal = roundToTwo(Number(mc.actualCostTotal || 0));
    totalMaterialCost += actTotal;

    // Fixed 18% GST business rule
    const lineInputGst = roundToTwo(actTotal * PROJECT_GST_MULTIPLIER);
    inputGstIssuedMaterials += lineInputGst;

    const lineIssuedValue = roundToTwo(actTotal + lineInputGst);
    issuedMaterialValueIncludingGST += lineIssuedValue;
  }

  totalMaterialCost = roundToTwo(totalMaterialCost);
  inputGstIssuedMaterials = roundToTwo(inputGstIssuedMaterials);
  issuedMaterialValueIncludingGST = roundToTwo(issuedMaterialValueIncludingGST);
  const totalInputGstClaimable = inputGstIssuedMaterials;
  const inputGstPurchasedMaterials = null;
  const missingGstCount = 0;

  // 3. Project Expenses & Category Breakdown (using amount from ProjectExpense)
  const expAgg = await ProjectExpense.aggregate([
    { $match: { project: projIdObj } },
    { $group: { _id: '$category', categoryTotal: { $sum: '$amount' } } },
  ]);

  const expenseCategoryBreakdown: Record<string, number> = {
    TRANSPORT: 0,
    LABOUR: 0,
    MACHINERY_RENTAL: 0,
    LOADING_UNLOADING: 0,
    SITE_EXPENSE: 0,
    MISCELLANEOUS: 0,
    OTHER: 0,
  };

  let totalProjectExpenses = 0;
  expAgg.forEach((item: any) => {
    const cat = item._id;
    const catTotal = Math.round(Number(item.categoryTotal) * 100) / 100;
    if (cat in expenseCategoryBreakdown) {
      expenseCategoryBreakdown[cat] = catTotal;
    } else {
      expenseCategoryBreakdown[cat] = catTotal;
    }
    totalProjectExpenses += catTotal;
  });
  totalProjectExpenses = Math.round(totalProjectExpenses * 100) / 100;

  // 5. Labour Cost (Direct labour placeholder)
  const totalLabourCost = 0;

  // 6. Actual Project Cost = Material Cost (Excl. GST) + Project Expenses + Labour Cost
  // Invariant: GST is NEVER included in project expenditure
  const actualProjectCost = Math.round((totalMaterialCost + totalProjectExpenses + totalLabourCost) * 100) / 100;

  // 7. Remaining Budget = Project Budget - Actual Project Cost
  const remainingBudget = Math.round((projectBudget - actualProjectCost) * 100) / 100;
  const projectProfit = remainingBudget; // Aliased for backward compatibility with existing tests

  // 8. Project Margin = (Remaining Budget / Project Budget) * 100 (Safe 0 on zero/invalid budget)
  let projectMargin = 0;
  if (projectBudget > 0) {
    const rawMargin = (remainingBudget / projectBudget) * 100;
    projectMargin = Math.round(rawMargin * 100) / 100;
  }

  // 9. Invoicing & Collections (Independent tracking, does not alter operational cost or budget)
  const invAgg = await ProjectInvoice.aggregate([
    { $match: { project: projIdObj, status: { $ne: 'CANCELLED' } } },
    { $group: { _id: null, totalInvoiced: { $sum: '$grandTotal' } } },
  ]);
  const totalInvoiced = invAgg.length > 0 ? Math.round(Number(invAgg[0].totalInvoiced) * 100) / 100 : 0;

  const pmtAgg = await ProjectInvoicePayment.aggregate([
    { $match: { project: projIdObj } },
    { $group: { _id: null, totalReceived: { $sum: '$amount' } } },
  ]);
  const totalReceived = pmtAgg.length > 0 ? Math.round(Number(pmtAgg[0].totalReceived) * 100) / 100 : 0;

  const outstanding = Math.max(0, Math.round((totalInvoiced - totalReceived) * 100) / 100);

  return {
    projectId: project._id.toString(),
    projectName: project.name,
    projectCode: project.projectCode,
    status: project.status,
    customerName: (project.customer as any)?.name || 'N/A',
    siteAddress: project.siteAddress,
    startDate: project.startDate,
    expectedEndDate: project.expectedEndDate,

    // Authoritative Budget vs Actual Cost fields (GST-Exclusive)
    projectBudget,
    totalMaterialCost,
    totalProjectExpenses,
    totalLabourCost,
    actualProjectCost,
    remainingBudget,
    projectProfit,
    projectMargin,

    // Separate GST Tracking
    inputGstPurchasedMaterials,
    inputGstIssuedMaterials,
    totalInputGstClaimable,
    issuedMaterialValueIncludingGST,
    totalSupplierInvoiceValue: issuedMaterialValueIncludingGST,
    missingGstCount,

    expenseCategoryBreakdown,

    // Independent Invoicing & Payment tracking
    totalInvoiced,
    totalReceived,
    outstanding,

    // Backward-compatibility aliases
    revenue: projectBudget,
    totalProjectCost: actualProjectCost,
    grossProfit: projectProfit,
    grossMargin: projectMargin,
    totalProjectCostExcludingGST: actualProjectCost,
    materialCostExcludingGST: totalMaterialCost,
  };
};

export const getAllProjectsProfitabilityReport = async (): Promise<IProjectProfitability[]> => {
  const projects = await Project.find().select('_id').lean();
  const results: IProjectProfitability[] = [];

  for (const p of projects) {
    try {
      const prof = await getProjectProfitability(p._id.toString());
      results.push(prof);
    } catch (_err) {
      continue;
    }
  }

  return results;
};
