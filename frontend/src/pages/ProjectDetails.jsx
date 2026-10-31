import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { formatDateToIndian, formatDateShortMonth, formatDateRange, toApiDateFormat } from '../utils/dateUtils';
import { PROJECT_GST_RATE, PROJECT_GST_MULTIPLIER, roundToTwo } from '../utils/projectGst.constants';
import { FaArrowLeft, FaEdit, FaPlus, FaTimes, FaSpinner, FaReceipt, FaExclamationTriangle, FaCheck } from 'react-icons/fa';
import { LuChevronDown, LuMapPin, LuCalendarDays, LuWallet, LuUser, LuStickyNote } from 'react-icons/lu';
import LabourFormModal from '../components/LabourFormModal';
import AssignLabourModal from '../components/AssignLabourModal';
import StopDateModal from '../components/StopDateModal';
import FilterSelect from '../components/FilterSelect';
import IndianDateInput from '../components/IndianDateInput';
import ProjectFormModal from '../components/ProjectFormModal';
import LabourPaymentModal from '../components/LabourPaymentModal';
import { stopLabour } from '../utils/labourService';
import { useAuth } from '../context/AuthContext';

const BADGE = {
  green: 'bg-[#22C55E]/10 text-[#4ADE80] border-[#22C55E]/40',
  grey: 'bg-[#908C84]/10 text-[#B8B4AC] border-[#908C84]/40',
  blue: 'bg-[#60A5FA]/10 text-[#93C5FD] border-[#60A5FA]/40',
  amber: 'bg-[#FFB82E]/10 text-[#FFC14D] border-[#FFB82E]/40',
  purple: 'bg-[#A78BFA]/10 text-[#C4B5FD] border-[#A78BFA]/40',
  red: 'bg-[#F87171]/10 text-[#FCA5A5] border-[#F87171]/40',
};

const STATUS_BADGES = {
  PLANNING: { label: 'Planning', cls: BADGE.blue },
  IN_PROGRESS: { label: 'In progress', cls: BADGE.green },
  ON_HOLD: { label: 'On hold', cls: BADGE.amber },
  COMPLETED: { label: 'Completed', cls: BADGE.purple },
  CANCELLED: { label: 'Cancelled', cls: BADGE.red },
};

const capitalise = (text) => (text ? text.trim().charAt(0).toUpperCase() + text.trim().slice(1) : '');

// Cards show whole rupees; tables keep paise
const formatRupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const formatPaise = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SectionHead = ({ title, subtitle, actionLabel, onAction, disabled, disabledTitle }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
    </div>
    {actionLabel && (
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        title={disabled ? disabledTitle : actionLabel}
        className="px-3 py-1.5 rounded-lg text-xs bg-[#FFB82E]/10 text-[#FFC14D] border border-[#FFB82E]/30 hover:bg-[#FFB82E]/20 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FaPlus className="text-[10px]" />
        {actionLabel}
      </button>
    )}
  </div>
);

// One-line summary card: label on the left, value on the right
const MiniCard = ({ label, value, note, valueClass = 'text-slate-900' }) => (
  <div className="px-4 py-3 rounded-xl border border-gray-200 bg-white flex items-center justify-between gap-3">
    <span className="text-xs text-gray-400 truncate">{label}</span>
    <span className="flex items-baseline gap-1.5 shrink-0">
      <span className={`text-base font-semibold font-mono ${valueClass}`}>{value}</span>
      {note && <span className="text-[11px] text-gray-400">{note}</span>}
    </span>
  </div>
);

const EmptyLine = ({ children }) => (
  <p className="py-8 text-center text-sm text-gray-400 bg-white border border-gray-200 rounded-2xl">{children}</p>
);

