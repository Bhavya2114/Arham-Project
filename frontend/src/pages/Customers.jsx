import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/api';
import ConfirmationModal from '../components/ConfirmationModal';
import { 
  FaSearch, 
  FaPlus, 
  FaInfoCircle, 
  FaEdit, 
  FaTrash,
  FaTimes, 
  FaChevronLeft, 
  FaChevronRight, 
  FaUserTag, 
  FaStickyNote,
  FaMapMarkerAlt,
  FaUser,
  FaEnvelope,
  FaPhoneAlt,
  FaBriefcase,
  FaIdCard,
  FaCheckCircle,
  FaExclamationTriangle
} from 'react-icons/fa';

const Customers = () => {
  const { user } = useAuth();
  const isWriter = user?.role === 'ADMIN' || user?.role === 'SALES';
  const isAdmin = user?.role === 'ADMIN';

  // 1. Core lists state
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [total, setTotal] = useState(0);

  // 2. Query filters state
  const [search, setSearch] = useState("");
  const [searchVal, setSearchVal] = useState(""); // Input-controlled state
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  // 3. Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 4. Follow ups state
  const [followUps, setFollowUps] = useState([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [followUpsError, setFollowUpsError] = useState(null);
  const [newFollowUpNote, setNewFollowUpNote] = useState("");
  const [newFollowUpDate, setNewFollowUpDate] = useState("");
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  // 5. Form inputs state
  const [addForm, setAddForm] = useState({
    name: "",
    businessName: "",
    mobile: "",
    email: "",
    type: "RETAIL",
    status: "LEAD",
    address: "",
    gstNumber: "",
    notes: "",
    followUpDate: ""
  });

  const [editForm, setEditForm] = useState({
    id: "",
    name: "",
    businessName: "",
    mobile: "",
    email: "",
    type: "RETAIL",
    status: "LEAD",
    address: "",
    gstNumber: ""
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // 6. Fetch logic
  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (status) params.status = status;
      if (type) params.type = type;

      const res = await axiosInstance.get('/customers', { params });
      setCustomers(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError(err.response?.data?.message || "Failed to load customers list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search, status, type]);

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchVal);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchVal("");
    setSearch("");
    setStatus("");
    setType("");
    setPage(1);
  };

  // Validate form fields
  const validateForm = (form) => {
    const errors = {};
    if (!form.name || !form.name.trim()) errors.name = "Customer name is required.";
    
    if (form.email && form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        errors.email = "Please enter a valid email address.";
      }
    }

    if (form.mobile && form.mobile.trim()) {
      if (form.mobile.trim().length < 7) {
        errors.mobile = "Mobile number must be at least 7 digits.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Details modal & load follow ups
  const openDetails = async (customer) => {
    setActiveCustomer(customer);
    setIsDetailOpen(true);
    setFollowUpsLoading(true);
    setFollowUpsError(null);
    setFollowUps([]);
    try {
      const detailRes = await axiosInstance.get(`/customers/${customer.id}`);
      setActiveCustomer(detailRes.data.data);
      
      const followUpsRes = await axiosInstance.get(`/customers/${customer.id}/follow-ups`);
      setFollowUps(followUpsRes.data.data || []);
    } catch (err) {
      console.error("Error loading details/followups:", err);
      setFollowUpsError(err.response?.data?.message || "Failed to load complete details.");
    } finally {
      setFollowUpsLoading(false);
    }
  };

  // Add Follow-up Note submit
  const handleAddFollowUp = async (e) => {
    e.preventDefault();
    if (!newFollowUpNote.trim()) return;
    setFollowUpSubmitting(true);
    try {
      const payload = { note: newFollowUpNote.trim() };
      if (newFollowUpDate) {
        payload.followUpDate = newFollowUpDate;
      }
      await axiosInstance.post(`/customers/${activeCustomer.id}/follow-ups`, payload);
      setNewFollowUpNote("");
      setNewFollowUpDate("");
      
      const followUpsRes = await axiosInstance.get(`/customers/${activeCustomer.id}/follow-ups`);
      setFollowUps(followUpsRes.data.data || []);
      fetchCustomers();
    } catch (err) {
      console.error("Error adding follow-up:", err);
      setFollowUpsError(err.response?.data?.message || "Failed to add follow-up note.");
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  // Create Customer submit
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm(addForm)) return;

    setFormSubmitting(true);
    try {
      const payload = {
        name: addForm.name.trim(),
        businessName: addForm.businessName ? addForm.businessName.trim() : undefined,
        mobile: addForm.mobile ? addForm.mobile.trim() : undefined,
        email: addForm.email ? addForm.email.trim() : undefined,
        gstNumber: addForm.gstNumber ? addForm.gstNumber.trim() : undefined,
        type: addForm.type,
        status: addForm.status,
        address: addForm.address ? addForm.address.trim() : undefined,
      };
      if (addForm.followUpDate) payload.followUpDate = addForm.followUpDate;
      if (addForm.notes) payload.notes = addForm.notes.trim();

      await axiosInstance.post('/customers', payload);
      setIsAddOpen(false);
      setAddForm({
        name: "",
        businessName: "",
        mobile: "",
        email: "",
        type: "RETAIL",
        status: "LEAD",
        address: "",
        gstNumber: "",
        notes: "",
        followUpDate: ""
      });
      setSuccessMessage(`Customer "${addForm.name.trim()}" created successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setPage(1);
      fetchCustomers();
    } catch (err) {
      console.error("Error creating customer:", err);
      const rawMsg = err.response?.data?.message || "";
      setFormError(rawMsg || "Failed to create customer.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Trigger Edit Customer
  const triggerEdit = (customer) => {
    setEditForm({
      id: customer.id,
      name: customer.name,
      businessName: customer.businessName || "",
      mobile: customer.mobile || "",
      email: customer.email || "",
      type: customer.type || "RETAIL",
      status: customer.status || "LEAD",
      address: customer.address || "",
      gstNumber: customer.gstNumber || ""
    });
    setFieldErrors({});
    setFormError(null);
    setIsEditOpen(true);
  };

  // Edit Customer submit
  const handleEditCustomer = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm(editForm)) return;

    setFormSubmitting(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        businessName: editForm.businessName ? editForm.businessName.trim() : undefined,
        mobile: editForm.mobile ? editForm.mobile.trim() : undefined,
        email: editForm.email ? editForm.email.trim() : undefined,
        gstNumber: editForm.gstNumber ? editForm.gstNumber.trim() : undefined,
        type: editForm.type,
        status: editForm.status,
        address: editForm.address ? editForm.address.trim() : undefined,
      };

      await axiosInstance.put(`/customers/${editForm.id}`, payload);
      setIsEditOpen(false);
      setSuccessMessage(`Customer "${editForm.name.trim()}" updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchCustomers();
      if (activeCustomer?.id === editForm.id) {
        openDetails(editForm);
      }
    } catch (err) {
      console.error("Error editing customer:", err);
      const rawMsg = err.response?.data?.message || "";
      setFormError(rawMsg || "Failed to update customer.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Trigger Delete Customer
  const triggerDelete = (cust) => {
    setCustomerToDelete(cust);
    setIsDeleteOpen(true);
  };

  // Confirm Delete Execution
  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await axiosInstance.delete(`/customers/${customerToDelete.id}`);
      setIsDeleteOpen(false);
      setSuccessMessage(`Customer "${customerToDelete.name}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (err) {
      console.error('Error deleting customer:', err);
      setIsDeleteOpen(false);
      const rawMsg = err.response?.data?.message || '';
      if (rawMsg.includes('sales') || rawMsg.includes('referenced') || err.response?.status === 400) {
        setError(`Unable to delete customer "${customerToDelete.name}" because they have existing sales records.`);
      } else {
        setError(rawMsg || `Failed to delete customer "${customerToDelete.name}".`);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // Badges styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'LEAD': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ACTIVE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'INACTIVE': return 'bg-gray-100 text-gray-600 border-gray-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'RETAIL': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'WHOLESALE': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'DISTRIBUTOR': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Customer CRM Directory</h2>
          <p className="text-gray-500 text-sm">Track customer profiles, contacts, sales history, and operations follow-up notes.</p>
        </div>
        {isWriter && (
          <button
            onClick={() => {
              setFieldErrors({});
              setFormError(null);
              setIsAddOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 self-start sm:self-auto"
          >
            <FaPlus />
            <span>Add New Customer</span>
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

      {/* Search & Filters Controls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2 relative">
            <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search by customer name, business, mobile, email..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500 font-medium text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="LEAD">LEAD</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <div className="flex space-x-2">
            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
            >
              Search
            </button>
            {(search || status || type) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-500 font-bold hover:bg-gray-50"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Customer List Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading customer directory...</p>
          </div>
        ) : customers.length === 0 ? (
          /* Empty Customer State */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              <FaUser />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">
                {search || status ? "No customers match your search criteria" : "No customers registered yet"}
              </h3>
              <p className="text-xs text-gray-500">
                {search || status ? "Try adjusting search query or clearing status filters." : "Add your first customer to build your CRM directory."}
              </p>
            </div>
            {isWriter && !search && !status && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2"
              >
                <FaPlus />
                <span>Add First Customer</span>
              </button>
            )}
          </div>
        ) : (
          /* Customer Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[750px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Customer & Business Name</th>
                  <th className="px-6 py-3.5">Contact Phone & Email</th>
                  <th className="px-6 py-3.5 text-center">Type</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 flex items-center space-x-2">
                        <FaUser className="text-emerald-600 text-xs flex-shrink-0" />
                        <span>{c.name}</span>
                      </div>
                      {c.businessName && (
                        <div className="text-xs text-gray-400 pl-5 flex items-center space-x-1">
                          <FaBriefcase className="text-[10px]" />
                          <span>{c.businessName}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs space-y-0.5">
                      {c.mobile && (
                        <div className="flex items-center space-x-1.5 font-mono text-gray-700">
                          <FaPhoneAlt className="text-[10px] text-gray-400" />
                          <span>{c.mobile}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center space-x-1.5 text-gray-500">
                          <FaEnvelope className="text-[10px] text-gray-400" />
                          <span>{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getTypeBadge(c.type)}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button
                        onClick={() => openDetails(c)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        title="View Customer Details & Notes"
                      >
                        <FaInfoCircle />
                      </button>
                      {isWriter && (
                        <button
                          onClick={() => triggerEdit(c)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit Customer Profile"
                        >
                          <FaEdit />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => triggerDelete(c)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete Customer"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
            <span>Showing Page {page} of {totalPages} ({total} Total Records)</span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40"
              >
                <FaChevronLeft />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40"
              >
                <FaChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE CUSTOMER MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaUser className="text-emerald-600" />
                <span>Add New Customer Profile</span>
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

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Customer Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anish Gupta"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none ${
                      fieldErrors.name ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
                    }`}
                  />
                  {fieldErrors.name && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Business Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Gupta Enterprises"
                    value={addForm.businessName}
                    onChange={(e) => setAddForm({ ...addForm, businessName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Mobile Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={addForm.mobile}
                    onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none ${
                      fieldErrors.mobile ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
                    }`}
                  />
                  {fieldErrors.mobile && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.mobile}</p>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. anish@example.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none ${
                      fieldErrors.email ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
                    }`}
                  />
                  {fieldErrors.email && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Customer Category Type</label>
                  <select
                    value={addForm.type}
                    onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="RETAIL">RETAIL</option>
                    <option value="WHOLESALE">WHOLESALE</option>
                    <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">CRM Lifecycle Status</label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="LEAD">LEAD</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={addForm.gstNumber}
                  onChange={(e) => setAddForm({ ...addForm, gstNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Billing Address</label>
                <textarea
                  rows="2"
                  placeholder="Street address, city, pin code..."
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100">
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
                  <span>{formSubmitting ? 'Saving...' : 'Add Customer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaEdit className="text-blue-600" />
                <span>Edit Customer Profile</span>
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

            <form onSubmit={handleEditCustomer} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Customer Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    value={editForm.businessName}
                    onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Mobile Phone Number</label>
                  <input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
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

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Customer Category Type</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="RETAIL">RETAIL</option>
                    <option value="WHOLESALE">WHOLESALE</option>
                    <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">CRM Lifecycle Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="LEAD">LEAD</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={editForm.gstNumber}
                  onChange={(e) => setEditForm({ ...editForm, gstNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Billing Address</label>
                <textarea
                  rows="2"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100">
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
                  <span>{formSubmitting ? 'Saving...' : 'Update Customer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW CUSTOMER DETAILS & FOLLOW-UP NOTES MODAL */}
      {isDetailOpen && activeCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaInfoCircle className="text-emerald-600" />
                <span>Customer Profile & Follow-Ups</span>
              </h3>
              <button onClick={() => setIsDetailOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                <div className="text-sm font-extrabold text-gray-900">{activeCustomer.name}</div>
                {activeCustomer.businessName && <div className="text-gray-500 font-semibold">{activeCustomer.businessName}</div>}
              </div>

              <div className="grid grid-cols-2 gap-2 text-gray-600">
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">Phone Mobile</span>
                  <span className="font-bold text-gray-800">{activeCustomer.mobile || '-'}</span>
                </div>
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">Email Address</span>
                  <span className="font-bold text-gray-800">{activeCustomer.email || '-'}</span>
                </div>
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">Type</span>
                  <span className="font-bold text-gray-800">{activeCustomer.type}</span>
                </div>
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">Status</span>
                  <span className="font-bold text-gray-800">{activeCustomer.status}</span>
                </div>
              </div>

              {activeCustomer.gstNumber && (
                <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="text-gray-400 block">GSTIN Number:</span>
                  <span className="font-mono font-bold text-gray-800">{activeCustomer.gstNumber}</span>
                </div>
              )}

              {activeCustomer.address && (
                <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="text-gray-400 block">Billing Address:</span>
                  <span className="font-medium text-gray-700">{activeCustomer.address}</span>
                </div>
              )}

              {/* Follow-up Notes Section */}
              <div className="pt-2 space-y-2">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                  <FaStickyNote className="text-amber-500" />
                  <span>CRM Follow-Up Notes ({followUps.length})</span>
                </h4>

                {followUpsLoading ? (
                  <div className="text-center py-4 text-gray-400">Loading notes...</div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {followUps.length === 0 ? (
                      <p className="text-gray-400 italic text-[11px]">No follow-up notes logged yet.</p>
                    ) : (
                      followUps.map((fw) => (
                        <div key={fw.id} className="p-2.5 bg-amber-50/60 border border-amber-100 rounded-xl text-gray-700 space-y-1">
                          <p className="font-medium text-xs">{fw.note}</p>
                          <div className="text-[10px] text-amber-800 font-semibold flex items-center justify-between">
                            <span>By: {fw.creator?.name || 'Staff'}</span>
                            <span>{new Date(fw.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Add Follow-up Note Form */}
                {isWriter && (
                  <form onSubmit={handleAddFollowUp} className="space-y-2 pt-2 border-t border-gray-100">
                    <textarea
                      rows="2"
                      required
                      placeholder="Add operational follow-up note..."
                      value={newFollowUpNote}
                      onChange={(e) => setNewFollowUpNote(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                    ></textarea>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={followUpSubmitting || !newFollowUpNote.trim()}
                        className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg text-xs hover:bg-amber-700 disabled:opacity-50"
                      >
                        {followUpSubmitting ? 'Saving Note...' : 'Add Note'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STYLED CONFIRMATION MODAL FOR DELETE CUSTOMER */}
      <ConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setCustomerToDelete(null);
        }}
        onConfirm={confirmDeleteCustomer}
        title="Delete Customer?"
        message={`Are you sure you want to delete customer "${customerToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Customer"
        cancelText="Cancel"
        isDanger={true}
        isLoading={deleteLoading}
      />
    </div>
  );
};

export default Customers;
