import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
  FaCheckCircle,
} from 'react-icons/fa';
import { calculateLineItem, calculatePurchaseTotals } from '../utils/purchaseCalculations';
import { toApiDateFormat } from '../utils/dateUtils';
import FilterSelect from '../components/FilterSelect';
import IndianDateInput from '../components/IndianDateInput';

// Units shown in the unit dropdown; bill units like "R" or "Nos" are mapped onto these
const UNIT_OPTIONS = ['Pcs', 'Mtr', 'Roll', 'Coil', 'Box', 'Set', 'Kg', 'Pkt'];
const UNIT_ALIASES = {
  r: 'Pcs', pc: 'Pcs', pcs: 'Pcs', piece: 'Pcs', pieces: 'Pcs', no: 'Pcs', nos: 'Pcs', qty: 'Pcs', u: 'Pcs', unit: 'Pcs', units: 'Pcs',
  m: 'Mtr', mtr: 'Mtr', mtrs: 'Mtr', meter: 'Mtr', meters: 'Mtr', metre: 'Mtr', metres: 'Mtr',
  roll: 'Roll', rolls: 'Roll', rl: 'Roll', coil: 'Coil', coils: 'Coil',
  box: 'Box', boxes: 'Box', bx: 'Box', set: 'Set', sets: 'Set',
  kg: 'Kg', kgs: 'Kg', pkt: 'Pkt', pkts: 'Pkt', packet: 'Pkt', packets: 'Pkt',
};
const normalizeUnit = (unit) => {
  const raw = String(unit || '').trim();
  if (!raw) return 'Pcs';
  return UNIT_ALIASES[raw.toLowerCase().replace(/[^a-z]/g, '')] || raw;
};

