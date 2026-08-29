import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/api';
import ConfirmationModal from '../components/ConfirmationModal';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaTruck, FaSearch, FaCheckCircle, FaExclamationTriangle, FaEnvelope, FaPhone } from 'react-icons/fa';

const Suppliers = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    gstin: '',
    address: '',
  });

  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    gstin: '',
    address: '',
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/suppliers');
      setSuppliers(res.data.data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setError(err.response?.data?.message || 'Failed to load suppliers list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const triggerAdd = () => {
    setAddForm({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      gstin: '',
      address: '',
    });
    setFieldErrors({});
    setFormError(null);
    setIsAddOpen(true);
  };

  const validateForm = (form) => {
    const errors = {};
    if (!form.name || !form.name.trim()) errors.name = 'Supplier company name is required.';
    
    if (form.email && form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    if (form.phone && form.phone.trim()) {
      if (form.phone.trim().length < 7) {
        errors.phone = 'Phone number must be at least 7 digits.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm(addForm)) return;

    setFormSubmitting(true);
    try {
      await axiosInstance.post('/suppliers', {
        name: addForm.name.trim(),
        contactPerson: addForm.contactPerson ? addForm.contactPerson.trim() : undefined,
        email: addForm.email ? addForm.email.trim() : undefined,
        phone: addForm.phone ? addForm.phone.trim() : undefined,
        gstin: addForm.gstin ? addForm.gstin.trim() : undefined,
        address: addForm.address ? addForm.address.trim() : undefined,
      });

      setIsAddOpen(false);
      setSuccessMessage(`Supplier "${addForm.name.trim()}" created successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchSuppliers();
    } catch (err) {
      console.error('Error creating supplier:', err);
      const rawMsg = err.response?.data?.message || '';
      setFormError(rawMsg || 'Failed to create supplier.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const triggerEdit = (sup) => {
    setEditForm({
      id: sup.id || sup._id,
      name: sup.name,
      contactPerson: sup.contactPerson || '',
      email: sup.email || '',
      phone: sup.phone || '',
      gstin: sup.gstin || '',
      address: sup.address || '',
    });
    setFieldErrors({});
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm(editForm)) return;

    setFormSubmitting(true);
    try {
      await axiosInstance.put(`/suppliers/${editForm.id}`, {
        name: editForm.name.trim(),
        contactPerson: editForm.contactPerson ? editForm.contactPerson.trim() : undefined,
        email: editForm.email ? editForm.email.trim() : undefined,
        phone: editForm.phone ? editForm.phone.trim() : undefined,
        gstin: editForm.gstin ? editForm.gstin.trim() : undefined,
        address: editForm.address ? editForm.address.trim() : undefined,
      });

      setIsEditOpen(false);
      setSuccessMessage(`Supplier "${editForm.name.trim()}" updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchSuppliers();
    } catch (err) {
      console.error('Error updating supplier:', err);
      const rawMsg = err.response?.data?.message || '';
      setFormError(rawMsg || 'Failed to update supplier.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const triggerDelete = (sup) => {
    setSupplierToDelete(sup);
    setIsDeleteOpen(true);
  };

  const confirmDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await axiosInstance.delete(`/suppliers/${supplierToDelete.id || supplierToDelete._id}`);
      setIsDeleteOpen(false);
      setSuccessMessage(`Supplier "${supplierToDelete.name}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setSupplierToDelete(null);
      fetchSuppliers();
    } catch (err) {
      console.error('Error deleting supplier:', err);
      setIsDeleteOpen(false);
      const rawMsg = err.response?.data?.message || '';
      if (rawMsg.includes('purchases') || rawMsg.includes('referenced') || err.response?.status === 400) {
        setError(`Unable to delete supplier "${supplierToDelete.name}" because it is used in existing purchase records.`);
      } else {
        setError(rawMsg || `Failed to delete supplier "${supplierToDelete.name}".`);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(term)) ||
      (s.email && s.email.toLowerCase().includes(term)) ||
      (s.phone && s.phone.toLowerCase().includes(term)) ||
      (s.gstin && s.gstin.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Suppliers Directory</h2>
          <p className="text-gray-500 text-sm">Manage vendor procurement partners and contact details.</p>
        </div>
        {isAdmin && (
          <button
            onClick={triggerAdd}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 self-start sm:self-auto"
          >
            <FaPlus />
            <span>Add Supplier</span>
          </button>
        )}
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-semibold flex items-center space-x-3 shadow-sm animate-fadeIn">
          <FaCheckCircle className="text-emerald-600 text-lg flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-semibold flex items-center space-x-3 shadow-sm">
          <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Table Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
          <div className="relative w-full sm:w-80">
            <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search by supplier name, contact, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>
          <span className="text-xs font-bold text-gray-400 bg-white px-3 py-1.5 rounded-lg border border-gray-200 self-end sm:self-auto">
            {filteredSuppliers.length} Suppliers Active
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading suppliers directory...</p>
          </div>
        ) : suppliers.length === 0 ? (
          /* Empty Suppliers State */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              <FaTruck />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">No suppliers added yet</h3>
              <p className="text-xs text-gray-500">Add suppliers to track inventory procurement and vendors.</p>
            </div>
            {isAdmin && (
              <button
                onClick={triggerAdd}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2"
              >
                <FaPlus />
                <span>Add First Supplier</span>
              </button>
            )}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          /* Empty Search Filter State */
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">No suppliers match your search query</p>
            <p className="text-xs text-gray-400">Try searching for a different company or contact name.</p>
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-emerald-600 font-bold underline hover:text-emerald-700 mt-2"
            >
              Clear Search Filter
            </button>
          </div>
        ) : (
          /* Suppliers Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Supplier Name</th>
                  <th className="px-6 py-3.5">Contact Person</th>
                  <th className="px-6 py-3.5">Phone / Email</th>
                  <th className="px-6 py-3.5">GSTIN</th>
                  {isAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSuppliers.map((s) => (
                  <tr key={s.id || s._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 flex items-center space-x-2">
                      <FaTruck className="text-emerald-600 text-xs flex-shrink-0" />
                      <span>{s.name}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-700">
                      {s.contactPerson || <span className="italic text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 text-xs space-y-0.5">
                      {s.phone && (
                        <div className="flex items-center space-x-1.5 font-mono text-gray-700">
                          <FaPhone className="text-[10px] text-gray-400" />
                          <span>{s.phone}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center space-x-1.5 text-gray-500">
                          <FaEnvelope className="text-[10px] text-gray-400" />
                          <span>{s.email}</span>
                        </div>
                      )}
                      {!s.phone && !s.email && <span className="italic text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-600">
                      {s.gstin || <span className="italic text-gray-400">-</span>}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => triggerEdit(s)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Supplier"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => triggerDelete(s)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Supplier"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE SUPPLIER MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaTruck className="text-emerald-600" />
                <span>Add New Supplier</span>
              </h3>
              <button onClick={() => setIsAddOpen(false)} disabled={formSubmitting} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Company / Supplier Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Tech Distributors"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none ${
                    fieldErrors.name ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
                  }`}
                />
                {fieldErrors.name && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={addForm.contactPerson}
                  onChange={(e) => setAddForm({ ...addForm, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none ${
                      fieldErrors.phone ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
                    }`}
                  />
                  {fieldErrors.phone && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.phone}</p>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. sales@acme.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none ${
                      fieldErrors.email ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
                    }`}
                  />
                  {fieldErrors.email && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.email}</p>}
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={addForm.gstin}
                  onChange={(e) => setAddForm({ ...addForm, gstin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Address</label>
                <textarea
                  rows="2"
                  placeholder="Vendor business address..."
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center space-x-2 disabled:opacity-50"
                >
                  {formSubmitting && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                  <span>{formSubmitting ? 'Saving...' : 'Add Supplier'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaEdit className="text-blue-600" />
                <span>Edit Supplier Details</span>
              </h3>
              <button onClick={() => setIsEditOpen(false)} disabled={formSubmitting} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Company / Supplier Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={editForm.contactPerson}
                  onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={editForm.gstin}
                  onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Address</label>
                <textarea
                  rows="2"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
                >
                  {formSubmitting && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                  <span>{formSubmitting ? 'Saving...' : 'Update Supplier'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STYLED CONFIRMATION MODAL FOR DELETE SUPPLIER */}
      <ConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setSupplierToDelete(null);
        }}
        onConfirm={confirmDeleteSupplier}
        title="Delete Supplier?"
        message={`Are you sure you want to delete supplier "${supplierToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Supplier"
        cancelText="Cancel"
        isDanger={true}
        isLoading={deleteLoading}
      />
    </div>
  );
};

export default Suppliers;
