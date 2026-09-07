import mongoose from 'mongoose';
import { Project } from '../models/Project';
import { MaterialConsumption } from '../models/MaterialConsumption';
import { ProjectExpense } from '../models/ProjectExpense';
import { ProjectInvoice } from '../models/ProjectInvoice';
import { ProjectInvoicePayment } from '../models/ProjectInvoicePayment';

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

  // Authoritative Budget vs Actual Cost Profitability
  projectBudget: number;
  totalMaterialCost: number;
  totalProjectExpenses: number;
  totalLabourCost: number;
  actualProjectCost: number;
  projectProfit: number;
  projectMargin: number;

  // Expense Breakdown
  expenseCategoryBreakdown: Record<string, number>;

  // Invoicing & Collections (Independent Tracking)
  totalInvoiced: number;
  totalReceived: number;
  outstanding: number;

  // Backward-compatibility aliases
  revenue: number; // Aliased to projectBudget for profitability context
  totalProjectCost: number; // Aliased to actualProjectCost
  grossProfit: number; // Aliased to projectProfit
  grossMargin: number; // Aliased to projectMargin
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

  // 2. Material Actual Cost (using actualCostTotal from MaterialConsumption)
  const matAgg = await MaterialConsumption.aggregate([
    { $match: { project: projIdObj } },
    { $group: { _id: null, totalMaterialCost: { $sum: '$actualCostTotal' } } },
  ]);
  const totalMaterialCost = matAgg.length > 0 ? Math.round(Number(matAgg[0].totalMaterialCost) * 100) / 100 : 0;

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

  // 4. Labour Cost (Dedicated Labour system placeholder; if separate model is built later, connect here)
  const totalLabourCost = 0;

  // 5. Actual Project Cost = Material Cost + Project Expenses + Labour Cost
  const actualProjectCost = Math.round((totalMaterialCost + totalProjectExpenses + totalLabourCost) * 100) / 100;

  // 6. Project Profit = Project Budget - Actual Project Cost (Negative values valid and preserved)
  const projectProfit = Math.round((projectBudget - actualProjectCost) * 100) / 100;

  // 7. Project Margin = (Project Profit / Project Budget) * 100 (Safe 0 on zero/invalid budget)
  let projectMargin = 0;
  if (projectBudget > 0) {
    const rawMargin = (projectProfit / projectBudget) * 100;
    projectMargin = Math.round(rawMargin * 100) / 100;
  }

  // 8. Invoicing & Collections (Independent tracking, does not alter operational profitability)
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

    // Authoritative Budget vs Actual Cost fields
    projectBudget,
    totalMaterialCost,
    totalProjectExpenses,
    totalLabourCost,
    actualProjectCost,
    projectProfit,
    projectMargin,

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
  };
};

export const getAllProjectsProfitabilityReport = async (): Promise<IProjectProfitability[]> => {
  const projects = await Project.find().select('_id').lean();
  const results: IProjectProfitability[] = [];

  for (const p of projects) {
    const prof = await getProjectProfitability(p._id.toString());
    results.push(prof);
  }

  return results;
};
