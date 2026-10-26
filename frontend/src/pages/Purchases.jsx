import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { FaPlus, FaSearch, FaTruck, FaTimes, FaExclamationTriangle, FaArrowDown, FaArrowUp, FaUndo, FaTrashAlt } from 'react-icons/fa';
import FilterSelect from '../components/FilterSelect';
import IndianDateInput from '../components/IndianDateInput';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDateShortMonth, toApiDateFormat } from '../utils/dateUtils';

const NO_SUPPLIER = '__none__';

const getPurchaseDateKey = (p) => toApiDateFormat(p.purchaseDate || p.invoiceDate);
const getPurchaseTotal = (p) => (p.totalAmount !== undefined && p.totalAmount !== null ? p.totalAmount : (p.grandTotal || 0));
// The bill number as printed (purchaseNumber can carry a suffix when two suppliers share a number)
const getBillNo = (p) => p.invoiceNumber || p.purchaseNumber || '';
const getSupplierKey = (p) => p.supplier?.id || p.supplier?._id || p.supplierId || p.supplier?.name || NO_SUPPLIER;

const Purchases = () => {
  // The Suppliers page opens this list already filtered to one supplier
  const location = useLocation();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(location.state?.supplierId || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // Details Modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activePurchase, setActivePurchase] = useState(null);

  // Delete bill (admin only): the confirm box first shows what comes back out of stock and projects
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const [deletePreview, setDeletePreview] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPurchases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/purchases');
      setPurchases(res.data.data || []);
    } catch (err) {
      console.error('Error fetching purchases history:', err);
      setError(err.response?.data?.message || 'Failed to load purchase history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  // The page itself never scrolls: the bill list gets the height left below the toolbar and scrolls inside
  const listRef = useRef(null);
  const [listMaxHeight, setListMaxHeight] = useState(null);
  useLayoutEffect(() => {
    const fit = () => {
      const list = listRef.current;
      if (!list) return;
      const main = list.closest('main');
      const mainBottom = main ? main.getBoundingClientRect().bottom : window.innerHeight;
      const mainPad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const top = list.getBoundingClientRect().top + (main ? main.scrollTop : 0);
      // 1px card border at the bottom
      setListMaxHeight(Math.max(200, Math.floor(mainBottom - top - mainPad - 1)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [loading, error, purchases.length]);

  // Esc closes the bill popup
  useEffect(() => {
    if (!isDetailOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !isDeleteOpen) setIsDetailOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isDetailOpen, isDeleteOpen]);

  const openDeleteBill = async () => {
    if (!activePurchase) return;
    setIsLoadingPreview(true);
    try {
      const res = await axiosInstance.get(`/purchases/${activePurchase.id}/delete-preview`);
      setDeletePreview(res.data.data || { stockRemoved: [], projectRemoved: [] });
      setIsDeleteOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't check this bill. Please try again.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmDeleteBill = async () => {
    if (!activePurchase) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/purchases/${activePurchase.id}`);
      toast.success(`Bill ${getBillNo(activePurchase)} deleted`);
      setIsDeleteOpen(false);
      setIsDetailOpen(false);
      setActivePurchase(null);
      setDeletePreview(null);
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't delete the bill. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const openDetails = (purchase) => {
    setActivePurchase(purchase);
    setIsDetailOpen(true);
  };

  const supplierOptions = useMemo(() => {
    const map = new Map();
    purchases.forEach((p) => {
      const key = getSupplierKey(p);
      if (!map.has(key)) map.set(key, p.supplier?.name || 'Unknown supplier');
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => {
      if (a.value === NO_SUPPLIER) return 1;
      if (b.value === NO_SUPPLIER) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [purchases]);

  const hasActiveFilters = Boolean(searchTerm || supplierFilter || dateFrom || dateTo);

  const clearFilters = () => {
    setSearchTerm('');
    setSupplierFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // Clicking the active sort field flips its direction; a new field starts newest/highest first
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const filteredPurchases = purchases
    .filter((p) => {
      const num = getBillNo(p);
      const supName = p.supplier?.name || '';
      const notes = p.notes || '';
      const term = searchTerm.toLowerCase();

      const matchesSearch =
        num.toLowerCase().includes(term) ||
        supName.toLowerCase().includes(term) ||
        notes.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (supplierFilter && getSupplierKey(p) !== supplierFilter) return false;

      if (dateFrom || dateTo) {
        const dateKey = getPurchaseDateKey(p);
        if (!dateKey) return false;
        if (dateFrom && dateKey < dateFrom) return false;
        if (dateTo && dateKey > dateTo) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const cmp = sortBy === 'amount'
        ? getPurchaseTotal(a) - getPurchaseTotal(b)
        : getPurchaseDateKey(a).localeCompare(getPurchaseDateKey(b));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortIcon = sortDir === 'desc' ? FaArrowDown : FaArrowUp;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Purchases</h2>
          <p className="text-gray-500 text-sm">Supplier bills and what was received.</p>
        </div>
        <Link
          to="/purchases/new"
          className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors text-xs self-start sm:self-auto"
        >
          <FaPlus />
          <span>Add Purchase Order</span>
        </Link>
      </div>

      {/* Search, filters, sort and count on one row */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
            <FaSearch className="absolute left-3.5 top-3.5 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              placeholder="Search bill no, supplier or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#FFB82E]/60 bg-gray-50/50 text-slate-800 placeholder-gray-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-0.5"
                title="Clear search"
              >
                <FaTimes className="text-xs" />
              </button>
            )}
          </div>

          <div className="w-full sm:w-48">
            <FilterSelect
              value={supplierFilter}
              onChange={setSupplierFilter}
              placeholder="All suppliers"
              options={supplierOptions}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-36">
              <IndianDateInput
                id="purchases-date-from"
                name="dateFrom"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={setDateFrom}
                placeholder="From"
                className="py-2.5"
              />
            </div>
            <span className="text-gray-400">to</span>
            <div className="w-36">
              <IndianDateInput
                id="purchases-date-to"
                name="dateTo"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={setDateTo}
                placeholder="To"
                className="py-2.5"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all cursor-pointer"
            >
              <FaUndo className="text-[10px]" />
              <span>Reset</span>
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 mr-1">Sort by</span>
              {[
                { field: 'date', label: 'Date' },
                { field: 'amount', label: 'Amount' },
              ].map(({ field, label }) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => handleSort(field)}
                  className={`px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                    sortBy === field
                      ? 'bg-[#FFB82E]/10 border-[#FFB82E]/40 text-[#FFC14D]'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                  }`}
                  title={sortBy === field ? 'Click to reverse order' : `Sort by ${label.toLowerCase()}`}
                >
                  <span>{label}</span>
                  {sortBy === field && <SortIcon className="text-[10px]" />}
                </button>
              ))}
            </div>
            <span className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 whitespace-nowrap">
              <span className="text-slate-900 font-semibold">{filteredPurchases.length}</span>{' '}
              {filteredPurchases.length === 1 ? 'bill' : 'bills'}
            </span>
          </div>
        </div>
      </div>

      {/* Purchase List Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading purchase history...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center space-x-3">
            <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : purchases.length === 0 ? (
          /* Empty Purchase History State */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              <FaTruck />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">No purchase records recorded yet</h3>
              <p className="text-xs text-gray-500">Record incoming stock procurement from your vendors to populate inventory levels.</p>
            </div>
            <Link
              to="/purchases/new"
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2"
            >
              <FaPlus />
              <span>Create First Purchase Order</span>
            </Link>
          </div>
        ) : filteredPurchases.length === 0 ? (
          /* Empty Search Filter State */
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">No purchases match your search or filters</p>
            <p className="text-xs text-gray-400">Try a different search term, supplier, or date range.</p>
            <button
              onClick={clearFilters}
              className="text-xs text-emerald-600 font-bold underline hover:text-emerald-700 mt-2"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          /* Purchase History Table: click a row to open the bill */
          <div
            ref={listRef}
            className="overflow-y-auto"
            style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
          >
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="sticky top-0 z-10 bg-white text-xs font-medium text-gray-400 shadow-[0_1px_0_0_rgba(255,255,255,0.08)]">
              <tr>
                <th className="px-6 py-3.5">Bill no</th>
                <th className="px-6 py-3.5">Supplier</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Items</th>
                <th className="px-6 py-3.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPurchases.map((p) => {
                const rawDate = p.purchaseDate || p.invoiceDate;
                const pDate = formatDateShortMonth(rawDate, '-');
                const lineCount = p.items?.length || 0;
                const totalQty = p.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
                const grandTotalVal = getPurchaseTotal(p);

                return (
                  <tr
                    key={p.id || p._id}
                    onClick={() => openDetails(p)}
                    title="Open bill"
                    className="hover:bg-[#FFB82E]/[0.04] transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900">{getBillNo(p)}</td>
                    <td className="px-6 py-4 text-slate-900">
                      {p.supplier?.name || <span className="text-gray-400">Unknown supplier</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-900 whitespace-nowrap">{pDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-slate-900">{lineCount} {lineCount === 1 ? 'item' : 'items'}</span>
                      <span className="text-gray-400"> · {totalQty} qty</span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                      ₹{grandTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

      </div>

      {/* BILL DETAILS POPUP: closes with ✕, Esc or a click outside */}
      {isDetailOpen && activePurchase && (() => {
        const bp = activePurchase;
        const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const billDate = bp.purchaseDate || bp.invoiceDate;
        const rows = (bp.items || []).map((item) => {
          const price = item.originalPrice !== undefined ? Number(item.originalPrice) : Number(item.purchasePrice || 0);
          const qty = Number(item.quantity || 0);
          const taxable = item.taxableAmount !== undefined ? Number(item.taxableAmount) : price * qty;
          const taxRate = Number(item.taxRate || 0);
          const lineTax = item.taxAmount !== undefined && item.taxAmount !== null ? Number(item.taxAmount) : (taxable * taxRate) / 100;
          const sku = item.sku || item.product?.sku || '';
          const unitRaw = item.unit || item.product?.unit || '';
          return {
            name: item.productName || item.product?.name || 'Unknown product',
            // Auto-made codes like PROD-1792346422974-43 mean nothing to a reader, so only real SKUs show
            sku: /^PROD-\d+/.test(sku) ? '' : sku,
            unit: unitRaw ? unitRaw.charAt(0).toUpperCase() + unitRaw.slice(1) : '',
            price,
            qty,
            discountPercent: Number(item.discountPercent || 0),
            perUnit: item.discountedPrice !== undefined ? Number(item.discountedPrice) : (qty > 0 ? taxable / qty : price),
            taxable,
            taxRate,
            lineTax,
            lineTotal: item.totalCost !== undefined && item.totalCost !== null ? Number(item.totalCost) : taxable + lineTax,
          };
        });
        const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
        const taxable = Number(bp.subtotal || 0);
        const discount = Number(bp.totalDiscount || 0);
        const gst = bp.taxAmount !== undefined ? Number(bp.taxAmount) : Number(bp.totalGst || 0);
        const igst = Number(bp.igst || 0);
        const hasSplit = bp.cgst !== undefined && bp.cgst !== null && bp.sgst !== undefined && bp.sgst !== null;
        const roundOff = Number(bp.roundedOffAmount || 0);
        const billTotal = bp.totalAmount !== undefined ? Number(bp.totalAmount) : Number(bp.grandTotal || 0);
        const line = (label, value, cls = 'text-slate-900') => (
          <div className="flex items-center justify-between">
            <span className="text-gray-400">{label}</span>
            <span className={cls}>{value}</span>
          </div>
        );

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isDeleteOpen) setIsDetailOpen(false);
            }}
          >
            <div className="bg-white border border-gray-200 rounded-2xl max-w-6xl w-full h-[85vh] shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Bill {getBillNo(bp)}
                    <span className="text-sm font-normal text-gray-400 ml-2.5">{formatDateShortMonth(billDate, '')}</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    <span className="text-slate-900">{bp.supplier?.name || 'Unknown supplier'}</span>
                    {bp.supplier?.gstNumber && <span> · GSTIN {bp.supplier.gstNumber}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  title="Close"
                  aria-label="Close"
                  className="w-8 h-8 shrink-0 rounded-lg text-gray-400 hover:text-slate-900 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
                {/* Items */}
                <div className="min-h-0 overflow-y-auto lg:border-r border-gray-100">
                  <table className="w-full table-fixed text-left text-xs text-gray-600">
                    <thead className="sticky top-0 z-10 bg-white text-gray-400 text-[11px] font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
                      <tr>
                        <th className="pl-6 pr-2 py-2.5 w-[44px]">#</th>
                        <th className="px-2 py-2.5">Item</th>
                        <th className="px-2 py-2.5 w-[84px] text-right">Qty</th>
                        <th className="px-2 py-2.5 w-[96px] text-right">Rate</th>
                        <th className="px-2 py-2.5 w-[60px] text-right">Disc %</th>
                        <th className="px-2 py-2.5 w-[108px] text-right">Taxable</th>
                        <th className="px-2 py-2.5 w-[56px] text-right">GST %</th>
                        <th className="px-2 py-2.5 w-[92px] text-right">GST</th>
                        <th className="pl-2 pr-6 py-2.5 w-[116px] text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-[#FFB82E]/[0.03] transition-colors">
                          <td className="pl-6 pr-2 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-slate-900 truncate" title={r.name}>{r.name}</span>
                              {r.sku && <span className="text-[11px] text-gray-400 shrink-0">{r.sku}</span>}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-right text-slate-900 whitespace-nowrap">
                            {r.qty} {r.unit && <span className="text-gray-400">{r.unit}</span>}
                          </td>
                          <td className="px-2 py-3 text-right whitespace-nowrap">₹{money(r.price)}</td>
                          <td className="px-2 py-3 text-right">{r.discountPercent}%</td>
                          <td
                            className="px-2 py-3 text-right text-slate-900 whitespace-nowrap"
                            title={r.discountPercent > 0 ? `₹${money(r.perUnit)} per unit after discount` : undefined}
                          >
                            ₹{money(r.taxable)}
                          </td>
                          <td className="px-2 py-3 text-right">{r.taxRate}%</td>
                          <td className="px-2 py-3 text-right text-gray-400 whitespace-nowrap">{money(r.lineTax)}</td>
                          <td className="pl-2 pr-6 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">₹{money(r.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="min-h-0 overflow-y-auto px-5 py-4 flex flex-col text-xs border-t lg:border-t-0 border-gray-100">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-900 mb-1">Summary</h4>
                    {line('Items', `${rows.length} items · ${totalQty} qty`)}
                    {line('Gross (before discount)', `₹${money(taxable + discount)}`)}
                    {discount > 0 && line('Discount', `−₹${money(discount)}`, 'text-emerald-400')}
                    {line('Taxable', `₹${money(taxable)}`)}
                    {igst > 0
                      ? line('IGST', `₹${money(igst)}`)
                      : hasSplit && (
                        <>
                          {line('CGST', `₹${money(bp.cgst)}`)}
                          {line('SGST', `₹${money(bp.sgst)}`)}
                        </>
                      )}
                    {line('Total GST', `₹${money(gst)}`)}
                    {roundOff !== 0 && line('Round off', `${roundOff < 0 ? '−' : '+'}₹${money(Math.abs(roundOff))}`)}
                  </div>
                  {bp.notes && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-gray-400 mb-0.5">Notes</div>
                      <div className="text-slate-900">{bp.notes}</div>
                    </div>
                  )}
                  <div className="mt-auto pt-4 border-t border-gray-100">
                    <div className="text-gray-400">Bill total</div>
                    <div className="text-[#FFB82E] font-semibold text-2xl">₹{money(billTotal)}</div>
                    {/* Rare and risky, so it sits at the bottom, away from ✕ */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={openDeleteBill}
                        disabled={isLoadingPreview}
                        className="mt-4 w-full py-2 rounded-lg text-xs font-medium text-red-500 border border-red-500/40 hover:bg-red-600 hover:text-white hover:border-red-600 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <FaTrashAlt className="text-[10px]" />
                        <span>{isLoadingPreview ? 'Checking...' : 'Delete bill'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <ConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => !isDeleting && setIsDeleteOpen(false)}
        onConfirm={handleConfirmDeleteBill}
        title="Delete bill"
        confirmText="Delete bill"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeleting}
        message={
          <div className="space-y-3 font-normal">
            <p className="text-gray-800 text-sm">
              Delete bill <span className="font-semibold text-gray-900">{activePurchase && getBillNo(activePurchase)}</span>
              {activePurchase?.supplier?.name ? ` from ${activePurchase.supplier.name}` : ''}? The whole bill is erased and can't be undone.
            </p>
            {deletePreview?.stockRemoved?.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Taken out of stock</div>
                <ul className="text-xs text-gray-700 space-y-0.5 max-h-32 overflow-y-auto">
                  {deletePreview.stockRemoved.map((r) => (
                    <li key={r.productId} className="flex justify-between gap-3">
                      <span className="truncate">{r.productName}</span>
                      <span className="shrink-0">{r.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {deletePreview?.projectRemoved?.length > 0 && (
              <div>
                <div className="text-xs text-red-500 mb-1">Already used, taken back from projects</div>
                <ul className="text-xs text-gray-700 space-y-0.5 max-h-32 overflow-y-auto">
                  {deletePreview.projectRemoved.map((r, i) => (
                    <li key={`${r.projectId}-${r.productId}-${i}`} className="flex justify-between gap-3">
                      <span className="truncate">{r.productName} · {r.projectName}</span>
                      <span className="shrink-0">{r.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
};

export default Purchases;
