import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuUploadCloud, LuFileText, LuClipboardList, LuCheck, LuPencilLine } from 'react-icons/lu';

const PurchaseChoice = () => {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // A bill picked or dropped here is handed to the upload page, which reads it from route state
  const goToUpload = (file) => {
    navigate('/purchases/new/upload', file ? { state: { file } } : undefined);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    goToUpload(e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFilePicked = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) goToUpload(file);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8 animate-fadeIn">
      {/* Top Heading */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-semibold text-slate-900">Add purchase</h2>
        <p className="text-sm text-gray-400">Choose how you want to add this purchase.</p>
      </div>

      {/* Choice Cards Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* OPTION 1 — UPLOAD BILL CARD */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFilePicked}
          className="hidden"
        />
        <div
          onClick={openFilePicker}
          className="bg-white border border-gray-200 hover:border-[#FFB82E]/50 rounded-3xl p-8 transition-colors duration-300 flex flex-col items-center text-center cursor-pointer group"
        >
          <div className="w-24 h-24 rounded-full bg-[#FFB82E]/10 text-[#FFC14D] flex items-center justify-center text-4xl mb-6 transition-transform duration-300 group-hover:scale-105">
            <LuFileText />
          </div>

          <h3 className="text-2xl font-semibold text-slate-900 mb-3">Upload bill</h3>
          <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-6">
            Upload the supplier bill (PDF, JPG, PNG). AI reads the items, prices and GST, and you check them before saving.
          </p>

          {/* Drop zone: click or drop a bill here */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`w-full flex-1 min-h-[150px] border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-1.5 transition-colors ${
              isDragging
                ? 'border-[#FFB82E] bg-[#FFB82E]/10'
                : 'border-gray-200 group-hover:border-[#FFB82E]/60 group-hover:bg-[#FFB82E]/[0.04]'
            }`}
          >
            <span className="w-12 h-12 rounded-full bg-[#FFB82E] text-[#1A1B1E] flex items-center justify-center mb-1">
              <LuUploadCloud className="text-xl" />
            </span>
            <span className="text-sm text-slate-900">
              <span className="text-[#FFC14D] font-medium">Click to upload</span> or drag & drop
            </span>
            <span className="text-xs text-gray-400">PDF, JPG, PNG up to 10 MB</span>
          </div>
        </div>

        {/* OPTION 2 — ENTER MANUALLY CARD */}
        <div
          onClick={() => navigate('/purchases/new/manual')}
          className="bg-white border border-gray-200 hover:border-[#FFB82E]/50 rounded-3xl p-8 transition-colors duration-300 flex flex-col justify-between items-center text-center cursor-pointer group"
        >
          <div className="w-full flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-[#FFB82E]/10 text-[#FFC14D] flex items-center justify-center text-4xl mb-6 transition-transform duration-300 group-hover:scale-105">
              <LuClipboardList />
            </div>

            <h3 className="text-2xl font-semibold text-slate-900 mb-3">Enter manually</h3>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-6">
              Type the purchase in yourself, item by item.
            </p>

            <div className="w-full max-w-xs space-y-3.5 text-left mb-8 text-sm text-slate-700 px-4">
              {['Add items one by one', 'Full control over every field', 'Best for small purchases'].map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-md bg-[#FFB82E]/10 text-[#FFC14D] flex items-center justify-center shrink-0">
                    <LuCheck className="text-xs" />
                  </span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/purchases/new/manual');
            }}
            className="w-full py-3 border border-[#FFB82E]/60 hover:bg-[#FFB82E]/10 text-[#FFC14D] text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LuPencilLine className="text-sm" />
            <span>Enter manually</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseChoice;
