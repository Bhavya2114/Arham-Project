import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { 
  FaCloudUploadAlt, 
  FaFilePdf, 
  FaFileImage, 
  FaArrowLeft, 
  FaTrash, 
  FaSyncAlt,
  FaExternalLinkAlt, 
  FaExclamationTriangle,
  FaArrowRight,
  FaSpinner,
  FaCheck,
  FaFileAlt
} from 'react-icons/fa';
import { toApiDateFormat } from '../utils/dateUtils';
import { toSafeNumber, roundToTwo, parseExplicitRoundOff } from '../utils/purchaseCalculations';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

const STAGES = [
  { id: 1, label: 'File uploaded', threshold: 0 },
  { id: 2, label: 'File checked', threshold: 15 },
  { id: 3, label: 'Reading bill', threshold: 30 },
  { id: 4, label: 'Picking out items', threshold: 55 },
  { id: 5, label: 'Finishing', threshold: 90 },
];

// After each failed read, Try again stays locked a little longer: 2s, 5s, 10s, then 20s
const RETRY_WAIT_SECONDS = [2, 5, 10, 20];

const PurchaseUpload = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  // Processing & Simulated Progress State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(10);
  const progressTimerRef = useRef(null);

  // Wait before the next try after a failed read
  const [failedTries, setFailedTries] = useState(0);
  const [retryWait, setRetryWait] = useState(0);
  const [errorTitle, setErrorTitle] = useState('');

  useEffect(() => {
    if (retryWait <= 0) return undefined;
    const t = setTimeout(() => setRetryWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [retryWait]);

  // Clean up interval timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  // Validate File (Type and Size)
  const validateFile = (file) => {
    setValidationError(null);

    if (!file) return false;

    // Validate Extension & MIME Type
    const fileNameLower = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));
    const hasValidMime = !file.type || ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

    if (!hasValidExtension || !hasValidMime) {
      const err = 'Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG file.';
      setValidationError(err);
      toast.error(err);
      return false;
    }

    // Validate File Size (<= 10MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const err = 'File is too large. Maximum allowed size is 10 MB.';
      setValidationError(err);
      toast.error(err);
      return false;
    }

    return true;
  };

  // Handle File Selection via Browser File Picker
  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Process and Store Selected File
  const processSelectedFile = (file) => {
    if (!validateFile(file)) {
      setSelectedFile(null);
      setFilePreviewUrl(null);
      setIsReady(false);
      return;
    }

    setSelectedFile(file);
    setValidationError(null);
    setIsReady(true);

    // Preview URL for both images and PDFs, so the bill can be checked before reading it
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(URL.createObjectURL(file));

    toast.success(`Selected file "${file.name}" successfully.`);
  };

  // A bill dropped on the Add purchase page arrives in route state
  useEffect(() => {
    const droppedFile = location.state?.file;
    if (droppedFile) {
      processSelectedFile(droppedFile);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag & Drop Event Handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging && !isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isProcessing) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  // Remove Selected File
  const handleRemoveFile = () => {
    if (isProcessing) return;
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setValidationError(null);
    setIsReady(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.info('File removed.');
  };

  // Trigger File Input Picker
  const handleBrowseClick = () => {
    if (isProcessing) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Start Simulated Progress Steps (10% -> 20% -> 35% -> 50% -> 65% -> 75% -> 85% -> 92%)
  const startSimulatedProgress = () => {
    setProgressPercent(10);
    const steps = [20, 35, 50, 65, 75, 85, 92];
    let stepIdx = 0;

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    progressTimerRef.current = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgressPercent(steps[stepIdx]);
        stepIdx++;
      } else {
        clearInterval(progressTimerRef.current);
      }
    }, 600);
  };

  // Process Bill Button Action -> Calls Gemini Extraction API
  const handleProcessBill = async () => {
    console.log('PROCESS BILL CLICKED', selectedFile);

    if (!selectedFile || isProcessing || retryWait > 0) {
      console.log('Process bill aborted: missing file, already processing or still waiting');
      return;
    }

    setIsProcessing(true);
    setValidationError(null);

    // Start simulated UX progress timer
    startSimulatedProgress();

    const formData = new FormData();
    formData.append('bill', selectedFile);

    console.log('Sending bill extraction request to POST /api/purchases/extract-bill');

    try {
      const response = await axiosInstance.post('/purchases/extract-bill', formData);

      console.log('Extraction API Response Received:', response.status, response.data);

      if (!response.data || response.data.success === false || !response.data.data) {
        throw new Error(response.data?.message || 'Bill extraction failed. Please try again.');
      }

      // Clear progress interval
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }

      // Finish progress to 100%
      setProgressPercent(100);

      const resData = response.data?.data || {};
      const extracted = resData.extracted || {};
      const matching = resData.matching || {};
      const validation = resData.validation || {};

      const rawItems = (matching.items && Array.isArray(matching.items) && matching.items.length > 0)
        ? matching.items
        : (extracted.items && Array.isArray(extracted.items) && extracted.items.length > 0 ? extracted.items : []);

      if (rawItems.length === 0) {
        throw new Error('No line items could be detected in this bill. Please ensure the bill is clear and legible, or enter details manually.');
      }

      // Transform extracted + matched response into Record Purchase form state
      const matchedSupplier = matching.supplier || {};
      const isSupplierNew = matchedSupplier.isNew === true || !matchedSupplier.id;

      const matchedItems = rawItems.map((item, idx) => {
        const extItem = (extracted.items && extracted.items[idx]) || {};
        const isItemNew = item.isNew === true || !item.matchedProduct || !item.matchedProduct.id;
        const matchedProd = item.matchedProduct || {};

        // Quantity (defaults safely to 1, finite positive number)
        const rawQty = item.quantity ?? extItem.quantity;
        const qty = Math.max(1, toSafeNumber(rawQty, 1));

        // Unit Rate (defaults safely to 0, finite non-negative number)
        const rawRate = item.unitPrice ?? extItem.unitPrice ?? matchedProd.costPrice;
        const rate = Math.max(0, toSafeNumber(rawRate, 0));

        // Discount Percent & Amount (defaults safely to 0)
        const rawDiscPct = item.discountPercent ?? extItem.discountPercent ?? item.discount ?? extItem.discount ?? item.discountPercentage ?? extItem.discountPercentage ?? item.discount_percent ?? extItem.discount_percent ?? item.discPct ?? extItem.discPct;
        let parsedDiscPct = Math.max(0, Math.min(100, toSafeNumber(rawDiscPct, 0)));

        const rawDiscAmt = item.discountAmount ?? extItem.discountAmount ?? item.discount_amount ?? extItem.discount_amount ?? item.discAmount ?? extItem.discAmount;
        let parsedDiscAmt = Math.max(0, toSafeNumber(rawDiscAmt, 0));

        const gross = roundToTwo(qty * rate);

        if (parsedDiscPct === 0 && parsedDiscAmt > 0 && gross > 0) {
          parsedDiscPct = roundToTwo((parsedDiscAmt / gross) * 100);
        } else if (parsedDiscPct > 0 && parsedDiscAmt === 0 && gross > 0) {
          parsedDiscAmt = roundToTwo((gross * parsedDiscPct) / 100);
        }

        // Taxable Value (defaults safely to gross - discount)
        const rawTaxable = item.taxableAmount ?? extItem.taxableAmount;
        const taxable = (rawTaxable !== undefined && rawTaxable !== null && toSafeNumber(rawTaxable, -1) >= 0)
          ? roundToTwo(toSafeNumber(rawTaxable))
          : roundToTwo(Math.max(0, gross - parsedDiscAmt));

        // Effective unit cost
        const effectiveCost = (item.effectiveUnitPrice !== undefined && item.effectiveUnitPrice !== null)
          ? roundToTwo(toSafeNumber(item.effectiveUnitPrice))
          : (qty > 0 ? roundToTwo(taxable / qty) : rate);

        // Taxes (cgst, sgst, igst default to 0)
        const gstPercent = toSafeNumber(item.gstPercent ?? extItem.gstRate, 18);
        const cgstAmount = toSafeNumber(item.cgstAmount ?? extItem.cgstAmount, 0);
        const sgstAmount = toSafeNumber(item.sgstAmount ?? extItem.sgstAmount, 0);
        const igstAmount = toSafeNumber(item.igstAmount ?? extItem.igstAmount, 0);
        const lineTax = (cgstAmount + sgstAmount + igstAmount > 0)
          ? roundToTwo(cgstAmount + sgstAmount + igstAmount)
          : roundToTwo((taxable * gstPercent) / 100);

        // Total (defaults safely to taxable + lineTax)
        const rawTotal = item.lineTotal ?? extItem.lineTotal ?? item.total;
        const total = (rawTotal !== undefined && rawTotal !== null && toSafeNumber(rawTotal, -1) > 0)
          ? roundToTwo(toSafeNumber(rawTotal))
          : roundToTwo(taxable + lineTax);

        return {
          id: Date.now() + idx,
          selected: true,
          productId: isItemNew ? '' : matchedProd.id,
          isNewProduct: isItemNew,
          newProduct: isItemNew ? {
            name: item.extractedItemName || extItem.itemName || matchedProd.name || 'New Product',
            unit: item.unit || extItem.unit || 'Pcs',
            unitPrice: rate,
            costPrice: effectiveCost,
            gstRate: gstPercent,
          } : null,
          productName: item.extractedItemName || extItem.itemName || matchedProd.name || '',
          quantity: qty,
          unit: item.unit || extItem.unit || 'Pcs',
          unitPrice: rate,
          discountPercent: parsedDiscPct,
          discountAmount: parsedDiscAmt,
          taxableAmount: taxable,
          effectiveUnitPrice: effectiveCost,
          gstPercent,
          taxAmount: lineTax,
          cgstAmount,
          sgstAmount,
          igstAmount,
          total,
          extractedItemName: item.extractedItemName || extItem.itemName,
          matched: !isItemNew,
        };
      });

      const rawRound = extracted.totals?.roundedOffAmount !== undefined && extracted.totals?.roundedOffAmount !== null
        ? extracted.totals.roundedOffAmount
        : extracted.totals?.roundOff;
      const parsedRound = parseExplicitRoundOff(rawRound);
      const roundedOffAmount = parsedRound ? parsedRound.amount : null;
      const roundedOffType = parsedRound ? (extracted.totals?.roundedOffType || parsedRound.type) : null;

      const recordPurchaseState = {
        isAiExtracted: true,
        supplierId: isSupplierNew ? '' : matchedSupplier.id,
        isNewSupplier: isSupplierNew,
        newSupplier: isSupplierNew ? {
          name: matchedSupplier.name || extracted.supplier?.supplierName || 'New Supplier',
          gstNumber: matchedSupplier.gstNumber || extracted.supplier?.supplierGSTIN || '',
          state: matchedSupplier.state || extracted.supplier?.supplierState || '',
          address: matchedSupplier.address || extracted.supplier?.supplierAddress || '',
          phone: matchedSupplier.phone || extracted.supplier?.supplierPhone || '',
        } : null,
        invoiceNumber: extracted.invoice?.invoiceNumber || '',
        invoiceDate: extracted.invoice?.invoiceDate ? toApiDateFormat(extracted.invoice.invoiceDate) : new Date().toISOString().split('T')[0],
        notes: extracted.invoice?.notes || '',
        totalDiscount: toSafeNumber(extracted.totals?.totalDiscount, 0),
        cgst: extracted.totals?.totalCGST !== undefined ? toSafeNumber(extracted.totals.totalCGST) : (extracted.totals?.cgst !== undefined ? toSafeNumber(extracted.totals.cgst) : undefined),
        sgst: extracted.totals?.totalSGST !== undefined ? toSafeNumber(extracted.totals.totalSGST) : (extracted.totals?.sgst !== undefined ? toSafeNumber(extracted.totals.sgst) : undefined),
        igst: extracted.totals?.totalIGST !== undefined ? toSafeNumber(extracted.totals.totalIGST) : (extracted.totals?.igst !== undefined ? toSafeNumber(extracted.totals.igst) : undefined),
        roundedOffAmount,
        roundedOffType,
        roundOff: roundedOffAmount,
        extractedGrandTotal: extracted.totals?.grandTotal !== undefined && extracted.totals?.grandTotal !== null ? toSafeNumber(extracted.totals.grandTotal) : null,
        items: matchedItems,
        warnings: validation.warnings || [],
      };

      setFailedTries(0);
      setRetryWait(0);

      // Short delay so user sees 100% completed state before navigation
      setTimeout(() => {
        toast.success('Bill extracted successfully!');
        navigate('/purchases/new/manual', { state: recordPurchaseState });
      }, 700);

    } catch (err) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      setIsProcessing(false);
      setProgressPercent(10);

      console.error('Bill Extraction Failed Error:', err);
      const errorMsg = getErrorMessage(
        err,
        'Bill extraction failed. Something went wrong while processing this bill. Please try again or enter details manually.'
      );
      const status = err?.response?.status;
      const isBusy = status === 503 || status === 429 || /network busy/i.test(errorMsg);
      setErrorTitle(isBusy ? 'Network busy' : "Couldn't read the bill");
      setValidationError(
        isBusy ? 'Please wait a moment and try again, or enter the bill manually.' : errorMsg
      );
      toast.error(isBusy ? 'Network busy. Please try again in a moment.' : errorMsg);
      setRetryWait(RETRY_WAIT_SECONDS[Math.min(failedTries, RETRY_WAIT_SECONDS.length - 1)]);
      setFailedTries((n) => n + 1);
    }
  };


  // Helper for Formatting File Size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Determine current active stage index (0 to 4)
  const getActiveStageIndex = () => {
    if (progressPercent >= 100) return 4;
    if (progressPercent >= 90) return 4;
    if (progressPercent >= 55) return 3;
    if (progressPercent >= 30) return 2;
    if (progressPercent >= 15) return 1;
    return 0;
  };

  const activeStageIndex = getActiveStageIndex();

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Upload bill</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            AI reads the items, prices and GST from the bill. You check them before saving.
          </p>
        </div>

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => navigate('/purchases/new')}
          className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-slate-700 text-sm rounded-xl transition-colors self-start sm:self-auto flex items-center gap-2 bg-white cursor-pointer disabled:opacity-50"
        >
          <FaArrowLeft className="text-xs" />
          <span>Back</span>
        </button>
      </div>

      {/* Inline Error Alert Banner */}
      {validationError && (
        <div className="px-4 py-3 bg-white border border-rose-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <FaExclamationTriangle className="text-sm" />
            </span>
            <div>
              <div className="text-sm font-medium text-slate-900">{errorTitle || "Couldn't read the bill"}</div>
              <div className="text-xs text-gray-400 mt-0.5">{validationError}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleProcessBill}
              disabled={retryWait > 0 || !selectedFile}
              className="px-4 py-2 bg-[#FFB82E] hover:bg-[#FFC14D] text-[#1A1B1E] text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed min-w-[130px]"
            >
              {retryWait > 0 ? `Try again in ${retryWait}s` : 'Try again'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/purchases/new/manual')}
              className="px-4 py-2 border border-gray-200 text-slate-700 text-sm rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Enter manually
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileChange}
        disabled={isProcessing}
        className="hidden"
      />

      {/* MAIN UPLOAD CARD */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">

        {/* 1. SELECTED FILE HEADER CARD (ALWAYS VISIBLE WHEN FILE IS SELECTED) */}
        {selectedFile && (
          <div className="border border-gray-200 bg-gray-50/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFB82E]/10 text-[#FFC14D] flex items-center justify-center text-xl flex-shrink-0">
                {selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                  <FaFilePdf className="text-[#FFC14D]" />
                ) : (
                  <FaFileImage className="text-[#FFC14D]" />
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-900 truncate max-w-xs sm:max-w-md">
                  {selectedFile.name}
                </h4>
                <div className="text-xs text-gray-400 mt-0.5">
                  {selectedFile.name.split('.').pop().toUpperCase()} · {formatFileSize(selectedFile.size)}
                </div>
              </div>
            </div>

            {/* View, Replace & Remove Action Buttons */}
            <div className="flex items-center space-x-2 self-end sm:self-auto">
              {filePreviewUrl && (
                <a
                  href={filePreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 border border-[#FFB82E]/50 text-[#FFC14D] hover:bg-[#FFB82E]/10 text-xs rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <FaExternalLinkAlt className="text-[10px]" />
                  <span>View full bill</span>
                </a>
              )}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleBrowseClick}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FaSyncAlt className="text-[10px]" />
                <span>Replace file</span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRemoveFile}
                className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FaTrash className="text-[10px]" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. DEDICATED PROCESSING CARD (REPLACES PREVIEW WHEN EXTRACTING IS ACTIVE) */}
        {isProcessing ? (
          <div className="border border-[#FFB82E]/30 bg-[#FFB82E]/[0.04] rounded-2xl px-6 py-5 text-center h-[calc(100vh-360px)] min-h-[220px] flex flex-col items-center justify-center gap-4 overflow-hidden">
            {/* Centered Document / Extraction Illustration */}
            <div className="w-12 h-12 shrink-0 rounded-full border-4 border-[#FFB82E]/20 border-t-[#FFB82E] animate-spin" />

            {/* Heading & Subtitle */}
            <div className="space-y-1">
              <h4 className="text-xl font-semibold text-slate-900">Reading the bill...</h4>
              <p className="text-xs font-semibold text-gray-500 max-w-md mx-auto">
                Please wait while we extract the purchase details from your bill.
              </p>
            </div>

            {/* Percentage Display & Reassuring Note */}
            <div>
              <div className="text-3xl font-semibold text-[#FFC14D]">
                {progressPercent}%
              </div>
              <p className="text-xs text-gray-400 font-medium mt-1">
                Almost there, please don't close this window.
              </p>
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full max-w-xl mx-auto bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[#FFB82E] h-full transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {/* 5-Stage Processing Progress Indicator Timeline */}
            <div className="w-full max-w-2xl mx-auto pt-2 relative">
              <div className="absolute top-4 left-6 right-6 h-0.5 bg-gray-200 -z-0"></div>

              <div className="grid grid-cols-5 gap-2 relative z-10 text-center">
                {STAGES.map((stg, idx) => {
                  const isDone = progressPercent >= 100 || idx < activeStageIndex;
                  const isActive = idx === activeStageIndex && progressPercent < 100;

                  return (
                    <div key={stg.id} className="flex flex-col items-center space-y-2">
                      {isDone ? (
                        <div className="w-7 h-7 bg-[#FFB82E] text-[#1A1B1E] rounded-full flex items-center justify-center text-xs shadow-sm">
                          <FaCheck className="text-[11px]" />
                        </div>
                      ) : isActive ? (
                        <div className="w-7 h-7 rounded-full border-2 border-[#FFB82E] bg-[#FFB82E]/15 flex items-center justify-center">
                          <div className="w-3 h-3 bg-[#FFB82E] rounded-full animate-pulse"></div>
                        </div>
                      ) : (
                        <div className="w-7 h-7 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {stg.id}
                        </div>
                      )}

                      <span
                        className={`text-[11px] font-bold ${
                          isDone
                            ? 'text-[#FFC14D]'
                            : isActive
                            ? 'text-slate-900 font-extrabold'
                            : 'text-gray-400'
                        }`}
                      >
                        {stg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : !selectedFile ? (
          /* EMPTY UPLOAD DROP ZONE (WHEN NO FILE SELECTED) */
          <div
            onClick={handleBrowseClick}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center space-y-4 ${
              isDragging
                ? 'border-[#FFB82E] bg-[#FFB82E]/10'
                : 'border-gray-200 hover:border-[#FFB82E]/60 hover:bg-[#FFB82E]/[0.04]'
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-[#FFB82E] text-[#1A1B1E] flex items-center justify-center text-2xl">
              <FaCloudUploadAlt />
            </div>

            <h4 className="text-base font-medium text-slate-900">Drag the bill here</h4>

            <span className="text-xs text-gray-400">or</span>

            <button
              type="button"
              disabled={isProcessing}
              onClick={(e) => {
                e.stopPropagation();
                handleBrowseClick();
              }}
              className="px-5 py-2.5 border border-[#FFB82E]/60 text-[#FFC14D] hover:bg-[#FFB82E]/10 text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <FaCloudUploadAlt className="text-sm" />
              <span>Choose file</span>
            </button>

            <div className="pt-1 text-xs text-gray-400">
              PDF, JPG or PNG, up to 10 MB
            </div>
          </div>
        ) : (
          /* FILE PREVIEW CARD (WHEN FILE IS SELECTED & NOT PROCESSING) */
          <div className="space-y-4">
            {filePreviewUrl &&
              (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                // Top of the bill only, enough to check it is the right one; full bill opens in a new tab
                <div className={`relative ${validationError ? 'h-[calc(100vh-440px)]' : 'h-[calc(100vh-360px)]'} min-h-[220px] rounded-2xl border border-gray-200 overflow-hidden bg-white`}>
                  <iframe
                    src={`${filePreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    title="Bill preview"
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className={`flex items-center justify-center p-3 bg-gray-50/50 border border-gray-200 rounded-2xl ${validationError ? 'h-[calc(100vh-440px)]' : 'h-[calc(100vh-360px)]'} min-h-[220px] overflow-hidden`}>
                  <img src={filePreviewUrl} alt="Bill preview" className="max-h-full object-contain rounded-lg" />
                </div>
              ))}
          </div>
        )}
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="bg-white p-4 border border-gray-200 rounded-2xl flex items-center justify-between">
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => navigate('/purchases/new')}
          className="px-5 py-2.5 border border-gray-200 hover:bg-gray-100 text-slate-700 text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleProcessBill}
          disabled={!selectedFile || isProcessing || retryWait > 0}
          className="px-6 py-2.5 bg-[#FFB82E] hover:bg-[#FFC14D] text-[#1A1B1E] font-medium text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <span>Reading...</span>
              <FaSpinner className="animate-spin text-xs" />
            </>
          ) : (
            <>
              <span>{retryWait > 0 ? `Wait ${retryWait}s` : 'Read bill'}</span>
              <FaArrowRight className="text-xs" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PurchaseUpload;
