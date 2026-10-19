import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import {
  FaArrowLeft,
  FaCheck,
  FaExclamationTriangle,
  FaSpinner,
  FaCloudUploadAlt
} from 'react-icons/fa';
import { calculateLineItem, calculatePurchaseTotals, toSafeNumber, parseExplicitRoundOff } from '../utils/purchaseCalculations';
import { formatDateShortMonth, toApiDateFormat } from '../utils/dateUtils';

const formatMoney = (n) =>
  toSafeNumber(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // The page itself never scrolls: on wide screens the two columns fill the height that is left
  const gridRef = useRef(null);
  const [gridHeight, setGridHeight] = useState(null);
  useLayoutEffect(() => {
    const fit = () => {
      const grid = gridRef.current;
      if (!grid) return;
      if (window.innerWidth < 1024) {
        setGridHeight(null);
        return;
      }
      const main = grid.closest('main');
      const mainBottom = main ? main.getBoundingClientRect().bottom : window.innerHeight;
      const mainPad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const top = grid.getBoundingClientRect().top + (main ? main.scrollTop : 0);
      setGridHeight(Math.max(420, Math.floor(mainBottom - top - mainPad)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [apiError, loadingPrereqs, formData]);

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

  const totalQty = lineItems.reduce((acc, i) => acc + toSafeNumber(i.qty, 0), 0);

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

  const isNewRow = (item) => item.isNewProduct || (!item.productId && (item.newProduct?.name || item.productName));
  const rowName = (item) =>
    isNewRow(item)
      ? item.newProduct?.name || item.productName || item.extractedItemName
      : item.productName || item.existingProd?.name || 'Product';
  const isNewSupplierView = formData.isNewSupplier || (!formData.supplierId && formData.newSupplier?.name);
  const supplierName = isNewSupplierView ? formData.newSupplier?.name || 'New supplier' : supplierDetails?.name || '—';
  const supplierGst = isNewSupplierView ? formData.newSupplier?.gstNumber : supplierDetails?.gstNumber;

  const newBadge = (label) => (
    <span className="px-1.5 py-0.5 shrink-0 rounded-md border border-[#FFB82E]/40 bg-[#FFB82E]/10 text-[#FFB82E] text-[10px] font-medium inline-flex items-center gap-1 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {label}
    </span>
  );

  const editPurchase = () =>
    navigate('/purchases/new/manual', { state: { ...formData, roundedOffAmount, roundedOffType } });

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={editPurchase}
          title="Back to edit"
          aria-label="Back to edit"
          className="mt-0.5 w-9 h-9 shrink-0 rounded-lg border border-gray-200 text-gray-400 hover:text-slate-900 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
        >
          <FaArrowLeft className="text-xs" />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">Review purchase</h1>
          <p className="text-sm text-gray-400 mt-0.5">Check everything once more, then confirm to add the stock.</p>
        </div>
      </div>

      {/* Bill total doesn't match what was read from the bill */}
      {isTotalMismatch && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-400/30 text-red-300 rounded-xl text-xs flex items-center gap-2.5">
          <FaExclamationTriangle className="text-red-400 text-sm shrink-0" />
          <span>
            Our total ₹{formatMoney(grandTotal)} doesn't match the bill's total ₹{formatMoney(extractedTotal)}. Check the items, GST and round off before confirming.
          </span>
        </div>
      )}

      {/* API error */}
      {apiError && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-400/30 text-red-300 rounded-xl text-xs flex items-center gap-2.5">
          <FaExclamationTriangle className="text-red-400 text-sm shrink-0" />
          <div className="break-all">{apiError}</div>
        </div>
      )}

      {/* Items on the left, bill details + totals + actions on the right */}
      <div
        ref={gridRef}
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5"
        style={gridHeight ? { height: gridHeight } : undefined}
      >
        {/* Items */}
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col min-h-0">
          <div className="px-5 py-4 flex items-center gap-2.5 shrink-0">
            <h3 className="text-sm font-semibold text-slate-900">Items</h3>
            <span className="px-2 py-0.5 rounded-md border border-gray-200 text-gray-400 text-[11px]">
              {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto rounded-b-2xl border-t border-gray-100">
            <table className="w-full table-fixed text-left text-xs text-gray-600">
              <thead className="sticky top-0 z-10 bg-white text-gray-400 text-[11px] font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
                <tr>
                  <th className="pl-5 pr-2 py-2.5 w-[48px]">#</th>
                  <th className="px-2 py-2.5">Item</th>
                  <th className="px-2 py-2.5 w-[84px] text-right">Qty</th>
                  <th className="px-2 py-2.5 w-[96px] text-right">Rate</th>
                  <th className="px-2 py-2.5 w-[64px] text-right">Disc %</th>
                  <th className="px-2 py-2.5 w-[112px] text-right">Taxable</th>
                  <th className="px-2 py-2.5 w-[60px] text-right">GST %</th>
                  <th className="px-2 py-2.5 w-[96px] text-right">GST</th>
                  <th className="pl-2 pr-5 py-2.5 w-[124px] text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#FFB82E]/[0.03] transition-colors">
                    <td className="pl-5 pr-2 py-3 text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {isNewRow(item) && newBadge('New product')}
                        <span className="text-slate-900 truncate" title={rowName(item)}>{rowName(item)}</span>
                        {!isNewRow(item) && item.existingProd?.sku && (
                          <span className="text-[11px] text-gray-400 shrink-0">{item.existingProd.sku}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right text-slate-900 whitespace-nowrap">
                      {item.qty} <span className="text-gray-400">{item.unit || 'Pcs'}</span>
                    </td>
                    <td className="px-2 py-3 text-right whitespace-nowrap">₹{formatMoney(item.price)}</td>
                    <td className="px-2 py-3 text-right">{toSafeNumber(item.discountPercent)}%</td>
                    <td
                      className="px-2 py-3 text-right text-slate-900 whitespace-nowrap"
                      title={toSafeNumber(item.discountPercent) > 0 ? `₹${formatMoney(item.discountedUnitPrice)} per unit after discount` : undefined}
                    >
                      ₹{formatMoney(item.taxableAmount)}
                    </td>
                    <td className="px-2 py-3 text-right">{toSafeNumber(item.gstPct)}%</td>
                    <td
                      className="px-2 py-3 text-right text-gray-400 whitespace-nowrap"
                      title={
                        toSafeNumber(item.igst) > 0
                          ? `IGST ₹${formatMoney(item.igst)}`
                          : `CGST ₹${formatMoney(item.cgst)} · SGST ₹${formatMoney(item.sgst)}`
                      }
                    >
                      {formatMoney(item.taxAmount)}
                    </td>
                    <td className="pl-2 pr-5 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                      ₹{formatMoney(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill details + summary + actions */}
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 text-xs">
            {/* Bill details */}
            <div className="space-y-2.5">
              <h4 className="text-sm font-semibold text-slate-900">Bill details</h4>
              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                  <span>Supplier</span>
                  {isNewSupplierView && newBadge('New supplier')}
                </div>
                <div className="text-sm text-slate-900 truncate" title={supplierName}>{supplierName}</div>
                {supplierGst && <div className="text-[11px] text-gray-400 truncate">GSTIN {supplierGst}</div>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Bill number</span>
                <span className="text-slate-900">{formData.invoiceNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Bill date</span>
                <span className="text-slate-900">{formatDateShortMonth(formData.invoiceDate)}</span>
              </div>
              {formData.notes && (
                <div>
                  <div className="text-gray-400 mb-0.5">Notes</div>
                  <div className="text-slate-900">{formData.notes}</div>
                </div>
              )}
            </div>

            {/* Money summary */}
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <h4 className="text-sm font-semibold text-slate-900 mb-1">Summary</h4>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Items</span>
                <span className="text-slate-900">{lineItems.length} items · {totalQty} qty</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Gross (before discount)</span>
                <span className="text-slate-900">₹{formatMoney(grandGross)}</span>
              </div>
              {toSafeNumber(grandDiscount) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Discount</span>
                  <span className="text-emerald-400">−₹{formatMoney(grandDiscount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Taxable</span>
                <span className="text-slate-900">₹{formatMoney(grandTaxable)}</span>
              </div>
              {totals.igst > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">IGST</span>
                  <span className="text-slate-900">₹{formatMoney(totals.igst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">CGST</span>
                    <span className="text-slate-900">₹{formatMoney(totals.cgst)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">SGST</span>
                    <span className="text-slate-900">₹{formatMoney(totals.sgst)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total GST</span>
                <span className="text-slate-900">₹{formatMoney(grandTax)}</span>
              </div>
              {hasRoundedOff && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Round off</span>
                  <span className="text-slate-900">
                    {roundedOffAmount < 0 ? '−' : '+'}₹{formatMoney(Math.abs(roundedOffAmount))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bill total + actions, always at the bottom of the panel */}
          <div className="shrink-0 px-5 pt-3 pb-4 border-t border-gray-100 space-y-3">
            <div>
              <div className="text-xs text-gray-400">Bill total</div>
              <div className="text-[#FFB82E] font-semibold text-2xl">₹{formatMoney(grandTotal)}</div>
            </div>
            <button
              type="button"
              onClick={handleConfirmPurchase}
              disabled={submitting}
              className="w-full px-6 py-2.5 bg-[#FFB82E] hover:bg-[#FFC555] text-[#1A1B1E] font-medium text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <FaSpinner className="animate-spin text-sm" />
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <FaCheck className="text-xs" />
                  <span>Confirm purchase</span>
                </>
              )}
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={editPurchase}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FaArrowLeft className="text-[10px]" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => navigate('/purchases')}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewPurchase;
