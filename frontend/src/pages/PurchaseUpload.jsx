import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FaExclamationTriangle,
  FaArrowRight,
  FaSpinner,
  FaCheck,
  FaFileAlt
} from 'react-icons/fa';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

const STAGES = [
  { id: 1, label: 'File Uploaded', threshold: 0 },
  { id: 2, label: 'File Verified', threshold: 15 },
  { id: 3, label: 'Reading Bill', threshold: 30 },
  { id: 4, label: 'Extracting Data', threshold: 55 },
  { id: 5, label: 'Finalizing', threshold: 90 },
];

const PurchaseUpload = () => {
  const navigate = useNavigate();
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

    // Create Image Preview URL if image type
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }

    toast.success(`Selected file "${file.name}" successfully.`);
  };

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

    if (!selectedFile || isProcessing) {
      console.log('Process bill aborted: missing file or already processing');
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

      // Transform extracted + matched response into Record Purchase form state
      const matchedSupplier = matching.supplier || {};
      const isSupplierNew = matchedSupplier.isNew === true || !matchedSupplier.id;

      const matchedItems = (matching.items || []).map((item, idx) => {
        const isItemNew = item.isNew === true || !item.matchedProduct || !item.matchedProduct.id;

        const matchedProd = item.matchedProduct || {};
        const dbSellingPrice = !isItemNew ? Number(matchedProd.sellingPrice || matchedProd.unitPrice || 0) : 0;

        return {
          id: Date.now() + idx,
          selected: true,
          productId: isItemNew ? '' : matchedProd.id,
          isNewProduct: isItemNew,
          newProduct: isItemNew ? {
            name: item.extractedItemName || matchedProd.name || 'New Product',
            unit: item.unit || 'Pcs',
            unitPrice: item.unitPrice || 0,
            sellingPrice: 0,
            gstRate: item.gstPercent !== undefined ? item.gstPercent : 18,
          } : null,
          productName: item.extractedItemName || matchedProd.name || '',
          quantity: item.quantity > 0 ? item.quantity : 1,
          unit: item.unit || 'Pcs',
          unitPrice: item.unitPrice || 0,
          sellingPrice: dbSellingPrice,
          gstPercent: item.gstPercent !== undefined ? item.gstPercent : 18,
          cgstAmount: item.cgstAmount || 0,
          sgstAmount: item.sgstAmount || 0,
          igstAmount: item.igstAmount || 0,
          total: item.lineTotal || 0,
          extractedItemName: item.extractedItemName,
          matched: !isItemNew,
        };
      });

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
        invoiceDate: extracted.invoice?.invoiceDate || new Date().toISOString().split('T')[0],
        notes: extracted.invoice?.notes || '',
        items: matchedItems.length > 0 ? matchedItems : [
          {
            id: Date.now(),
            selected: false,
            productId: '',
            isNewProduct: true,
            newProduct: { name: 'New Item', unit: 'Pcs', unitPrice: 0, gstRate: 18 },
            productName: 'New Item',
            quantity: 1,
            unit: 'Pcs',
            unitPrice: 0,
            gstPercent: 18,
          }
        ],
        warnings: validation.warnings || [],
      };

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
        'Unable to extract bill. Something went wrong while processing this bill. Please try again.'
      );
      setValidationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  // Helper for Formatting File Size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
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
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-semibold mb-1 flex items-center space-x-1">
            <span>Purchases</span>
            <span>&gt;</span>
            <span>Add Purchase</span>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">Upload Bill</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">Upload Purchase Bill</h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Upload your supplier bill to prepare it for purchase entry.
          </p>
        </div>

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => navigate('/purchases/new')}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition-all self-start sm:self-auto flex items-center space-x-2 bg-white disabled:opacity-50"
        >
          <FaArrowLeft className="text-xs" />
          <span>Back to Add Purchase</span>
        </button>
      </div>

      {/* Inline Error Alert Banner */}
      {validationError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <FaExclamationTriangle className="text-red-500 text-base flex-shrink-0" />
            <div>
              <div className="font-extrabold text-red-800">Unable to extract bill</div>
              <div className="text-red-700">{validationError}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleProcessBill}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => navigate('/purchases/new/manual')}
              className="px-3 py-1.5 border border-red-300 text-red-700 text-xs font-bold rounded-lg hover:bg-red-100 transition-all bg-white"
            >
              Enter Manually
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
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Upload Supplier Bill</h3>
          <p className="text-xs text-gray-500 mt-1">
            Upload the supplier invoice or bill. You can upload a PDF or image.
          </p>
        </div>

        {/* 1. SELECTED FILE HEADER CARD (ALWAYS VISIBLE WHEN FILE IS SELECTED) */}
        {selectedFile && (
          <div className="border border-gray-200 bg-gray-50/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-rose-600 flex items-center justify-center text-xl flex-shrink-0">
                {selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                  <FaFilePdf className="text-rose-600" />
                ) : (
                  <FaFileImage className="text-emerald-600" />
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                  {selectedFile.name}
                </h4>
                <div className="text-[11px] text-gray-400 font-medium mt-0.5 space-x-1">
                  <span className="uppercase font-bold text-gray-600">
                    {selectedFile.name.split('.').pop()}
                  </span>
                  <span>•</span>
                  <span>{formatFileSize(selectedFile.size)}</span>
                </div>
              </div>
            </div>

            {/* Replace & Remove Action Buttons */}
            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleBrowseClick}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FaSyncAlt className="text-[10px]" />
                <span>Replace File</span>
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
          <div className="bg-emerald-50/20 border border-emerald-200 rounded-3xl p-8 sm:p-12 text-center space-y-6">
            {/* Centered Document / Extraction Illustration */}
            <div className="relative w-28 h-20 mx-auto flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center text-3xl shadow-sm z-10">
                <FaCloudUploadAlt />
              </div>
              <div className="w-12 h-14 bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm text-gray-400 absolute right-1 top-2 transform rotate-6 z-0 flex flex-col justify-between">
                <FaFileAlt className="text-gray-300 text-sm mx-auto" />
                <div className="space-y-1">
                  <div className="h-0.5 bg-gray-200 rounded w-full"></div>
                  <div className="h-0.5 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>

            {/* Heading & Subtitle */}
            <div className="space-y-1">
              <h4 className="text-xl font-extrabold text-slate-900">Extracting bill...</h4>
              <p className="text-xs font-semibold text-gray-500 max-w-md mx-auto">
                Please wait while we extract the purchase details from your bill.
              </p>
            </div>

            {/* Percentage Display & Reassuring Note */}
            <div>
              <div className="text-3xl font-black text-emerald-600 tracking-tight">
                {progressPercent}%
              </div>
              <p className="text-xs text-gray-400 font-medium mt-1">
                Almost there, please don't close this window.
              </p>
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full max-w-xl mx-auto bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {/* 5-Stage Processing Progress Indicator Timeline */}
            <div className="w-full max-w-2xl mx-auto pt-4 relative">
              <div className="absolute top-4 left-6 right-6 h-0.5 bg-gray-200 -z-0"></div>

              <div className="grid grid-cols-5 gap-2 relative z-10 text-center">
                {STAGES.map((stg, idx) => {
                  const isDone = progressPercent >= 100 || idx < activeStageIndex;
                  const isActive = idx === activeStageIndex && progressPercent < 100;

                  return (
                    <div key={stg.id} className="flex flex-col items-center space-y-2">
                      {isDone ? (
                        <div className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs shadow-sm">
                          <FaCheck className="text-[11px]" />
                        </div>
                      ) : isActive ? (
                        <div className="w-7 h-7 rounded-full border-2 border-emerald-600 bg-emerald-100 flex items-center justify-center">
                          <div className="w-3 h-3 bg-emerald-600 rounded-full animate-pulse"></div>
                        </div>
                      ) : (
                        <div className="w-7 h-7 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {stg.id}
                        </div>
                      )}

                      <span
                        className={`text-[11px] font-bold ${
                          isDone
                            ? 'text-emerald-700'
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
                ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01]'
                : 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/30 hover:bg-emerald-50/50'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl shadow-inner">
              <FaCloudUploadAlt />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-900">Upload your purchase bill</h4>
              <p className="text-xs font-semibold text-gray-500">Drag & drop your file here</p>
            </div>

            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">OR</span>

            <button
              type="button"
              disabled={isProcessing}
              onClick={(e) => {
                e.stopPropagation();
                handleBrowseClick();
              }}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all inline-flex items-center space-x-2"
            >
              <FaCloudUploadAlt className="text-sm" />
              <span>Browse Files</span>
            </button>

            <div className="pt-2 text-[11px] text-gray-400 font-medium">
              PDF, JPG, JPEG or PNG • Maximum 10 MB
            </div>
          </div>
        ) : (
          /* FILE PREVIEW CARD (WHEN FILE IS SELECTED & NOT PROCESSING) */
          <div className="space-y-4">
            {filePreviewUrl && (
              <div className="flex flex-col items-center justify-center p-3 bg-gray-50/50 border border-gray-200 rounded-2xl max-h-72 overflow-hidden">
                <img
                  src={filePreviewUrl}
                  alt="Supplier Bill Preview"
                  className="max-h-64 object-contain rounded-lg shadow-sm"
                />
              </div>
            )}

            {(!filePreviewUrl && (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf'))) && (
              <div className="p-8 bg-gray-50/50 border border-gray-200 rounded-2xl text-center space-y-2">
                <FaFilePdf className="text-rose-500 text-4xl mx-auto" />
                <p className="text-xs font-bold text-slate-800">PDF Document Selected</p>
                <p className="text-[11px] text-gray-400">
                  Document verified and ready for automated processing.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm flex items-center justify-between">
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => navigate('/purchases/new')}
          className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleProcessBill}
          disabled={!selectedFile || isProcessing}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <span>Processing...</span>
              <FaSpinner className="animate-spin text-xs" />
            </>
          ) : (
            <>
              <span>Process Bill</span>
              <FaArrowRight className="text-xs" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PurchaseUpload;
