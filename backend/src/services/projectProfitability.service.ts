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
  revenue: number;
  totalMaterialCost: number;
  totalProjectExpenses: number;
  totalProjectCost: number;
  expenseCategoryBreakdown: Record<string, number>;
  grossProfit: number;
  grossMargin: number;
  totalInvoiced: number;
  totalReceived: number;
  outstanding: number;
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

  // 1. Material Actual Cost (using actualCostTotal)
  const matAgg = await MaterialConsumption.aggregate([
    { $match: { project: projIdObj } },
    { $group: { _id: null, totalMaterialCost: { $sum: '$actualCostTotal' } } },
  ]);
  const totalMaterialCost = matAgg.length > 0 ? Math.round(Number(matAgg[0].totalMaterialCost) * 100) / 100 : 0;

  // 2. Project Expenses & Category Breakdown (using amount)
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

  const totalProjectCost = Math.round((totalMaterialCost + totalProjectExpenses) * 100) / 100;

  // 3. Project Revenue (sum of grandTotal for non-cancelled invoices)
  const invAgg = await ProjectInvoice.aggregate([
    { $match: { project: projIdObj, status: { $ne: 'CANCELLED' } } },
    { $group: { _id: null, totalRevenue: { $sum: '$grandTotal' } } },
  ]);
  const revenue = invAgg.length > 0 ? Math.round(Number(invAgg[0].totalRevenue) * 100) / 100 : 0;
  const totalInvoiced = revenue;

  // 4. Total Collections / Received (sum of payments for non-cancelled invoices of project)
  const pmtAgg = await ProjectInvoicePayment.aggregate([
    { $match: { project: projIdObj } },
    { $group: { _id: null, totalReceived: { $sum: '$amount' } } },
  ]);
  const totalReceived = pmtAgg.length > 0 ? Math.round(Number(pmtAgg[0].totalReceived) * 100) / 100 : 0;

  // 5. Outstanding
  const outstanding = Math.max(0, Math.round((revenue - totalReceived) * 100) / 100);

  // 6. Gross Profit & Margin
  const grossProfit = Math.round((revenue - totalProjectCost) * 100) / 100;
  const rawMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const grossMargin = Math.round(rawMargin * 100) / 100;

  return {
    projectId: project._id.toString(),
    projectName: project.name,
    projectCode: project.projectCode,
    status: project.status,
    customerName: (project.customer as any)?.name || 'N/A',
    siteAddress: project.siteAddress,
    revenue,
    totalMaterialCost,
    totalProjectExpenses,
    totalProjectCost,
    expenseCategoryBreakdown,
    grossProfit,
    grossMargin,
    totalInvoiced,
    totalReceived,
    outstanding,
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
