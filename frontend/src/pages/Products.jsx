import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/api';
import ConfirmationModal from '../components/ConfirmationModal';
import { 
  FaPlus, 
  FaInfoCircle, 
  FaEdit, 
  FaTrash,
  FaTimes, 
  FaBoxes, 
  FaSearch, 
  FaWarehouse,
  FaCheckCircle,
  FaExclamationTriangle
} from 'react-icons/fa';

const Products = () => {
  const { user } = useAuth();
  const isWriter = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE';

  // 1. Products & dropdown data state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockFilter, setStockFilter] = useState('');

  // 2. Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 3. Form fields state
  const [addForm, setAddForm] = useState({
    name: "",
    sku: "",
    category: "",
    supplier: "",
    costPrice: "0",
    unitPrice: "0",
    sellingPrice: "0",
    gstRate: "18",
    currentStock: "0",
    minStockQuantity: "5",
    location: "Main Store",
    unit: "pcs"
  });

  const [editForm, setEditForm] = useState({
    id: "",
    name: "",
    sku: "",
    category: "",
    supplier: "",
    costPrice: "0",
    unitPrice: "0",
    sellingPrice: "0",
    gstRate: "18",
    minStockQuantity: "5",
    location: "Main Store",
    unit: "pcs"
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [formWarning, setFormWarning] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // 4. Fetch Products list, Categories, Suppliers
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes, supRes] = await Promise.allSettled([
        axiosInstance.get('/products'),
        axiosInstance.get('/categories'),
        axiosInstance.get('/suppliers'),
      ]);

      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data.data || []);
      else setError("Failed to load products list.");

      if (catRes.status === 'fulfilled') setCategories(catRes.value.data.data || []);
      if (supRes.status === 'fulfilled') setSuppliers(supRes.value.data.data || []);
    } catch (err) {
      console.error("Error loading products data:", err);
      setError("Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open Add Modal
  const triggerAdd = () => {
    setAddForm({
      name: "",
      sku: "",
      category: categories[0]?.name || "",
      supplier: "",
      costPrice: "0",
      unitPrice: "0",
      sellingPrice: "0",
      gstRate: "18",
      currentStock: "0",
      minStockQuantity: "5",
      location: "Main Store",
      unit: "pcs"
    });
    setFieldErrors({});
    setFormError(null);
    setFormWarning(null);
    setIsAddOpen(true);
  };

  // 5. Open details modal
  const openDetails = async (product) => {
    setActiveProduct(product);
    setIsDetailOpen(true);
    try {
      const res = await axiosInstance.get(`/products/${product.id}`);
      setActiveProduct(res.data.data);
    } catch (err) {
      console.error("Error loading product details:", err);
    }
  };

  // Open Edit Modal
  const triggerEdit = (prod) => {
    setEditForm({
      id: prod.id,
      name: prod.name,
      sku: prod.sku,
      category: prod.category,
      supplier: prod.supplier?._id || prod.supplier || "",
      costPrice: String(prod.costPrice || 0),
      unitPrice: String(prod.unitPrice || prod.sellingPrice || 0),
      sellingPrice: String(prod.sellingPrice || prod.unitPrice || 0),
      gstRate: String(prod.gstRate || 18),
      minStockQuantity: String(prod.minStockQuantity || 5),
      location: prod.location || "Main Store",
      unit: prod.unit || "pcs"
    });
    setFieldErrors({});
    setFormError(null);
    setFormWarning(null);
    setIsEditOpen(true);
  };

  // Form Validation Check
  const validateForm = (form) => {
    const errors = {};
    if (!form.name || !form.name.trim()) errors.name = "Product name is required.";
    if (!form.sku || !form.sku.trim()) errors.sku = "SKU barcode identifier is required.";
    if (!form.category || !form.category.trim()) errors.category = "Category selection is required.";
    
    const cost = parseFloat(form.costPrice);
    if (isNaN(cost) || cost < 0) errors.costPrice = "Cost price cannot be negative.";
    
    const selling = parseFloat(form.sellingPrice);
    if (isNaN(selling) || selling < 0) errors.sellingPrice = "Selling price cannot be negative.";

    if (form.currentStock !== undefined) {
      const stock = parseInt(form.currentStock, 10);
      if (isNaN(stock) || stock < 0) errors.currentStock = "Current stock cannot be negative.";
    }

    const minStock = parseInt(form.minStockQuantity, 10);
    if (isNaN(minStock) || minStock < 0) errors.minStockQuantity = "Minimum stock threshold cannot be negative.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check Selling Price Warning
  const checkPriceWarning = (costStr, sellingStr) => {
    const cost = parseFloat(costStr) || 0;
    const selling = parseFloat(sellingStr) || 0;
    if (selling > 0 && selling < cost) {
      setFormWarning("Warning: Selling price is below cost price (potential negative margin).");
    } else {
      setFormWarning(null);
    }
  };

  // 6. Create Product submit
  const handleAddProduct = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm(addForm)) return;

    setFormSubmitting(true);
    try {
      const payload = {
        name: addForm.name.trim(),
        sku: addForm.sku.trim(),
        category: addForm.category.trim(),
        supplier: addForm.supplier || undefined,
        costPrice: parseFloat(addForm.costPrice) || 0,
        unitPrice: parseFloat(addForm.sellingPrice) || parseFloat(addForm.unitPrice) || 0,
        sellingPrice: parseFloat(addForm.sellingPrice) || parseFloat(addForm.unitPrice) || 0,
        gstRate: parseFloat(addForm.gstRate) || 18,
        currentStock: parseInt(addForm.currentStock, 10) || 0,
        minStockQuantity: parseInt(addForm.minStockQuantity, 10) || 5,
        location: addForm.location || "Main Store",
        unit: addForm.unit || "pcs"
      };

      await axiosInstance.post('/products', payload);
      setIsAddOpen(false);
      setSuccessMessage(`Product "${addForm.name}" created successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchData();
    } catch (err) {
      console.error("Error creating product:", err);
      const rawMsg = err.response?.data?.message || "";
      if (rawMsg.includes("SKU") || rawMsg.includes("duplicate")) {
        setFieldErrors((prev) => ({ ...prev, sku: "A product with this SKU already exists." }));
        setFormError("Product with this SKU already exists.");
      } else {
        setFormError(rawMsg || "Failed to create product.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // 7. Update Product submit
  const handleEditProduct = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm(editForm)) return;

    setFormSubmitting(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        sku: editForm.sku.trim(),
        category: editForm.category.trim(),
        supplier: editForm.supplier || undefined,
        costPrice: parseFloat(editForm.costPrice) || 0,
        unitPrice: parseFloat(editForm.sellingPrice) || parseFloat(editForm.unitPrice) || 0,
        sellingPrice: parseFloat(editForm.sellingPrice) || parseFloat(editForm.unitPrice) || 0,
        gstRate: parseFloat(editForm.gstRate) || 18,
        minStockQuantity: parseInt(editForm.minStockQuantity, 10) || 5,
        location: editForm.location || "Main Store",
        unit: editForm.unit || "pcs"
      };

      await axiosInstance.put(`/products/${editForm.id}`, payload);
      setIsEditOpen(false);
      setSuccessMessage(`Product "${editForm.name}" updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchData();
    } catch (err) {
      console.error("Error updating product:", err);
      const rawMsg = err.response?.data?.message || "";
      if (rawMsg.includes("SKU") || rawMsg.includes("duplicate")) {
        setFieldErrors((prev) => ({ ...prev, sku: "A product with this SKU already exists." }));
        setFormError("Product with this SKU already exists.");
      } else {
        setFormError(rawMsg || "Failed to update product.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Trigger Delete Confirmation Modal
  const triggerDelete = (prod) => {
    setProductToDelete(prod);
    setIsDeleteOpen(true);
  };

  // Confirm Delete Product Execution
  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await axiosInstance.delete(`/products/${productToDelete.id}`);
      setIsDeleteOpen(false);
      setSuccessMessage(`Product "${productToDelete.name}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setProductToDelete(null);
      fetchData();
    } catch (err) {
      console.error("Error deleting product:", err);
      setIsDeleteOpen(false);
      const rawMsg = err.response?.data?.message || "";
      if (rawMsg.includes("sales") || rawMsg.includes("purchases") || rawMsg.includes("referenced") || err.response?.status === 400) {
        setError(`Unable to delete "${productToDelete.name}". It may still be referenced in existing sales or purchase transactions.`);
      } else {
        setError(rawMsg || `Unable to delete product "${productToDelete.name}".`);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered Products Logic
  const filteredProducts = products.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory ? p.category === selectedCategory : true;

    let matchesStock = true;
    if (stockFilter === 'IN_STOCK') matchesStock = p.currentStock > (p.minStockQuantity || 5);
    else if (stockFilter === 'LOW_STOCK') matchesStock = p.currentStock > 0 && p.currentStock <= (p.minStockQuantity || 5);
    else if (stockFilter === 'OUT_OF_STOCK') matchesStock = p.currentStock === 0;

    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Inventory Catalog</h2>
          <p className="text-gray-500 text-sm">Manage products, pricing, minimum stock thresholds, and suppliers.</p>
        </div>

        {isWriter && (
          <button
            onClick={triggerAdd}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 self-start sm:self-auto"
          >
            <FaPlus />
            <span>Add New Product</span>
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

      {/* Search & Filter Controls */}
      <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search by Product Name, SKU, Category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Categories ({categories.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        {/* Stock Status Filter */}
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Stock Levels</option>
          <option value="IN_STOCK">In Stock (Normal)</option>
          <option value="LOW_STOCK">Low Stock Alert</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>
      </div>

      {/* Products Table Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading inventory products...</p>
          </div>
        ) : products.length === 0 ? (
          /* Empty Inventory Catalog State */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              <FaBoxes />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">No products found in inventory</h3>
              <p className="text-xs text-gray-500">Add your first product to start tracking inventory levels and selling at POS.</p>
            </div>
            {isWriter && (
              <button
                onClick={triggerAdd}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2"
              >
                <FaPlus />
                <span>Add Your First Product</span>
              </button>
            )}
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty Search Filter State */
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">No products match your search/filter criteria</p>
            <p className="text-xs text-gray-400">Try adjusting search keywords or clearing stock status filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setStockFilter('');
              }}
              className="text-xs text-emerald-600 font-bold underline hover:text-emerald-700 mt-2"
            >
              Clear Search & Filters
            </button>
          </div>
        ) : (
          /* Products Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Product Name & SKU</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5 text-right">Cost Price</th>
                  <th className="px-6 py-3.5 text-right">Selling Price</th>
                  <th className="px-6 py-3.5 text-center">Stock Level</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const isLow = p.currentStock > 0 && p.currentStock <= (p.minStockQuantity || 5);
                  const isOut = p.currentStock === 0;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-xs font-mono text-gray-400">{p.sku}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-gray-600">{p.category}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-500">
                        ₹{(p.costPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-extrabold text-emerald-700">
                        ₹{(p.sellingPrice || p.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">
                        {p.currentStock} <span className="text-xs text-gray-400 font-normal">{p.unit || 'pcs'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isOut ? (
                          <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">Out of Stock</span>
                        ) : isLow ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">Low Stock ({p.currentStock})</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">In Stock</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <button
                          onClick={() => openDetails(p)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                          title="View Details"
                        >
                          <FaInfoCircle />
                        </button>
                        {isWriter && (
                          <>
                            <button
                              onClick={() => triggerEdit(p)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit Product"
                            >
                              <FaEdit />
                            </button>
                            {user?.role === 'ADMIN' && (
                              <button
                                onClick={() => triggerDelete(p)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete Product"
                              >
                                <FaTrash />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE PRODUCT MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaBoxes className="text-emerald-600" />
                <span>Add New Product to Inventory</span>
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

            {formWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <FaExclamationTriangle className="text-amber-600 flex-shrink-0" />
                <span>{formWarning}</span>
              </div>
            )}

            <form onSubmit={handleAddProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wireless Mouse"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none ${
                      fieldErrors.name ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
                    }`}
                  />
                  {fieldErrors.name && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">SKU / Barcode <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LOGI-WM-001"
                    value={addForm.sku}
                    onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none ${
                      fieldErrors.sku ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
                    }`}
                  />
                  {fieldErrors.sku && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.sku}</p>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Supplier (Optional)</label>
                  <select
                    value={addForm.supplier}
                    onChange={(e) => setAddForm({ ...addForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addForm.costPrice}
                    onChange={(e) => {
                      setAddForm({ ...addForm, costPrice: e.target.value });
                      checkPriceWarning(e.target.value, addForm.sellingPrice);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                  {fieldErrors.costPrice && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.costPrice}</p>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Selling Price (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addForm.sellingPrice}
                    onChange={(e) => {
                      setAddForm({ ...addForm, sellingPrice: e.target.value, unitPrice: e.target.value });
                      checkPriceWarning(addForm.costPrice, e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 font-extrabold text-emerald-800"
                  />
                  {fieldErrors.sellingPrice && <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.sellingPrice}</p>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">GST Tax Rate (%)</label>
                  <select
                    value={addForm.gstRate}
                    onChange={(e) => setAddForm({ ...addForm, gstRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="0">0% (GST Exempt)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST (Standard)</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.currentStock}
                    onChange={(e) => setAddForm({ ...addForm, currentStock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Minimum Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.minStockQuantity}
                    onChange={(e) => setAddForm({ ...addForm, minStockQuantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    placeholder="pcs, kg, box, mtr"
                    value={addForm.unit}
                    onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
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
                  <span>{formSubmitting ? 'Saving...' : 'Add Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaEdit className="text-blue-600" />
                <span>Edit Product Specification</span>
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

            {formWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <FaExclamationTriangle className="text-amber-600 flex-shrink-0" />
                <span>{formWarning}</span>
              </div>
            )}

            <form onSubmit={handleEditProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">SKU / Barcode <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Supplier (Optional)</label>
                  <select
                    value={editForm.supplier}
                    onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.costPrice}
                    onChange={(e) => {
                      setEditForm({ ...editForm, costPrice: e.target.value });
                      checkPriceWarning(e.target.value, editForm.sellingPrice);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Selling Price (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.sellingPrice}
                    onChange={(e) => {
                      setEditForm({ ...editForm, sellingPrice: e.target.value, unitPrice: e.target.value });
                      checkPriceWarning(editForm.costPrice, e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 font-extrabold text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">GST Tax Rate (%)</label>
                  <select
                    value={editForm.gstRate}
                    onChange={(e) => setEditForm({ ...editForm, gstRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="0">0% (GST Exempt)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST (Standard)</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Minimum Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.minStockQuantity}
                    onChange={(e) => setEditForm({ ...editForm, minStockQuantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
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
                  <span>{formSubmitting ? 'Saving...' : 'Update Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PRODUCT DETAILS MODAL */}
      {isDetailOpen && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <FaInfoCircle className="text-emerald-600" />
                <span>Product Specifications</span>
              </h3>
              <button onClick={() => setIsDetailOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                <div className="text-sm font-extrabold text-gray-900">{activeProduct.name}</div>
                <div className="font-mono text-gray-400">SKU: {activeProduct.sku}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-gray-600">
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">Category</span>
                  <span className="font-bold text-gray-800">{activeProduct.category}</span>
                </div>
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">Current Stock</span>
                  <span className="font-bold text-gray-800">{activeProduct.currentStock} {activeProduct.unit || 'pcs'}</span>
                </div>
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">Cost Price</span>
                  <span className="font-bold text-gray-800">₹{(activeProduct.costPrice || 0).toFixed(2)}</span>
                </div>
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">Selling Price</span>
                  <span className="font-extrabold text-emerald-700">₹{(activeProduct.sellingPrice || activeProduct.unitPrice || 0).toFixed(2)}</span>
                </div>
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">GST Rate</span>
                  <span className="font-bold text-gray-800">{activeProduct.gstRate || 18}%</span>
                </div>
                <div className="p-2 border border-gray-100 rounded-lg">
                  <span className="text-gray-400 block">Min Threshold</span>
                  <span className="font-bold text-gray-800">{activeProduct.minStockQuantity || 5}</span>
                </div>
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

      {/* STYLED CONFIRMATION MODAL FOR DELETE PRODUCT */}
      <ConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={confirmDeleteProduct}
        title="Delete Product?"
        message={`Are you sure you want to delete product "${productToDelete?.name}" (${productToDelete?.sku})? This action cannot be undone.`}
        confirmText="Delete Product"
        cancelText="Cancel"
        isDanger={true}
        isLoading={deleteLoading}
      />
    </div>
  );
};

export default Products;