const EXPENSE_CATEGORIES = [
  { value: 'TRANSPORT', label: 'Transport / Freight' },
  { value: 'LABOUR', label: 'Labour / Manpower' },
  { value: 'MACHINERY_RENTAL', label: 'Machinery / Equipment Rental' },
  { value: 'LOADING_UNLOADING', label: 'Loading / Unloading' },
  { value: 'SITE_EXPENSE', label: 'Site / Operational Expense' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
  { value: 'OTHER', label: 'Other Expenses' },
];

const CATEGORY_SHORT = {
  TRANSPORT: 'Transport',
  LABOUR: 'Labour',
  MACHINERY_RENTAL: 'Machinery rental',
  LOADING_UNLOADING: 'Loading',
  SITE_EXPENSE: 'Site expense',
  MISCELLANEOUS: 'Misc',
  OTHER: 'Other',
};
const categoryLabel = (cat) => CATEGORY_SHORT[cat] || capitalise((cat || '').replace(/_/g, ' ').toLowerCase());

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user } = useAuth();
  const canManageLabour = !user?.role || user?.role === 'ADMIN' || user?.role === 'SALES';

  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [labours, setLabours] = useState([]);
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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentLabour, setPaymentLabour] = useState(null);

  const [activeTab, setActiveTab] = useState(location.state?.tab || 'overview');
  const [materialView, setMaterialView] = useState('material');
  const [expandedDates, setExpandedDates] = useState(() => new Set());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Material Issue Modal State
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [submittingMaterial, setSubmittingMaterial] = useState(false);
  const [materialModalError, setMaterialModalError] = useState(null);

  // Several materials can be issued together; they share one issue date
  const newIssueLine = () => ({ key: `${Date.now()}-${Math.random()}`, productId: '', quantity: '' });
  const [issueLines, setIssueLines] = useState(() => [newIssueLine()]);
  const [issueDate, setIssueDate] = useState(() => toApiDateFormat(new Date()));

  const openIssueModal = () => {
    setIssueLines([newIssueLine()]);
    setIssueDate(toApiDateFormat(new Date()));
    setMaterialModalError(null);
    setIsMaterialModalOpen(true);
  };

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
      const [projRes, matRes, expRes, profRes, prodRes, labRes] = await Promise.all([
        axiosInstance.get(`/projects/${id}`),
        axiosInstance.get(`/projects/${id}/material-consumptions`),
        axiosInstance.get(`/projects/${id}/expenses`),
        axiosInstance.get(`/projects/${id}/profitability`),
        axiosInstance.get('/products'),
        axiosInstance.get(`/projects/${id}/labours`),
      ]);

      setProject(projRes.data.data);
      setMaterials(matRes.data.data || []);
      setExpenses(expRes.data.data || []);
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
  const findProduct = (pId) => products.find((p) => (p.id || p._id) === pId) || null;

  const updateIssueLine = (key, changes) => {
    setIssueLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...changes } : l)));
    setMaterialModalError(null);
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setMaterialModalError(null);

    const lines = issueLines.filter((l) => l.productId);
    if (lines.length === 0) {
      setMaterialModalError('Choose at least one material.');
      return;
    }
    for (const l of lines) {
      const prod = findProduct(l.productId);
      const qty = Number(l.quantity);
      if (!prod) continue;
      if (isNaN(qty) || qty <= 0) {
        setMaterialModalError(`Enter a quantity for ${prod.name}.`);
        return;
      }
      if (qty > prod.currentStock) {
        setMaterialModalError(`Not enough ${prod.name}. Only ${prod.currentStock} ${prod.unit || 'pcs'} in stock.`);
        return;
      }
    }

    setSubmittingMaterial(true);
    // One request per material; rows that went through are dropped so a retry only sends the rest
    let issued = 0;
    try {
      for (const l of lines) {
        await axiosInstance.post('/material-consumptions', {
          project: id,
          product: l.productId,
          quantity: Number(l.quantity),
          issueDate: issueDate ? toApiDateFormat(issueDate) : undefined,
        });
        issued += 1;
        setIssueLines((prev) => prev.filter((x) => x.key !== l.key));
      }
      toast.success(issued === 1 ? 'Material issued.' : `${issued} materials issued.`);
      setIsMaterialModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error issuing material:', err);
      const errMsg = getErrorMessage(err, 'Failed to issue material to project.');
      setMaterialModalError(issued > 0 ? `${issued} issued, then this failed: ${errMsg}` : errMsg);
      toast.error(errMsg);
      if (issued > 0) fetchData();
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
      await axiosInstance.post('/project-expenses', payload);
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

  const handleConfirmStopLabour = async (stopDate) => {
    if (!labourToStop) return;
    setIsStopping(true);
    try {
      await stopLabour(labourToStop.id, stopDate);
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

  const badge = STATUS_BADGES[project.status] || { label: project.status, cls: BADGE.grey };
  const endKey = project.expectedEndDate ? toApiDateFormat(project.expectedEndDate) : '';
  const isOverdue = project.status === 'IN_PROGRESS' && endKey && endKey < toApiDateFormat(new Date());

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
  const activeLabourCount = labours.filter((l) => l.status === 'ACTIVE').length;
  const totalLabourEarned = labours.reduce((sum, l) => sum + (Number(l.totalEarned) || 0), 0);
  const totalLabourPaid = labours.reduce((sum, l) => sum + (Number(l.totalPaid) || 0), 0);
  const totalLabourBalance = totalLabourEarned - totalLabourPaid;


  const isClosedProject = project.status === 'COMPLETED' || project.status === 'CANCELLED';

  // Labour cost = wages earned so far (same numbers as the Labour tab), so Overview
  // is right even when the backend total is older
  const budgetAmount = profitability
    ? profitability.projectBudget !== undefined ? profitability.projectBudget : project?.budget || 0
    : 0;
  const materialCost = profitability?.totalMaterialCost || 0;
  const expenseCost = profitability?.totalProjectExpenses || 0;
  const totalSpent = roundToTwo(materialCost + expenseCost + totalLabourEarned);
  const remaining = roundToTwo(budgetAmount - totalSpent);
  const marginLeft = budgetAmount > 0 ? roundToTwo((remaining / budgetAmount) * 100) : 0;

  const budgetCards = profitability
    ? [
        { label: 'Budget', value: budgetAmount },
        { label: 'Materials', value: materialCost },
        { label: 'Expenses', value: expenseCost },
        { label: 'Labour', value: totalLabourEarned },
        { label: 'Total spent', value: totalSpent },
        { label: 'Remaining', value: remaining, valueClass: remaining >= 0 ? 'text-[#4ADE80]' : 'text-rose-500' },
      ]
    : [];

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'materials', label: 'Materials', count: materials.length },
    { key: 'expenses', label: 'Expenses', count: expenses.length },
    { key: 'labour', label: 'Labour', count: labours.length },
  ];

  const creatorName = project.creator?.name || 'System Admin';

  return (
    <div className="space-y-5 animate-fadeIn pb-16">
      {/* Header: name + status, code underneath, Edit on the right */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            title="Back to projects"
            aria-label="Back to projects"
            className="mt-0.5 w-9 h-9 shrink-0 rounded-lg border border-gray-200 text-gray-400 hover:text-slate-900 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer focus:outline-none"
          >
            <FaArrowLeft className="text-xs" />
          </button>
          <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
            <span className={`px-2.5 py-1 rounded-md border text-[11px] font-medium inline-flex items-center gap-1.5 shrink-0 ${badge.cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {badge.label}
            </span>
            {isOverdue && (
              <span className={`px-2.5 py-1 rounded-md border text-[11px] font-medium inline-flex items-center gap-1.5 shrink-0 ${BADGE.red}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                Overdue
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{project.projectCode}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditModalOpen(true)}
          className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-slate-700 text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <FaEdit className="text-xs" />
          Edit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto hide-scrollbar">
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 -mb-px border-b-2 text-sm whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 focus:outline-none focus-visible:outline-none ${
                isActive ? 'border-[#FFB82E] text-[#FFC14D]' : 'border-transparent text-gray-400 hover:text-slate-900'
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`px-1.5 min-w-[20px] text-center rounded-md text-[11px] ${
                    isActive ? 'bg-[#FFB82E]/15 text-[#FFC14D]' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Project details: one row of icon + label + value, notes underneath */}
          {(() => {
            let timelineNote = null;
            if (project.expectedEndDate && !isClosedProject) {
              const end = new Date(project.expectedEndDate);
              end.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const days = Math.round((end - today) / 86400000);
              if (days > 0) timelineNote = { text: `${days} ${days === 1 ? 'day' : 'days'} left`, cls: 'text-gray-400' };
              else if (days === 0) timelineNote = { text: 'Ends today', cls: 'text-[#FFC14D]' };
              else timelineNote = { text: `Overdue by ${-days} ${days === -1 ? 'day' : 'days'}`, cls: 'text-rose-500' };
            }
            const items = [
              { icon: LuMapPin, label: 'Site', value: capitalise(project.siteAddress) || '-' },
              {
                icon: LuCalendarDays,
                label: 'Timeline',
                value: formatDateRange(project.startDate, project.expectedEndDate, 'Ongoing'),
                note: timelineNote,
              },
              {
                icon: LuWallet,
                label: 'Budget',
                value: project.budget !== undefined && project.budget !== null ? formatRupees(project.budget) : 'Not set',
              },
              { icon: LuUser, label: 'Created by', value: creatorName },
            ];
            return (
              <div className="bg-white border border-gray-200 rounded-2xl">
                <div className="grid grid-cols-2 lg:grid-cols-[1fr_1.35fr_1fr_1fr]">
                  {items.map((it, i) => {
                    const Icon = it.icon;
                    return (
                      <div
                        key={it.label}
                        className={`flex items-center gap-4 px-5 py-4 min-w-0 ${i > 0 ? 'lg:border-l border-gray-200' : ''} ${i % 2 === 1 ? 'border-l lg:border-l' : ''} ${i > 1 ? 'border-t lg:border-t-0' : ''}`}
                      >
                        <span className="w-12 h-12 shrink-0 rounded-xl bg-[#FFB82E]/10 text-[#FFC14D] flex items-center justify-center">
                          <Icon className="text-[22px]" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-400 whitespace-nowrap">
                            {it.label}
                            {it.note && <span className={`ml-2 text-xs ${it.note.cls}`}>· {it.note.text}</span>}
                          </p>
                          <p className="text-base 2xl:text-lg font-medium text-slate-900 mt-0.5 leading-snug truncate" title={it.value}>{it.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {project.notes && (
                  <div className="flex items-start gap-3 px-4 py-3 border-t border-gray-200 text-sm">
                    <LuStickyNote className="text-gray-400 mt-0.5 shrink-0" />
                    <p className="text-slate-700 break-words">{project.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Budget and costs */}
          {profitability && (
            <div className="bg-white p-5 border border-gray-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Budget and costs <span className="text-gray-400 font-normal">(excl. GST)</span>
                </h3>
                <span className={`px-2.5 py-1 rounded-md border text-[11px] font-medium ${remaining >= 0 ? BADGE.green : BADGE.red}`}>
                  Margin left {marginLeft}%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {budgetCards.map((c) => (
                  <div key={c.label} className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-400">{c.label}</p>
                    <p className={`text-lg font-semibold font-mono mt-0.5 ${c.valueClass || 'text-slate-900'}`}>{formatRupees(c.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GST Summary (Fixed 18% Rule) */}
          {profitability && (
            <div className="bg-white p-5 border border-gray-200 rounded-2xl space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">GST summary</h3>
                <p className="text-xs text-gray-400 mt-0.5">Input tax credit on issued materials, at the fixed 18% rate.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-400">Input GST @ 18%</p>
                  <p className="text-lg font-semibold font-mono mt-0.5 text-slate-900">{formatRupees(profitability.inputGstIssuedMaterials || 0)}</p>
                </div>
                <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-400">Issued material value (incl. GST)</p>
                  <p className="text-lg font-semibold font-mono mt-0.5 text-slate-900">
                    {formatRupees(profitability.issuedMaterialValueIncludingGST || 0)}
                  </p>
                </div>
                <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-400">Input GST to claim</p>
                  <p className="text-lg font-semibold font-mono mt-0.5 text-[#FFC14D]">
                    {formatRupees(
                      profitability.totalInputGstClaimable !== undefined
                        ? profitability.totalInputGstClaimable
                        : profitability.inputGstIssuedMaterials || 0
                    )}
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Only the material cost excluding GST is taken from the project budget. GST is tracked separately here.
              </p>
            </div>
          )}
        </>
      )}

      {/* MATERIALS */}
      {activeTab === 'materials' && (() => {
        // Each issue's money split, falling back to the fixed 18% rule for older records
        const lineOf = (m) => {
          const cost = m.actualCostTotal !== undefined ? Number(m.actualCostTotal) : Number(m.quantity) * Number(m.actualCostPrice || 0);
          const gst = m.inputGst != null ? Number(m.inputGst) : roundToTwo(cost * PROJECT_GST_MULTIPLIER);
          const value = m.issuedMaterialValueIncludingGST != null ? Number(m.issuedMaterialValueIncludingGST) : roundToTwo(cost + gst);
          return { ...m, cost, gst, value, dateKey: toApiDateFormat(m.issueDate) || '' };
        };
        const lines = materials
          .map(lineOf)
          .sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || '') || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

        // By material: numbered in the order first issued, so new materials are added at the bottom
        const byMaterial = [];
        const matIndex = {};
        [...lines].reverse().forEach((l) => {
          const key = l.product?.id || l.product?._id || l.productId || (typeof l.product === 'string' ? l.product : '') || l.productName;
          if (!matIndex[key]) {
            matIndex[key] = { key, name: l.productName, sku: l.sku, unit: l.unit, qty: 0, cost: 0, gst: 0, value: 0, lastDate: l.issueDate, issues: [] };
            byMaterial.push(matIndex[key]);
          }
          const g = matIndex[key];
          g.qty += Number(l.quantity) || 0;
          g.cost += l.cost;
          g.gst += l.gst;
          g.value += l.value;
          g.lastDate = l.issueDate;
          g.issues.push(l);
        });

        // By date: one heading per day
        const byDate = [];
        const dateIndex = {};
        lines.forEach((l) => {
          if (!dateIndex[l.dateKey]) {
            dateIndex[l.dateKey] = { key: l.dateKey, date: l.issueDate, qty: 0, cost: 0, gst: 0, value: 0, items: [] };
            byDate.push(dateIndex[l.dateKey]);
          }
          dateIndex[l.dateKey].qty += Number(l.quantity) || 0;
          dateIndex[l.dateKey].cost += l.cost;
          dateIndex[l.dateKey].gst += l.gst;
          dateIndex[l.dateKey].value += l.value;
          dateIndex[l.dateKey].items.push(l);
        });

        const toggleDate = (key) =>
          setExpandedDates((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          });

        const qtyCell = (qty, unit) => (
          <>
            {Number(roundToTwo(qty))} <span className="text-gray-400">{unit}</span>
          </>
        );

        return (
          <div className="space-y-4">
            <SectionHead
              title="Materials issued"
              subtitle="Stock sent from the store to this site."
              actionLabel="Issue material"
              onAction={openIssueModal}
              disabled={isClosedProject}
              disabledTitle={`Cannot issue materials to a ${badge.label.toLowerCase()} project`}
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MiniCard label="Cost (excl. GST)" value={formatRupees(totalActualCost)} />
              <MiniCard label="Input GST @ 18%" value={formatRupees(totalInputGst)} />
              <MiniCard label="Value (incl. GST)" value={formatRupees(totalIssuedValue)} />
              <MiniCard label="Materials" value={byMaterial.length} note={`(${materials.length} issues)`} />
            </div>

            {materials.length === 0 ? (
              <EmptyLine>No materials issued yet.</EmptyLine>
            ) : (
              <>
                {/* View switch */}
                <div className="inline-flex p-1 rounded-xl border border-gray-200 bg-white">
                  {[
                    { key: 'material', label: 'By material' },
                    { key: 'date', label: 'By date' },
                  ].map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setMaterialView(v.key)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        materialView === v.key ? 'bg-[#FFB82E]/15 text-[#FFC14D]' : 'text-gray-400 hover:text-slate-900'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                {materialView === 'material' ? (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs text-gray-600">
                      <thead className="bg-gray-50 text-gray-500 text-[10px]">
                        <tr>
                          <th className="p-3 pr-0 w-10">#</th>
                          <th className="p-3">Material</th>
                          <th className="p-3 text-right">Total qty</th>
                          <th className="p-3 text-right">Cost excl. GST</th>
                          <th className="p-3 text-right">GST 18%</th>
                          <th className="p-3 text-right">Value incl. GST</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {byMaterial.map((g, idx) => (
                          <tr key={g.key} className="hover:bg-[#FFB82E]/[0.05] transition-colors">
                            <td className="p-3 pr-0 text-gray-400 font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <div className="text-slate-900">{g.name}</div>
                              {g.sku && <div className="text-[11px] text-gray-400">{g.sku}</div>}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap text-slate-900">{qtyCell(g.qty, g.unit)}</td>
                            <td className="p-3 text-right font-mono text-slate-900">{formatPaise(g.cost)}</td>
                            <td className="p-3 text-right font-mono">{formatPaise(g.gst)}</td>
                            <td className="p-3 text-right font-mono text-slate-900">{formatPaise(g.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs text-gray-600">
                      <thead className="bg-gray-50 text-gray-500 text-[10px]">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Items</th>
                          <th className="p-3 text-right">Total qty</th>
                          <th className="p-3 text-right">Cost excl. GST</th>
                          <th className="p-3 text-right">GST 18%</th>
                          <th className="p-3 text-right">Value incl. GST</th>
                          <th className="p-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {byDate.map((d) => {
                          const open = expandedDates.has(d.key);
                          // Same material issued twice on one day shows as one line
                          const products = [];
                          const pIndex = {};
                          d.items.forEach((l) => {
                            const k = l.productName;
                            if (!pIndex[k]) {
                              pIndex[k] = { key: k, name: l.productName, unit: l.unit, qty: 0 };
                              products.push(pIndex[k]);
                            }
                            pIndex[k].qty += Number(l.quantity) || 0;
                          });
                          return (
                            <React.Fragment key={d.key}>
                              <tr
                                onClick={() => toggleDate(d.key)}
                                className={`cursor-pointer transition-colors ${open ? 'bg-[#FFB82E]/[0.05]' : 'hover:bg-[#FFB82E]/[0.05]'}`}
                              >
                                <td className="p-3 text-slate-900 whitespace-nowrap">{formatDateShortMonth(d.date, '-')}</td>
                                <td className="p-3 text-right text-slate-900">{products.length}</td>
                                <td className="p-3 text-right text-slate-900">{Number(roundToTwo(d.qty))}</td>
                                <td className="p-3 text-right font-mono text-slate-900">{formatPaise(d.cost)}</td>
                                <td className="p-3 text-right font-mono">{formatPaise(d.gst)}</td>
                                <td className="p-3 text-right font-mono text-slate-900">{formatPaise(d.value)}</td>
                                <td className="p-3 text-gray-400">
                                  <LuChevronDown className={`transition-transform ${open ? 'rotate-180 text-[#FFC14D]' : ''}`} />
                                </td>
                              </tr>
                              {open && (
                                <tr>
                                  <td colSpan={7} className="p-0 bg-gray-50/60">
                                    {/* Long days scroll inside, about 5 products visible */}
                                    <div className="max-h-[11rem] overflow-y-auto">
                                      <table className="w-full text-[11px]">
                                        <tbody className="divide-y divide-gray-100">
                                          {products.map((p, i) => (
                                            <tr key={p.key}>
                                              <td className="py-2 pl-8 pr-2 w-10 text-gray-400">{i + 1}</td>
                                              <td className="py-2 px-3 text-slate-700">{p.name}</td>
                                              <td className="py-2 px-3 text-right whitespace-nowrap w-40">{qtyCell(p.qty, p.unit)}</td>
                                              <td className="w-[45%]"></td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <SectionHead
            title="Expenses"
            subtitle="Transport, rental and other site costs."
            actionLabel="Add expense"
            onAction={() => setIsExpenseModalOpen(true)}
            disabled={isClosedProject}
            disabledTitle={`Cannot add expenses to a ${badge.label.toLowerCase()} project`}
          />

          <div className="grid grid-cols-2 gap-3">
            <MiniCard label="Total expenses" value={formatRupees(totalExpenses)} />
            <MiniCard label="Entries" value={expenses.length} />
          </div>

          {expenses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryTotals).map(([cat, amt]) => (
                <span key={cat} className="px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-500">
                  {categoryLabel(cat)} <span className="font-mono text-slate-900 ml-1">{formatRupees(amt)}</span>
                </span>
              ))}
            </div>
          )}

          {expenses.length === 0 ? (
            <EmptyLine>No expenses recorded yet.</EmptyLine>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-500 text-[10px]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Bill no.</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Added by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-[#FFB82E]/[0.05] transition-colors">
                      <td className="p-3 whitespace-nowrap">{formatDateShortMonth(e.expenseDate, '-')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md border text-[11px] whitespace-nowrap ${BADGE.grey}`}>{categoryLabel(e.category)}</span>
                      </td>
                      <td className="p-3 text-slate-900">{e.description}</td>
                      <td className="p-3">{e.vendorName || '-'}</td>
                      <td className="p-3 text-gray-400">{e.billNumber || '-'}</td>
                      <td className="p-3 text-right font-mono text-slate-900">{formatPaise(e.amount)}</td>
                      <td className="p-3 text-gray-400">{e.createdBy?.name || 'Accounts staff'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* LABOUR */}
      {activeTab === 'labour' && (
        <div className="space-y-4">
          <SectionHead
            title="Labour"
            subtitle="Workers on this site, what they earned and what is still owed."
            actionLabel={canManageLabour ? 'Assign labour' : null}
            onAction={handleOpenAddLabour}
            disabled={isClosedProject}
            disabledTitle={`Cannot assign labour to a ${badge.label.toLowerCase()} project`}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniCard label="Workers" value={labours.length} note={`(${activeLabourCount} active)`} />
            <MiniCard label="Earned" value={formatRupees(totalLabourEarned)} />
            <MiniCard label="Paid" value={formatRupees(totalLabourPaid)} valueClass="text-[#4ADE80]" />
            <MiniCard
              label={totalLabourBalance < 0 ? 'Overpaid' : 'To pay'}
              value={formatRupees(Math.abs(totalLabourBalance))}
              valueClass={totalLabourBalance < 0 ? 'text-rose-500' : totalLabourBalance === 0 ? 'text-slate-900' : 'text-[#FFC14D]'}
            />
          </div>

          {labours.length === 0 ? (
            <EmptyLine>No workers assigned yet.</EmptyLine>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-500 text-[10px]">
                  <tr>
                    <th className="p-3">Worker</th>
                    <th className="p-3 text-right">Daily wage</th>
                    <th className="p-3">Worked</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Earned</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Balance</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {labours.map((l) => {
                    const isActive = l.status === 'ACTIVE';
                    const balance = Number(l.balance || 0);
                    return (
                      <tr key={l.id} className="hover:bg-[#FFB82E]/[0.05] transition-colors">
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/labour/${l.id}`, {
                                state: { backTo: `/projects/${id}`, backLabel: 'Back to project', backState: { tab: 'labour' } },
                              })
                            }
                            className="text-sm text-slate-900 hover:text-[#FFC14D] text-left cursor-pointer transition-colors"
                            title="Open profile"
                          >
                            {l.name}
                          </button>
                          {l.mobile && <div className="text-[11px] text-gray-400">{l.mobile}</div>}
                        </td>
                        <td className="p-3 text-right font-mono">{formatRupees(l.dailyWage)}</td>
                        <td className="p-3 whitespace-nowrap">
                          {formatDateRange(l.assignmentStartDate || l.startDate, l.stoppedAt, 'today')}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap ${
                              isActive ? BADGE.green : BADGE.grey
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-900">{formatPaise(l.totalEarned)}</td>
                        <td className="p-3 text-right font-mono">{formatPaise(l.totalPaid)}</td>
                        <td className={`p-3 text-right font-mono ${balance < 0 ? 'text-rose-500' : balance === 0 ? 'text-gray-400' : 'text-slate-900'}`}>
                          {balance < 0 ? '-' : ''}
                          {formatPaise(Math.abs(balance))}
                          {balance < 0 && <div className="text-[10px] text-rose-500">Overpaid</div>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentLabour(l);
                                setIsPaymentModalOpen(true);
                              }}
                              className="px-4 py-1.5 rounded-lg text-xs bg-[#FFB82E]/10 text-[#FFC14D] border border-[#FFB82E]/30 hover:bg-[#FFB82E]/20 transition-colors cursor-pointer whitespace-nowrap"
                              title="Record payment"
                            >
                              Pay
                            </button>
                            {canManageLabour && (
                              <button
                                type="button"
                                disabled={!isActive || isClosedProject}
                                onClick={() => handleOpenStopLabour(l)}
                                className="px-3 py-1.5 rounded-lg text-xs border transition-colors whitespace-nowrap border-rose-500/30 text-rose-500 hover:bg-rose-500/10 cursor-pointer disabled:border-gray-200 disabled:text-gray-500 disabled:bg-transparent disabled:cursor-not-allowed"
                                title={!isActive ? 'Already stopped' : isClosedProject ? 'Project is closed' : 'Stop this worker'}
                              >
                                Stop
                              </button>
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
      )}

      {/* ISSUE MATERIAL MODAL */}
      {isMaterialModalOpen && (() => {
        const rows = issueLines.map((l) => {
          const prod = findProduct(l.productId);
          const qty = Number(l.quantity) || 0;
          const cost = prod ? roundToTwo(qty * Number(prod.costPrice || 0)) : 0;
          return { ...l, prod, qty, cost, overStock: prod && qty > prod.currentStock };
        });
        const totalCost = roundToTwo(rows.reduce((s, r) => s + r.cost, 0));
        const totalGst = roundToTwo(totalCost * PROJECT_GST_MULTIPLIER);
        const readyCount = rows.filter((r) => r.prod && r.qty > 0).length;
        const anyOverStock = rows.some((r) => r.overStock);
        const chosenIds = rows.map((r) => r.productId).filter(Boolean);
        const inStock = products.filter((p) => Number(p.currentStock) > 0);
        const canAddRow = inStock.some((p) => !chosenIds.includes(p.id || p._id));
        const inputCls =
          'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm bg-transparent text-slate-900 placeholder-gray-500 focus:outline-none focus:border-[#FFB82E]/60 transition-colors';
        const labelCls = 'block text-xs text-gray-400 mb-1.5';

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto hide-scrollbar bg-black/60 backdrop-blur-sm animate-fadeIn">
           <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full shadow-2xl relative">
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-5 pb-1">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Issue material</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    from the store to <span className="text-slate-700">{project.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMaterialModalOpen(false)}
                  disabled={submittingMaterial}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>

              <form onSubmit={handleIssueSubmit} className="px-6 pt-4 pb-5 space-y-4">
                {materialModalError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                    <FaExclamationTriangle className="flex-shrink-0" />
                    <span>{materialModalError}</span>
                  </div>
                )}

                <div className="w-full sm:w-48">
                  <label className={labelCls}>Date</label>
                  <IndianDateInput
                    id="issue-material-date"
                    name="issueDate"
                    value={issueDate}
                    onChange={setIssueDate}
                    className="py-2.5 sm:text-sm"
                  />
                </div>

                {inStock.length === 0 && (
                  <p className="py-3 text-center text-sm text-gray-400">Nothing is in stock right now.</p>
                )}

                {/* Item rows */}
                <div className={`space-y-2 ${inStock.length === 0 ? 'hidden' : ''}`}>
                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_120px_110px_32px] gap-2 text-xs text-gray-400 px-0.5">
                    <span>Material</span>
                    <span>Quantity</span>
                    <span className="text-right">Cost</span>
                    <span></span>
                  </div>
                  {rows.map((r) => (
                    <div key={r.key}>
                      <div className="grid grid-cols-[minmax(0,1fr)_120px_110px_32px] gap-2 items-center">
                        <FilterSelect
                          size="md"
                          value={r.productId}
                          placeholder="Choose from inventory"
                          options={inStock
                            .filter((p) => (p.id || p._id) === r.productId || !chosenIds.includes(p.id || p._id))
                            .map((p) => ({
                              value: p.id || p._id,
                              label: p.name,
                              hint: `${p.currentStock} ${p.unit || 'pcs'}`,
                            }))}
                          onChange={(v) => updateIssueLine(r.key, { productId: v })}
                        />
                        <div className="relative">
                          <input
                            type="number"
                            min="0.0001"
                            step="any"
                            value={r.quantity}
                            onChange={(e) => updateIssueLine(r.key, { quantity: e.target.value })}
                            placeholder="0"
                            className={`${inputCls} pr-11 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                              r.overStock ? 'border-rose-500/60' : ''
                            }`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{r.prod?.unit || 'pcs'}</span>
                        </div>
                        <span className="text-right font-mono text-xs sm:text-sm text-slate-900">{r.cost > 0 ? formatPaise(r.cost) : '-'}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setIssueLines((prev) => (prev.length === 1 ? [newIssueLine()] : prev.filter((x) => x.key !== r.key)))
                          }
                          className="w-8 h-8 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer"
                          title="Remove"
                        >
                          <FaTimes className="text-xs" />
                        </button>
                      </div>
                      {r.prod && (
                        <p className={`text-[11px] mt-1 px-0.5 ${r.overStock ? 'text-rose-400' : 'text-gray-400'}`}>
                          {r.overStock ? 'Not enough stock. ' : ''}
                          {r.prod.currentStock} {r.prod.unit || 'pcs'} available · {formatPaise(r.prod.costPrice)} each
                        </p>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIssueLines((prev) => [...prev, newIssueLine()])}
                    disabled={!canAddRow}
                    title={canAddRow ? 'Add another material' : 'No other materials in stock'}
                    className="text-xs text-[#FFC14D] hover:text-[#FFB82E] inline-flex items-center gap-1.5 pt-1 cursor-pointer disabled:opacity-40"
                  >
                    <FaPlus className="text-[10px]" />
                    Add another material
                  </button>
                </div>

                {/* Totals */}
                {totalCost > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cost (excl. GST)</span>
                      <span className="font-mono text-slate-900">{formatPaise(totalCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">GST {PROJECT_GST_RATE}%</span>
                      <span className="font-mono text-slate-900">{formatPaise(totalGst)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-gray-200">
                      <span className="text-slate-900">Value (incl. GST)</span>
                      <span className="font-mono text-[#FFC14D]">{formatPaise(totalCost + totalGst)}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 pt-0.5">Only the cost excl. GST is taken from the project budget.</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    disabled={submittingMaterial}
                    onClick={() => setIsMaterialModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingMaterial || readyCount === 0 || anyOverStock}
                    className="px-6 py-2.5 rounded-xl bg-[#FFB82E] hover:bg-[#FFC14D] text-[#1A1B1E] font-medium text-sm transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submittingMaterial && <FaSpinner className="animate-spin text-xs" />}
                    {submittingMaterial ? 'Issuing...' : readyCount > 1 ? `Issue ${readyCount} materials` : 'Issue material'}
                  </button>
                </div>
              </form>
            </div>
           </div>
          </div>
        );
      })()}

      {/* ADD EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <FaReceipt className="text-blue-600" />
                  <span>Add project expense</span>
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

      {/* RECORD PAYMENT MODAL */}
      <LabourPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentLabour(null);
        }}
        onSuccess={(message) => {
          toast.success(message);
          fetchData();
        }}
        labour={paymentLabour}
      />

      {/* EDIT PROJECT POPUP (same one the Projects list uses) */}
      <ProjectFormModal
        isOpen={isEditModalOpen}
        project={project}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          setIsEditModalOpen(false);
          fetchData();
        }}
      />

      {/* STOP LABOUR: stop date defaults to today and can be moved within the project timeline */}
      <StopDateModal
        isOpen={isStopModalOpen}
        onClose={() => {
          setIsStopModalOpen(false);
          setLabourToStop(null);
        }}
        onConfirm={handleConfirmStopLabour}
        isLoading={isStopping}
        mode="stop"
        name={labourToStop?.name}
        startDate={labourToStop?.assignmentStartDate || labourToStop?.startDate}
        minDate={toApiDateFormat(labourToStop?.assignmentStartDate || labourToStop?.startDate) || null}
        maxDate={endKey && endKey < toApiDateFormat(new Date()) ? endKey : toApiDateFormat(new Date())}
        dailyWage={labourToStop?.dailyWage}
      />

    </div>
  );
};

export default ProjectDetails;
