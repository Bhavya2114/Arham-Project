import React, { useState, useEffect } from 'react';
import { 
  FaBuilding, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaSave, 
  FaUndo, 
  FaFileInvoice, 
  FaPhoneAlt, 
  FaEnvelope, 
  FaMapMarkerAlt, 
  FaIdCard 
} from 'react-icons/fa';

const DEFAULT_SETTINGS = {
  name: 'INVENTORY & BILLING MS',
  address: '101 Commercial Hub, Main Road, City, State - 400001',
  phone: '+91 98765 43210',
  email: 'billing@inventoryms.com',
  gstin: '27AAAAA0000A1Z5',
};

const Settings = () => {
  const getPersistedSettings = () => {
    try {
      const saved = localStorage.getItem('ims_business_info');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error('Error parsing stored settings:', e);
    }
    return DEFAULT_SETTINGS;
  };

  const [form, setForm] = useState(getPersistedSettings());
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // Validate inputs
  const validateForm = () => {
    const errors = {};

    if (!form.name || !form.name.trim()) {
      errors.name = 'Business / Store Name is required.';
    }

    if (!form.address || !form.address.trim()) {
      errors.address = 'Full Business Address is required.';
    }

    if (form.email && form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    if (form.phone && form.phone.trim()) {
      if (form.phone.trim().length < 7) {
        errors.phone = 'Contact phone must be at least 7 digits.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setTimeout(() => {
      const cleaned = {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        gstin: form.gstin.trim(),
      };
      localStorage.setItem('ims_business_info', JSON.stringify(cleaned));
      setForm(cleaned);
      setSaving(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 4000);
    }, 400);
  };

  const handleReset = () => {
    setForm(getPersistedSettings());
    setFieldErrors({});
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Business Settings & Invoice Branding</h2>
        <p className="text-gray-500 text-sm">Configure company profile, tax identifiers, contact details, and billing address for printed tax invoices.</p>
      </div>

      {/* Success Notification Banner */}
      {savedMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center space-x-3 text-sm font-semibold shadow-sm animate-fadeIn">
          <FaCheckCircle className="text-emerald-600 text-xl flex-shrink-0" />
          <span>Business settings saved successfully. Tax invoices will reflect these updated branding details.</span>
        </div>
      )}

      {/* Main Settings Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <h3 className="font-bold text-gray-800 text-base border-b border-gray-100 pb-3 flex items-center gap-2">
          <FaBuilding className="text-emerald-600" />
          <span>Company Profile & Tax Invoice Details</span>
        </h3>

        <div className="space-y-4 text-xs">
          {/* Company Name */}
          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
              Business / Store Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={`w-full px-3.5 py-2 border rounded-xl font-bold text-sm bg-gray-50 focus:bg-white focus:outline-none ${
                fieldErrors.name ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
              }`}
              placeholder="e.g. INVENTORY & BILLING MS"
            />
            {fieldErrors.name && <p className="text-red-500 text-[11px] mt-1">{fieldErrors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* GSTIN */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                GSTIN / Tax Registration Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl font-mono font-bold uppercase bg-gray-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 27AAAAA0000A1Z5"
                />
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                Contact Phone Number
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`w-full px-3.5 py-2 border rounded-xl font-medium bg-gray-50 focus:bg-white focus:outline-none ${
                  fieldErrors.phone ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
                }`}
                placeholder="e.g. +91 98765 43210"
              />
              {fieldErrors.phone && <p className="text-red-500 text-[11px] mt-1">{fieldErrors.phone}</p>}
            </div>
          </div>

          {/* Billing Email */}
          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
              Official Billing Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={`w-full px-3.5 py-2 border rounded-xl font-medium bg-gray-50 focus:bg-white focus:outline-none ${
                fieldErrors.email ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
              }`}
              placeholder="e.g. billing@inventoryms.com"
            />
            {fieldErrors.email && <p className="text-red-500 text-[11px] mt-1">{fieldErrors.email}</p>}
          </div>

          {/* Business Address */}
          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
              Full Business / Store Address <span className="text-red-500">*</span>
            </label>
            <textarea
              rows="3"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={`w-full px-3.5 py-2 border rounded-xl font-medium bg-gray-50 focus:bg-white focus:outline-none ${
                fieldErrors.address ? 'border-red-500' : 'border-gray-200 focus:border-emerald-500'
              }`}
              placeholder="Full shop address, street, city, pin code..."
            ></textarea>
            {fieldErrors.address && <p className="text-red-500 text-[11px] mt-1">{fieldErrors.address}</p>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 flex items-center space-x-1.5"
          >
            <FaUndo className="text-[10px]" />
            <span>Reset Changes</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <FaSave />
                <span>Save Business Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
