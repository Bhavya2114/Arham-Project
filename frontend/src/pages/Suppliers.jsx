import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axiosInstance from '../utils/api';
import { getErrorMessage } from '../utils/apiError';
import { formatDateShortMonth } from '../utils/dateUtils';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaTimes,
  FaTruck,
  FaSearch,
  FaSpinner,
  FaRupeeSign,
  FaExclamationTriangle,
  FaArrowDown,
  FaArrowUp,
} from 'react-icons/fa';

// "RAJ LAXMI ENTERPRISES" shows as "Raj Laxmi Enterprises"; mixed-case names are left as typed
const displayName = (name) => {
  const text = (name || '').trim();
  if (!/[A-Z]/.test(text) || text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|[\s(/&.-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
};

const gstKey = (gst) => (gst || '').trim().toUpperCase();

const rupees = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const rupeesPaise = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EMPTY_FORM = { name: '', contactPerson: '', mobile: '', gstNumber: '', address: '', email: '' };

const inputCls =
  'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition-colors';

// Add and edit share this popup; `supplier` = the one being edited, null when adding
const SupplierFormModal = ({ isOpen, supplier, onClose, onSaved }) => {
  const isEdit = Boolean(supplier);
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      supplier
        ? {
            name: supplier.name || '',
            contactPerson: supplier.contactPerson || '',
            mobile: supplier.mobile || '',
            gstNumber: supplier.gstNumber || '',
            address: supplier.address || '',
            email: supplier.email || '',
          }
        : EMPTY_FORM
    );
    setFormError(null);
    setSubmitting(false);
  }, [isOpen, supplier]);

  if (!isOpen) return null;

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const handleClose = () => !submitting && onClose();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Supplier name is required.');
      return;
    }
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    const mobile = form.mobile.trim();
    if (mobile && mobile.replace(/\D/g, '').length < 7) {
      setFormError('Phone number must be at least 7 digits.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      mobile,
      gstNumber: gstKey(form.gstNumber),
      address: form.address.trim(),
      email,
    };

    setSubmitting(true);
    try {
      if (isEdit) await axiosInstance.put(`/suppliers/${supplier.id}`, payload);
      else await axiosInstance.post('/suppliers', payload);
      toast.success(`Supplier "${payload.name}" ${isEdit ? 'updated' : 'added'}.`);
      onSaved();
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err, `Failed to ${isEdit ? 'update' : 'add'} supplier.`));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="min-h-full flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && handleClose()}>
        <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[560px]" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-7 pt-6 pb-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{isEdit ? 'Edit supplier' : 'New supplier'}</h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="w-8 h-8 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <FaTimes className="text-xs" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-7 py-4 space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">{formError}</div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Supplier name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. Raj Laxmi Enterprises"
                autoFocus
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact person</label>
                <input type="text" value={form.contactPerson} onChange={set('contactPerson')} placeholder="Who you talk to" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone</label>
                <input type="tel" value={form.mobile} onChange={set('mobile')} placeholder="98XXXXXXXX" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">GSTIN</label>
              <input
                type="text"
                value={form.gstNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))}
                placeholder="08AABCR1234F1Z9"
                maxLength={15}
                className={`${inputCls} tracking-wide`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Address</label>
              <input type="text" value={form.address} onChange={set('address')} placeholder="Shop, area, city" className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="Optional" className={inputCls} />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="text-sm font-semibold text-slate-600 hover:text-slate-800 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting && <FaSpinner className="animate-spin text-xs" />}
                <span>{isEdit ? 'Save changes' : 'Save supplier'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

const Suppliers = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  // Same rules as the backend: admin + warehouse add/edit, only admin deletes
  const canEdit = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE';
  const canDelete = user?.role === 'ADMIN';

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  // '' | 'MONTH', set by the summary cards
  const [cardFilter, setCardFilter] = useState('');
  const [sortBy, setSortBy] = useState('amount');
  const [sortDir, setSortDir] = useState('desc');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/suppliers');
      setSuppliers(res.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load suppliers.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const metrics = useMemo(() => {
    const boughtThisMonth = suppliers.filter((s) => s.monthPurchased > 0);
    const boughtThisYear = suppliers.filter((s) => s.yearPurchased > 0);
    return {
      total: suppliers.length,
      withBills: suppliers.filter((s) => s.billCount > 0).length,
      monthAmount: boughtThisMonth.reduce((acc, s) => acc + s.monthPurchased, 0),
      monthSuppliers: boughtThisMonth.length,
      yearAmount: boughtThisYear.reduce((acc, s) => acc + s.yearPurchased, 0),
      yearSuppliers: boughtThisYear.length,
    };
  }, [suppliers]);

  const toggleCardFilter = (value) => setCardFilter((cur) => (cur === value ? '' : value));
  const cardRing = (selected) =>
    selected ? 'ring-2 ring-[#FFB82E]/60 border-transparent' : 'hover:border-[#FFB82E]/40';

  // Clicking the active sort flips its direction; a new sort starts highest/newest first (name starts A-Z)
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };
  const SortIcon = sortDir === 'desc' ? FaArrowDown : FaArrowUp;

  const visibleSuppliers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = suppliers.filter((s) => {
      if (cardFilter === 'MONTH' && !(s.monthPurchased > 0)) return false;
      if (!term) return true;
      return [s.name, s.contactPerson, s.mobile, s.email, s.gstNumber, s.address].some(
        (v) => v && String(v).toLowerCase().includes(term)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (sortBy === 'name') return displayName(a.name).localeCompare(displayName(b.name)) * dir;
      if (sortBy === 'lastBill') {
        // Suppliers with no bills always sit at the bottom
        const av = a.lastPurchaseDate || '';
        const bv = b.lastPurchaseDate || '';
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return String(av).localeCompare(String(bv)) * dir;
      }
      return ((a.totalPurchased || 0) - (b.totalPurchased || 0)) * dir;
    });
  }, [suppliers, searchTerm, cardFilter, sortBy, sortDir]);

  const openAdd = () => {
    setEditingSupplier(null);
    setIsFormOpen(true);
  };

  const openPurchases = (s) => {
    if (s.billCount > 0) navigate('/purchases', { state: { supplierId: s.id } });
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/suppliers/${supplierToDelete.id}`);
      toast.success(`Supplier "${displayName(supplierToDelete.name)}" deleted.`);
      setSupplierToDelete(null);
      fetchSuppliers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete supplier.'));
      setSupplierToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header: title + what was bought this year */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Suppliers</h2>
          <p className="text-gray-500 text-sm mt-1">
            {metrics.yearAmount > 0 ? (
              <>
                <span className="text-[#FFC14D]">{rupees(metrics.yearAmount)}</span>
                {` bought from ${metrics.yearSuppliers} ${metrics.yearSuppliers === 1 ? 'supplier' : 'suppliers'} this year`}
              </>
            ) : (
              'No purchases this year'
            )}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openAdd}
            className="self-start sm:self-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm whitespace-nowrap cursor-pointer"
          >
            <FaPlus className="text-xs" />
            <span>Add supplier</span>
          </button>
        )}
      </div>

      {/* Summary cards (click to filter, click again to clear) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={() => setCardFilter('')}
          className={`text-left bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${cardRing(cardFilter === '')}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total suppliers</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">{metrics.withBills} with bills</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg shadow-inner">
              <FaTruck />
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleCardFilter('MONTH')}
          className={`text-left bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${cardRing(cardFilter === 'MONTH')}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Bought this month</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">{rupees(metrics.monthAmount)}</h3>
              <p className="text-xs font-semibold text-emerald-700/80 mt-1">
                {metrics.monthSuppliers
                  ? `From ${metrics.monthSuppliers} ${metrics.monthSuppliers === 1 ? 'supplier' : 'suppliers'}`
                  : 'No bills yet this month'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-inner">
              <FaRupeeSign />
            </div>
          </div>
        </button>
      </div>

      {/* Search, sort and count on one row */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search name, phone or GSTIN"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 bg-gray-50/50"
          />
        </div>
        <div className="flex items-center gap-3 lg:ml-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-400 mr-1">Sort by</span>
            {[
              { field: 'name', label: 'Name' },
              { field: 'amount', label: 'Amount bought' },
              { field: 'lastBill', label: 'Last bill' },
            ].map(({ field, label }) => (
              <button
                key={field}
                type="button"
                onClick={() => handleSort(field)}
                className={`px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1.5 ${
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
          <span className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 whitespace-nowrap">
            <span className="text-slate-900 font-semibold">{visibleSuppliers.length}</span>{' '}
            {visibleSuppliers.length === 1 ? 'supplier' : 'suppliers'}
          </span>
        </div>
      </div>

      {/* Suppliers table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading suppliers...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center space-x-3">
            <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : suppliers.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No suppliers yet. They are also added when you record a purchase.</p>
        ) : visibleSuppliers.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No suppliers match these filters.</p>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Supplier</th>
                <th className="px-6 py-3.5">GSTIN</th>
                <th className="px-6 py-3.5 text-center">Bills</th>
                <th className="px-6 py-3.5 text-right">Total bought</th>
                <th className="px-6 py-3.5">Last bill</th>
                {(canEdit || canDelete) && <th className="px-6 py-3.5 text-center w-28">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {visibleSuppliers.map((s) => {
                const hasBills = s.billCount > 0;
                const contact = [s.contactPerson, s.mobile].filter(Boolean).join(' · ');
                return (
                  <tr
                    key={s.id}
                    onClick={() => openPurchases(s)}
                    title={hasBills ? 'See this supplier’s bills' : undefined}
                    className={`group hover:bg-[#FFB82E]/[0.05] transition-colors duration-150 ${hasBills ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-slate-900 ${hasBills ? 'group-hover:text-[#FFC14D]' : ''} transition-colors`}>
                          {displayName(s.name)}
                        </span>
                      </div>
                      <span className="block text-[11px] text-gray-400 mt-0.5">{contact || 'No phone'}</span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {s.gstNumber ? (
                        <span className="text-gray-600 tracking-wide">{s.gstNumber}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 text-[11px] rounded-md border bg-[#FFB82E]/10 text-[#FFC14D] border-[#FFB82E]/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          Missing
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-900">{hasBills ? s.billCount : <span className="text-gray-300">0</span>}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                      {hasBills ? rupeesPaise(s.totalPurchased) : <span className="text-gray-300 font-normal">—</span>}
                    </td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap text-gray-500">
                      {s.lastPurchaseDate ? formatDateShortMonth(s.lastPurchaseDate) : <span className="text-gray-300">No bills</span>}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        {/* Plain icons get a box only on hover; delete is greyed out while the supplier has bills */}
                        <div className="flex items-center justify-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSupplier(s);
                                setIsFormOpen(true);
                              }}
                              title="Edit supplier"
                              className="p-2 rounded-lg text-[#75716A] hover:text-[#F4F1EA] hover:bg-[#2A2B30] transition-colors cursor-pointer"
                            >
                              <FaEdit className="text-sm" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => !hasBills && setSupplierToDelete(s)}
                              disabled={hasBills}
                              title={hasBills ? `Has ${s.billCount} ${s.billCount === 1 ? 'bill' : 'bills'}, can't delete` : 'Delete supplier'}
                              className={`p-2 rounded-lg transition-colors ${
                                hasBills
                                  ? 'text-[#75716A]/40 cursor-not-allowed'
                                  : 'text-[#75716A] hover:text-[#FCA5A5] hover:bg-[#F87171]/10 cursor-pointer'
                              }`}
                            >
                              <FaTrash className="text-sm" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmationModal
        isOpen={Boolean(supplierToDelete)}
        onClose={() => !isDeleting && setSupplierToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete supplier"
        confirmText="Delete supplier"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeleting}
        message={
          <div className="space-y-3">
            <p className="text-gray-800 text-sm">
              Delete <span className="font-semibold text-gray-900">{displayName(supplierToDelete?.name)}</span>?
            </p>
            <div className="bg-white p-2.5 rounded-lg border border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-500">{supplierToDelete?.gstNumber || 'No GSTIN'}</span>
              <span className="text-gray-800">{supplierToDelete?.mobile || 'No phone'}</span>
            </div>
            <p className="text-xs text-gray-500">It has no bills. This can't be undone.</p>
          </div>
        }
      />

      <SupplierFormModal
        isOpen={isFormOpen}
        supplier={editingSupplier}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSupplier(null);
        }}
        onSaved={fetchSuppliers}
      />
    </div>
  );
};

export default Suppliers;
