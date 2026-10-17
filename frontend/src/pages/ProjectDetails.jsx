import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { formatDateToIndian, toApiDateFormat } from '../utils/dateUtils';
import { PROJECT_GST_RATE, PROJECT_GST_MULTIPLIER, roundToTwo } from '../utils/projectGst.constants';
import {
  FaBuilding,
  FaArrowLeft,
  FaEdit,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaRupeeSign,
  FaBoxOpen,
  FaPlus,
  FaTimes,
  FaSpinner,
  FaReceipt,
  FaFileInvoiceDollar,
  FaExclamationTriangle,
  FaCheck,
  FaTag,
  FaHardHat,
  FaUsers,
  FaBan,
  FaEye,
} from 'react-icons/fa';
import LabourFormModal from '../components/LabourFormModal';
import AssignLabourModal from '../components/AssignLabourModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { stopLabour } from '../utils/labourService';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const canManageLabour = !user?.role || user?.role === 'ADMIN' || user?.role === 'SALES';

  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [labours, setLabours] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [profitability, setProfitability] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Labour Modal States (Phase 10)
  const [isAssignLabourModalOpen, setIsAssignLabourModalOpen] = useState(false);
  const [isLabourModalOpen, setIsLabourModalOpen] = useState(false);
  const [labourModalMode, setLabourModalMode] = useState('edit');
  const [activeLabour, setActiveLabour] = useState(null);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [labourToStop, setLabourToStop] = useState(null);
  const [isStopping, setIsStopping] = useState(false);

  // Material Issue Modal State
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [submittingMaterial, setSubmittingMaterial] = useState(false);
  const [materialModalError, setMaterialModalError] = useState(null);

  const [issueForm, setIssueForm] = useState({
    productId: '',
    quantity: '',
    issueDate: toApiDateFormat(new Date()),
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
    expenseDate: toApiDateFormat(new Date()),
    vendorName: '',
    billNumber: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, matRes, expRes, invRes, profRes, prodRes, labRes] = await Promise.all([
        axiosInstance.get(`/projects/${id}`),
        axiosInstance.get(`/projects/${id}/material-consumptions`),
        axiosInstance.get(`/projects/${id}/expenses`),
        axiosInstance.get(`/projects/${id}/invoices`),
        axiosInstance.get(`/projects/${id}/profitability`),
        axiosInstance.get('/products'),
        axiosInstance.get(`/projects/${id}/labours`),
      ]);

      setProject(projRes.data.data);
      setMaterials(matRes.data.data || []);
      setExpenses(expRes.data.data || []);
      setInvoices(invRes.data.data || []);
      setProfitability(profRes.data.data);
      setProducts(prodRes.data.data || []);
      setLabours(labRes.data?.data || []);
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
      setMaterialModalError('Please enter a valid quantity greater than zero.');
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
      issueDate: issueForm.issueDate ? toApiDateFormat(issueForm.issueDate) : undefined,
      notes: issueForm.notes ? issueForm.notes.trim() : undefined,
    };

    try {
      await axiosInstance.post('/material-consumptions', payload);
      toast.success('Material issued to project successfully!');
      setIsMaterialModalOpen(false);

      setIssueForm({
        productId: '',
        quantity: '',
        issueDate: toApiDateFormat(new Date()),
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
      expenseDate: expenseForm.expenseDate ? toApiDateFormat(expenseForm.expenseDate) : undefined,
      vendorName: expenseForm.vendorName ? expenseForm.vendorName.trim() : undefined,
      billNumber: expenseForm.billNumber ? expenseForm.billNumber.trim() : undefined,
      notes: expenseForm.notes ? expenseForm.notes.trim() : undefined,
    };

    try {
      await axiosInstance.post('/expenses', payload);
      toast.success('Project expense logged successfully!');
      setIsExpenseModalOpen(false);

      setExpenseForm({
        category: 'TRANSPORT',
        description: '',
        amount: '',
        expenseDate: toApiDateFormat(new Date()),
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

  // Labour Handlers (Phase 10)
  const handleOpenAddLabour = () => {
    setIsAssignLabourModalOpen(true);
  };

  const handleOpenEditLabour = (labourItem) => {
    setLabourModalMode('edit');
    setActiveLabour(labourItem);
    setIsLabourModalOpen(true);
  };

  const handleOpenStopLabour = (labourItem) => {
    setLabourToStop(labourItem);
    setIsStopModalOpen(true);
  };

  const handleConfirmStopLabour = async () => {
    if (!labourToStop) return;
    setIsStopping(true);
    try {
      await stopLabour(labourToStop.id);
      toast.success(`Labour worker "${labourToStop.name}" has been stopped.`);
      setIsStopModalOpen(false);
      setLabourToStop(null);
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to stop labour worker.'));
    } finally {
      setIsStopping(false);
    }
  };

  const handleLabourModalSuccess = (savedLabour) => {
    setIsLabourModalOpen(false);
    setActiveLabour(null);
    toast.success(
      labourModalMode === 'edit'
        ? `Labour worker "${savedLabour?.name || 'worker'}" updated successfully.`
        : `Labour worker "${savedLabour?.name || 'worker'}" assigned to project successfully.`
    );
    fetchData();
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

  const startDateStr = formatDateToIndian(project.startDate);
  const endDateStr = formatDateToIndian(project.expectedEndDate, 'Ongoing');
  const badgeStyle = STATUS_BADGES[project.status] || 'bg-gray-100 text-gray-800 border-gray-200';

  // Calculate Material Consumption Totals (Fixed 18% Project GST)
  const totalActualCost = materials.reduce((sum, m) => sum + (m.actualCostTotal || 0), 0);
  const totalInputGst = materials.reduce(
    (sum, m) =>
      sum +
      (m.inputGst != null
        ? Number(m.inputGst)
        : roundToTwo(Number(m.actualCostTotal || 0) * PROJECT_GST_MULTIPLIER)),
    0
  );
  const totalIssuedValue = materials.reduce(
    (sum, m) =>
      sum +
      (m.issuedMaterialValueIncludingGST != null
        ? Number(m.issuedMaterialValueIncludingGST)
        : roundToTwo(
            Number(m.actualCostTotal || 0) +
              (m.inputGst != null
                ? Number(m.inputGst)
                : roundToTwo(Number(m.actualCostTotal || 0) * PROJECT_GST_MULTIPLIER))
          )),
    0
  );

  // Calculate Project Expense Totals
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Group Category Totals
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {});

  // Calculate Project Labour Totals (Phase 10 — Derived directly from Labour records)
  const totalLabourCount = labours.length;
  const activeLabourCount = labours.filter((l) => l.status === 'ACTIVE').length;
  const stoppedLabourCount = labours.filter((l) => l.status === 'STOPPED').length;
  const totalLabourEarned = labours.reduce((sum, l) => sum + (Number(l.totalEarned) || 0), 0);
  const totalLabourPaid = labours.reduce((sum, l) => sum + (Number(l.totalPaid) || 0), 0);
  const totalLabourBalance = totalLabourEarned - totalLabourPaid;

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


      {/* SECTION 2.5 — FINANCIAL OVERVIEW & BUDGET KPI CARDS */}
      {profitability && (
        <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <FaFileInvoiceDollar className="text-emerald-600 text-xs" />
              <span>Project Financial Overview & Profitability</span>
            </h3>
            <span className={`px-2.5 py-0.5 rounded text-[11px] font-black ${
              (profitability.remainingBudget !== undefined ? profitability.remainingBudget : profitability.projectProfit) >= 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              Remaining Margin: {profitability.projectMargin !== undefined ? profitability.projectMargin : (profitability.grossMargin || 0)}%
            </span>
          </div>

          {/* 1. PROJECT BUDGET VS ACTUAL COST (GST-Exclusive) */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Project Budget vs Actual Cost (GST-Exclusive)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Card 1: Project Budget — Excl. GST */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider block">
                  PROJECT BUDGET — EXCL. GST
                </span>
                <div className="text-base font-black text-indigo-950 font-mono">
                  ₹{(profitability.projectBudget !== undefined ? profitability.projectBudget : (project?.budget || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[9px] text-indigo-600 font-medium block">Approved project budget</span>
              </div>

              {/* Card 2: Material Cost — Excl. GST */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  MATERIAL COST — EXCL. GST
                </span>
                <div className="text-base font-black text-slate-900 font-mono">
                  ₹{(profitability.totalMaterialCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[9px] text-slate-500 block">Cost of materials issued/consumed by the project, excluding GST</span>
              </div>

              {/* Card 3: Project Expenses */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  PROJECT EXPENSES
                </span>
                <div className="text-base font-black text-slate-900 font-mono">
                  ₹{(profitability.totalProjectExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[9px] text-slate-500 block">Site, logistics, and other project expenses</span>
              </div>

              {/* Card 4: Labour Cost */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  LABOUR COST
                </span>
                <div className="text-base font-black text-slate-900 font-mono">
                  ₹{(profitability.totalLabourCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[9px] text-slate-500 block">Direct labour cost assigned to the project</span>
              </div>

              {/* Card 5: Total Project Cost — Excl. GST */}
              <div className="p-3 bg-slate-100/80 border border-slate-300 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider block">
                  TOTAL PROJECT COST — EXCL. GST
                </span>
                <div className="text-base font-black text-slate-900 font-mono">
                  ₹{(profitability.actualProjectCost !== undefined ? profitability.actualProjectCost : (profitability.totalProjectCost || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[9px] text-slate-600 font-medium block">Materials + project expenses + labour</span>
              </div>

              {/* Card 6: Remaining Budget */}
              <div className={`p-3 border rounded-xl space-y-1 ${
                (profitability.remainingBudget !== undefined ? profitability.remainingBudget : profitability.projectProfit) >= 0
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-rose-50 border-rose-300'
              }`}>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                  (profitability.remainingBudget !== undefined ? profitability.remainingBudget : profitability.projectProfit) >= 0
                    ? 'text-emerald-800'
                    : 'text-rose-800'
                }`}>REMAINING BUDGET</span>
                <div className={`text-base font-black font-mono ${
                  (profitability.remainingBudget !== undefined ? profitability.remainingBudget : profitability.projectProfit) >= 0
                    ? 'text-emerald-900'
                    : 'text-rose-900'
                }`}>
                  ₹{(profitability.remainingBudget !== undefined ? profitability.remainingBudget : profitability.projectProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[9px] text-gray-500 font-medium block">Project budget minus total project cost excluding GST</span>
              </div>
            </div>
          </div>

          {/* 2. INVOICING & CASH-FLOW STATUS (Separated from Budget) */}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Invoicing & Payment Collections (Cash-Flow — Output GST Included)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50/50 border border-emerald-200/70 rounded-xl space-y-0.5">
                <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">TOTAL INVOICED (INCL. GST)</span>
                <div className="text-sm font-black text-emerald-900 font-mono">
                  ₹{(profitability.totalInvoiced !== undefined ? profitability.totalInvoiced : (profitability.revenue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[9px] text-emerald-600">Active customer bills (Output GST included)</span>
              </div>

              <div className="p-3 bg-blue-50/50 border border-blue-200/70 rounded-xl space-y-0.5">
                <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">TOTAL RECEIVED</span>
                <div className="text-sm font-black text-blue-900 font-mono">
                  ₹{(profitability.totalReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[9px] text-blue-600">Collected payments</span>
              </div>

              <div className="p-3 bg-amber-50/50 border border-amber-200/70 rounded-xl space-y-0.5">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">OUTSTANDING BALANCE</span>
                <div className="text-sm font-black text-amber-900 font-mono">
                  ₹{(profitability.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[9px] text-amber-700">Invoiced balance pending</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2.6 — GST SUMMARY (Fixed 18% Rule) */}
      {profitability && (
        <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <FaReceipt className="text-emerald-600 text-xs" />
                <span>GST Summary</span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Input Tax Credit (ITC) tracking — Fixed 18% business rule for all project materials.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Input GST @ 18% */}
            <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider block">
                INPUT GST @ 18%
              </span>
              <div className="text-base font-black text-blue-900 font-mono">
                ₹{(profitability.inputGstIssuedMaterials || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-blue-600 font-medium block">
                Fixed 18% GST on issued project materials
              </span>
            </div>

            {/* Card 2: Issued Material Value — Incl. GST */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                ISSUED MATERIAL VALUE — INCL. GST
              </span>
              <div className="text-base font-black text-emerald-950 font-mono">
                ₹{(profitability.issuedMaterialValueIncludingGST || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-emerald-600 font-medium block">
                Material cost plus 18% Input GST
              </span>
            </div>

            {/* Card 3: Total Input GST to be Claimed — Issued Materials GST Only */}
            <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block">
                TOTAL INPUT GST TO BE CLAIMED — ISSUED MATERIALS GST ONLY
              </span>
              <div className="text-base font-black text-purple-950 font-mono">
                ₹{(profitability.totalInputGstClaimable !== undefined ? profitability.totalInputGstClaimable : (profitability.inputGstIssuedMaterials || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-purple-600 font-medium block">
                Eligible Input Tax Credit (ITC) for this project
              </span>
            </div>
          </div>

          {/* Explanatory Note Alert */}
          <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-[11px] text-gray-500 flex items-start space-x-2">
            <span className="text-emerald-600 font-bold text-xs mt-0.5">ℹ</span>
            <span>
              <strong>Notice:</strong> GST is calculated using the fixed 18% business rule on project materials and maintained separately from project budget calculations. Only the material cost excluding GST is deducted from the project budget.
            </span>
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
            <span>Issue Material to Project</span>
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
              MATERIAL COST — EXCL. GST
            </span>
            <div className="text-lg font-black text-slate-900 font-mono">
              ₹{totalActualCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-gray-400 block">Actual inventory procurement cost (Excl. GST)</span>
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider block">
              INPUT GST @ 18%
            </span>
            <div className="text-lg font-black text-blue-900 font-mono">
              ₹{totalInputGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-blue-600 block">Fixed 18% Input GST on issued stock</span>
          </div>

          <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
              ISSUED MATERIAL VALUE — INCL. GST
            </span>
            <div className="text-lg font-black text-emerald-950 font-mono">
              ₹{totalIssuedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-600 block">Proportional material value including 18% GST</span>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
              MATERIALS ISSUED
            </span>
            <div className="text-lg font-black text-slate-900 font-mono">
              {materials.length} <span className="text-xs font-normal text-gray-500">batches</span>
            </div>
            <span className="text-[10px] text-gray-400 block">Stock transfers to site</span>
          </div>
        </div>

        {/* Material History Table */}
        {materials.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/40 space-y-2">
            <p className="text-xs font-bold text-gray-600">No material consumption recorded yet.</p>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Click &quot;Issue Material to Project&quot; to record stock transferred from central inventory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs text-gray-600 min-w-[900px]">
              <thead className="bg-gray-50 font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Material / Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3 text-center">Quantity</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3 text-right">Actual Unit Cost — Excl. GST (₹)</th>
                  <th className="p-3 text-right">Input GST @ 18% (₹)</th>
                  <th className="p-3 text-right">Actual Cost Total — Excl. GST (₹)</th>
                  <th className="p-3 text-right">Issued Material Value — Incl. GST (₹)</th>
                  <th className="p-3 text-right">Issued By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {materials.map((m) => {
                  const dStr = formatDateToIndian(m.issueDate);
                  const actTotal = m.actualCostTotal !== undefined ? Number(m.actualCostTotal) : (m.quantity * m.actualCostPrice);
                  const lineGst = m.inputGst != null ? Number(m.inputGst) : Math.round(actTotal * 0.18 * 100) / 100;
                  const issuedVal = m.issuedMaterialValueIncludingGST != null ? Number(m.issuedMaterialValueIncludingGST) : Math.round((actTotal + lineGst) * 100) / 100;

                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 text-gray-500 font-mono">{dStr}</td>
                      <td className="p-3 font-extrabold text-slate-900">{m.productName}</td>
                      <td className="p-3 text-[10px] font-mono text-gray-500">{m.sku}</td>
                      <td className="p-3 text-center font-extrabold text-slate-900">{m.quantity}</td>
                      <td className="p-3 text-gray-600 font-semibold">{m.unit}</td>
                      <td className="p-3 text-right font-bold text-slate-700 font-mono">
                        ₹{Number(m.actualCostPrice || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-bold text-blue-700 font-mono">
                        ₹{lineGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-black text-slate-900 font-mono">
                        ₹{actTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-black text-emerald-800 font-mono">
                        ₹{issuedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
            <span>Add Project Expense</span>
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
              Click &quot;Add Project Expense&quot; to log transport, labour, or machinery rental costs.
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
                  const dStr = formatDateToIndian(e.expenseDate);
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

      {/* SECTION 4.5 — PROJECT LABOUR & WORKFORCE LEDGER */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <FaHardHat className="text-amber-500" />
              <span>Project Labour & Workforce Ledger</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Workforce deployed on this site, wage earnings, disbursements, and outstanding balances.
            </p>
          </div>

          {canManageLabour && (
            <button
              type="button"
              disabled={isClosedProject}
              onClick={handleOpenAddLabour}
              title={isClosedProject ? `Cannot assign labour to a ${project.status} project` : 'Assign Labour'}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-40"
            >
              <FaPlus className="text-xs" />
              <span>Assign Labour</span>
            </button>
          )}
        </div>

        {/* Project Labour Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Labour */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
              TOTAL LABOUR
            </span>
            <div className="text-base font-black text-slate-900 font-mono">
              {totalLabourCount} <span className="text-xs font-normal text-gray-500">workers</span>
            </div>
            <span className="text-[9px] text-slate-500 block">Total assigned workforce</span>
          </div>

          {/* Card 2: Active Labour */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
              ACTIVE WORKERS
            </span>
            <div className="text-base font-black text-emerald-950 font-mono">
              {activeLabourCount} <span className="text-xs font-normal text-emerald-700">active</span>
            </div>
            <span className="text-[9px] text-emerald-600 block">Currently working on site</span>
          </div>

          {/* Card 3: Stopped Labour */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
              STOPPED WORKERS
            </span>
            <div className="text-base font-black text-slate-700 font-mono">
              {stoppedLabourCount} <span className="text-xs font-normal text-slate-400">stopped</span>
            </div>
            <span className="text-[9px] text-slate-400 block">Site work ended</span>
          </div>

          {/* Card 4: Total Earned */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider block">
              TOTAL EARNED (COST)
            </span>
            <div className="text-base font-black text-indigo-950 font-mono">
              ₹{totalLabourEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[9px] text-indigo-600 block">Calendar-day wage cost</span>
          </div>

          {/* Card 5: Total Paid */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider block">
              TOTAL PAID
            </span>
            <div className="text-base font-black text-blue-900 font-mono">
              ₹{totalLabourPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[9px] text-blue-600 block">Disbursed to workers</span>
          </div>

          {/* Card 6: Balance */}
          <div className={`p-3 border rounded-xl space-y-1 ${
            totalLabourBalance < 0
              ? 'bg-rose-50 border-rose-200'
              : totalLabourBalance === 0
              ? 'bg-slate-50 border-slate-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${
              totalLabourBalance < 0
                ? 'text-rose-800'
                : totalLabourBalance === 0
                ? 'text-slate-700'
                : 'text-amber-800'
            }`}>
              NET BALANCE
            </span>
            <div className={`text-base font-black font-mono ${
              totalLabourBalance < 0
                ? 'text-rose-700'
                : totalLabourBalance === 0
                ? 'text-slate-800'
                : 'text-amber-900'
            }`}>
              {totalLabourBalance < 0 ? '-' : ''}₹{Math.abs(totalLabourBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className={`text-[9px] font-medium block ${
              totalLabourBalance < 0
                ? 'text-rose-600'
                : totalLabourBalance === 0
                ? 'text-slate-500'
                : 'text-amber-700'
            }`}>
              {totalLabourBalance < 0 ? 'Overpaid to workers' : totalLabourBalance === 0 ? 'Fully settled' : 'Outstanding payable'}
            </span>
          </div>
        </div>

        {/* Project Labour Table or Empty State */}
        {labours.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/40 space-y-2">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto text-base">
              <FaHardHat />
            </div>
            <p className="text-xs font-bold text-gray-700">No labour assigned to this project.</p>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Deploy workforce to this project to track daily calendar-day wages, disbursements, and site labour costs.
            </p>
            {canManageLabour && !isClosedProject && (
              <button
                type="button"
                onClick={handleOpenAddLabour}
                className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors"
              >
                <FaPlus className="text-[10px]" />
                <span>Assign Labour</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs text-gray-600 min-w-[850px]">
              <thead className="bg-gray-50 font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Labour Name</th>
                  <th className="p-3">Mobile & Address</th>
                  <th className="p-3 text-right">Daily Wage (₹)</th>
                  <th className="p-3">Start / Stopped</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Total Earned (₹)</th>
                  <th className="p-3 text-right">Total Paid (₹)</th>
                  <th className="p-3 text-right">Balance (₹)</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {labours.map((l) => {
                  const startStr = formatDateToIndian(l.assignmentStartDate || l.startDate);
                  const stoppedStr = l.stoppedAt ? formatDateToIndian(l.stoppedAt) : null;
                  const isStopped = l.status === 'STOPPED';

                  return (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Name */}
                      <td className="p-3 font-extrabold text-slate-900">
                        <button
                          type="button"
                          onClick={() => navigate(`/labour/${l.id}`)}
                          className="hover:text-emerald-700 hover:underline text-left cursor-pointer transition-colors"
                          title="View Labour Details"
                        >
                          {l.name}
                        </button>
                      </td>

                      {/* Mobile & Address */}
                      <td className="p-3 text-slate-700">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{l.mobile}</span>
                          <span className="text-[11px] text-gray-400">{l.address || l.location}</span>
                        </div>
                      </td>

                      {/* Daily Wage */}
                      <td className="p-3 text-right font-bold text-slate-800 font-mono">
                        ₹{Number(l.dailyWage || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Start / Stopped Date */}
                      <td className="p-3 text-gray-600 font-mono text-[11px]">
                        <div>Start: {startStr}</div>
                        {stoppedStr && (
                          <div className="text-gray-400 text-[10px]">End: {stoppedStr}</div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            l.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : l.status === 'STOPPED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              l.status === 'ACTIVE'
                                ? 'bg-emerald-500'
                                : l.status === 'STOPPED'
                                ? 'bg-rose-400'
                                : 'bg-slate-400'
                            }`}
                          />
                          {l.status}
                        </span>
                      </td>

                      {/* Total Earned */}
                      <td className="p-3 text-right font-black text-slate-900 font-mono">
                        ₹{Number(l.totalEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Total Paid */}
                      <td className="p-3 text-right font-black text-blue-900 font-mono">
                        ₹{Number(l.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Balance */}
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-black font-mono text-xs ${
                              (l.balance ?? 0) < 0
                                ? 'text-rose-600'
                                : (l.balance ?? 0) === 0
                                ? 'text-slate-500'
                                : 'text-slate-900'
                            }`}
                          >
                            {(l.balance ?? 0) < 0 ? '-' : ''}₹{Math.abs(Number(l.balance || 0)).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          {(l.balance ?? 0) < 0 && (
                            <span className="text-[10px] text-rose-500 font-semibold mt-0.5">
                              Overpaid
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions: View, Edit, Stop */}
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center space-x-1">
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => navigate(`/labour/${l.id}`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="View labour details"
                          >
                            <FaEye className="text-xs" />
                          </button>

                          {/* Edit Button */}
                          {canManageLabour && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditLabour(l)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Edit labour details"
                            >
                              <FaEdit className="text-xs" />
                            </button>
                          )}

                          {/* Stop Button */}
                          {canManageLabour && (
                            l.status === 'ACTIVE' && !isClosedProject ? (
                              <button
                                type="button"
                                onClick={() => handleOpenStopLabour(l)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Stop labour"
                              >
                                <FaBan className="text-xs" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="p-1.5 rounded-lg text-gray-300 cursor-not-allowed opacity-40"
                                title={isClosedProject ? 'Project is completed/closed' : l.status === 'STOPPED' ? 'Labour is already stopped' : 'Worker is not active'}
                              >
                                <FaBan className="text-xs" />
                              </button>
                            )
                          )}
                        </div>
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
            <span>Create Project Invoice</span>
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
              Click &quot;Create Project Invoice&quot; to bill materials consumed and site expenses to the customer.
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
                  <th className="p-3 text-right">Grand Total (Incl. GST) (₹)</th>
                  <th className="p-3 text-right">Paid (₹)</th>
                  <th className="p-3 text-right">Outstanding (₹)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {invoices.map((inv) => {
                  const dStr = formatDateToIndian(inv.invoiceDate);
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
                    <span>Actual Unit Cost (Excl. GST): <strong className="text-slate-900 font-bold">₹{selectedProduct.costPrice || 0}</strong></span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 text-[11px] pt-1 border-t border-slate-200/60">
                    <span>Applicable GST Rate: <strong className="text-blue-700 font-bold">{selectedProduct.gstRate || 0}%</strong></span>
                    <span className="text-[10px] text-gray-400 italic">Sourced from product master</span>
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
                    Actual Unit Cost (Excl. GST) (₹)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={selectedProduct ? `₹${Number(selectedProduct.costPrice || 0).toFixed(2)}` : '-'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Procurement cost basis from inventory</p>
                </div>
              </div>

              {selectedProduct && Number(issueForm.quantity) > 0 && (() => {
                const qty = Number(issueForm.quantity);
                const unitCost = Number(selectedProduct.costPrice || 0);
                const costTotal = roundToTwo(qty * unitCost);
                const lineGst = roundToTwo(costTotal * PROJECT_GST_MULTIPLIER);
                const issuedVal = roundToTwo(costTotal + lineGst);

                return (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-800 font-bold">
                      <span>Material Cost — Excl. GST:</span>
                      <span className="font-mono text-sm font-black text-slate-900">
                        ₹{costTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-gray-700 font-semibold text-[11px]">
                      <span>GST Rate:</span>
                      <span className="font-mono font-bold text-slate-800">{PROJECT_GST_RATE}% (Fixed)</span>
                    </div>
                    <div className="flex items-center justify-between text-blue-800 font-semibold text-[11px]">
                      <span>Input GST @ {PROJECT_GST_RATE}%:</span>
                      <span className="font-mono font-bold text-blue-900">
                        ₹{lineGst.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-800 font-bold text-[11px] pt-1 border-t border-slate-200/80">
                      <span>Issued Material Value — Incl. GST:</span>
                      <span className="font-mono font-black text-emerald-950">
                        ₹{issuedVal.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 italic pt-0.5">
                      ℹ Only ₹{costTotal.toFixed(2)} (Excl. GST) will affect the project budget. Input GST is tracked separately for tax claims.
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700">Issue Date</label>
                  {issueForm.issueDate && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {formatDateToIndian(issueForm.issueDate)}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={issueForm.issueDate}
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Standard Indian format: <strong>DD/MM/YYYY</strong></span>
                  {issueForm.issueDate && (
                    <span className="text-slate-600 font-medium">
                      Display: <strong className="text-emerald-700">{formatDateToIndian(issueForm.issueDate)}</strong>
                    </span>
                  )}
                </div>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700">Expense Date</label>
                  {expenseForm.expenseDate && (
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {formatDateToIndian(expenseForm.expenseDate)}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={expenseForm.expenseDate}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 bg-gray-50/50"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Standard Indian format: <strong>DD/MM/YYYY</strong></span>
                  {expenseForm.expenseDate && (
                    <span className="text-slate-600 font-medium">
                      Display: <strong className="text-blue-700">{formatDateToIndian(expenseForm.expenseDate)}</strong>
                    </span>
                  )}
                </div>
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

      {/* ASSIGN EXISTING LABOUR MODAL */}
      <AssignLabourModal
        isOpen={isAssignLabourModalOpen}
        onClose={() => setIsAssignLabourModalOpen(false)}
        onSuccess={(assignedLabour) => {
          setIsAssignLabourModalOpen(false);
          toast.success(
            `Labour worker "${assignedLabour?.name || 'worker'}" assigned to project successfully.`
          );
          fetchData();
        }}
        project={project}
      />

      {/* LABOUR FORM MODAL (Edit Labour) */}
      <LabourFormModal
        isOpen={isLabourModalOpen}
        onClose={() => {
          setIsLabourModalOpen(false);
          setActiveLabour(null);
        }}
        onSuccess={handleLabourModalSuccess}
        mode={labourModalMode}
        labour={activeLabour}
        defaultProjectId={project?.id || project?._id || ''}
        projectName={project?.name || ''}
      />

      {/* STOP LABOUR CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={isStopModalOpen}
        onClose={() => {
          setIsStopModalOpen(false);
          setLabourToStop(null);
        }}
        onConfirm={handleConfirmStopLabour}
        title="Stop Labour"
        confirmText="Stop Labour"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isStopping}
        message={
          <div className="space-y-3">
            <p className="text-gray-800 text-sm font-medium">
              Are you sure you want to stop <span className="font-bold text-gray-900">{labourToStop?.name}</span>?
            </p>
            <p className="text-xs text-gray-500 font-normal">
              Once stopped, this labour will no longer be considered active on this project.
            </p>
            <div className="bg-white p-2.5 rounded-lg border border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Stop Date:</span>
              <span className="font-bold text-gray-800">
                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        }
      />

    </div>
  );
};

export default ProjectDetails;