// Product names compared without case, spaces or punctuation ("6A Switch" = "6a-switch")
const normalizeName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const findProductByName = (name, list) => {
  const n = normalizeName(name);
  if (n.length < 3) return null;
  return list.find((p) => normalizeName(p.name) === n || (p.sku && normalizeName(p.sku) === n)) || null;
};

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // Supplier state (database supplier ID vs new supplier)
  const [isNewSupplier, setIsNewSupplier] = useState(Boolean(incomingState.isNewSupplier));
  const [newSupplier, setNewSupplier] = useState(
    incomingState.newSupplier || {
      name: '',
      gstNumber: '',
      mobile: '',
      email: '',
      address: '',
    }
  );
  const [supplierId, setSupplierId] = useState(incomingState.supplierId || '');

  // Header 4 fields
  const [invoiceNumber, setInvoiceNumber] = useState(incomingState.invoiceNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(
    incomingState.invoiceDate ? toApiDateFormat(incomingState.invoiceDate) : new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(incomingState.notes || '');

  // Rounded-off amount & type preserved from scanned bill
  const [roundedOffAmount] = useState(
    incomingState.roundedOffAmount !== undefined && incomingState.roundedOffAmount !== null
      ? incomingState.roundedOffAmount
      : (incomingState.roundOff !== undefined && incomingState.roundOff !== null ? incomingState.roundOff : null)
  );
  const [roundedOffType] = useState(
    incomingState.roundedOffType || (incomingState.roundedOffAmount !== undefined && incomingState.roundedOffAmount !== null ? (incomingState.roundedOffAmount < 0 ? 'less' : 'add') : null)
  );

  const createEmptyItemRow = () => ({
    id: Date.now() + Math.random(),
    selected: true,
    productId: '',
    isNewProduct: false,
    newProduct: null,
    quantity: 1,
    unit: 'Pcs',
    unitPrice: 0,
    discountPercent: 0,
    discountAmount: 0,
    gstPercent: 18,
  });

  // Table Line Items State
  const [items, setItems] = useState(() => {
    if (incomingState.items && incomingState.items.length > 0) {
      return incomingState.items.map((item) => {
        const rawDisc = item.discountPercent ?? item.discPct ?? item.discount ?? 0;
        const numDisc = Number(String(rawDisc).replace(/%/g, '').trim());
        return {
          ...item,
          unit: normalizeUnit(item.unit),
          discountPercent: isNaN(numDisc) ? 0 : numDisc,
          discountAmount: Number(item.discountAmount) || 0,
        };
      });
    }
    return [];
  });

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

      // Bill items whose name matches a product already in inventory are linked to it
      setItems((prev) => prev.map((item) => linkToExistingProduct(item, fetchedProducts)));

      // Auto select first supplier if available and not set
      if (fetchedSuppliers.length > 0 && !supplierId && !isNewSupplier && !incomingState.isAiExtracted && !incomingState.isNewSupplier) {
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

  // Link a new-product row to an inventory product with the same name, keeping the bill's rate, GST and unit
  const linkToExistingProduct = (item, list) => {
    if (!item.isNewProduct) return item;
    const match = findProductByName(item.newProduct?.name || item.extractedItemName || item.productName, list);
    if (!match) return item;
    return {
      ...item,
      isNewProduct: false,
      newProduct: null,
      productId: match.id || match._id,
      productName: match.name,
      autoMatched: true,
    };
  };

  const handleNewProductBlur = (id) => {
    setItems((prev) => prev.map((item) => (item.id === id ? linkToExistingProduct(item, products) : item)));
  };

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
          updated.autoMatched = false;
          if (value === 'NEW') {
            updated.isNewProduct = true;
            updated.productId = '';
            updated.newProduct = {
              name: item.extractedItemName || item.productName || 'New Product',
              unit: item.unit || 'Pcs',
              unitPrice: item.unitPrice || 0,
              costPrice: item.unitPrice || 0,
              gstRate: item.gstPercent || 18,
            };
          } else {
            updated.isNewProduct = false;
            updated.newProduct = null;
            const selectedProd = products.find((p) => (p.id || p._id) === value);
            if (selectedProd) {
              updated.unitPrice = selectedProd.costPrice || 0;
              if (!item.gstPercent) {
                updated.gstPercent = selectedProd.gstRate !== undefined ? selectedProd.gstRate : 18;
              }
              if (selectedProd.unit) {
                updated.unit = normalizeUnit(selectedProd.unit);
              }
              updated.matched = true;
            }
          }
        }

        if (field === 'discountPercent') {
          updated.discountPercent = value === '' ? '' : (isNaN(parseFloat(value)) ? 0 : parseFloat(value));
        }

        if (field === 'newProductName') {
          updated.newProduct = { ...(updated.newProduct || {}), name: value };
          updated.extractedItemName = value;
          updated.productName = value;
        }

        return updated;
      })
    );
  };

  // Real-time Dynamic Line Calculations with Discount Support
  const calculatedItems = items.map((item) => {
    const prod = products.find((p) => (p.id || p._id) === item.productId);

    const calc = calculateLineItem({
      quantity: item.quantity,
      rate: item.unitPrice,
      discountPercent: item.discountPercent,
      discountAmount: item.discountAmount,
      taxRate: item.gstPercent,
      suppliedTaxAmount: item.taxAmount,
      cgstAmount: item.cgstAmount,
      sgstAmount: item.sgstAmount,
      igstAmount: item.igstAmount,
    });

    return {
      ...item,
      prod,
      qty: calc.quantity,
      price: calc.rate,
      discPct: calc.discountPercent,
      grossAmount: calc.grossAmount,
      discountAmount: calc.discountAmount,
      taxableAmount: calc.taxableValue,
      discountedUnitPrice: calc.discountedUnitPrice,
      gstPct: calc.taxRate,
      cgstAmount: calc.cgstAmount,
      sgstAmount: calc.sgstAmount,
      igstAmount: calc.igstAmount,
      totalGstAmount: calc.lineTax,
      taxAmount: calc.lineTax,
      lineTotal: calc.totalCost,
    };
  });

  const allRowsSelected = items.length > 0 && items.every((i) => Boolean(i.selected));
  const [invalidRowId, setInvalidRowId] = useState(null);

  // The page itself never scrolls: the items list gets whatever height is left above the totals bar
  const listRef = useRef(null);
  const barRef = useRef(null);
  const [listMaxHeight, setListMaxHeight] = useState(null);
  useLayoutEffect(() => {
    const fit = () => {
      const list = listRef.current;
      if (!list) return;
      const main = list.closest('main');
      const mainBottom = main ? main.getBoundingClientRect().bottom : window.innerHeight;
      const mainPad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const top = list.getBoundingClientRect().top + (main ? main.scrollTop : 0);
      const barHeight = barRef.current ? barRef.current.offsetHeight : 0;
      // 1px card border + 20px gap (space-y-5) above the totals bar
      const available = mainBottom - top - mainPad - barHeight - 21;
      setListMaxHeight(Math.max(240, Math.floor(available)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [loading, items.length, error, formError, isNewSupplier, newSupplier?.gstNumber]);

  // Form Validation & Navigation to Review Purchase
  const handleReviewPurchase = (e) => {
    if (e) e.preventDefault();
    setFormError(null);
    setInvalidRowId(null);

    // 1. Supplier Validation: Must select a valid database supplier or enter a new supplier name
    if (!isNewSupplier && !supplierId) {
      setFormError('Please select a Supplier.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (isNewSupplier && (!newSupplier?.name || !newSupplier.name.trim())) {
      setFormError('Supplier Name is required for new supplier.');
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
      const hasNewProduct = Boolean(
        item.isNewProduct &&
        (item.newProduct?.name?.trim() || item.extractedItemName?.trim() || item.productName?.trim())
      );

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

      // Discount % check
      const discPct = parseFloat(item.discountPercent !== undefined ? item.discountPercent : 0);
      if (isNaN(discPct) || discPct < 0 || discPct > 100) {
        setInvalidRowId(item.id);
        setFormError(`Discount % must be between 0% and 100% for item #${rowNum}.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
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
      supplierId: isNewSupplier ? '' : supplierId,
      isNewSupplier,
      newSupplier: isNewSupplier ? {
        name: newSupplier?.name ? newSupplier.name.trim() : 'New Supplier',
        gstNumber: newSupplier?.gstNumber ? newSupplier.gstNumber.trim() : undefined,
        state: newSupplier?.state || undefined,
        stateCode: newSupplier?.stateCode || undefined,
        address: newSupplier?.address || undefined,
        phone: newSupplier?.phone || newSupplier?.mobile || undefined,
        mobile: newSupplier?.mobile || newSupplier?.phone || undefined,
        email: newSupplier?.email || undefined,
      } : null,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate: toApiDateFormat(invoiceDate),
      notes: notes ? notes.trim() : '',
      totalDiscount: calculatedItems.reduce((acc, i) => acc + (i.discountAmount || 0), 0),
      cgst: incomingState.cgst !== undefined ? incomingState.cgst : undefined,
      sgst: incomingState.sgst !== undefined ? incomingState.sgst : undefined,
      igst: incomingState.igst !== undefined ? incomingState.igst : undefined,
      roundedOffAmount: roundedOffAmount !== null && roundedOffAmount !== undefined ? Number(roundedOffAmount) : null,
      roundedOffType: roundedOffType || (roundedOffAmount !== null && roundedOffAmount !== undefined ? (Number(roundedOffAmount) < 0 ? 'less' : 'add') : null),
      roundOff: roundedOffAmount !== null && roundedOffAmount !== undefined ? Number(roundedOffAmount) : null,
      extractedGrandTotal: incomingState.extractedGrandTotal ?? null,
      warnings: incomingState.warnings || [],
      items: calculatedItems.map((i) => ({
        id: i.id,
        productId: i.isNewProduct ? '' : i.productId,
        isNewProduct: i.isNewProduct,
        newProduct: i.isNewProduct ? {
          name: i.newProduct?.name || i.extractedItemName || i.productName || 'New Product',
          unit: i.unit || 'Pcs',
          unitPrice: Number(i.price || 0),
          costPrice: Number(i.discountedUnitPrice || i.price || 0),
          gstRate: Number(i.gstPct !== undefined ? i.gstPct : 18),
        } : null,
        productName: i.isNewProduct ? (i.newProduct?.name || i.extractedItemName || i.productName || 'New Product') : (i.productName || i.prod?.name || 'Product'),
        quantity: i.qty,
        unit: i.unit,
        unitPrice: i.price,
        discountPercent: i.discPct || 0,
        discountAmount: i.discountAmount || 0,
        taxableAmount: i.taxableAmount,
        discountedUnitPrice: i.discountedUnitPrice,
        gstPercent: i.gstPct,
        taxAmount: i.taxAmount !== undefined ? i.taxAmount : i.totalGstAmount,
        cgstAmount: i.cgstAmount,
        sgstAmount: i.sgstAmount,
        igstAmount: i.igstAmount,
        total: i.lineTotal,
      })),
    };

    // Navigate to Review Purchase page preserving state
    navigate('/purchases/new/review', { state: formData });
  };

  // Bill totals for the bar next to Review purchase, worked out the same way as on Review purchase
  const roundOffValue = roundedOffAmount !== null && roundedOffAmount !== undefined ? Number(roundedOffAmount) || 0 : 0;
  const totals = calculatePurchaseTotals({
    items: calculatedItems,
    suppliedCgst: incomingState.cgst,
    suppliedSgst: incomingState.sgst,
    suppliedIgst: incomingState.igst,
    roundedOffAmount: roundOffValue !== 0 ? roundOffValue : null,
  });
  const totalTaxable = totals.taxableTotal;
  const totalGst = totals.totalTax;
  const grandTotal = totals.grandTotal;
  const billTotal = incomingState.extractedGrandTotal !== undefined && incomingState.extractedGrandTotal !== null
    ? Number(incomingState.extractedGrandTotal)
    : null;
  const billDiff = billTotal !== null && !isNaN(billTotal) ? grandTotal - billTotal : null;

  // IGST only shows when the bill has it; CGST/SGST hide on an IGST-only bill
  const hasIgst = calculatedItems.some((i) => (i.igstAmount || 0) > 0);
  const hasCgstSgst = !hasIgst || calculatedItems.some((i) => (i.cgstAmount || 0) > 0 || (i.sgstAmount || 0) > 0);

  const productOptions = [
    { value: 'NEW', label: '+ New product' },
    ...products.map((p) => ({
      value: p.id || p._id,
      label: p.name,
      hint: `${p.currentStock !== undefined ? p.currentStock : 0} in stock`,
    })),
  ];
  const supplierOptions = [
    ...suppliers.map((s) => ({ value: s.id || s._id, label: s.name })),
    { value: 'NEW', label: '+ New supplier' },
  ];

  const labelCls = 'block text-xs text-gray-400 mb-1.5';
  const fieldCls =
    'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:border-[#FFB82E]/60';
  const cellInputCls =
    'w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 bg-white text-center focus:outline-none focus:border-[#FFB82E]/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  const startNewSupplier = () => {
    setIsNewSupplier(true);
    setSupplierId('');
    setNewSupplier({ name: '', gstNumber: '', mobile: '', email: '', address: '' });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate('/purchases/new')}
          title="Back to add purchase"
          aria-label="Back to add purchase"
          className="mt-0.5 w-9 h-9 shrink-0 rounded-lg border border-gray-200 text-gray-400 hover:text-slate-900 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer focus:outline-none"
        >
          <FaArrowLeft className="text-xs" />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">Record purchase</h1>
          {incomingState.isAiExtracted ? (
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <FaCheckCircle className="text-emerald-400 text-xs shrink-0" />
              <span>Filled in from the bill. Check the values before you review.</span>
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-0.5">Add the goods you bought and the supplier's bill.</p>
          )}
        </div>
      </div>

      {/* Error Alert Banner */}
      {(error || formError) && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium flex items-center space-x-3">
          <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
          <span>{formError || error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3 bg-white rounded-2xl border border-gray-200">
          <div className="animate-spin rounded-full h-9 w-9 border-2 border-[#FFB82E]/20 border-t-[#FFB82E]"></div>
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      ) : (
        <form onSubmit={handleReviewPurchase} noValidate className="space-y-5">
          {/* Purchase details */}
          <div className="bg-white p-5 border border-gray-200 rounded-2xl">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Purchase details</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Supplier */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="text-xs text-gray-400">Supplier</label>
                  {isNewSupplier && (
                    <span className="px-1.5 py-0.5 rounded-md border border-[#FFB82E]/40 bg-[#FFB82E]/10 text-[#FFB82E] text-[10px] font-medium inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      New supplier
                    </span>
                  )}
                </div>
                {isNewSupplier ? (
                  <>
                    <input
                      type="text"
                      required
                      value={newSupplier?.name || ''}
                      onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                      className={fieldCls}
                      placeholder="Supplier name"
                    />
                    {newSupplier?.gstNumber ? (
                      <p className="mt-1 text-[11px] text-gray-400 truncate">GSTIN {newSupplier.gstNumber}</p>
                    ) : null}
                  </>
                ) : (
                  <FilterSelect
                    size="md"
                    value={supplierId}
                    onChange={(v) => (v === 'NEW' ? startNewSupplier() : setSupplierId(v))}
                    options={supplierOptions}
                    placeholder="Choose supplier"
                  />
                )}
              </div>

              {/* Bill number */}
              <div>
                <label className={labelCls}>Bill number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FCC/26-27/1278"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className={fieldCls}
                />
              </div>

              {/* Bill date */}
              <div>
                <label className={labelCls}>Bill date</label>
                <IndianDateInput
                  id="purchase-invoice-date"
                  name="invoiceDate"
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                  className="py-2.5 sm:text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes (optional)</label>
                <input
                  type="text"
                  placeholder="Any notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={fieldCls}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white border border-gray-200 rounded-2xl">
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-semibold text-slate-900">Items</h3>
                <span className="px-2 py-0.5 rounded-md border border-gray-200 text-gray-400 text-[11px]">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="px-3 py-1.5 border border-red-400/40 text-red-400 hover:bg-red-500/10 text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FaTrash className="text-[10px]" />
                    <span>Delete selected</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3 py-1.5 border border-[#FFB82E]/50 text-[#FFB82E] hover:bg-[#FFB82E]/10 text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FaPlus className="text-[10px]" />
                  <span>Add item</span>
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="py-10 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-400">No items yet. Use "Add item" to add one.</p>
              </div>
            ) : (
              <div
                ref={listRef}
                className="overflow-y-auto rounded-b-2xl border-t border-gray-100"
                style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
              >
              <table className="w-full table-fixed text-left text-xs text-gray-600">
                <thead className="sticky top-0 z-10 bg-white text-gray-400 text-[11px] font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
                  <tr>
                    <th className="pl-5 pr-2 py-2.5 w-11">
                      <input
                        type="checkbox"
                        checked={allRowsSelected}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 accent-[#FFB82E]"
                      />
                    </th>
                    <th className="px-2 py-2.5">Item</th>
                    <th className="px-2 py-2.5 w-[72px] text-center">Qty</th>
                    <th className="px-2 py-2.5 w-[80px] text-center">Unit</th>
                    <th className="px-2 py-2.5 w-[96px] text-center">Rate</th>
                    <th className="px-2 py-2.5 w-[72px] text-center">Disc %</th>
                    <th className="px-2 py-2.5 w-[112px] text-right">Taxable</th>
                    <th className="px-2 py-2.5 w-[68px] text-center">GST %</th>
                    {hasCgstSgst && <th className="px-2 py-2.5 w-[88px] text-right">CGST</th>}
                    {hasCgstSgst && <th className="px-2 py-2.5 w-[88px] text-right">SGST</th>}
                    {hasIgst && <th className="px-2 py-2.5 w-[88px] text-right">IGST</th>}
                    <th className="pl-2 pr-5 py-2.5 w-[120px] text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {calculatedItems.map((item) => {
                    const isRowInvalid = invalidRowId === item.id;
                    const unitChoices = UNIT_OPTIONS.includes(item.unit) || !item.unit ? UNIT_OPTIONS : [item.unit, ...UNIT_OPTIONS];

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isRowInvalid ? 'bg-red-500/10' : 'hover:bg-[#FFB82E]/[0.03]'
                        }`}
                      >
                        <td className="pl-5 pr-2 py-2">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleSelectRow(item.id)}
                            className="rounded border-gray-300 accent-[#FFB82E]"
                          />
                        </td>

                        {/* Item */}
                        <td className="px-2 py-2">
                          {item.isNewProduct ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                title="Will be added to inventory when you save"
                                className="px-1.5 py-0.5 shrink-0 rounded-md border border-[#FFB82E]/40 bg-[#FFB82E]/10 text-[#FFB82E] text-[10px] font-medium inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                New product
                              </span>
                              <input
                                type="text"
                                value={item.newProduct?.name || item.extractedItemName || ''}
                                onChange={(e) => handleItemFieldChange(item.id, 'newProductName', e.target.value)}
                                onBlur={() => handleNewProductBlur(item.id)}
                                className="min-w-0 flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 bg-white focus:outline-none focus:border-[#FFB82E]/60"
                                placeholder="Product name"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 min-w-0">
                              {item.autoMatched && (
                                <span
                                  title="Found in your inventory"
                                  className="px-1.5 py-0.5 shrink-0 rounded-md border border-emerald-400/40 bg-emerald-500/10 text-emerald-400 text-[10px] font-medium inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                  In inventory
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <FilterSelect
                                  value={item.productId}
                                  onChange={(v) => handleItemFieldChange(item.id, 'productId', v)}
                                  options={productOptions}
                                  placeholder="Choose product"
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Qty */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemFieldChange(item.id, 'quantity', e.target.value)}
                            className={cellInputCls}
                          />
                        </td>

                        {/* Unit */}
                        <td className="px-2 py-2">
                          <select
                            value={item.unit}
                            onChange={(e) => handleItemFieldChange(item.id, 'unit', e.target.value)}
                            className="w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 bg-white focus:outline-none focus:border-[#FFB82E]/60 cursor-pointer"
                          >
                            {unitChoices.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>

                        {/* Rate (before discount) */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleItemFieldChange(item.id, 'unitPrice', e.target.value)}
                            className={cellInputCls}
                            title="Rate before discount"
                          />
                        </td>

                        {/* Discount % */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={item.discountPercent === '' ? '' : (item.discountPercent !== undefined && item.discountPercent !== null ? item.discountPercent : 0)}
                            onChange={(e) => handleItemFieldChange(item.id, 'discountPercent', e.target.value)}
                            className={cellInputCls}
                            placeholder="0"
                          />
                        </td>

                        {/* Taxable (after discount) */}
                        <td
                          className="px-2 py-2 text-right text-slate-900 whitespace-nowrap"
                          title={item.discPct > 0 ? `₹${formatMoney(item.discountedUnitPrice)} per unit after discount` : undefined}
                        >
                          ₹{formatMoney(item.taxableAmount)}
                        </td>

                        {/* GST % */}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={item.gstPercent}
                            onChange={(e) => handleItemFieldChange(item.id, 'gstPercent', e.target.value)}
                            className={cellInputCls}
                          />
                        </td>

                        {hasCgstSgst && (
                          <td className="px-2 py-2 text-right text-gray-400 whitespace-nowrap">{formatMoney(item.cgstAmount)}</td>
                        )}
                        {hasCgstSgst && (
                          <td className="px-2 py-2 text-right text-gray-400 whitespace-nowrap">{formatMoney(item.sgstAmount)}</td>
                        )}
                        {hasIgst && (
                          <td className="px-2 py-2 text-right text-gray-400 whitespace-nowrap">{formatMoney(item.igstAmount)}</td>
                        )}

                        {/* Total */}
                        <td className="pl-2 pr-5 py-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                          ₹{formatMoney(item.lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Totals + actions */}
          <div ref={barRef}>
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-3.5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
              <button
                type="button"
                onClick={() => navigate('/purchases')}
                className="self-start lg:self-auto px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex-1 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-xs text-gray-400">
                <span>
                  Taxable <span className="text-slate-900 ml-1">₹{formatMoney(totalTaxable)}</span>
                </span>
                <span>
                  GST <span className="text-slate-900 ml-1">₹{formatMoney(totalGst)}</span>
                </span>
                {roundOffValue !== 0 && (
                  <span>
                    Round off <span className="text-slate-900 ml-1">{roundOffValue > 0 ? '+' : '−'}₹{formatMoney(Math.abs(roundOffValue))}</span>
                  </span>
                )}
                <span className="text-sm">
                  Total <span className="text-[#FFB82E] font-semibold text-base ml-1">₹{formatMoney(grandTotal)}</span>
                </span>
                {billDiff !== null && (
                  Math.abs(billDiff) < 1 ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <FaCheckCircle className="text-[11px]" /> Matches the bill
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400" title="Total printed on the bill">
                      <FaExclamationTriangle className="text-[11px]" /> Bill says ₹{formatMoney(billTotal)}
                    </span>
                  )
                )}
              </div>

              <button
                type="submit"
                disabled={!allRowsSelected}
                className={`self-end lg:self-auto px-6 py-2.5 bg-[#FFB82E] hover:bg-[#FFC555] text-[#1A1B1E] font-medium text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer ${
                  !allRowsSelected ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <span>Review purchase</span>
                <FaArrowRight className="text-xs" />
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default AddPurchase;
