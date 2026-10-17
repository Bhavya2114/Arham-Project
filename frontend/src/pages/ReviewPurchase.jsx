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
  FaArrowUp,
  FaCloudUploadAlt
} from 'react-icons/fa';
import { calculateLineItem, calculatePurchaseTotals, toSafeNumber, parseExplicitRoundOff } from '../utils/purchaseCalculations';
import { formatDateToIndian, formatDateShortMonth, toApiDateFormat } from '../utils/dateUtils';

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

  // Empty-state guard: ensure valid items exist
  const rawItems = formData && Array.isArray(formData.items) ? formData.items : [];
  const hasValidItems = rawItems.length > 0 && rawItems.some((it) => it && (it.productName || it.newProduct?.name || it.productId || it.unitPrice !== undefined || it.quantity !== undefined));

  if (!hasValidItems) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-4 animate-fadeIn">
        <div className="p-8 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mx-auto shadow-inner">
            <FaExclamationTriangle />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-slate-900">No Purchase Items to Review</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              No purchase items were passed to the review page. Please extract a bill or enter purchase items manually before reviewing.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/purchases/new/upload')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center space-x-2"
            >
              <FaCloudUploadAlt className="text-sm" />
              <span>Upload Bill</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/purchases/new/manual')}
              className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center space-x-2 bg-white"
            >
              <FaArrowLeft className="text-xs" />
              <span>Enter Manually</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/purchases')}
              className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-500 font-bold text-xs rounded-xl transition-all"
            >
              Back to Purchases
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate Financial Totals with full defensive normalization
  const lineItems = rawItems.map((item, idx) => {
    const qty = Math.max(0, toSafeNumber(item.quantity ?? item.qty, 1));
    const price = Math.max(0, toSafeNumber(item.unitPrice ?? item.price ?? item.purchasePrice, 0));
    const discountPercent = Math.max(0, Math.min(100, toSafeNumber(item.discountPercent ?? item.discount, 0)));
    const gstPct = Math.max(0, toSafeNumber(item.gstPercent ?? item.gstPct ?? item.taxRate, 0));

    const lineCalc = calculateLineItem({
      quantity: qty,
      unitPrice: price,
      discountPercent,
      gstRate: gstPct,
      suppliedTaxAmount: item.taxAmount,
      cgstAmount: item.cgstAmount ?? item.cgst,
      sgstAmount: item.sgstAmount ?? item.sgst,
      igstAmount: item.igstAmount ?? item.igst,
    });

    const cgst = toSafeNumber(item.cgstAmount ?? item.cgst ?? lineCalc.cgstAmount, 0);
    const sgst = toSafeNumber(item.sgstAmount ?? item.sgst ?? lineCalc.sgstAmount, 0);
    const igst = toSafeNumber(item.igstAmount ?? item.igst ?? lineCalc.igstAmount, 0);
    const lineTaxAmount = toSafeNumber(item.taxAmount ?? lineCalc.lineTax, 0);
    const taxableAmount = toSafeNumber(lineCalc.taxableValue ?? lineCalc.taxableAmount ?? item.taxableAmount, 0);
    const discountedUnitPrice = toSafeNumber(lineCalc.discountedUnitPrice ?? item.discountedUnitPrice, price);
    const lineTotal = toSafeNumber(lineCalc.totalCost ?? lineCalc.lineTotal ?? item.lineTotal ?? item.total, 0);

    const existingProd = item.productId ? productsMap[item.productId] : null;

    return {
      ...item,
      id: item.id || `line-${idx}-${Date.now()}`,
      qty,
      price,
      unitPrice: price,
      discountPercent,
      discountAmount: toSafeNumber(lineCalc.discountAmount),
      taxableAmount,
      taxableValue: taxableAmount,
      discountedUnitPrice,
      gstPct,
      gross: toSafeNumber(lineCalc.grossAmount),
      cgst,
      sgst,
      igst,
      totalGst: lineTaxAmount,
      taxAmount: lineTaxAmount,
      lineTotal,
      total: lineTotal,
      existingProd,
      currentStock: existingProd ? toSafeNumber(existingProd.currentStock, 0) : 0,
      newStock: existingProd ? toSafeNumber(existingProd.currentStock, 0) + qty : qty,
    };
  });

  const rawRound = formData.roundedOffAmount !== undefined && formData.roundedOffAmount !== null
    ? formData.roundedOffAmount
    : formData.roundOff;
  const parsedRound = parseExplicitRoundOff(rawRound);
  const roundedOffAmount = parsedRound ? parsedRound.amount : null;
  const roundedOffType = parsedRound ? (formData.roundedOffType || parsedRound.type) : null;
  const hasRoundedOff = roundedOffAmount !== null && roundedOffAmount !== 0;

  const totals = calculatePurchaseTotals({
    items: lineItems,
    suppliedCgst: formData.cgst,
    suppliedSgst: formData.sgst,
    suppliedIgst: formData.igst,
    roundedOffAmount: hasRoundedOff ? roundedOffAmount : null,
  });
  const grandGross = toSafeNumber(totals.grossTotal);
  const grandDiscount = toSafeNumber(totals.totalDiscount);
  const grandTaxable = toSafeNumber(totals.taxableTotal ?? totals.subtotal);
  const grandTax = toSafeNumber(totals.totalTax ?? totals.taxAmount);
  const grandTotal = toSafeNumber(totals.grandTotal ?? totals.totalAmount);
  const totalQtyAdded = lineItems.reduce((acc, i) => acc + toSafeNumber(i.qty, 0), 0);

  const extractedTotal = formData.extractedGrandTotal !== undefined && formData.extractedGrandTotal !== null
    ? toSafeNumber(formData.extractedGrandTotal)
    : null;
  const isTotalMismatch = extractedTotal !== null && Math.abs(grandTotal - extractedTotal) > 1.0;

  // Confirm Purchase Action -> Calls POST /api/purchases
  const handleConfirmPurchase = async () => {
    setSubmitting(true);
    setApiError(null);

    const isNewSup = formData.isNewSupplier || (!formData.supplierId && formData.newSupplier?.name);

    const payload = {
      supplierId: isNewSup ? undefined : (formData.supplierId && formData.supplierId.trim() !== '' ? formData.supplierId : undefined),
      newSupplier: isNewSup ? {
        name: formData.newSupplier?.name || 'New Supplier',
        companyName: formData.newSupplier?.companyName || undefined,
        gstNumber: formData.newSupplier?.gstNumber || undefined,
        mobile: formData.newSupplier?.mobile || formData.newSupplier?.phone || undefined,
        email: formData.newSupplier?.email || undefined,
        address: formData.newSupplier?.address || undefined,
        state: formData.newSupplier?.state || undefined,
        stateCode: formData.newSupplier?.stateCode || undefined,
      } : undefined,
      invoiceNumber: formData.invoiceNumber,
      invoiceDate: toApiDateFormat(formData.invoiceDate),
      purchaseDate: toApiDateFormat(formData.invoiceDate || formData.purchaseDate),
      notes: formData.notes || undefined,
      cgst: formData.cgst !== undefined && formData.cgst !== null ? Number(formData.cgst) : undefined,
      sgst: formData.sgst !== undefined && formData.sgst !== null ? Number(formData.sgst) : undefined,
      igst: formData.igst !== undefined && formData.igst !== null ? Number(formData.igst) : undefined,
      roundedOffAmount: hasRoundedOff ? roundedOffAmount : null,
      roundedOffType: hasRoundedOff ? roundedOffType : null,
      items: lineItems.map((i) => {
        const isNewProd = i.isNewProduct || (!i.productId && (i.newProduct?.name || i.productName || i.extractedItemName));

        return {
          productId: isNewProd ? undefined : (i.productId && i.productId.trim() !== '' ? i.productId : undefined),
          newProduct: isNewProd ? {
            name: i.newProduct?.name || i.productName || i.extractedItemName || 'New Product',
            unit: i.unit || 'Pcs',
            costPrice: Number(i.discountedUnitPrice || i.price || 0),
            gstRate: Number(i.gstPct || 0),
          } : undefined,
          purchasePrice: Number(i.price || 0),
          discountPercent: Number(i.discountPercent || 0),
          discountAmount: Number(i.discountAmount || 0),
          taxableAmount: Number(i.taxableAmount || 0),
          discountedPrice: Number(i.discountedUnitPrice || i.price || 0),
          quantity: Number(i.qty || 1),
          taxRate: Number(i.gstPct || 0),
          taxAmount: i.taxAmount !== undefined && i.taxAmount !== null ? Number(i.taxAmount) : undefined,
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
          onClick={() => navigate('/purchases/new/manual', { state: { ...formData, roundedOffAmount, roundedOffType } })}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition-all self-start sm:self-auto flex items-center space-x-2 bg-white disabled:opacity-50"
        >
          <FaArrowLeft className="text-xs" />
          <span>Back to Edit</span>
        </button>
      </div>

      {/* Extracted Total Discrepancy Alert Banner */}
      {isTotalMismatch && (
        <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl text-xs font-semibold flex items-start space-x-3 shadow-sm">
          <FaExclamationTriangle className="text-amber-600 text-base flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold text-amber-950">Invoice Total Discrepancy Warning</div>
            <div className="text-amber-800">
              Calculated supplier bill total (₹{grandTotal.toFixed(2)}) differs from the extracted invoice grand total (₹{extractedTotal.toFixed(2)}). Please inspect line items, GST, and rounding before confirming.
            </div>
          </div>
        </div>
      )}

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
            <div className="font-extrabold text-slate-900 flex items-center space-x-2">
              <FaCalendarAlt className="text-emerald-600 text-xs" />
              <span>{formatDateToIndian(formData.invoiceDate)}</span>
              {formData.invoiceDate && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  {formatDateShortMonth(formData.invoiceDate)}
                </span>
              )}
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
          <table className="w-full text-left text-xs text-gray-600 min-w-[1050px]">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-400 font-extrabold text-[11px] uppercase tracking-wider sticky top-0 bg-white shadow-xs z-10">
              <tr>
                <th className="px-4 py-3 min-w-[200px]">ITEM / PRODUCT</th>
                <th className="px-3 py-3 w-16 text-center">QTY</th>
                <th className="px-2 py-3 w-14">UNIT</th>
                <th className="px-3 py-3 w-24 text-right">UNIT RATE (₹)</th>
                <th className="px-2 py-3 w-16 text-center">DISC %</th>
                <th className="px-3 py-3 w-28 text-right">TAXABLE (₹)</th>
                <th className="px-2 py-3 w-14 text-center">GST %</th>
                <th className="px-3 py-3 w-20 text-right">CGST (₹)</th>
                <th className="px-3 py-3 w-20 text-right">SGST (₹)</th>
                <th className="px-3 py-3 w-20 text-right">IGST (₹)</th>
                <th className="px-4 py-3 w-24 text-right">LINE TOTAL (₹)</th>
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
                  <td className="px-2 py-3 font-semibold text-gray-600">{item.unit || 'Pcs'}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-700 font-mono">
                    ₹{toSafeNumber(item.price).toFixed(2)}
                  </td>
                  <td className="px-2 py-3 text-center font-bold">
                    {toSafeNumber(item.discountPercent) > 0 ? (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px]">
                        {toSafeNumber(item.discountPercent)}%
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[10px]">0%</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="font-bold text-slate-900 font-mono">
                      ₹{toSafeNumber(item.taxableAmount).toFixed(2)}
                    </div>
                    {toSafeNumber(item.discountPercent) > 0 && (
                      <div className="text-[10px] text-emerald-700 font-medium">
                        (₹{toSafeNumber(item.discountedUnitPrice).toFixed(2)}/u)
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center font-bold text-emerald-700">{toSafeNumber(item.gstPct)}%</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-600 font-mono">{toSafeNumber(item.cgst).toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-600 font-mono">{toSafeNumber(item.sgst).toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-400 font-mono">{toSafeNumber(item.igst).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-900 text-sm font-mono">
                    ₹{toSafeNumber(item.lineTotal).toFixed(2)}
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
            <div className="space-y-2.5 text-xs pt-4">
              <div className="flex items-center justify-between text-gray-600">
                <span>Gross Subtotal (Before Discount)</span>
                <span className="font-bold text-slate-900 font-mono">₹{toSafeNumber(grandGross).toFixed(2)}</span>
              </div>
              {toSafeNumber(grandDiscount) > 0 && (
                <div className="flex items-center justify-between text-emerald-700 font-medium bg-emerald-50/70 px-2.5 py-1.5 rounded-lg">
                  <span className="font-bold">Total Discount Savings</span>
                  <span className="font-black font-mono">−₹{toSafeNumber(grandDiscount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-gray-600">
                <span>Taxable Subtotal (Post-Discount)</span>
                <span className="font-bold text-slate-900 font-mono">₹{toSafeNumber(grandTaxable).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Input GST (Total Tax)</span>
                <span className="font-bold text-emerald-700 font-mono">₹{toSafeNumber(grandTax).toFixed(2)}</span>
              </div>
              {formData.cgst !== undefined && formData.cgst !== null && (
                <div className="flex items-center justify-between text-[11px] text-gray-400 pl-3">
                  <span>CGST Breakdown</span>
                  <span className="font-mono">₹{toSafeNumber(formData.cgst).toFixed(2)}</span>
                </div>
              )}
              {formData.sgst !== undefined && formData.sgst !== null && (
                <div className="flex items-center justify-between text-[11px] text-gray-400 pl-3">
                  <span>SGST Breakdown</span>
                  <span className="font-mono">₹{toSafeNumber(formData.sgst).toFixed(2)}</span>
                </div>
              )}
              {formData.igst !== undefined && formData.igst !== null && Number(formData.igst) > 0 && (
                <div className="flex items-center justify-between text-[11px] text-gray-400 pl-3">
                  <span>IGST Breakdown</span>
                  <span className="font-mono">₹{toSafeNumber(formData.igst).toFixed(2)}</span>
                </div>
              )}

              {/* Conditionally Render Rounded Off Amount - ONLY if explicitly present on bill */}
              {hasRoundedOff && (
                <div className="flex items-center justify-between text-gray-700 font-semibold bg-gray-50/80 px-2.5 py-1.5 rounded-lg border border-gray-100">
                  <span>Rounded Off ({roundedOffAmount < 0 || roundedOffType === 'less' ? '−' : '+'})</span>
                  <span className={`font-mono font-bold ${roundedOffAmount < 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                    {roundedOffAmount < 0 ? `−₹${Math.abs(roundedOffAmount).toFixed(2)}` : `₹${roundedOffAmount.toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-1">
            <div className="flex items-center justify-between text-slate-900">
              <span className="font-black text-sm uppercase tracking-wider">Supplier Bill Total</span>
              <span className="text-emerald-600 font-black text-xl font-mono">₹{toSafeNumber(grandTotal).toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-gray-400 italic">
              * Input GST is paid to supplier and does not enter operational project material cost.
            </p>
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
                Inventory valuation will update using effective discounted purchase cost.
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

                  <div className="grid grid-cols-4 gap-2 text-center text-xs border-t border-gray-200/60 pt-2">
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Current</div>
                      <div className="font-bold text-gray-600">{toSafeNumber(item.currentStock)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Purchase</div>
                      <div className="font-extrabold text-emerald-600">+{toSafeNumber(item.qty)} {item.unit || 'Pcs'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">New Stock</div>
                      <div className="font-black text-slate-900">{toSafeNumber(item.newStock)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Cost Basis</div>
                      <div className="font-bold text-emerald-700 font-mono">₹{toSafeNumber(item.discountedUnitPrice).toFixed(2)}</div>
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
