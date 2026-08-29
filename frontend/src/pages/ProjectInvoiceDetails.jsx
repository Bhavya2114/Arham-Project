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
  FaCalendarAlt,
  FaExclamationTriangle,
  FaPrint,
  FaRupeeSign,
  FaCheckCircle,
  FaMoneyCheckAlt,
  FaPlus,
  FaTimes,
  FaSpinner,
  FaReceipt
} from 'react-icons/fa';

const ProjectInvoiceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Record Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentModalError, setPaymentModalError] = useState(null);

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'BANK_TRANSFER',
    transactionReference: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, pmtRes] = await Promise.all([
        axiosInstance.get(`/project-invoices/${id}`),
        axiosInstance.get(`/project-invoices/${id}/payments`),
      ]);

      setInvoice(invRes.data.data);
      setPayments(pmtRes.data.data || []);
    } catch (err) {
      console.error('Error loading project invoice details:', err);
      setError(getErrorMessage(err, 'Failed to load project invoice details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const handleOpenPaymentModal = () => {
    setPaymentModalError(null);
    setPaymentForm({
      amount: invoice.balanceDue ? String(invoice.balanceDue) : '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: 'BANK_TRANSFER',
      transactionReference: '',
      notes: '',
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentModalError(null);

    const amt = Number(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentModalError('Payment amount must be greater than 0.');
      return;
    }

    if (amt > Number(invoice.balanceDue)) {
      setPaymentModalError(`Payment amount (₹${amt}) cannot exceed outstanding balance (₹${invoice.balanceDue}).`);
      return;
    }

    setSubmittingPayment(true);

    try {
      await axiosInstance.post('/project-invoice-payments', {
        invoice: id,
        amount: amt,
        paymentDate: paymentForm.paymentDate || undefined,
        paymentMode: paymentForm.paymentMode,
        transactionReference: paymentForm.transactionReference ? paymentForm.transactionReference.trim() : undefined,
        notes: paymentForm.notes ? paymentForm.notes.trim() : undefined,
      });

      toast.success('Payment recorded successfully!');
      setIsPaymentModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error recording payment:', err);
      const errMsg = getErrorMessage(err, 'Failed to record payment.');
      setPaymentModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
        <p className="text-sm text-gray-400 font-medium">Loading project invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="p-8 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
          <FaExclamationTriangle className="text-rose-500 text-4xl mx-auto" />
          <h3 className="text-lg font-extrabold text-slate-900">Invoice Not Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">{error || 'The requested project invoice could not be found.'}</p>
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

  const invDateStr = invoice.invoiceDate
    ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '-';
  const dueDateStr = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '-';

  const isFullyPaid = invoice.status === 'PAID' || invoice.balanceDue <= 0.005;
  const isCancelled = invoice.status === 'CANCELLED';

  const businessInfo = (() => {
    try {
      const saved = localStorage.getItem('ims_business_info');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading business info:', e);
    }
    return {};
  })();

  const companyName = businessInfo.name || 'INVENTORY & BILLING MS';
  const companyAddress = businessInfo.address || '101 Commercial Hub, Main Road, City, State - 400001';
  const companyGst = businessInfo.gstin || '27AAAAA0000A1Z5';
  const companyPhone = businessInfo.phone || '+91 98765 43210';
  const companyEmail = businessInfo.email || 'billing@inventoryms.com';

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6 animate-fadeIn pb-16">
      {/* Action Header (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4 no-print">
        <div>
          <div className="text-xs text-gray-400 font-semibold mb-1 flex items-center space-x-1">
            <Link to="/projects" className="hover:text-emerald-600">Projects</Link>
            <span>&gt;</span>
            <Link to={`/projects/${invoice.projectId}`} className="hover:text-emerald-600">
              {invoice.projectSnapshot?.projectCode || 'Project'}
            </Link>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">{invoice.invoiceNumber}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center space-x-2">
            <FaFileInvoiceDollar className="text-emerald-600" />
            <span>PROJECT INVOICE</span>
          </h2>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => navigate(`/projects/${invoice.projectId}`)}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all flex items-center space-x-2 bg-white"
          >
            <FaArrowLeft />
            <span>Back to Project</span>
          </button>

          {!isFullyPaid && !isCancelled && (
            <button
              type="button"
              onClick={handleOpenPaymentModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2"
            >
              <FaMoneyCheckAlt />
              <span>Record Payment</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2"
          >
            <FaPrint />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {/* DOCUMENT PAPER CARD */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm space-y-8 print:shadow-none print:border-none print:p-0" id="printable-invoice">
        {/* Invoice Top Meta Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{companyName}</h1>
            <p className="text-xs text-gray-500 max-w-sm mt-1">{companyAddress}</p>
            <p className="text-xs text-gray-600 mt-1 font-semibold">GSTIN: {companyGst}</p>
            <p className="text-xs text-gray-500">Phone: {companyPhone} | Email: {companyEmail}</p>
          </div>

          <div className="sm:text-right text-xs space-y-1">
            <span className="inline-block px-3 py-1 bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest rounded-md">
              PROJECT TAX INVOICE
            </span>
            <h2 className="text-xl font-black text-slate-900 font-mono pt-1">{invoice.invoiceNumber}</h2>
            <div className="text-gray-500">Invoice Date: <span className="font-bold text-slate-800">{invDateStr}</span></div>
            <div className="text-gray-500">Payment Due Date: <span className="font-bold text-slate-800">{dueDateStr}</span></div>
            <div className={`mt-1 inline-flex items-center space-x-1.5 px-2.5 py-0.5 border rounded-lg text-[11px] font-extrabold ${
              isFullyPaid
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : invoice.status === 'PARTIALLY_PAID'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <FaCheckCircle className={isFullyPaid ? 'text-emerald-600' : 'text-amber-600'} />
              <span>STATUS: {invoice.status}</span>
            </div>
          </div>
        </div>

        {/* Customer & Project Snapshot Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs border-b border-gray-200 pb-6">
          <div className="space-y-2">
            <span className="text-gray-400 font-extrabold uppercase tracking-wider text-[10px]">BILLED TO (CLIENT SNAPSHOT)</span>
            <div className="font-black text-slate-900 text-base">{invoice.customerSnapshot?.name}</div>
            {invoice.customerSnapshot?.businessName && (
              <div className="font-bold text-gray-700">{invoice.customerSnapshot.businessName}</div>
            )}
            <div className="text-gray-600">GSTIN: {invoice.customerSnapshot?.gstNumber || 'Not Provided'}</div>
            <div className="text-gray-600">Phone: {invoice.customerSnapshot?.mobile}</div>
            {invoice.customerSnapshot?.address && (
              <div className="text-gray-500 pt-1">{invoice.customerSnapshot.address}</div>
            )}
          </div>

          <div className="space-y-2 sm:text-right">
            <span className="text-gray-400 font-extrabold uppercase tracking-wider text-[10px]">CONSTRUCTION PROJECT SNAPSHOT</span>
            <div className="font-black text-slate-900 text-base">{invoice.projectSnapshot?.name}</div>
            <div className="font-mono text-emerald-700 font-extrabold">Project Code: {invoice.projectSnapshot?.projectCode}</div>
            <div className="text-gray-600">Site: {invoice.projectSnapshot?.siteAddress}</div>
          </div>
        </div>

        {/* Items Table */}
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Line Items & Billing Breakdown</h3>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs text-gray-600 min-w-[600px]">
              <thead className="bg-gray-50 font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-center">Qty / Unit</th>
                  <th className="p-3 text-right">Rate (₹)</th>
                  <th className="p-3 text-right">GST %</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {invoice.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-extrabold">
                        {item.type}
                      </span>
                    </td>
                    <td className="p-3 font-extrabold text-slate-900">{item.description}</td>
                    <td className="p-3 text-center font-bold text-slate-800">
                      {item.quantity} {item.unit || ''}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{item.rate.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-gray-500">{item.gstRate}%</td>
                    <td className="p-3 text-right font-mono font-black text-slate-900">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary & Totals */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-gray-200 pt-6">
          <div className="max-w-xs space-y-2 text-xs">
            <span className="text-gray-400 font-extrabold uppercase tracking-wider text-[10px]">TERMS & NOTES</span>
            <p className="text-gray-600 italic">{invoice.notes || 'Thank you for your business. Payment due within agreed terms.'}</p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between font-bold text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-extrabold">₹{invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            {invoice.discount > 0 && (
              <div className="flex justify-between font-bold text-rose-600">
                <span>Discount:</span>
                <span className="font-mono font-extrabold">- ₹{invoice.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="flex justify-between font-extrabold text-slate-800 border-t border-gray-100 pt-2">
              <span>Taxable Amount:</span>
              <span className="font-mono">₹{invoice.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between font-bold text-emerald-800">
              <span>GST Total:</span>
              <span className="font-mono font-extrabold">+ ₹{invoice.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between font-black text-slate-900 text-base border-t border-slate-300 pt-2">
              <span>Grand Total:</span>
              <span className="font-mono text-emerald-700">₹{invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 mt-3 text-xs">
              <div className="flex justify-between text-gray-500 font-bold">
                <span>Amount Paid:</span>
                <span className="font-mono font-extrabold text-emerald-700">₹{invoice.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-sm pt-1.5 border-t border-slate-200">
                <span>Balance Outstanding:</span>
                <span className="font-mono text-amber-700">₹{invoice.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PAYMENT HISTORY TABLE */}
        <div className="border-t border-gray-200 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center space-x-2">
              <FaReceipt className="text-emerald-600" />
              <span>Payment Receipts & History ({payments.length})</span>
            </h3>
          </div>

          {payments.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/40 text-xs text-gray-400">
              No payments recorded for this invoice yet.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs text-gray-600 min-w-[650px]">
                <thead className="bg-gray-50 font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Receipt No.</th>
                    <th className="p-3">Payment Date</th>
                    <th className="p-3">Payment Mode</th>
                    <th className="p-3 font-mono">Reference</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                    <th className="p-3 text-right">Received By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {payments.map((p) => {
                    const pDateStr = p.paymentDate
                      ? new Date(p.paymentDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '-';
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 font-mono font-extrabold text-slate-900">{p.paymentNumber}</td>
                        <td className="p-3 text-gray-500 font-mono">{pDateStr}</td>
                        <td className="p-3 font-extrabold text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px]">
                            {p.paymentMode}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-gray-500 text-[11px]">{p.transactionReference || '-'}</td>
                        <td className="p-3 text-right font-mono font-black text-emerald-700 text-sm">
                          ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-gray-500 text-[11px]">
                          {p.receivedBy?.name || 'Accounts Staff'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <FaMoneyCheckAlt className="text-emerald-600" />
                <span>Record Customer Payment</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <FaTimes />
              </button>
            </div>

            {paymentModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {paymentModalError}
              </div>
            )}

            {/* Financial Status Summary */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Invoice Total:</span>
                <span className="font-mono font-bold">₹{invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Already Paid:</span>
                <span className="font-mono font-bold">₹{invoice.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-amber-900 font-extrabold border-t border-slate-200 pt-1">
                <span>Current Outstanding:</span>
                <span className="font-mono text-sm">₹{invoice.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={invoice.balanceDue}
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder={`Max ₹${invoice.balanceDue}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-black text-slate-900 focus:outline-none focus:border-emerald-500 bg-gray-50/50 text-sm"
                />
                {Number(paymentForm.amount) > 0 && (
                  <div className="text-[11px] text-gray-500 mt-1 font-medium flex justify-between">
                    <span>Remaining After Payment:</span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{Math.max(0, invoice.balanceDue - Number(paymentForm.amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentForm.paymentMode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Transaction Reference / UTR / Cheque No.</label>
                <input
                  type="text"
                  value={paymentForm.transactionReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                  placeholder="e.g. UTR123456789 or Cheque #004521"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Optional payment notes or remarks"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 bg-gray-50/50"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {submittingPayment ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <span>Confirm Payment</span>
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

export default ProjectInvoiceDetails;
