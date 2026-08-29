import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/api';
import InvoiceModal from '../components/InvoiceModal';
import { 
  FaShoppingCart, 
  FaSearch, 
  FaEye, 
  FaFileInvoice, 
  FaFileCsv, 
  FaCalendarAlt, 
  FaExclamationTriangle,
  FaCheckCircle
} from 'react-icons/fa';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';

const Sales = () => {
  const { user } = useAuth();
  const showProfit = user?.role === 'ADMIN' || user?.role === 'ACCOUNTS';

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState('all'); // all, today, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Sale for Invoice Modal View
  const [selectedSale, setSelectedSale] = useState(null);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/sales');
      setSales(res.data.data || []);
    } catch (err) {
      console.error('Error fetching sales invoices:', err);
      setError(err.response?.data?.message || 'Failed to load sales invoices history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // Filter Sales Logic
  const filteredSales = sales.filter((s) => {
    const invNum = s.invoiceNumber || '';
    const custName = s.customer?.name || '';
    const custMobile = s.customer?.mobile || '';
    const bizName = s.customer?.businessName || '';
    const notes = s.notes || '';
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      invNum.toLowerCase().includes(term) ||
      custName.toLowerCase().includes(term) ||
      custMobile.toLowerCase().includes(term) ||
      bizName.toLowerCase().includes(term) ||
      notes.toLowerCase().includes(term);

    const matchesStatus = statusFilter ? s.paymentStatus === statusFilter : true;

    // Date Filtering
    let matchesDate = true;
    if (s.createdAt || s.saleDate) {
      const saleTime = new Date(s.saleDate || s.createdAt).getTime();
      const now = new Date();

      if (dateRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        matchesDate = saleTime >= startOfDay && saleTime <= endOfDay;
      } else if (dateRange === 'week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).setHours(0, 0, 0, 0);
        matchesDate = saleTime >= startOfWeek;
      } else if (dateRange === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        matchesDate = saleTime >= startOfMonth;
      } else if (dateRange === 'custom') {
        if (startDate) {
          const sTime = new Date(startDate).setHours(0, 0, 0, 0);
          matchesDate = matchesDate && saleTime >= sTime;
        }
        if (endDate) {
          const eTime = new Date(endDate).setHours(23, 59, 59, 999);
          matchesDate = matchesDate && saleTime <= eTime;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const toast = useToast();

  // CSV Export Functionality (Exports ONLY Active Filtered Sales)
  const exportToCSV = () => {
    if (filteredSales.length === 0) {
      toast.warning('No sales available to export for the current filters.');
      return;
    }

    const headers = [
      'Invoice Number',
      'Date',
      'Customer',
      'Subtotal (INR)',
      'GST (INR)',
      'Grand Total (INR)',
      'Payment Mode',
      'Payment Status',
      'COGS (INR)',
      'Profit (INR)',
    ];

    const rows = filteredSales.map((s) => {
      const dateStr = s.createdAt || s.saleDate
        ? new Date(s.saleDate || s.createdAt).toISOString().split('T')[0]
        : '';

      const custName = s.customer?.name || 'Walk-in Customer';
      const subtotal = (s.subtotal || 0).toFixed(2);
      const totalGst = (s.totalGst || 0).toFixed(2);
      const grandTotal = (s.grandTotal || 0).toFixed(2);
      const cogs = (s.totalCost || 0).toFixed(2);
      const profit = (s.totalProfit || 0).toFixed(2);

      // Escape CSV values containing commas or quotes
      const safeCust = `"${custName.replace(/"/g, '""')}"`;
      const safeInvoice = `"${(s.invoiceNumber || '').replace(/"/g, '""')}"`;

      return [
        safeInvoice,
        dateStr,
        safeCust,
        subtotal,
        totalGst,
        grandTotal,
        s.paymentMode || 'CASH',
        s.paymentStatus || 'PAID',
        cogs,
        profit,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);

    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const todayStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `sales-report-${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Sales Invoices & History</h2>
          <p className="text-gray-500 text-sm">Review completed billing invoices, sales revenue, gross profit, and view/print invoices.</p>
        </div>
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            onClick={exportToCSV}
            disabled={loading || filteredSales.length === 0}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-xs disabled:opacity-40"
            title="Export Active Filtered Sales to CSV"
          >
            <FaFileCsv className="text-sm" />
            <span>Export CSV</span>
          </button>
          <Link
            to="/billing"
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-xs"
          >
            <FaShoppingCart />
            <span>⚡ New Sale / POS</span>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search invoice #, customer name, mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Payment Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500 font-medium text-gray-700"
          >
            <option value="">All Payment Statuses</option>
            <option value="PAID">PAID</option>
            <option value="PENDING">PENDING</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {/* Date Range Quick Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500 font-medium text-gray-700"
          >
            <option value="all">Date Range: All Time</option>
            <option value="today">Date Range: Today</option>
            <option value="week">Date Range: This Week</option>
            <option value="month">Date Range: This Month</option>
            <option value="custom">Date Range: Custom Date Pickers</option>
          </select>
        </div>

        {/* Custom Date Pickers Row */}
        {dateRange === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100 animate-fadeIn text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 font-bold w-20">Start Date:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 font-bold w-20">End Date:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 font-medium pt-1">
          <span>Showing {filteredSales.length} of {sales.length} total sales transactions</span>
          {(searchTerm || statusFilter || dateRange !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setDateRange('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-emerald-600 font-bold underline hover:text-emerald-700"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Sales Table Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading sales invoices...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center space-x-3">
            <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : sales.length === 0 ? (
          /* Empty Sales History State */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              <FaFileInvoice />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">No sales recorded yet</h3>
              <p className="text-xs text-gray-500">Complete sales at the POS terminal to generate invoice transactions.</p>
            </div>
            <Link
              to="/billing"
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2"
            >
              <FaShoppingCart />
              <span>Go to POS Terminal</span>
            </Link>
          </div>
        ) : filteredSales.length === 0 ? (
          /* Empty Search Filter State */
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">No sales match your current search/filter criteria</p>
            <p className="text-xs text-gray-400">Try searching for a different invoice number or clearing date range filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setDateRange('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-emerald-600 font-bold underline hover:text-emerald-700 mt-2"
            >
              Clear Search & Date Filters
            </button>
          </div>
        ) : (
          /* Sales Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[850px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Invoice #</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5 text-center">Items</th>
                  <th className="px-6 py-3.5 text-right">Grand Total</th>
                  {showProfit && <th className="px-6 py-3.5 text-right">Gross Profit</th>}
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.map((s) => {
                  const saleDateStr = s.createdAt || s.saleDate
                    ? new Date(s.saleDate || s.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '-';

                  const itemCount = s.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

                  return (
                    <tr key={s.id || s._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900">{s.invoiceNumber}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{saleDateStr}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800 text-xs">
                          {s.customer?.name || <span className="italic text-gray-400">Walk-in Customer</span>}
                        </div>
                        {s.customer?.mobile && (
                          <div className="text-[11px] font-mono text-gray-400">{s.customer.mobile}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800 text-xs">
                        {itemCount} units
                      </td>
                      <td className="px-6 py-4 text-right font-black text-emerald-700">
                        ₹{(s.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      {showProfit && (
                        <td className="px-6 py-4 text-right font-extrabold text-blue-700">
                          ₹{(s.totalProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            s.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.paymentStatus === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {s.paymentStatus || 'PAID'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedSale(s)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors inline-flex items-center space-x-1.5"
                        >
                          <FaEye />
                          <span>View Invoice</span>
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

      {/* INVOICE MODAL VIEW & PRINT */}
      {selectedSale && (
        <InvoiceModal
          isOpen={Boolean(selectedSale)}
          onClose={() => setSelectedSale(null)}
          saleData={selectedSale}
        />
      )}
    </div>
  );
};

export default Sales;
