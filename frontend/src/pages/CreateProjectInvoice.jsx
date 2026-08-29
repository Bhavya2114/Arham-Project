import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import {
  FaFileInvoiceDollar,
  FaArrowLeft,
  FaBuilding,
  FaUserCheck,
  FaPlus,
  FaTrash,
  FaSpinner,
  FaCheck,
  FaExclamationTriangle,
  FaReceipt,
  FaBoxOpen,
  FaRupeeSign
} from 'react-icons/fa';

const CreateProjectInvoice = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Selection & Items State
  const [selectedMaterials, setSelectedMaterials] = useState({});
  const [selectedExpenses, setSelectedExpenses] = useState({});
  const [expenseRates, setExpenseRates] = useState({});
  const [manualItems, setManualItems] = useState([]);

  // Invoice Settings
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [projRes, matRes, expRes] = await Promise.all([
          axiosInstance.get(`/projects/${projectId}`),
          axiosInstance.get(`/projects/${projectId}/material-consumptions`),
          axiosInstance.get(`/projects/${projectId}/expenses`),
        ]);

        setProject(projRes.data.data);

        // Filter unbilled materials
        const availMats = (matRes.data.data || []).filter(
          (m) => (m.unbilledQuantity !== undefined ? m.unbilledQuantity : m.quantity) > 0
        );
        setMaterials(availMats);

        // Filter unbilled expenses
        const availExps = (expRes.data.data || []).filter((e) => !e.isBilled);
        setExpenses(availExps);

        // Initialize expense billing rates with actual cost
        const initRates = {};
        availExps.forEach((e) => {
          initRates[e.id] = String(e.amount || 0);
        });
        setExpenseRates(initRates);
      } catch (err) {
        console.error('Error loading project invoice data:', err);
        setError(getErrorMessage(err, 'Failed to load project details for invoicing.'));
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  // Handlers
  const toggleMaterial = (id) => {
    setSelectedMaterials((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpense = (id) => {
    setSelectedExpenses((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpenseRateChange = (id, val) => {
    setExpenseRates((prev) => ({ ...prev, [id]: val }));
  };

  const addManualItem = () => {
    setManualItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        description: '',
        quantity: '1',
        unit: 'Job',
        rate: '',
        gstRate: '18',
      },
    ]);
  };

  const updateManualItem = (id, field, value) => {
    setManualItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeManualItem = (id) => {
    setManualItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Build Payload Line Items
  const buildLineItems = () => {
    const items = [];

    // Selected Materials
    materials.forEach((m) => {
      if (selectedMaterials[m.id]) {
        const unbilledQty = m.unbilledQuantity !== undefined ? m.unbilledQuantity : m.quantity;
        items.push({
          type: 'MATERIAL',
          sourceType: 'MATERIAL_CONSUMPTION',
          sourceId: m.id,
          description: `${m.productName} (Covers ${unbilledQty} ${m.unit})`,
          product: m.productId || m.product?.id,
          quantity: unbilledQty,
          unit: m.unit,
          rate: Number(m.product?.sellingPrice || m.product?.unitPrice || m.billingPrice || 0),
          gstRate: 18,
        });
      }
    });

    // Selected Expenses
    expenses.forEach((e) => {
      if (selectedExpenses[e.id]) {
        const rate = Number(expenseRates[e.id] || 0);
        items.push({
          type: 'EXPENSE',
          sourceType: 'PROJECT_EXPENSE',
          sourceId: e.id,
          description: `${e.description} (${e.category.replace('_', ' ')})`,
          quantity: 1,
          rate: rate,
          gstRate: 18,
        });
      }
    });

    // Manual Items
    manualItems.forEach((m) => {
      if (m.description.trim() && Number(m.rate) >= 0) {
        items.push({
          type: 'SERVICE',
          sourceType: 'MANUAL',
          description: m.description.trim(),
          quantity: Number(m.quantity) || 1,
          unit: m.unit ? m.unit.trim() : 'Job',
          rate: Number(m.rate),
          gstRate: Number(m.gstRate || 0),
        });
      }
    });

    return items;
  };

  const lineItems = buildLineItems();

  // Financial Math Preview
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const discountVal = Number(discount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountVal);
  const rawGst = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.rate * (item.gstRate / 100),
    0
  );
  const gstAmount = subtotal > 0 ? rawGst * (taxableAmount / subtotal) : 0;
  const grandTotal = taxableAmount + gstAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (lineItems.length === 0) {
      setError('Please select at least one material, expense, or add a custom manual line item.');
      return;
    }

    if (discountVal > subtotal) {
      setError('Discount cannot exceed subtotal.');
      return;
    }

    setSubmitting(true);

    const payload = {
      project: projectId,
      items: lineItems,
      discount: discountVal,
      invoiceDate: invoiceDate || undefined,
      dueDate: dueDate || undefined,
      notes: notes ? notes.trim() : undefined,
    };

    try {
      const res = await axiosInstance.post('/project-invoices', payload);
      toast.success('Project invoice generated successfully!');
      navigate(`/projects/${projectId}`);
    } catch (err) {
      console.error('Error generating project invoice:', err);
      const errMsg = getErrorMessage(err, 'Failed to create project invoice.');
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
        <p className="text-sm text-gray-400 font-medium">Loading project information for billing...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="p-8 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
          <FaExclamationTriangle className="text-rose-500 text-4xl mx-auto" />
          <h3 className="text-lg font-extrabold text-slate-900">Project Not Found</h3>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md"
          >
            Back to Projects Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 animate-fadeIn pb-16">
      {/* Top Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="text-xs text-gray-400 font-semibold mb-1 flex items-center space-x-1">
            <Link to="/projects" className="hover:text-emerald-600">Projects</Link>
            <span>&gt;</span>
            <Link to={`/projects/${project.id}`} className="hover:text-emerald-600">{project.projectCode}</Link>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">New Invoice</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center space-x-2">
            <FaFileInvoiceDollar className="text-emerald-600" />
            <span>CREATE PROJECT INVOICE</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Generate a customer billing invoice for materials consumed, site expenses & professional charges.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}`)}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all flex items-center space-x-2 bg-white self-start sm:self-auto"
        >
          <FaArrowLeft />
          <span>Cancel</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <FaExclamationTriangle className="text-rose-500 text-base flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Project & Client Card Header */}
      <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        <div className="space-y-1">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">CONSTRUCTION PROJECT</span>
          <div className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
            <FaBuilding className="text-emerald-600" />
            <span>{project.name}</span>
          </div>
          <div className="text-gray-500">Site: {project.siteAddress}</div>
          <div className="font-mono text-[11px] text-emerald-700 font-bold">Code: {project.projectCode}</div>
        </div>

        <div className="space-y-1">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">CUSTOMER / CLIENT</span>
          <div className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
            <FaUserCheck className="text-emerald-600" />
            <span>{project.customer?.name}</span>
          </div>
          {project.customer?.businessName && <div className="text-gray-600 font-semibold">{project.customer.businessName}</div>}
          <div className="text-gray-500">GSTIN: {project.customer?.gstNumber || 'N/A'} | Phone: {project.customer?.mobile}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1 — UNBILLED MATERIALS CHECKLIST */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <FaBoxOpen className="text-emerald-600" />
                <span>1. Select Unbilled Materials Consumed</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Check material stock transfers to bill to the customer.</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
              {materials.length} available
            </span>
          </div>

          {materials.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-xs text-gray-400">
              No unbilled material consumption records found for this project.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs text-gray-600 min-w-[650px]">
                <thead className="bg-gray-50 font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 w-10 text-center">Select</th>
                    <th className="p-3">Material / Product</th>
                    <th className="p-3 text-center">Unbilled Qty</th>
                    <th className="p-3 text-right">Customer Billing Rate (₹)</th>
                    <th className="p-3 text-right">Total Billing Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {materials.map((m) => {
                    const unbilledQty = m.unbilledQuantity !== undefined ? m.unbilledQuantity : m.quantity;
                    const totVal = unbilledQty * Number(m.billingPrice || 0);
                    const isChecked = !!selectedMaterials[m.id];
                    return (
                      <tr key={m.id} className={`hover:bg-gray-50/60 transition-colors ${isChecked ? 'bg-emerald-50/30' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleMaterial(m.id)}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-slate-900 block">{m.productName}</span>
                          <span className="text-[10px] text-gray-400 font-mono">SKU: {m.sku}</span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-900">
                          {unbilledQty} {m.unit}
                        </td>
                        <td className="p-3 text-right font-extrabold text-emerald-700">
                          ₹{Number(m.billingPrice || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-black text-slate-900">
                          ₹{totVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 2 — UNBILLED PROJECT EXPENSES CHECKLIST */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <FaReceipt className="text-blue-600" />
                <span>2. Select Unbilled Project Expenses</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Select site costs and set customer billing charge amount.</p>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
              {expenses.length} available
            </span>
          </div>

          {expenses.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-xs text-gray-400">
              No unbilled project expenses found for this project.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs text-gray-600 min-w-[650px]">
                <thead className="bg-gray-50 font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 w-10 text-center">Select</th>
                    <th className="p-3">Category & Description</th>
                    <th className="p-3 text-right">Actual Cost (₹)</th>
                    <th className="p-3 text-right w-44">Customer Billing Charge (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {expenses.map((e) => {
                    const isChecked = !!selectedExpenses[e.id];
                    return (
                      <tr key={e.id} className={`hover:bg-gray-50/60 transition-colors ${isChecked ? 'bg-blue-50/30' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleExpense(e.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-slate-900 block">{e.description}</span>
                          <span className="text-[10px] text-gray-400 uppercase font-bold">{e.category.replace('_', ' ')}</span>
                        </td>
                        <td className="p-3 text-right font-bold text-gray-600">
                          ₹{Number(e.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={expenseRates[e.id] !== undefined ? expenseRates[e.id] : e.amount}
                            onChange={(ev) => handleExpenseRateChange(e.id, ev.target.value)}
                            disabled={!isChecked}
                            className="w-36 px-2.5 py-1 border border-gray-300 rounded-lg text-xs font-black text-right focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:opacity-50"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 3 — MANUAL / CUSTOM LINE ITEMS */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <FaPlus className="text-purple-600" />
                <span>3. Custom Billable Services & Extra Line Items</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Add supervision fees, engineering services, or extra work charges.</p>
            </div>
            <button
              type="button"
              onClick={addManualItem}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs rounded-xl transition-all flex items-center space-x-1.5"
            >
              <FaPlus className="text-[10px]" />
              <span>+ Add Line Item</span>
            </button>
          </div>

          {manualItems.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-xs text-gray-400">
              No custom line items added yet. Click "+ Add Line Item" if required.
            </div>
          ) : (
            <div className="space-y-3">
              {manualItems.map((item) => (
                <div key={item.id} className="p-3 border border-gray-200 rounded-xl bg-gray-50/30 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Item Description</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateManualItem(item.id, 'description', e.target.value)}
                      placeholder="e.g. Site Supervision Charges"
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Qty / Unit</label>
                    <div className="flex space-x-1">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateManualItem(item.id, 'quantity', e.target.value)}
                        className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg font-bold text-slate-900 text-center"
                      />
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateManualItem(item.id, 'unit', e.target.value)}
                        placeholder="Job"
                        className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg font-bold text-slate-900 text-center"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Rate (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.rate}
                      onChange={(e) => updateManualItem(item.id, 'rate', e.target.value)}
                      placeholder="e.g. 10000"
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg font-black text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">GST %</label>
                    <select
                      value={item.gstRate}
                      onChange={(e) => updateManualItem(item.id, 'gstRate', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg font-bold text-slate-900"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1 text-right pt-4 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => removeManualItem(item.id)}
                      className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 4 — INVOICE SETTINGS & SUMMARY CALCULATION */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Invoice Dates & Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-gray-100 pb-2">Invoice Details & Notes</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Payment Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Discount Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Invoice Notes / Payment Terms</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes to display on customer invoice document"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50"
              />
            </div>
          </div>

          {/* Realtime Financial Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-200 pb-2">Financial Invoice Preview</h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Selected Line Items:</span>
                <span className="font-mono font-extrabold">{lineItems.length} items</span>
              </div>

              <div className="flex justify-between font-bold text-slate-700">
                <span>Subtotal:</span>
                <span className="font-mono font-extrabold">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between font-bold text-rose-600">
                <span>Discount:</span>
                <span className="font-mono font-extrabold">- ₹{discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200 pt-2">
                <span>Taxable Amount:</span>
                <span className="font-mono">₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between font-bold text-emerald-800">
                <span>Estimated GST (18%):</span>
                <span className="font-mono font-extrabold">+ ₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between font-black text-slate-900 text-base border-t border-slate-300 pt-2">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-700">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || lineItems.length === 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-4"
            >
              {submitting ? (
                <>
                  <FaSpinner className="animate-spin text-sm" />
                  <span>Generating Project Invoice...</span>
                </>
              ) : (
                <>
                  <FaCheck className="text-sm" />
                  <span>Confirm & Generate Invoice</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectInvoice;
