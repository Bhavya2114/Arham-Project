import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/api';
import ConfirmationModal from '../components/ConfirmationModal';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaTags, FaSearch, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const Categories = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formError, setFormError] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({ name: '', description: '' });
  const [editForm, setEditForm] = useState({ id: '', name: '', description: '' });

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/categories');
      setCategories(res.data.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError(err.response?.data?.message || 'Failed to load categories list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const triggerAdd = () => {
    setAddForm({ name: '', description: '' });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = addForm.name.trim();
    if (!trimmedName) {
      setFormError('Category name is required and cannot be empty.');
      return;
    }

    setFormSubmitting(true);
    try {
      await axiosInstance.post('/categories', {
        name: trimmedName,
        description: addForm.description.trim(),
      });
      setIsAddOpen(false);
      setAddForm({ name: '', description: '' });
      setSuccessMessage(`Category "${trimmedName}" created successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchCategories();
    } catch (err) {
      console.error('Error creating category:', err);
      const rawMsg = err.response?.data?.message || '';
      if (rawMsg.includes('already exists')) {
        setFormError(`Category "${trimmedName}" already exists.`);
      } else {
        setFormError(rawMsg || 'Failed to create category.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const triggerEdit = (cat) => {
    setEditForm({ id: cat.id, name: cat.name, description: cat.description || '' });
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = editForm.name.trim();
    if (!trimmedName) {
      setFormError('Category name is required and cannot be empty.');
      return;
    }

    setFormSubmitting(true);
    try {
      await axiosInstance.put(`/categories/${editForm.id}`, {
        name: trimmedName,
        description: editForm.description.trim(),
      });
      setIsEditOpen(false);
      setSuccessMessage(`Category "${trimmedName}" updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchCategories();
    } catch (err) {
      console.error('Error updating category:', err);
      const rawMsg = err.response?.data?.message || '';
      if (rawMsg.includes('already exists')) {
        setFormError(`Category "${trimmedName}" already exists.`);
      } else {
        setFormError(rawMsg || 'Failed to update category.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const triggerDelete = (cat) => {
    setCategoryToDelete(cat);
    setIsDeleteOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await axiosInstance.delete(`/categories/${categoryToDelete.id}`);
      setIsDeleteOpen(false);
      setSuccessMessage(`Category "${categoryToDelete.name}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      setIsDeleteOpen(false);
      const rawMsg = err.response?.data?.message || '';
      if (rawMsg.includes('products') || rawMsg.includes('in use') || err.response?.status === 400) {
        setError(`Cannot delete category "${categoryToDelete.name}" because products are still using it.`);
      } else {
        setError(rawMsg || `Failed to delete category "${categoryToDelete.name}".`);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Category Taxonomy</h2>
          <p className="text-gray-500 text-sm">Organize products into structured inventory categories.</p>
        </div>
        {isAdmin && (
          <button
            onClick={triggerAdd}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 self-start sm:self-auto"
          >
            <FaPlus />
            <span>Create Category</span>
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

      {/* Search Bar & Table Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden space-y-4">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
          <div className="relative w-full sm:w-72">
            <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search category name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>
          <span className="text-xs font-bold text-gray-400 bg-white px-3 py-1.5 rounded-lg border border-gray-200 self-end sm:self-auto">
            {filteredCategories.length} Categories Total
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          /* Empty Inventory State */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              <FaTags />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">No categories created yet</h3>
              <p className="text-xs text-gray-500">Create product categories to organize your store inventory taxonomy.</p>
            </div>
            {isAdmin && (
              <button
                onClick={triggerAdd}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2"
              >
                <FaPlus />
                <span>Create First Category</span>
              </button>
            )}
          </div>
        ) : filteredCategories.length === 0 ? (
          /* Empty Search Filter State */
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">No categories match your search filter</p>
            <p className="text-xs text-gray-400">Try searching for a different term or clear the filter.</p>
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-emerald-600 font-bold underline hover:text-emerald-700 mt-2"
            >
              Clear Search Filter
            </button>
          </div>
        ) : (
          /* Categories Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Category Name</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5 text-center">Products Count</th>
                  {isAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 flex items-center space-x-2">
                      <FaTags className="text-emerald-600 text-xs flex-shrink-0" />
                      <span>{cat.name}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {cat.description || <span className="italic text-gray-400">No description</span>}
                    </td>
                    <td className="px-6 py-4 text-center font-extrabold text-slate-800">
                      {cat.productCount !== undefined ? cat.productCount : '-'}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => triggerEdit(cat)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Category"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => triggerDelete(cat)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Category"
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

      {/* CREATE CATEGORY MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaTags className="text-emerald-600" />
                <span>Create New Category</span>
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                disabled={formSubmitting}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electronics, Hardware, Office Supplies"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  rows="3"
                  placeholder="Enter optional description..."
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center space-x-2 disabled:opacity-50"
                >
                  {formSubmitting && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                  <span>{formSubmitting ? 'Saving...' : 'Create Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CATEGORY MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaEdit className="text-blue-600" />
                <span>Edit Category</span>
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                disabled={formSubmitting}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  rows="3"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
                >
                  {formSubmitting && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                  <span>{formSubmitting ? 'Saving...' : 'Update Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STYLED CONFIRMATION MODAL FOR DELETE CATEGORY */}
      <ConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setCategoryToDelete(null);
        }}
        onConfirm={confirmDeleteCategory}
        title="Delete Category?"
        message={`Are you sure you want to delete category "${categoryToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Category"
        cancelText="Cancel"
        isDanger={true}
        isLoading={deleteLoading}
      />
    </div>
  );
};

export default Categories;
