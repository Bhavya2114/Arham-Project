import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { 
  FaPlus, 
  FaTrash, 
  FaExclamationTriangle, 
  FaArrowLeft,
  FaArrowRight,
  FaRobot,
  FaCheckCircle,
  FaInfoCircle
} from 'react-icons/fa';

const AddPurchase = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Incoming state (from bill upload or review page back navigation)
  const incomingState = location.state || {};

  // Supplier state (database supplier ID)
  const [supplierId, setSupplierId] = useState(incomingState.supplierId || '');

  // Header 4 fields
  const [invoiceNumber, setInvoiceNumber] = useState(incomingState.invoiceNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(
    incomingState.invoiceDate || new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(incomingState.notes || '');

  const createEmptyItemRow = () => ({
    id: Date.now() + Math.random(),
    selected: true,
    productId: '',
    isNewProduct: false,
    newProduct: null,
    quantity: 1,
    unit: 'Pcs',
    unitPrice: 0,
    sellingPrice: 0,
    gstPercent: 18,
  });

  // Table Line Items State
  const [items, setItems] = useState(
    incomingState.items && incomingState.items.length > 0
      ? incomingState.items
      : []
  );

  const [formError, setFormError] = useState(null);

  const fetchPrerequisites = async () => {
    setLoading(true);
    try {
      const [supRes, prodRes] = await Promise.all([
        axiosInstance.get('/suppliers'),
        axiosInstance.get('/products'),
      ]);
      const fetchedSuppliers = supRes.data.data || [];
      const fetchedProducts = prodRes.data.data || [];

      setSuppliers(fetchedSuppliers);
      setProducts(fetchedProducts);

      // Auto select first supplier if available and not set
      if (fetchedSuppliers.length > 0 && !supplierId && !incomingState.isAiExtracted) {
        setSupplierId(fetchedSuppliers[0].id || fetchedSuppliers[0]._id);
      }
    } catch (err) {
      console.error('Error fetching purchase prerequisites:', err);
      setError(getErrorMessage(err, 'Failed to load suppliers or products list. Please refresh.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrerequisites();
  }, []);

  // Add Empty Item Row
  const handleAddItemRow = () => {
    setItems((prev) => [...prev, createEmptyItemRow()]);
  };

  // Toggle Single Row Selection
  const handleToggleSelectRow = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Toggle All Rows Selection
  const handleToggleSelectAll = (checked) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  // Delete Selected Rows
  const handleDeleteSelected = () => {
    const selectedCount = items.filter((i) => i.selected).length;
    if (selectedCount === 0) {
      toast.error('Please check at least one item row to delete.');
      return;
    }
    setItems((prev) => prev.filter((i) => !i.selected));
  };

  // Update Line Item Field
  const handleItemFieldChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // When Product selection changes, update default prices and GST if not explicitly set
        if (field === 'productId') {
          if (value === 'NEW') {
            updated.isNewProduct = true;
            updated.productId = '';
            updated.sellingPrice = item.sellingPrice || 0;
            updated.newProduct = {
              name: item.extractedItemName || 'New Product',
              unit: item.unit || 'Pcs',
              unitPrice: item.unitPrice || 0,
              sellingPrice: item.sellingPrice || 0,
              gstRate: item.gstPercent || 18,
            };
          } else {
            updated.isNewProduct = false;
            updated.newProduct = null;
            const selectedProd = products.find((p) => (p.id || p._id) === value);
            if (selectedProd) {
              updated.unitPrice = selectedProd.costPrice || selectedProd.unitPrice || 0;
              updated.sellingPrice = selectedProd.sellingPrice || selectedProd.unitPrice || 0;
              if (!item.gstPercent) {
                updated.gstPercent = selectedProd.gstRate !== undefined ? selectedProd.gstRate : 18;
              }
              if (selectedProd.unit) {
                updated.unit = selectedProd.unit;
              }
              updated.matched = true;
            }
          }
        }

        if (field === 'newProductName') {
          updated.newProduct = { ...updated.newProduct, name: value };
        }

        return updated;
      })
    );
  };

  // Real-time Dynamic Line Calculations
  const calculatedItems = items.map((item) => {
    const prod = products.find((p) => (p.id || p._id) === item.productId);
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const gstPct = parseFloat(item.gstPercent) || 0;

    const grossAmount = qty * price;
    const totalGstAmount = (grossAmount * gstPct) / 100;
    const cgstAmount = totalGstAmount / 2;
    const sgstAmount = totalGstAmount / 2;
    const igstAmount = 0;

    const lineTotal = grossAmount + totalGstAmount;

    return {
      ...item,
      prod,
      qty,
      price,
      grossAmount,
      gstPct,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalGstAmount,
      lineTotal,
    };
  });

  const allRowsSelected = items.length > 0 && items.every((i) => Boolean(i.selected));
  const [invalidRowId, setInvalidRowId] = useState(null);

  // Form Validation & Navigation to Review Purchase
  const handleReviewPurchase = (e) => {
    if (e) e.preventDefault();
    setFormError(null);
    setInvalidRowId(null);

    // 1. Supplier Validation: Must select a valid database supplier
    if (!supplierId) {
      setFormError('Please select a Supplier.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 2. Invoice / Bill Number Validation
    if (!invoiceNumber || !invoiceNumber.trim()) {
      setFormError('Invoice / Bill Number is required.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 3. Invoice Date Validation
    if (!invoiceDate) {
      setFormError('Invoice Date is required.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 4. Empty Item List & Row Selection Check
    if (items.length === 0) {
      setFormError('Add at least one purchased item before reviewing.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!allRowsSelected) {
      setFormError('Please select all purchase item rows (check row checkboxes) before reviewing.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 5. Strict Row-by-Row Item Validation (EVERY row must be valid)
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const rowNum = idx + 1;

      // Product check
      const hasSelectedProduct = Boolean(item.productId);
      const hasNewProduct = Boolean(item.isNewProduct && (item.newProduct?.name?.trim() || item.extractedItemName?.trim()));

      if (!hasSelectedProduct && !hasNewProduct) {
        setInvalidRowId(item.id);
        setFormError(`Please select a product for item #${rowNum}.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Quantity check
      const qty = parseFloat(item.quantity);
      if (item.quantity === '' || item.quantity === null || item.quantity === undefined || isNaN(qty) || qty <= 0) {
        setInvalidRowId(item.id);
        setFormError(`Quantity must be greater than 0 for item #${rowNum}.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Unit check
      if (!item.unit || !String(item.unit).trim()) {
        setInvalidRowId(item.id);
        setFormError(`Please select a unit for item #${rowNum}.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Unit Price check
      const price = parseFloat(item.unitPrice);
      if (item.unitPrice === '' || item.unitPrice === null || item.unitPrice === undefined || isNaN(price) || price < 0) {
        setInvalidRowId(item.id);
        setFormError(`Unit purchase price cannot be negative for item #${rowNum}.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Default Selling Price check
      const sellPrice = parseFloat(item.sellingPrice);
      if (item.isNewProduct) {
        if (item.sellingPrice === '' || item.sellingPrice === null || item.sellingPrice === undefined || isNaN(sellPrice) || sellPrice <= 0) {
          setInvalidRowId(item.id);
          setFormError(`Default Selling Price must be greater than 0 for new product in item #${rowNum}.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      } else {
        if (item.sellingPrice === '' || item.sellingPrice === null || item.sellingPrice === undefined || isNaN(sellPrice) || sellPrice < 0) {
          setInvalidRowId(item.id);
          setFormError(`Default Selling Price cannot be negative for item #${rowNum}.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      // GST % check
      const gstPct = parseFloat(item.gstPercent);
      if (item.gstPercent === '' || item.gstPercent === null || item.gstPercent === undefined || isNaN(gstPct) || gstPct < 0) {
        setInvalidRowId(item.id);
        setFormError(`GST % cannot be negative for item #${rowNum}.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    const formData = {
      supplierId,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      notes: notes ? notes.trim() : '',
      items: calculatedItems.map((i) => ({
        id: i.id,
        productId: i.isNewProduct ? '' : i.productId,
        isNewProduct: i.isNewProduct,
        newProduct: i.isNewProduct ? {
          name: i.newProduct?.name || i.extractedItemName || 'New Product',
          unit: i.unit,
          unitPrice: i.price,
          sellingPrice: Number(i.sellingPrice || 0),
          gstRate: i.gstPct,
        } : null,
        productName: i.isNewProduct ? (i.newProduct?.name || i.extractedItemName) : i.prod?.name,
        quantity: i.qty,
        unit: i.unit,
        unitPrice: i.price,
        sellingPrice: Number(i.sellingPrice || 0),
        gstPercent: i.gstPct,
        cgstAmount: i.cgstAmount,
        sgstAmount: i.sgstAmount,
        igstAmount: i.igstAmount,
        total: i.lineTotal,
      })),
    };

    // Navigate to Review Purchase page preserving state
    navigate('/purchases/new/review', { state: formData });
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-semibold mb-1 flex items-center space-x-1">
            <span>Purchases</span>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">Add Purchase</span>
          </div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-extrabold text-slate-900">Record Purchase</h2>
            {incomingState.isAiExtracted && (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full flex items-center space-x-1.5 border border-emerald-300 shadow-sm">
                <FaRobot className="text-emerald-600 text-sm" />
                <span>AI Extracted</span>
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            Add purchased goods to your inventory and keep a record of the supplier invoice.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/purchases/new')}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition-all self-start sm:self-auto flex items-center space-x-2 bg-white"
        >
          <FaArrowLeft className="text-xs" />
          <span>Back to Add Purchase</span>
        </button>
      </div>

      {/* AI Extraction Banner */}
      {incomingState.isAiExtracted && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold flex items-center space-x-3 shadow-sm">
          <FaCheckCircle className="text-emerald-600 text-base flex-shrink-0" />
          <div>
            <span className="font-bold text-slate-900">Bill extracted successfully!</span> All purchase details and line items have been auto-populated below. You can review and edit any value before confirming.
          </div>
        </div>
      )}

      {/* Error Alert Banner */}
      {(error || formError) && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-semibold flex items-center space-x-3 shadow-sm">
          <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
          <span>{formError || error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
          <p className="text-sm text-gray-400 font-medium">Loading purchase record prerequisites...</p>
        </div>
      ) : (
        <form onSubmit={handleReviewPurchase} className="space-y-6">
          {/* SECTION 1 — PURCHASE INFORMATION CARD (4 FIELDS) */}
          <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-gray-100 pb-3">
              Purchase Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Field 1: Supplier Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 bg-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 2: Invoice / Bill Number */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Invoice / Bill Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FCC/26-27/1278"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Field 3: Invoice Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Field 4: Notes (Optional) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2 — PURCHASED ITEMS CARD */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3">
                <h3 className="text-sm font-extrabold text-slate-900">Purchased Items</h3>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3 py-1.5 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 bg-white"
                >
                  <FaPlus className="text-[10px]" />
                  <span>Add Item</span>
                </button>

                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 bg-white"
                  >
                    <FaTrash className="text-[10px]" />
                    <span>Delete Selected</span>
                  </button>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-gray-50/50">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shadow-xs">
                  <FaPlus />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">No Purchased Items Added Yet</h4>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">Click "+ Add Item" to add products to this purchase record.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
                >
                  <FaPlus className="text-[10px]" />
                  <span>Add First Item</span>
                </button>
              </div>
            ) : (
              /* Table with Horizontal Scroll */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600 min-w-[950px]">
                <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-400 font-extrabold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allRowsSelected}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </th>
                    <th className="px-3 py-3 min-w-[220px]">ITEM / PRODUCT</th>
                    <th className="px-3 py-3 w-20 text-center">QUANTITY</th>
                    <th className="px-3 py-3 w-16">UNIT</th>
                    <th className="px-3 py-3 w-24 text-center">UNIT PURCHASE PRICE (₹)</th>
                    <th className="px-3 py-3 w-24 text-center">DEFAULT SELLING PRICE (₹)</th>
                    <th className="px-3 py-3 w-16 text-center">GST %</th>
                    <th className="px-3 py-3 w-20 text-center">CGST AMT (₹)</th>
                    <th className="px-3 py-3 w-20 text-center">SGST AMT (₹)</th>
                    <th className="px-3 py-3 w-20 text-center">IGST AMT (₹)</th>
                    <th className="px-3 py-3 w-24 text-right">TOTAL (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {calculatedItems.map((item) => {
                    const prodObj = products.find((p) => (p.id || p._id) === item.productId);
                    const isRowInvalid = invalidRowId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isRowInvalid
                            ? 'bg-red-50/80 border-l-4 border-l-red-500'
                            : 'hover:bg-gray-50/50'
                        }`}
                      >
                        {/* 1. Checkbox */}
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleSelectRow(item.id)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>

                        {/* 2. Item / Product */}
                        <td className="px-3 py-3">
                          {item.isNewProduct ? (
                            <div className="p-2.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-extrabold text-[10px] rounded-md">
                                  🟡 New Product
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleItemFieldChange(item.id, 'productId', '')}
                                  className="text-[10px] text-amber-700 underline font-bold hover:text-amber-900"
                                >
                                  Choose Existing
                                </button>
                              </div>
                              <input
                                type="text"
                                value={item.newProduct?.name || item.extractedItemName || ''}
                                onChange={(e) => handleItemFieldChange(item.id, 'newProductName', e.target.value)}
                                className="w-full px-2 py-1 border border-amber-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                                placeholder="Enter Product Name..."
                              />
                              <p className="text-[10px] text-amber-700 font-medium flex items-center space-x-1">
                                <FaInfoCircle className="text-amber-500 flex-shrink-0" />
                                <span>This product is not currently in your inventory. It will be created when you confirm this purchase.</span>
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <select
                                value={item.productId}
                                onChange={(e) => handleItemFieldChange(item.id, 'productId', e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 bg-white focus:outline-none focus:border-emerald-500"
                              >
                                <option value="">-- Select Item or Product --</option>
                                {products.map((p) => (
                                  <option key={p.id || p._id} value={p.id || p._id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center justify-between pt-0.5 px-0.5">
                                {prodObj ? (
                                  <div className="text-[10px] font-mono text-gray-400 space-x-2">
                                    <span>SKU: {prodObj.sku || 'N/A'}</span>
                                    <span>Stock: {prodObj.currentStock !== undefined ? prodObj.currentStock : 0}</span>
                                  </div>
                                ) : (
                                  <div></div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleItemFieldChange(item.id, 'productId', 'NEW')}
                                  className="text-[11px] text-emerald-600 font-bold hover:text-emerald-700 hover:underline flex items-center space-x-1"
                                >
                                  <span>+ Create New Product</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 3. Quantity */}
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemFieldChange(item.id, 'quantity', e.target.value)}
                            className="w-16 px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-center text-gray-900 bg-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* 4. Unit */}
                        <td className="px-3 py-3">
                          <select
                            value={item.unit}
                            onChange={(e) => handleItemFieldChange(item.id, 'unit', e.target.value)}
                            className="w-16 px-1.5 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 bg-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="R">R</option>
                            <option value="Roll">Roll</option>
                            <option value="Pcs">Pcs</option>
                            <option value="Box">Box</option>
                            <option value="Kg">Kg</option>
                            <option value="Mtr">Mtr</option>
                          </select>
                        </td>

                        {/* 5. Unit Purchase Price (₹) */}
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleItemFieldChange(item.id, 'unitPrice', e.target.value)}
                            className="w-20 px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-center text-gray-900 bg-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* 6. Default Selling Price (₹) */}
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.sellingPrice !== undefined && item.sellingPrice !== null ? item.sellingPrice : 0}
                            onChange={(e) => handleItemFieldChange(item.id, 'sellingPrice', e.target.value)}
                            className="w-20 px-2 py-1.5 border border-emerald-200 rounded-xl text-xs font-bold text-center text-emerald-800 bg-emerald-50/20 focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* 6. GST % */}
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={item.gstPercent}
                            onChange={(e) => handleItemFieldChange(item.id, 'gstPercent', e.target.value)}
                            className="w-14 px-2 py-1.5 border border-emerald-200 rounded-xl text-xs font-bold text-center text-emerald-700 bg-emerald-50/20 focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* 7. CGST Amt (₹) */}
                        <td className="px-3 py-3 text-center font-bold text-gray-600">
                          {item.cgstAmount.toFixed(2)}
                        </td>

                        {/* 8. SGST Amt (₹) */}
                        <td className="px-3 py-3 text-center font-bold text-gray-600">
                          {item.sgstAmount.toFixed(2)}
                        </td>

                        {/* 9. IGST Amt (₹) */}
                        <td className="px-3 py-3 text-center font-bold text-gray-400">
                          {item.igstAmount.toFixed(2)}
                        </td>

                        {/* 10. Total (₹) */}
                        <td className="px-3 py-3 text-right font-black text-gray-900 text-sm">
                          {item.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

          {/* SECTION 3 — BOTTOM ACTION BAR */}
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => navigate('/purchases')}
                className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => toast.success('Purchase saved as draft.')}
                className="px-5 py-2.5 bg-white border border-emerald-500 hover:bg-emerald-50 text-emerald-600 font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                Save as Draft
              </button>
            </div>

            <button
              type="submit"
              disabled={!allRowsSelected}
              className={`px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2 ${
                !allRowsSelected ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span>Review Purchase</span>
              <FaArrowRight className="text-xs" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AddPurchase;
