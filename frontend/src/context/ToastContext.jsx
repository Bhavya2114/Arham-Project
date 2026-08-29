import React, { createContext, useContext, useState, useCallback } from 'react';
import { 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaExclamationTriangle, 
  FaInfoCircle, 
  FaTimes 
} from 'react-icons/fa';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => addToast('success', msg, dur),
    error: (msg, dur) => addToast('error', msg, dur),
    warning: (msg, dur) => addToast('warning', msg, dur),
    info: (msg, dur) => addToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Notification Layer */}
      <div 
        aria-live="polite" 
        className="fixed top-4 right-4 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-2xl shadow-xl border text-xs font-semibold transform transition-all duration-300 animate-slideIn ${
              t.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : t.type === 'error'
                ? 'bg-red-900 text-white border-red-700'
                : t.type === 'warning'
                ? 'bg-amber-900 text-white border-amber-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            <div className="mt-0.5 text-base flex-shrink-0">
              {t.type === 'success' && <FaCheckCircle className="text-emerald-400" />}
              {t.type === 'error' && <FaExclamationCircle className="text-red-400" />}
              {t.type === 'warning' && <FaExclamationTriangle className="text-amber-400" />}
              {t.type === 'info' && <FaInfoCircle className="text-blue-400" />}
            </div>

            <div className="flex-1 leading-snug">{t.message}</div>

            <button
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
              className="text-gray-400 hover:text-white transition-colors p-0.5 -mt-0.5 -mr-1"
            >
              <FaTimes className="text-xs" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return fallback no-op toast if context is not present
    return {
      success: (msg) => console.log('[Toast Success]:', msg),
      error: (msg) => console.error('[Toast Error]:', msg),
      warning: (msg) => console.warn('[Toast Warning]:', msg),
      info: (msg) => console.log('[Toast Info]:', msg),
    };
  }
  return context;
};
