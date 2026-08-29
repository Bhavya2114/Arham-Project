import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/api';
import { 
  FaShoppingCart, 
  FaPlus, 
  FaTrash, 
  FaExclamationTriangle,
  FaCheckCircle,
  FaSearch,
  FaBoxes,
  FaMinus,
  FaTimes,
  FaBarcode,
  FaUser
} from 'react-icons/fa';

const Billing = () => {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected Customer & Form State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);

  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [notes, setNotes] = useState('');

  // Cart State (array of { productId, sellingPrice, gstRate, quantity })
  const [cartItems, setCartItems] = useState([]);

  // Product Autocompleter / Barcode Search State
  const [productSearch, setProductSearch] = useState('');
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [custRes, prodRes] = await Promise.all([
        axiosInstance.get('/customers'),
        axiosInstance.get('/products')
      ]);
      const custs = custRes.data.data || [];
      setCustomers(custs);
      setProducts(prodRes.data.data || []);

      // Default select first customer if available
      if (custs.length > 0 && !selectedCustomer) {
        setSelectedCustomer(custs[0]);
      }
    } catch (err) {
      console.error('Error fetching prerequisites for billing:', err);
      setError('Failed to load customers or products list.');
    } finally {
      setLoading(false);
    }
  };

  // Add Product to Cart (or Increment Quantity if Already Present)
  const addProductToCart = (prod) => {
    if (!prod || prod.currentStock <= 0) return;

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === prod.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const currentQty = updated[existingIdx].quantity;
        if (currentQty < prod.currentStock) {
          updated[existingIdx].quantity = currentQty + 1;
        }
        return updated;
      } else {
        const defaultGst = prod.gstRate !== undefined && prod.gstRate !== null ? prod.gstRate : 0;
        const defaultSellPrice = Number(prod.sellingPrice || prod.unitPrice || 0);
        return [
          ...prev,
          {
            productId: prod.id,
            sellingPrice: defaultSellPrice,
            gstRate: defaultGst, // Default GST from product if available
            quantity: 1,
          },
        ];
      }
    });

    setProductSearch('');
    setIsProductSearchOpen(false);
  };

  // Handle Product Search / Exact Barcode SKU Lookup
  const handleProductSearchChange = (val) => {
    setProductSearch(val);
    setIsProductSearchOpen(true);

    if (!val.trim()) return;

    // Check for exact SKU barcode match
    const exactSkuMatch = products.find(
      (p) => p.sku.toLowerCase() === val.trim().toLowerCase()
    );

    if (exactSkuMatch && exactSkuMatch.currentStock > 0) {
      addProductToCart(exactSkuMatch);
    }
  };

  // Update Cart Line Selling Price
  const handleUpdateSellingPrice = (productId, newPrice) => {
    setCartItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, sellingPrice: newPrice } : i))
    );
  };

  // Update Cart Line GST Rate
  const handleUpdateGstRate = (productId, newGst) => {
    setCartItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, gstRate: newGst } : i))
    );
  };

  // Update Cart Quantity
  const handleUpdateQuantity = (productId, newQty) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    if (newQty <= 0) {
      // Remove item
      setCartItems((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }

    // Cap at available stock
    const validatedQty = Math.min(newQty, prod.currentStock);

    setCartItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: validatedQty } : i))
    );
  };

  const handleRemoveCartItem = (productId) => {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  // Autocomplete Filtered Products
  const autocompleteProducts = products.filter((p) => {
    if (!productSearch.trim()) return false;
    const term = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  });

  // Autocomplete Filtered Customers
  const autocompleteCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return false;
    const term = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.mobile && c.mobile.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.businessName && c.businessName.toLowerCase().includes(term))
    );
  });

  // Real-time Cart Financial Math with Editable Selling Price & GST Rate
  const calculatedCart = cartItems.map((item) => {
    const prod = products.find((p) => p.id === item.productId);
    
    const rawSellingPrice = item.sellingPrice;
    const sellingPrice = parseFloat(rawSellingPrice);
    const isInvalidPrice = isNaN(sellingPrice) || sellingPrice <= 0;

    const rawGstRate = item.gstRate;
    const gstRate = parseFloat(rawGstRate);
    const isInvalidGst = isNaN(gstRate) || gstRate < 0;

    const qty = parseInt(item.quantity, 10) || 0;
    const availableStock = prod?.currentStock || 0;

    const validPrice = isInvalidPrice ? 0 : sellingPrice;
    const validGst = isInvalidGst ? 0 : gstRate;

    const subtotal = validPrice * qty;
    const gstAmount = (subtotal * validGst) / 100;
    const lineTotal = subtotal + gstAmount;
    const isOverStock = qty > availableStock;

    return {
      ...item,
      prod,
      sellingPrice: rawSellingPrice,
      numericSellingPrice: validPrice,
      isInvalidPrice,
      gstRate: rawGstRate,
      numericGstRate: validGst,
      isInvalidGst,
      qty,
      availableStock,
      subtotal,
      gstAmount,
      lineTotal,
      isOverStock,
    };
  });

  const grandSubtotal = calculatedCart.reduce((sum, i) => sum + i.subtotal, 0);
  const grandTotalGst = calculatedCart.reduce((sum, i) => sum + i.gstAmount, 0);
  const grandTotalAmount = grandSubtotal + grandTotalGst;
  const hasOverStock = calculatedCart.some((i) => i.isOverStock);
  const hasInvalidPrice = calculatedCart.some((i) => i.isInvalidPrice);
  const hasInvalidGst = calculatedCart.some((i) => i.isInvalidGst);

  const handleSubmitSale = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!selectedCustomer) {
      setFormError('Please select a customer for this POS billing invoice.');
      return;
    }

    if (cartItems.length === 0) {
      setFormError('Your cart is empty. Search and add products to start billing.');
      return;
    }

    if (hasInvalidPrice) {
      setFormError('Selling price must be a valid number greater than 0 for all cart items.');
      return;
    }

    if (hasInvalidGst) {
      setFormError('GST rate must be a valid non-negative percentage for all cart items.');
      return;
    }

    if (hasOverStock) {
      const overItem = calculatedCart.find((i) => i.isOverStock);
      setFormError(`Only ${overItem?.availableStock} units available for "${overItem?.prod?.name}".`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomer.id || selectedCustomer._id,
        items: cartItems.map((i) => ({
          productId: i.productId,
          sellingPrice: parseFloat(i.sellingPrice),
          gstRate: parseFloat(i.gstRate || 0),
          quantity: parseInt(i.quantity, 10),
        })),
        paymentMode,
        paymentStatus,
        notes: notes ? notes.trim() : undefined,
      };

      const res = await axiosInstance.post('/sales', payload);
      const createdSale = res.data.data;
      const invNum = createdSale.invoiceNumber || '';

      // Set Success Toast Message
      setSuccessMessage(`Sale completed successfully! Invoice #${invNum} generated.`);

      // Reset Cart & Refetch updated stock from backend
      setCartItems([]);
      setNotes('');
      fetchInitialData();
    } catch (err) {
      console.error('Error submitting POS sale:', err);
      const rawMsg = err.response?.data?.message || '';
      if (rawMsg.includes('Insufficient stock')) {
        setFormError(rawMsg);
      } else {
        setFormError(rawMsg || 'Unable to complete the sale. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">POS Billing / New Sale</h2>
          <p className="text-gray-500 text-sm">Create instant sales invoices with custom transaction prices & GST rates.</p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-3">
            <FaCheckCircle className="text-emerald-600 text-lg flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline ml-4"
          >
            Dismiss
          </button>
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
          <p className="text-sm text-gray-400 font-medium">Loading POS Billing data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: PRODUCT SEARCH & CART LIST */}
          <div className="lg:col-span-2 space-y-6">
            {/* FAST PRODUCT SEARCH / SKU BARCODE AUTONOMOUS LOOKUP */}
            <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm space-y-3 relative">
              <label className="text-xs font-bold text-gray-800 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <FaBarcode className="text-emerald-600" />
                  <span>Product Search & SKU Barcode Scan</span>
                </span>
                <span className="text-[11px] text-gray-400 font-normal">Type SKU or Name to auto-add</span>
              </label>

              <div className="relative">
                <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder="Scan SKU barcode or search product name..."
                  value={productSearch}
                  onFocus={() => setIsProductSearchOpen(true)}
                  onChange={(e) => handleProductSearchChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500 font-semibold"
                />

                {/* Search Dropdown Results */}
                {isProductSearchOpen && productSearch.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {autocompleteProducts.length === 0 ? (
                      <div className="p-3 text-xs text-gray-400 text-center">No products matching "{productSearch}"</div>
                    ) : (
                      autocompleteProducts.map((prod) => {
                        const isOut = prod.currentStock <= 0;
                        return (
                          <div
                            key={prod.id}
                            onClick={() => !isOut && addProductToCart(prod)}
                            className={`p-3 flex items-center justify-between text-xs transition-colors ${
                              isOut ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'hover:bg-emerald-50/60 cursor-pointer'
                            }`}
                          >
                            <div>
                              <span className="font-bold text-gray-900">{prod.name}</span>
                              <span className="text-gray-400 font-mono ml-2">SKU: {prod.sku}</span>
                              <span className="text-gray-500 block text-[11px]">{prod.category}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-emerald-700 block">
                                Default GST: {prod.gstRate || 0}%
                              </span>
                              {isOut ? (
                                <span className="text-red-600 font-bold text-[11px]">Out of Stock</span>
                              ) : (
                                <span className="text-gray-500 text-[11px]">Stock: {prod.currentStock}</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* CART ITEMS CONTAINER */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center space-x-2">
                  <FaShoppingCart className="text-emerald-600" />
                  <span>Cart Line Items ({calculatedCart.length})</span>
                </h3>
                {calculatedCart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCartItems([])}
                    className="text-xs text-red-500 font-bold hover:underline"
                  >
                    Clear Cart
                  </button>
                )}
              </div>

              {calculatedCart.length === 0 ? (
                /* Empty Cart State */
                <div className="p-12 text-center space-y-3">
                  <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-xl">
                    <FaShoppingCart />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800">Your POS cart is empty</h4>
                  <p className="text-xs text-gray-400">Search for a product or scan a SKU barcode above to start billing.</p>
                </div>
              ) : (
                /* Cart Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-600 min-w-[650px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase">
                      <tr>
                        <th className="px-4 py-3">Product Info</th>
                        <th className="px-4 py-3 text-right w-36">Selling Price (₹)</th>
                        <th className="px-4 py-3 text-center w-36">Quantity</th>
                        <th className="px-4 py-3 text-center w-28">GST %</th>
                        <th className="px-4 py-3 text-right">Line Total</th>
                        <th className="px-4 py-3 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {calculatedCart.map((item) => (
                        <tr
                          key={item.productId}
                          className={`hover:bg-gray-50/50 transition-colors ${
                            item.isOverStock || item.isInvalidPrice || item.isInvalidGst ? 'bg-red-50/60' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-900">{item.prod?.name}</div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              SKU: {item.prod?.sku} | Stock: {item.availableStock}
                            </div>
                            {item.isOverStock && (
                              <div className="text-red-600 font-bold text-[11px] mt-0.5">
                                Only {item.availableStock} units available.
                              </div>
                            )}
                          </td>

                          {/* EDITABLE TRANSACTION SELLING PRICE (Starts at 0.00) */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <span className="text-gray-400 font-bold text-xs">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={item.sellingPrice}
                                onChange={(e) => handleUpdateSellingPrice(item.productId, e.target.value)}
                                className={`w-24 text-right px-2 py-1 border rounded-lg text-xs font-bold focus:outline-none ${
                                  item.isInvalidPrice ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-200 bg-white text-gray-900 focus:border-emerald-500'
                                }`}
                              />
                            </div>
                            {item.isInvalidPrice && (
                              <div className="text-red-500 text-[10px] font-bold mt-0.5">Price &gt; 0 required</div>
                            )}
                          </td>

                          {/* QUANTITY CONTROL */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.productId, item.qty - 1)}
                                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold"
                              >
                                <FaMinus className="text-[9px]" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={item.availableStock}
                                value={item.quantity}
                                onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value, 10) || 1)}
                                className="w-12 text-center py-1 border border-gray-200 rounded-lg font-bold text-xs focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={item.qty >= item.availableStock}
                                onClick={() => handleUpdateQuantity(item.productId, item.qty + 1)}
                                className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold disabled:opacity-40"
                              >
                                <FaPlus className="text-[9px]" />
                              </button>
                            </div>
                          </td>

                          {/* EDITABLE TRANSACTION GST RATE % */}
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={item.gstRate}
                                onChange={(e) => handleUpdateGstRate(item.productId, e.target.value)}
                                className={`w-16 text-center px-1.5 py-1 border rounded-lg text-xs font-bold focus:outline-none ${
                                  item.isInvalidGst ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-200 bg-white text-gray-900 focus:border-emerald-500'
                                }`}
                              />
                              <span className="text-gray-500 text-xs font-bold">%</span>
                            </div>
                            {item.isInvalidGst && (
                              <div className="text-red-500 text-[10px] font-bold mt-0.5">GST &ge; 0%</div>
                            )}
                          </td>

                          {/* LINE TOTAL */}
                          <td className="px-4 py-3 text-right font-extrabold text-emerald-800 text-sm">
                            ₹{item.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveCartItem(item.productId)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove Product"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 1 COLUMN: CUSTOMER SELECTION & BILLING SUMMARY */}
          <div className="space-y-6">
            {/* CUSTOMER SELECTION CARD */}
            <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm space-y-4">
              <label className="text-xs font-bold text-gray-800 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <FaUser className="text-emerald-600" />
                  <span>Customer Information</span>
                </span>
              </label>

              {selectedCustomer ? (
                /* Selected Customer Display Card */
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-950 block">{selectedCustomer.name}</span>
                    <span className="text-emerald-700 text-[11px] block">{selectedCustomer.mobile || selectedCustomer.email || 'Retail Customer'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="p-1 text-emerald-600 hover:text-emerald-900"
                    title="Change Customer"
                  >
                    <FaTimes />
                  </button>
                </div>
              ) : (
                /* Customer Autocomplete Input */
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search customer name, mobile, email..."
                    value={customerSearch}
                    onFocus={() => setIsCustomerSearchOpen(true)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setIsCustomerSearchOpen(true);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />

                  {isCustomerSearchOpen && customerSearch.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-gray-100">
                      {autocompleteCustomers.length === 0 ? (
                        <div className="p-2.5 text-xs text-gray-400 text-center">No customer matches</div>
                      ) : (
                        autocompleteCustomers.map((c) => (
                          <div
                            key={c.id || c._id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch('');
                              setIsCustomerSearchOpen(false);
                            }}
                            className="p-2.5 hover:bg-emerald-50 cursor-pointer text-xs transition-colors"
                          >
                            <div className="font-bold text-gray-900">{c.name}</div>
                            <div className="text-gray-400 text-[11px]">{c.mobile} | {c.email}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Fallback Select Dropdown */}
                  <select
                    value={selectedCustomer?.id || selectedCustomer?._id || ''}
                    onChange={(e) => {
                      const found = customers.find((c) => (c.id || c._id) === e.target.value);
                      setSelectedCustomer(found || null);
                    }}
                    className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Choose Customer from Directory --</option>
                    {customers.map((c) => (
                      <option key={c.id || c._id} value={c.id || c._id}>
                        {c.name} ({c.mobile || 'Retail'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* PAYMENT MODE & STATUS */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    <option value="CASH">CASH</option>
                    <option value="CARD">CARD</option>
                    <option value="UPI">UPI / Digital</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-emerald-500 font-semibold text-emerald-800"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>
            </div>

            {/* BILLING FINANCIAL SUMMARY CARD */}
            <div className="bg-slate-900 text-white p-6 border border-slate-800 rounded-2xl shadow-lg space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Order Financial Summary</h3>

              <div className="space-y-2 text-xs border-b border-slate-800 pb-4">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal Amount:</span>
                  <span className="font-mono font-bold">₹{grandSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Output GST Collected:</span>
                  <span className="font-mono font-bold">₹{grandTotalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs font-extrabold text-slate-300 uppercase">Grand Total</span>
                <span className="text-3xl font-black text-emerald-400">
                  ₹{grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* COMPLETE SALE SUBMIT BUTTON */}
              <button
                type="button"
                onClick={handleSubmitSale}
                disabled={submitting || calculatedCart.length === 0 || hasOverStock || hasInvalidPrice || hasInvalidGst}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-950"></div>}
                <span>{submitting ? 'Completing Sale...' : 'COMPLETE SALE'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
