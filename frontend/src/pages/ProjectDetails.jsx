import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import {
  FaBuilding,
  FaArrowLeft,
  FaEdit,
  FaUserCheck,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaRupeeSign,
  FaBoxOpen,
  FaPlus,
  FaTimes,
  FaSpinner,
  FaReceipt,
  FaFileInvoiceDollar,
  FaMoneyCheckAlt,
  FaExclamationTriangle,
  FaCheck,
  FaTag
} from 'react-icons/fa';

const STATUS_BADGES = {
  PLANNING: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ON_HOLD: 'bg-amber-100 text-amber-800 border-amber-200',
  COMPLETED: 'bg-purple-100 text-purple-800 border-purple-200',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
};

const EXPENSE_CATEGORIES = [
  { value: 'TRANSPORT', label: 'Transport / Freight' },
  { value: 'LABOUR', label: 'Labour / Manpower' },
  { value: 'MACHINERY_RENTAL', label: 'Machinery / Equipment Rental' },
  { value: 'LOADING_UNLOADING', label: 'Loading / Unloading' },
  { value: 'SITE_EXPENSE', label: 'Site / Operational Expense' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
  { value: 'OTHER', label: 'Other Expenses' },
];

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [profitability, setProfitability] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Material Issue Modal State
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [submittingMaterial, setSubmittingMaterial] = useState(false);
  const [materialModalError, setMaterialModalError] = useState(null);

  const [issueForm, setIssueForm] = useState({
    productId: '',
    quantity: '',
    billingPrice: '',
    issueDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseModalError, setExpenseModalError] = useState(null);

  const [expenseForm, setExpenseForm] = useState({
    category: 'TRANSPORT',
    description: '',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    vendorName: '',
    billNumber: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, matRes, expRes, invRes, profRes, prodRes] = await Promise.all([
        axiosInstance.get(`/projects/${id}`),
        axiosInstance.get(`/projects/${id}/material-consumptions`),
        axiosInstance.get(`/projects/${id}/expenses`),
        axiosInstance.get(`/projects/${id}/invoices`),
        axiosInstance.get(`/projects/${id}/profitability`),
        axiosInstance.get('/products'),
      ]);

      setProject(projRes.data.data);
      setMaterials(matRes.data.data || []);
      setExpenses(expRes.data.data || []);
      setInvoices(invRes.data.data || []);
      setProfitability(profRes.data.data);
      setProducts(prodRes.data.data || []);
    } catch (err) {
      console.error('Error loading project details:', err);
      setError(getErrorMessage(err, 'Failed to load project details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && id !== 'new') {
      fetchData();
    }
  }, [id]);

  // Material Handlers
  const handleProductChange = (e) => {
    const pId = e.target.value;
    const prod = products.find((p) => (p.id || p._id) === pId) || null;
    setSelectedProduct(prod);

    setIssueForm((prev) => ({
      ...prev,
      productId: pId,
      billingPrice: prod ? String(prod.sellingPrice !== undefined ? prod.sellingPrice : (prod.unitPrice || 0)) : '',
    }));
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setMaterialModalError(null);

    if (!issueForm.productId) {
      setMaterialModalError('Please select a product to issue.');
      return;
    }
    const qty = Number(issueForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      setMaterialModalError('Quantity must be greater than 0.');
      return;
    }
    if (selectedProduct && qty > selectedProduct.currentStock) {
      setMaterialModalError(`Insufficient stock. Available: ${selectedProduct.currentStock} ${selectedProduct.unit || 'units'}`);
      return;
    }

    setSubmittingMaterial(true);

    const payload = {
      project: id,
      product: issueForm.productId,
      quantity: qty,
      billingPrice: issueForm.billingPrice !== '' ? Number(issueForm.billingPrice) : undefined,
      issueDate: issueForm.issueDate || undefined,
      notes: issueForm.notes ? issueForm.notes.trim() : undefined,
    };

    try {
      await axiosInstance.post('/material-consumptions', payload);
      toast.success('Material issued to project successfully!');
      setIsMaterialModalOpen(false);

      setIssueForm({
        productId: '',
        quantity: '',
        billingPrice: '',
        issueDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setSelectedProduct(null);

      fetchData();
    } catch (err) {
      console.error('Error issuing material:', err);
      const errMsg = getErrorMessage(err, 'Failed to issue material to project.');
      setMaterialModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmittingMaterial(false);
    }
  };

  // Expense Handlers
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setExpenseModalError(null);

    if (!expenseForm.category) {
      setExpenseModalError('Please select an expense category.');
      return;
    }
    if (!expenseForm.description.trim()) {
      setExpenseModalError('Please provide an expense description.');
      return;
    }
    const amt = Number(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setExpenseModalError('Amount must be greater than 0.');
      return;
    }

    setSubmittingExpense(true);

    const payload = {
      project: id,
      category: expenseForm.category,
      description: expenseForm.description.trim(),
      amount: amt,
      expenseDate: expenseForm.expenseDate || undefined,
      vendorName: expenseForm.vendorName ? expenseForm.vendorName.trim() : undefined,
      billNumber: expenseForm.billNumber ? expenseForm.billNumber.trim() : undefined,
      notes: expenseForm.notes ? expenseForm.notes.trim() : undefined,
    };

    try {
      await axiosInstance.post('/project-expenses', payload);
      toast.success('Project expense recorded successfully!');
      setIsExpenseModalOpen(false);

      setExpenseForm({
        category: 'TRANSPORT',
        description: '',
        amount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        vendorName: '',
        billNumber: '',
        notes: '',
      });

      fetchData();
    } catch (err) {
      console.error('Error recording project expense:', err);
      const errMsg = getErrorMessage(err, 'Failed to record project expense.');
      setExpenseModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmittingExpense(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
        <p className="text-sm text-gray-400 font-medium">Loading project information...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="p-8 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
          <FaExclamationTriangle className="text-rose-500 text-4xl mx-auto" />
          <h3 className="text-lg font-extrabold text-slate-900">Project Not Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">{error || 'The requested project could not be found.'}</p>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center space-x-2"
          >
            <FaArrowLeft className="text-xs" />
            <span>Back to Projects Directory</span>
          </button>
        </div>
      </div>
    );
  }

  const startDateStr = project.startDate
    ? new Date(project.startDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '-';
  const endDateStr = project.expectedEndDate
    ? new Date(project.expectedEndDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Ongoing';
  const badgeStyle = STATUS_BADGES[project.status] || 'bg-gray-100 text-gray-800 border-gray-200';

  // Calculate Material Consumption Totals
  const totalActualCost = materials.reduce((sum, m) => sum + (m.actualCostTotal || 0), 0);
  const totalBillingValue = materials.reduce((sum, m) => sum + (m.billingTotal || 0), 0);

  // Calculate Project Expense Totals
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Group Category Totals
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {});

  const isClosedProject = project.status === 'COMPLETED' || project.status === 'CANCELLED';

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-semibold mb-1 flex items-center space-x-1">
            <Link to="/projects" className="hover:text-emerald-600">Projects</Link>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">{project.projectCode}</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg shadow-sm">
              <FaBuilding />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">{project.name}</h2>
              <span className="font-mono text-xs text-emerald-700 font-bold">{project.projectCode}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all flex items-center space-x-2 bg-white"
          >
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${project.id}/edit`)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2"
          >
            <FaEdit />
            <span>Edit Project</span>
          </button>
        </div>
      </div>

      {/* SECTION 1 — PROJECT INFORMATION SUMMARY CARD */}
      <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <FaBuilding className="text-emerald-600 text-xs" />
            <span>Project Overview</span>
          </h3>
          <span className={`px-3 py-1 text-xs font-extrabold rounded-lg border ${badgeStyle}`}>
            {project.status.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
          {/* Site Location */}
          <div className="space-y-1 md:col-span-2">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">CONSTRUCTION SITE LOCATION</span>
            <div className="font-extrabold text-slate-900 flex items-center space-x-1.5">
              <FaMapMarkerAlt className="text-emerald-600 text-xs flex-shrink-0" />
              <span>{project.siteAddress}</span>
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">START DATE</span>
            <div className="font-extrabold text-slate-900 flex items-center space-x-1.5">
              <FaCalendarAlt className="text-emerald-600 text-xs" />
              <span>{startDateStr}</span>
            </div>
          </div>

          {/* Expected End Date */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">EXPECTED COMPLETION</span>
            <div className="font-extrabold text-slate-900 flex items-center space-x-1.5">
              <FaCalendarAlt className="text-gray-400 text-xs" />
              <span>{endDateStr}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs pt-2 border-t border-gray-50">
          {/* Target Budget */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">TARGET BUDGET</span>
            <div className="font-black text-slate-900 text-sm flex items-center">
              {project.budget !== undefined && project.budget !== null ? (
                <>
                  <FaRupeeSign className="text-xs text-gray-400 mr-0.5" />
                  {Number(project.budget).toLocaleString('en-IN')}
                </>
              ) : (
                <span className="text-gray-400 font-normal">Unspecified</span>
              )}
            </div>
          </div>

          {/* Created By */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">CREATED BY</span>
            <div className="font-semibold text-slate-700">
              {project.creator?.name || 'System Admin'} ({project.creator?.role || 'ADMIN'})
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1 md:col-span-2">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">NOTES / SCOPE</span>
            <div className="font-medium text-gray-700 italic">
              {project.notes ? project.notes : <span className="text-gray-300 font-normal">No additional notes</span>}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 — CUSTOMER / CLIENT INFORMATION CARD */}
      <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 border-b border-gray-100 pb-3 flex items-center space-x-2">
          <FaUserCheck className="text-emerald-600 text-xs" />
          <span>Client & Customer Details</span>
        </h3>

        {project.customer ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
            <div>
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">CLIENT NAME</span>
              <div className="font-extrabold text-slate-900 text-sm">{project.customer.name}</div>
              {project.customer.businessName && (
                <div className="text-gray-500 font-semibold mt-0.5">{project.customer.businessName}</div>
              )}
            </div>

            <div>
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">GSTIN</span>
              <div className="font-mono font-bold text-slate-900">
                {project.customer.gstNumber ? project.customer.gstNumber : <span className="text-gray-400 font-normal">Not Provided</span>}
              </div>
            </div>

            <div>
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">CONTACT PHONE / EMAIL</span>
              <div className="font-bold text-slate-900">{project.customer.mobile}</div>
              {project.customer.email && <div className="text-gray-500">{project.customer.email}</div>}
            </div>

            <div>
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">BILLING ADDRESS</span>
              <div className="font-medium text-gray-700">
                {project.customer.address ? project.customer.address : <span className="text-gray-400 font-normal">Not Provided</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">No client profile associated with this project.</div>
        )}
      </div>

      {/* SECTION 2.5 — FINANCIAL OVERVIEW & PROFITABILITY KPI CARDS */}
      {profitability && (
        <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <FaFileInvoiceDollar className="text-emerald-600 text-xs" />
              <span>Project Financial Overview & Profitability</span>
            </h3>
            <span className={`px-2.5 py-0.5 rounded text-[11px] font-black ${
              profitability.grossProfit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              Margin: {profitability.grossMargin}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">TOTAL BILLED</span>
              <div className="text-base font-black text-emerald-900 font-mono">
                ₹{profitability.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-emerald-600">Active invoice totals</span>
            </div>

            <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">TOTAL RECEIVED</span>
              <div className="text-base font-black text-blue-900 font-mono">
                ₹{profitability.totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-blue-600">Collected payments</span>
            </div>

            <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">OUTSTANDING</span>
              <div className="text-base font-black text-amber-900 font-mono">
                ₹{profitability.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-amber-700">Uncollected balance</span>
            </div>

            <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">ACTUAL COST</span>
              <div className="text-base font-black text-slate-900 font-mono">
                ₹{profitability.totalProjectCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-slate-500">Materials + Expenses</span>
            </div>

            <div className={`p-3.5 border rounded-xl space-y-1 ${
              profitability.grossProfit >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
            }`}>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                profitability.grossProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}>GROSS PROFIT</span>
              <div className={`text-base font-black font-mono ${
                profitability.grossProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'
              }`}>
                ₹{profitability.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-gray-500">Revenue - Actual Cost</span>
            </div>

            <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider">GROSS MARGIN</span>
              <div className="text-base font-black text-purple-900 font-mono">
                {profitability.grossMargin}%
              </div>
              <span className="text-[9px] text-purple-600">Profit / Revenue %</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3 — MATERIALS USED & CONSUMPTION LEDGER */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <FaBoxOpen className="text-emerald-600" />
              <span>Materials Consumption Ledger</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Internal inventory stock issued from central warehouse to this construction site.
            </p>
          </div>

          <button
            type="button"
            disabled={isClosedProject}
            onClick={() => setIsMaterialModalOpen(true)}
            title={isClosedProject ? `Cannot issue materials to a ${project.status} project` : 'Issue Material'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-40"
          >
            <FaPlus className="text-xs" />
            <span>+ Issue Material to Project</span>
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">TOTAL MATERIAL COST</span>
            <div className="text-lg font-black text-slate-900 font-mono">
              ₹{totalActualCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-gray-400">Actual inventory procurement cost</span>
          </div>

          <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">TOTAL BILLING VALUE</span>
            <div className="text-lg font-black text-emerald-700 font-mono">
              ₹{totalBillingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-600">Target customer billing value</span>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">MATERIALS ISSUED</span>
            <div className="text-lg font-black text-slate-900 font-mono">
              {materials.length} <span className="text-xs font-normal text-gray-500">batches</span>
            </div>
            <span className="text-[10px] text-gray-400">Stock transfers to site</span>
          </div>
        </div>

        {/* Material History Table */}
        {materials.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/40 space-y-2">
            <p className="text-xs font-bold text-gray-600">No material consumption recorded yet.</p>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Click "+ Issue Material to Project" to record stock transferred from central inventory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs text-gray-600 min-w-[750px]">
              <thead className="bg-gray-50 font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Material / Product</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3 text-right">Actual Cost (₹)</th>
                  <th className="p-3 text-right">Billing Rate (₹)</th>
                  <th className="p-3 text-right">Billing Total (₹)</th>
                  <th className="p-3 text-right">Issued By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {materials.map((m) => {
                  const dStr = m.issueDate
                    ? new Date(m.issueDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '-';
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 text-gray-500 font-mono">{dStr}</td>
                      <td className="p-3">
                        <span className="font-extrabold text-slate-900 block">{m.productName}</span>
                        <span className="text-[10px] font-mono text-gray-400">SKU: {m.sku}</span>
                      </td>
                      <td className="p-3 text-center font-extrabold text-slate-900">{m.quantity}</td>
                      <td className="p-3 text-gray-600 font-semibold">{m.unit}</td>
                      <td className="p-3 text-right font-bold text-slate-700">₹{m.actualCostPrice.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">₹{m.billingPrice.toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-slate-900">
                        ₹{m.billingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right text-gray-500 text-[11px]">
                        {m.issuedBy?.name || 'Warehouse Staff'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 4 — PROJECT EXPENSES LEDGER */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <FaReceipt className="text-blue-600" />
              <span>Project Expenses Ledger</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Non-inventory operational costs incurred by company for transport, labour, rental & site operations.
            </p>
          </div>

          <button
            type="button"
            disabled={isClosedProject}
            onClick={() => setIsExpenseModalOpen(true)}
            title={isClosedProject ? `Cannot add expenses to a ${project.status} project` : 'Add Expense'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-40"
          >
            <FaPlus className="text-xs" />
            <span>+ Add Project Expense</span>
          </button>
        </div>

        {/* Expense Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">TOTAL PROJECT EXPENSES</span>
            <div className="text-lg font-black text-blue-900 font-mono">
              ₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-blue-600">Total non-inventory operational expenditure</span>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">EXPENSE ENTRIES</span>
            <div className="text-lg font-black text-slate-900 font-mono">
              {expenses.length} <span className="text-xs font-normal text-gray-500">records</span>
            </div>
            <span className="text-[10px] text-gray-400">Total expense vouchers logged</span>
          </div>
        </div>

        {/* Category Breakdown Pills */}
        {expenses.length > 0 && (
          <div className="p-3 bg-gray-50/80 border border-gray-100 rounded-xl space-y-2">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center space-x-1">
              <FaTag className="text-gray-400 text-[9px]" />
              <span>Category Expense Totals</span>
            </span>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              {Object.entries(categoryTotals).map(([cat, amt]) => (
                <div key={cat} className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-slate-800 flex items-center space-x-1.5 shadow-2xs">
                  <span className="text-gray-500 text-[10px] uppercase font-bold">{cat.replace('_', ' ')}:</span>
                  <span className="font-mono text-emerald-700 font-extrabold">₹{Number(amt).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expenses Table */}
        {expenses.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/40 space-y-2">
            <p className="text-xs font-bold text-gray-600">No project expenses recorded yet.</p>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Click "+ Add Project Expense" to log transport, labour, or machinery rental costs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs text-gray-600 min-w-[750px]">
              <thead className="bg-gray-50 font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Expense Date</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Vendor / Party</th>
                  <th className="p-3">Bill No.</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3 text-right">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {expenses.map((e) => {
                  const dStr = e.expenseDate
                    ? new Date(e.expenseDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '-';
                  return (
                    <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 text-gray-500 font-mono">{dStr}</td>
                      <td className="p-3 font-extrabold">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px]">
                          {e.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-slate-900 font-bold">{e.description}</td>
                      <td className="p-3 text-gray-600 font-semibold">{e.vendorName || '-'}</td>
                      <td className="p-3 font-mono text-gray-500 text-[11px]">{e.billNumber || '-'}</td>
                      <td className="p-3 text-right font-black text-blue-900 text-sm">
                        ₹{Number(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right text-gray-500 text-[11px]">
                        {e.createdBy?.name || 'Accounts Staff'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 5 — PROJECT INVOICES LEDGER */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <FaFileInvoiceDollar className="text-emerald-600" />
              <span>Project Invoices & Billing</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Customer invoices generated for materials consumed, site expenses & professional fees.
            </p>
          </div>

          <button
            type="button"
            disabled={project.status === 'CANCELLED'}
            onClick={() => navigate(`/projects/${project.id}/invoices/new`)}
            title={project.status === 'CANCELLED' ? 'Cannot generate invoice for a CANCELLED project' : 'Create Project Invoice'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-40"
          >
            <FaPlus className="text-xs" />
            <span>+ Create Project Invoice</span>
          </button>
        </div>

        {/* Invoice Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">TOTAL BILLED</span>
            <div className="text-lg font-black text-emerald-900 font-mono">
              ₹{invoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-600">Total customer invoices generated</span>
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">TOTAL RECEIVED</span>
            <div className="text-lg font-black text-blue-900 font-mono">
              ₹{invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-blue-600">Total customer payments collected</span>
          </div>

          <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">OUTSTANDING BALANCE</span>
            <div className="text-lg font-black text-amber-900 font-mono">
              ₹{invoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-amber-700">Unpaid customer balance</span>
          </div>
        </div>

        {/* Invoices Table */}
        {invoices.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/40 space-y-2">
            <p className="text-xs font-bold text-gray-600">No project invoices generated yet.</p>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Click "+ Create Project Invoice" to bill materials consumed and site expenses to the customer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs text-gray-600 min-w-[750px]">
              <thead className="bg-gray-50 font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Invoice No.</th>
                  <th className="p-3">Invoice Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Grand Total (₹)</th>
                  <th className="p-3 text-right">Paid (₹)</th>
                  <th className="p-3 text-right">Outstanding (₹)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {invoices.map((inv) => {
                  const dStr = inv.invoiceDate
                    ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '-';
                  const isPaid = inv.status === 'PAID' || inv.balanceDue <= 0.005;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 font-mono font-extrabold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="p-3 text-gray-500 font-mono">{dStr}</td>
                      <td className="p-3 font-extrabold">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : inv.status === 'PARTIALLY_PAID'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-slate-900 text-sm">
                        ₹{Number(inv.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-black text-emerald-700 text-sm">
                        ₹{Number(inv.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-black text-amber-900 text-sm">
                        ₹{Number(inv.balanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => navigate(`/project-invoices/${inv.id}`)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors"
                        >
                          View Invoice
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 6 — FUTURE EXTENSION MODULE PLACEHOLDERS (PAYMENTS) */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
          Upcoming Extensions (Phase 7.5)
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {/* Payments & Ledger Placeholder */}
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-4 shadow-xs space-y-2 text-center">
            <div className="w-9 h-9 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto text-base">
              <FaMoneyCheckAlt />
            </div>
            <h4 className="text-xs font-bold text-slate-800">Payments & Receipts</h4>
            <p className="text-[11px] text-gray-400">
              No payment receipts recorded yet. Customer payment entries and project profit ledger will appear here in Phase 7.5.
            </p>
          </div>
        </div>
      </div>

      {/* ISSUE MATERIAL MODAL */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <FaBoxOpen className="text-emerald-600" />
                  <span>ISSUE MATERIAL TO PROJECT</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Transfer stock from central inventory to <span className="font-bold text-slate-800">{project.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMaterialModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                <FaTimes />
              </button>
            </div>

            {materialModalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <FaExclamationTriangle className="text-red-500 flex-shrink-0" />
                <span>{materialModalError}</span>
              </div>
            )}

            <form onSubmit={handleIssueSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Select Product / Material <span className="text-rose-500">*</span>
                </label>
                <select
                  value={issueForm.productId}
                  onChange={handleProductChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50 text-slate-900"
                  required
                >
                  <option value="">-- Choose Product from Inventory --</option>
                  {products.map((p) => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.name} (Stock: {p.currentStock} {p.unit || 'pcs'}) - Cost: ₹{p.costPrice || 0}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">{selectedProduct.name}</span>
                    <span className="font-mono text-[11px] text-gray-400">SKU: {selectedProduct.sku}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 text-[11px]">
                    <span>Available Stock: <strong className="text-slate-900 font-bold">{selectedProduct.currentStock} {selectedProduct.unit || 'pcs'}</strong></span>
                    <span>Actual Cost: <strong className="text-slate-900 font-bold">₹{selectedProduct.costPrice || 0}</strong></span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Quantity to Issue <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    placeholder="e.g. 100"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                    required
                  />
                  {selectedProduct && Number(issueForm.quantity) > selectedProduct.currentStock && (
                    <p className="text-[10px] font-bold text-rose-600 mt-1">
                      Insufficient stock. Available: {selectedProduct.currentStock} {selectedProduct.unit || 'pcs'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Billing Rate per Unit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={issueForm.billingPrice}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, billingPrice: e.target.value }))}
                    placeholder="e.g. 400"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Defaulted to Product selling price</p>
                </div>
              </div>

              {selectedProduct && Number(issueForm.quantity) > 0 && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between text-emerald-900 font-bold">
                    <span>Total Actual Inventory Cost:</span>
                    <span className="font-mono">
                      ₹{(Number(issueForm.quantity) * (selectedProduct.costPrice || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-900 font-black">
                    <span>Total Target Billing Value:</span>
                    <span className="font-mono text-sm">
                      ₹{(Number(issueForm.quantity) * Number(issueForm.billingPrice || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Issue Date</label>
                <input
                  type="date"
                  value={issueForm.issueDate}
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Issue Notes / Remarks</label>
                <input
                  type="text"
                  value={issueForm.notes}
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional site issuance remarks"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  disabled={submittingMaterial}
                  onClick={() => setIsMaterialModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMaterial}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {submittingMaterial ? (
                    <>
                      <FaSpinner className="animate-spin text-xs" />
                      <span>Deducting Stock & Issuing...</span>
                    </>
                  ) : (
                    <>
                      <FaCheck className="text-xs" />
                      <span>Confirm Stock Issue</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <FaReceipt className="text-blue-600" />
                  <span>ADD PROJECT EXPENSE</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Record operational cost for <span className="font-bold text-slate-800">{project.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                <FaTimes />
              </button>
            </div>

            {expenseModalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <FaExclamationTriangle className="text-red-500 flex-shrink-0" />
                <span>{expenseModalError}</span>
              </div>
            )}

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Expense Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 bg-gray-50/50 text-slate-900"
                    required
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Expense Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 bg-gray-50/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Expense Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Sand transportation from supplier to site"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 bg-gray-50/50"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Vendor / Party Name</label>
                  <input
                    type="text"
                    value={expenseForm.vendorName}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, vendorName: e.target.value }))}
                    placeholder="e.g. ABC Transport"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 bg-gray-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Bill / Voucher Number</label>
                  <input
                    type="text"
                    value={expenseForm.billNumber}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, billNumber: e.target.value }))}
                    placeholder="e.g. TR-102"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 bg-gray-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Expense Date</label>
                <input
                  type="date"
                  value={expenseForm.expenseDate}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 bg-gray-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional site expense notes"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 bg-gray-50/50"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  disabled={submittingExpense}
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {submittingExpense ? (
                    <>
                      <FaSpinner className="animate-spin text-xs" />
                      <span>Recording Expense...</span>
                    </>
                  ) : (
                    <>
                      <FaCheck className="text-xs" />
                      <span>Confirm Add Expense</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;
