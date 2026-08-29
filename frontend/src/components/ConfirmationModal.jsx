import React from 'react';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDanger = true,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <FaTimes className="text-base" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center space-x-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
              isDanger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            <FaExclamationTriangle />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Please confirm your selection below.</p>
          </div>
        </div>

        {/* Message Body */}
        <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-semibold text-gray-700">
          {message}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center space-x-2 shadow-sm disabled:opacity-50 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500'
                : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500'
            }`}
          >
            {isLoading && <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>}
            <span>{isLoading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
