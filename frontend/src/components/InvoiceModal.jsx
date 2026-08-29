import React from 'react';
import { FaTimes, FaPrint, FaCheckCircle } from 'react-icons/fa';

const InvoiceModal = ({ sale, onClose }) => {
  if (!sale) return null;

  const handlePrint = () => {
    const printElement = document.getElementById("printable-invoice");
    if (!printElement) {
      window.print();
      return;
    }

    const businessInfo = JSON.parse(localStorage.getItem('ims_business_info') || '{}') || {};
    const companyName = businessInfo.name || 'INVENTORY & BILLING MS';

    // Open dedicated print document containing ONLY the selected tax invoice
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
      window.print(); // Fallback if popup blocked
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Tax Invoice - ${sale.invoiceNumber}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: #ffffff !important; color: #0f172a !important; margin: 0; padding: 15px; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>
          <div style="max-width: 800px; margin: 0 auto; background: white; padding: 10px;">
            ${printElement.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const businessInfo = JSON.parse(localStorage.getItem('ims_business_info') || '{}') || {};
  const companyName = businessInfo.name || 'INVENTORY & BILLING MS';
  const companyAddress = businessInfo.address || '101 Commercial Hub, Main Road, City, State - 400001';
  const companyGst = businessInfo.gstin || '27AAAAA0000A1Z5';
  const companyPhone = businessInfo.phone || '+91 98765 43210';
  const companyEmail = businessInfo.email || 'billing@inventoryms.com';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col border border-gray-200 max-h-[90vh]">
        {/* Action Header (Hidden during print) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FaCheckCircle className="text-emerald-400 text-lg" />
            <h3 className="font-bold text-lg">Tax Invoice #{sale.invoiceNumber}</h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
            >
              <FaPrint />
              <span>Print Invoice</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Printable Tax Invoice Container */}
        <div className="p-8 overflow-y-auto space-y-6 text-gray-800 font-sans" id="printable-invoice">
          {/* Header & Company Details */}
          <div className="flex justify-between items-start border-b border-gray-200 pb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{companyName}</h1>
              <p className="text-xs text-gray-500 max-w-xs mt-1">{companyAddress}</p>
              <p className="text-xs text-gray-600 mt-1 font-semibold">GSTIN: {companyGst}</p>
              <p className="text-xs text-gray-500">Phone: {companyPhone} | Email: {companyEmail}</p>
            </div>

            <div className="text-right space-y-1">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-md">
                TAX INVOICE
              </span>
              <p className="text-sm font-extrabold text-slate-900 pt-1">#{sale.invoiceNumber}</p>
              <p className="text-xs text-gray-500">Date: {new Date(sale.saleDate).toLocaleDateString()}</p>
              <p className="text-xs font-semibold text-emerald-700 uppercase pt-1">Status: {sale.paymentStatus || 'PAID'}</p>
            </div>
          </div>

          {/* Customer Details & Invoice Info Grid */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
            <div>
              <span className="font-bold text-gray-400 uppercase tracking-wider block mb-1">Billed To (Customer):</span>
              <p className="font-bold text-slate-900 text-sm">{sale.customer?.businessName || sale.customer?.name || 'Retail Customer'}</p>
              {sale.customer?.name && sale.customer?.businessName && (
                <p className="text-gray-600 font-medium">Attn: {sale.customer.name}</p>
              )}
              {sale.customer?.mobile && <p className="text-gray-600">Mobile: {sale.customer.mobile}</p>}
              {sale.customer?.gstNumber && <p className="text-gray-700 font-mono font-semibold">GSTIN: {sale.customer.gstNumber}</p>}
            </div>

            <div className="text-right space-y-1">
              <span className="font-bold text-gray-400 uppercase tracking-wider block mb-1">Payment Details:</span>
              <p className="font-bold text-gray-800">Mode: <span className="text-emerald-700 font-extrabold">{sale.paymentMode || 'CASH'}</span></p>
              <p className="text-gray-600">Generated By: System Administrator</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Item Description</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Price (₹)</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">GST %</th>
                  <th className="px-4 py-3 text-right">GST Amt</th>
                  <th className="px-4 py-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(sale.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{item.productName}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono">{item.sku}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{item.sellingPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-900">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-semibold">{item.gstRate || 0}%</td>
                    <td className="px-4 py-3 text-right text-gray-600">₹{(item.gstAmount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">₹{item.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculation Summary Footer */}
          <div className="flex justify-between items-start pt-2">
            <div className="max-w-xs text-xs text-gray-500 space-y-1">
              <p className="font-bold text-gray-700">Terms & Conditions:</p>
              <p>1. Goods once sold will not be taken back or exchanged.</p>
              <p>2. Subject to local jurisdiction.</p>
              <p className="pt-2 italic text-emerald-700 font-semibold">Thank you for your business!</p>
            </div>

            <div className="w-64 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Subtotal (Excl. Tax):</span>
                <span>₹{sale.subtotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total GST Tax:</span>
                <span>+ ₹{sale.totalGst?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-base border-t border-slate-300 pt-2 mt-1">
                <span>Grand Total:</span>
                <span>₹{sale.grandTotal?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
