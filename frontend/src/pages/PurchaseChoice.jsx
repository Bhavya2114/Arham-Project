import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaCloudUploadAlt, 
  FaEdit, 
  FaCheck, 
  FaFileInvoice, 
  FaClipboardList 
} from 'react-icons/fa';

const PurchaseChoice = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8 animate-fadeIn">
      {/* Top Heading */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Add New Purchase</h2>
        <p className="text-sm text-gray-500 font-medium">Choose how you want to create your purchase order.</p>
      </div>

      {/* Choice Cards Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* OPTION 1 — UPLOAD BILL CARD */}
        <div 
          onClick={() => navigate('/purchases/new/upload')}
          className="bg-white border-2 border-emerald-200 hover:border-emerald-400 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between items-center text-center cursor-pointer group relative overflow-hidden"
        >
          <div className="w-full flex flex-col items-center">
            {/* Top Circular Icon */}
            <div className="w-24 h-24 rounded-full bg-emerald-100/70 group-hover:bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl mb-6 shadow-inner transition-transform duration-300 group-hover:scale-105">
              <FaFileInvoice />
            </div>

            {/* Title & Description */}
            <h3 className="text-2xl font-black text-slate-900 mb-3">Upload Bill</h3>
            <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-6 font-medium">
              Upload your supplier bill (PDF, JPG, PNG) and let AI extract items, prices, GST and totals automatically.
            </p>

            {/* Drag & Drop Visual Zone */}
            <div className="w-full border-2 border-dashed border-emerald-200 group-hover:border-emerald-400 bg-emerald-50/40 rounded-2xl p-6 mb-6 flex flex-col items-center justify-center text-center space-y-1.5 transition-colors">
              <FaCloudUploadAlt className="text-emerald-500 text-3xl mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-slate-800">Click to upload or drag & drop</span>
              <span className="text-[11px] text-gray-400 font-medium">PDF, JPG, PNG up to 10MB</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/purchases/new/upload');
            }}
            className="w-full py-3 bg-emerald-600 group-hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
          >
            <FaCloudUploadAlt className="text-base" />
            <span>Upload Bill</span>
          </button>
        </div>

        {/* OPTION 2 — ENTER MANUALLY CARD */}
        <div 
          onClick={() => navigate('/purchases/new/manual')}
          className="bg-white border-2 border-blue-200 hover:border-blue-400 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between items-center text-center cursor-pointer group relative overflow-hidden"
        >
          <div className="w-full flex flex-col items-center">
            {/* Top Circular Icon */}
            <div className="w-24 h-24 rounded-full bg-blue-100/70 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center text-4xl mb-6 shadow-inner transition-transform duration-300 group-hover:scale-105">
              <FaClipboardList />
            </div>

            {/* Title & Description */}
            <h3 className="text-2xl font-black text-slate-900 mb-3">Enter Manually</h3>
            <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-6 font-medium">
              Enter purchase details manually item by item.
            </p>

            {/* Feature Checklist */}
            <div className="w-full max-w-xs space-y-3.5 text-left mb-8 text-xs font-semibold text-slate-700 px-4">
              <div className="flex items-center space-x-3">
                <FaCheck className="text-blue-500 text-sm flex-shrink-0" />
                <span>Add items one by one</span>
              </div>
              <div className="flex items-center space-x-3">
                <FaCheck className="text-blue-500 text-sm flex-shrink-0" />
                <span>Full control over data entry</span>
              </div>
              <div className="flex items-center space-x-3">
                <FaCheck className="text-blue-500 text-sm flex-shrink-0" />
                <span>Ideal for small or simple purchases</span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/purchases/new/manual');
            }}
            className="w-full py-3 border-2 border-blue-500 hover:bg-blue-50 text-blue-600 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 bg-white"
          >
            <FaEdit className="text-sm" />
            <span>Enter Manually</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseChoice;
