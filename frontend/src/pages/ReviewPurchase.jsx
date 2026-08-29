import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import {
  FaArrowLeft,
  FaCheck,
  FaExclamationTriangle,
  FaFileInvoice,
  FaBoxOpen,
  FaCalendarAlt,
  FaSpinner,
  FaArrowUp
} from 'react-icons/fa';

const ReviewPurchase = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const formData = location.state || null;

  const [supplierDetails, setSupplierDetails] = useState(null);
  const [productsMap, setProductsMap] = useState({});
  const [loadingPrereqs, setLoadingPrereqs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Fetch Supplier & Products metadata for preview
  useEffect(() => {
    if (!formData) return;

    const fetchDetails = async () => {
      setLoadingPrereqs(true);
      try {
        const [supRes, prodRes] = await Promise.all([
          axiosInstance.get('/suppliers'),
          axiosInstance.get('/products'),
        ]);

        const allSuppliers = supRes.data.data || [];
        const allProducts = prodRes.data.data || [];

        // Map supplier
        if (formData.supplierId) {
          const sup = allSuppliers.find((s) => (s.id || s._id) === formData.supplierId);
          setSupplierDetails(sup || null);
        }

        // Map products
        const pMap = {};
        allProducts.forEach((p) => {
          pMap[p.id || p._id] = p;
        });
        setProductsMap(pMap);
      } catch (err) {
        console.error('Error loading review metadata:', err);
      } finally {
        setLoadingPrereqs(false);
      }
    };

    fetchDetails();
  }, [formData]);

  if (!formData || !formData.items || formData.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="p-8 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
          <FaExclamationTriangle className="text-amber-500 text-4xl mx-auto" />
          <h3 className="text-lg font-extrabold text-slate-900">No Purchase Data Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            No purchase information was passed to the review page. Please fill out the purchase details first.
          </p>
          <button
            type="button"
            onClick={() => navigate('/purchases/new/manual')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center space-x-2"
          >
            <FaArrowLeft className="text-xs" />
            <span>Go to Record Purchase</span>
          </button>
        </div>
      </div>
    );
  }

  // Calculate Financial Totals
  const lineItems = formData.items.map((item) => {
    const qty = Number(item.quantity || item.qty || 0);
    const price = Number(item.unitPrice || item.price || 0);
    const gstPct = Number(item.gstPercent || item.gstPct || 0);

    const gross = qty * price;
    const totalGst = (gross * gstPct) / 100;
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;
    const igst = 0;
    const lineTotal = gross + totalGst;

    const existingProd = item.productId ? productsMap[item.productId] : null;

    return {
      ...item,
      qty,
      price,
      gstPct,
      gross,
      cgst,
      sgst,
      igst,
      totalGst,
      lineTotal,
      existingProd,
      currentStock: existingProd ? Number(existingProd.currentStock || 0) : 0,
      newStock: existingProd ? Number(existingProd.currentStock || 0) + qty : qty,
    };
  });

  const grandGross = lineItems.reduce((acc, i) => acc + i.gross, 0);
  const grandTax = lineItems.reduce((acc, i) => acc + i.totalGst, 0);
  const grandTotal = grandGross + grandTax;
  const totalQtyAdded = lineItems.reduce((acc, i) => acc + i.qty, 0);

  // Confirm Purchase Action -> Calls POST /api/purchases
  const handleConfirmPurchase = async () => {
    setSubmitting(true);
    setApiError(null);

    const isNewSup = formData.isNewSupplier || (!formData.supplierId && formData.newSupplier?.name);

    const payload = {
      supplierId: isNewSup ? undefined : (formData.supplierId && formData.supplierId.trim() !== '' ? formData.supplierId : undefined),
      newSupplier: isNewSup ? {
        name: formData.newSupplier?.name || 'New Supplier',
        gstNumber: formData.newSupplier?.gstNumber || undefined,
        mobile: formData.newSupplier?.mobile || undefined,
        email: formData.newSupplier?.email || undefined,
        address: formData.newSupplier?.address || undefined,
      } : undefined,
      invoiceNumber: formData.invoiceNumber,
      invoiceDate: formData.invoiceDate,
      purchaseDate: formData.invoiceDate || formData.purchaseDate,
      notes: formData.notes || undefined,
      items: lineItems.map((i) => {
        const isNewProd = i.isNewProduct || (!i.productId && (i.newProduct?.name || i.productName || i.extractedItemName));

        return {
          productId: isNewProd ? undefined : (i.productId && i.productId.trim() !== '' ? i.productId : undefined),
          newProduct: isNewProd ? {
            name: i.newProduct?.name || i.productName || i.extractedItemName || 'New Product',
            unit: i.unit || 'Pcs',
            unitPrice: Number(i.price || 0),
            sellingPrice: Number(i.sellingPrice || 0),
            gstRate: Number(i.gstPct || 0),
          } : undefined,
          purchasePrice: Number(i.price || 0),
          sellingPrice: Number(i.sellingPrice || 0),
          quantity: Number(i.qty || 1),
          taxRate: Number(i.gstPct || 0),
          unit: i.unit || 'Pcs',
        };
      }),
    };

    console.log('=== CONFIRM PURCHASE PAYLOAD ===', JSON.stringify(payload, null, 2));

    try {
      const response = await axiosInstance.post('/purchases', payload);

      if (response.data && response.data.success) {
        toast.success('Purchase confirmed & inventory updated successfully!');
        navigate('/purchases');
      } else {
        throw new Error(response.data?.message || 'Failed to create purchase record.');
      }
    } catch (err) {
      console.error('CONFIRM PURCHASE ERROR:', err);
      console.error('STATUS:', err?.response?.status);
      console.error('RESPONSE DATA:', err?.response?.data);
      console.error('RESPONSE HEADERS:', err?.response?.headers);

      let detailedMsg = getErrorMessage(err, 'Failed to confirm purchase.');
      if (err?.response?.data) {
        const responseData = err.response.data;
        if (responseData.details && Array.isArray(responseData.details)) {
          detailedMsg = `Validation failed: ${responseData.details.map((d) => `${d.path}: ${d.message}`).join(' | ')}`;
        } else if (responseData.errors) {
          detailedMsg = `Validation failed: ${JSON.stringify(responseData.errors)}`;
        } else if (responseData.message) {
          detailedMsg = responseData.message;
        }
      }

      setApiError(detailedMsg);
      toast.error(detailedMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 animate-fadeIn pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-semibold mb-1 flex items-center space-x-1">
            <span>Purchases</span>
            <span>&gt;</span>
            <span>Add Purchase</span>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">Review Purchase</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-base shadow-sm">
              <FaFileInvoice />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Review Purchase</h2>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            Please review all details before confirming this purchase
          </p>
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => navigate('/purchases/new/manual', { state: formData })}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition-all self-start sm:self-auto flex items-center space-x-2 bg-white disabled:opacity-50"
        >
          <FaArrowLeft className="text-xs" />
          <span>Back to Edit</span>
        </button>
      </div>

      {/* API Error Alert Banner (Renders Detailed Validation Issues) */}
      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center space-x-3 shadow-sm">
          <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
          <div className="break-all">
            <span className="font-bold">Error: </span>
            {apiError}
          </div>
        </div>
      )}

      {/* SECTION 1 — READ-ONLY PURCHASE INFORMATION CARD */}
      <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 border-b border-gray-100 pb-3 flex items-center space-x-2">
          <FaFileInvoice className="text-emerald-600 text-xs" />
          <span>Purchase Information Summary</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
          {/* Supplier */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">SUPPLIER</span>
            {formData.isNewSupplier || (!formData.supplierId && formData.newSupplier?.name) ? (
              <div className="space-y-0.5">
                <div className="font-extrabold text-slate-900 flex items-center space-x-2">
                  <span>{formData.newSupplier?.name || 'New Supplier'}</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[10px] rounded">
                    NEW SUPPLIER
                  </span>
                </div>
                {formData.newSupplier?.gstNumber ? (
                  <div className="text-[11px] font-mono text-gray-500">
                    GSTIN: {formData.newSupplier.gstNumber}
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-700 italic">Will be created on confirmation</div>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="font-extrabold text-slate-900">
                  {supplierDetails?.name || `Supplier ID: ${formData.supplierId}`}
                </div>
                {supplierDetails?.gstNumber && (
                  <div className="text-[11px] font-mono text-gray-500">
                    GSTIN: {supplierDetails.gstNumber}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invoice / Bill No */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">INVOICE / BILL NO</span>
            <div className="font-extrabold text-slate-900">{formData.invoiceNumber}</div>
          </div>

          {/* Invoice Date */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">INVOICE DATE</span>
            <div className="font-extrabold text-slate-900 flex items-center space-x-1.5">
              <FaCalendarAlt className="text-emerald-600 text-xs" />
              <span>{formData.invoiceDate}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">NOTES</span>
            <div className="font-medium text-gray-700">
              {formData.notes ? formData.notes : <span className="text-gray-300 font-normal">None</span>}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 — PURCHASED ITEMS READ-ONLY TABLE (FIXED MAX HEIGHT + INTERNAL SCROLLBAR) */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <FaBoxOpen className="text-emerald-600" />
            <span>Purchased Items ({lineItems.length})</span>
          </h3>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs text-gray-600 min-w-[950px]">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-400 font-extrabold text-[11px] uppercase tracking-wider sticky top-0 bg-white shadow-xs z-10">
              <tr>
                <th className="px-4 py-3 min-w-[220px]">ITEM / PRODUCT</th>
                <th className="px-3 py-3 w-20 text-center">QUANTITY</th>
                <th className="px-3 py-3 w-16">UNIT</th>
                <th className="px-3 py-3 w-24 text-center">UNIT PURCHASE PRICE (₹)</th>
                <th className="px-3 py-3 w-24 text-center">DEFAULT SELLING PRICE (₹)</th>
                <th className="px-3 py-3 w-16 text-center">GST %</th>
                <th className="px-3 py-3 w-20 text-center">CGST (₹)</th>
                <th className="px-3 py-3 w-20 text-center">SGST (₹)</th>
                <th className="px-3 py-3 w-20 text-center">IGST (₹)</th>
                <th className="px-4 py-3 w-24 text-right">TOTAL (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {lineItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    {item.isNewProduct || (!item.productId && (item.newProduct?.name || item.productName)) ? (
                      <div>
                        <div className="font-extrabold text-slate-900 flex items-center space-x-2">
                          <span>{item.newProduct?.name || item.productName || item.extractedItemName}</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[10px] rounded">
                            NEW PRODUCT
                          </span>
                        </div>
                        <div className="text-[10px] text-amber-700 italic">Will be created on confirmation</div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-extrabold text-slate-900">
                          {item.productName || item.existingProd?.name || 'Product'}
                        </div>
                        {item.existingProd?.sku && (
                          <div className="text-[10px] font-mono text-gray-400">
                            SKU: {item.existingProd.sku}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-extrabold text-slate-900">{item.qty}</td>
                  <td className="px-3 py-3 font-semibold text-gray-600">{item.unit || 'Pcs'}</td>
                  <td className="px-3 py-3 text-center font-bold text-gray-700">{item.price.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center font-bold text-emerald-800 bg-emerald-50/20">
                    {Number(item.sellingPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-emerald-700">{item.gstPct}%</td>
                  <td className="px-3 py-3 text-center font-medium text-gray-600">{item.cgst.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center font-medium text-gray-600">{item.sgst.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center font-medium text-gray-400">{item.igst.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-900 text-sm">
                    {item.lineTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3 — BOTTOM TWO-COLUMN SECTION (FINANCIAL SUMMARY + INVENTORY IMPACT PREVIEW) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: FINANCIAL SUMMARY CARD */}
        <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm flex flex-col justify-between min-h-[260px]">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-3">
              Financial Summary
            </h4>
            <div className="space-y-4 text-xs pt-4">
              <div className="flex items-center justify-between text-gray-600">
                <span>Gross Subtotal</span>
                <span className="font-bold text-slate-900 font-mono">₹{grandGross.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Total Tax (GST)</span>
                <span className="font-bold text-emerald-700 font-mono">₹{grandTax.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex items-center justify-between text-slate-900">
            <span className="font-black text-sm uppercase tracking-wider">Grand Total</span>
            <span className="text-emerald-600 font-black text-xl font-mono">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* RIGHT: INVENTORY IMPACT PREVIEW CARD */}
        <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm flex flex-col justify-between min-h-[260px]">
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Inventory Impact Preview
              </h4>
              <p className="text-[11px] text-gray-400 font-medium">
                This purchase will update inventory stock levels as shown below.
              </p>
            </div>

            {/* Internal Vertical Scrollable Product List */}
            <div className="max-h-52 overflow-y-auto space-y-2.5 pr-1">
              {lineItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-xs text-slate-900 truncate max-w-[200px]">
                      {item.isNewProduct || (!item.productId && (item.newProduct?.name || item.productName)) ? (item.newProduct?.name || item.productName || item.extractedItemName) : (item.productName || item.existingProd?.name)}
                    </div>
                    {item.isNewProduct || (!item.productId && (item.newProduct?.name || item.productName)) ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[9px] rounded">
                        NEW PRODUCT
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-gray-400">
                        {item.existingProd?.sku || 'SKU'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-gray-200/60 pt-2">
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Current Stock</div>
                      <div className="font-bold text-gray-600">{item.currentStock}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Purchase Qty</div>
                      <div className="font-extrabold text-emerald-600">+{item.qty} {item.unit || 'Roll'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">New Stock</div>
                      <div className="font-black text-slate-900">{item.newStock}</div>
                      <div className="text-[9px] text-gray-400 font-normal">After this purchase</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compact Bottom Summary Row */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-xs font-bold text-gray-600">
            <div>Products: <span className="text-slate-900 font-black">{lineItems.length}</span></div>
            <div>Qty Added: <span className="text-slate-900 font-black">+{totalQtyAdded}</span></div>
            <div className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full flex items-center space-x-1">
              <FaArrowUp className="text-[9px]" />
              <span>Stock Increase</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4 — BOTTOM ACTION BAR */}
      <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm flex items-center justify-between">
        <button
          type="button"
          disabled={submitting}
          onClick={() => navigate('/purchases')}
          className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 bg-white"
        >
          Cancel Purchase
        </button>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => navigate('/purchases/new/manual', { state: formData })}
            className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center space-x-1.5 bg-white"
          >
            <FaArrowLeft className="text-[10px]" />
            <span>Edit Purchase</span>
          </button>

          <button
            type="button"
            onClick={handleConfirmPurchase}
            disabled={submitting}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin text-sm" />
                <span>Confirming Purchase...</span>
              </>
            ) : (
              <>
                <FaCheck className="text-xs" />
                <span>Confirm Purchase</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPurchase;
