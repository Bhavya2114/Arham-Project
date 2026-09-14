import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { FaPlus, FaSearch, FaTruck, FaInfoCircle, FaTimes, FaExclamationTriangle } from 'react-icons/fa';

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Details Modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activePurchase, setActivePurchase] = useState(null);

  const fetchPurchases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/purchases');
      setPurchases(res.data.data || []);
    } catch (err) {
      console.error('Error fetching purchases history:', err);
      setError(err.response?.data?.message || 'Failed to load purchase history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const openDetails = (purchase) => {
    setActivePurchase(purchase);
    setIsDetailOpen(true);
  };

  const filteredPurchases = purchases.filter((p) => {
    const num = p.purchaseNumber || '';
    const supName = p.supplier?.name || '';
    const notes = p.notes || '';
    const term = searchTerm.toLowerCase();

    return (
      num.toLowerCase().includes(term) ||
      supName.toLowerCase().includes(term) ||
      notes.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Purchase History & Ledger</h2>
          <p className="text-gray-500 text-sm">Review vendor purchase orders, items received, and historical purchase prices.</p>
        </div>
        <Link
          to="/purchases/new"
          className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors text-xs self-start sm:self-auto"
        >
          <FaPlus />
          <span>Add Purchase Order</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search by purchase #, supplier name, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white"
          />
        </div>
        <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 self-end sm:self-auto">
          {filteredPurchases.length} Purchase Records Total
        </span>
      </div>

      {/* Purchase List Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading purchase history...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center space-x-3">
            <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : purchases.length === 0 ? (
          /* Empty Purchase History State */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              <FaTruck />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">No purchase records recorded yet</h3>
              <p className="text-xs text-gray-500">Record incoming stock procurement from your vendors to populate inventory levels.</p>
            </div>
            <Link
              to="/purchases/new"
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2"
            >
              <FaPlus />
              <span>Create First Purchase Order</span>
            </Link>
          </div>
        ) : filteredPurchases.length === 0 ? (
          /* Empty Search Filter State */
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">No purchases match your search query</p>
            <p className="text-xs text-gray-400">Try searching for a different purchase number or supplier name.</p>
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-emerald-600 font-bold underline hover:text-emerald-700 mt-2"
            >
              Clear Search Filter
            </button>
          </div>
        ) : (
          /* Purchase History Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Purchase Order #</th>
                  <th className="px-6 py-3.5">Supplier Name</th>
                  <th className="px-6 py-3.5">Purchase Date</th>
                  <th className="px-6 py-3.5 text-center">Items Count</th>
                  <th className="px-6 py-3.5 text-right">Supplier Total (Incl. GST)</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPurchases.map((p) => {
                  const pDate = p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
                  const itemCount = p.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
                  const grandTotalVal = p.totalAmount !== undefined && p.totalAmount !== null ? p.totalAmount : (p.grandTotal || 0);

                  return (
                    <tr key={p.id || p._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900">{p.purchaseNumber}</td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-700">
                        {p.supplier?.name || <span className="italic text-gray-400">Unknown Supplier</span>}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{pDate}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">{itemCount} units</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-700">
                        ₹{grandTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openDetails(p)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors inline-flex items-center space-x-1.5"
                        >
                          <FaInfoCircle />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PURCHASE DETAILS MODAL */}
      {isDetailOpen && activePurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                  <FaTruck className="text-emerald-600" />
                  <span>Purchase Order #{activePurchase.purchaseNumber}</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Purchased on {new Date(activePurchase.purchaseDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>

            {/* Supplier Info */}
            <div className="p-3 bg-gray-50 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-gray-700">Supplier: {activePurchase.supplier?.name || 'Unknown Supplier'}</div>
              {activePurchase.supplier?.contactPerson && (
                <div className="text-gray-500">Contact: {activePurchase.supplier.contactPerson}</div>
              )}
              {activePurchase.supplier?.gstNumber && (
                <div className="text-gray-500 font-mono text-[11px]">GSTIN: {activePurchase.supplier.gstNumber}</div>
              )}
              {activePurchase.notes && <div className="text-gray-500 italic">Notes: {activePurchase.notes}</div>}
            </div>

            {/* Purchased Items List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-700 uppercase">Purchased Items Breakdown</h4>
              <div className="border border-gray-100 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600 min-w-[620px]">
                  <thead className="bg-gray-50 font-bold text-gray-500">
                    <tr>
                      <th className="p-2.5">Product / Item</th>
                      <th className="p-2.5 text-right">Unit Price (₹)</th>
                      <th className="p-2.5 text-center">Disc %</th>
                      <th className="p-2.5 text-right">Taxable (₹)</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-center">GST %</th>
                      <th className="p-2.5 text-right">Line GST (₹)</th>
                      <th className="p-2.5 text-right">Line Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activePurchase.items?.map((item, idx) => {
                      const name = item.productName || item.product?.name || (item.productId ? `Product (${item.productId.substring(0, 8)})` : 'Unknown Product');
                      const sku = item.sku || item.product?.sku || '';
                      const originalPrice = item.originalPrice !== undefined ? item.originalPrice : (item.purchasePrice || 0);
                      const discountPercent = item.discountPercent || 0;
                      const qty = item.quantity || 0;
                      const taxable = item.taxableAmount !== undefined ? item.taxableAmount : (originalPrice * qty);
                      const discountedUnitPrice = item.discountedPrice !== undefined ? item.discountedPrice : (qty > 0 ? taxable / qty : originalPrice);
                      const taxRate = item.taxRate || 0;
                      const lineTax = item.taxAmount !== undefined && item.taxAmount !== null
                        ? Number(item.taxAmount)
                        : (taxable * taxRate) / 100;

                      const calculatedCost = taxable + lineTax;
                      const lineTotal = item.totalCost !== undefined && item.totalCost !== null ? item.totalCost : (item.lineTotal || calculatedCost);

                      return (
                        <tr key={idx}>
                          <td className="p-2.5">
                            <span className="font-bold text-gray-900 block">{name}</span>
                            {sku && <span className="text-[11px] font-mono text-gray-400">SKU: {sku}</span>}
                          </td>
                          <td className="p-2.5 text-right font-mono">₹{originalPrice.toFixed(2)}</td>
                          <td className="p-2.5 text-center font-bold">
                            {discountPercent > 0 ? (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px]">
                                {discountPercent}%
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">0%</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            <div className="font-bold text-slate-900">₹{taxable.toFixed(2)}</div>
                            {discountPercent > 0 && (
                              <div className="text-[10px] text-emerald-700 font-medium">
                                (₹{discountedUnitPrice.toFixed(2)}/u)
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-bold">{qty}</td>
                          <td className="p-2.5 text-center">{taxRate}%</td>
                          <td className="p-2.5 text-right font-medium text-amber-700 font-mono">₹{lineTax.toFixed(2)}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-800 font-mono">
                            ₹{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Spend Breakdown */}
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex flex-wrap items-center gap-3 text-slate-300">
                  {activePurchase.totalDiscount !== undefined && activePurchase.totalDiscount > 0 && (
                    <>
                      <span>Total Savings: <strong className="text-emerald-400">−₹{Number(activePurchase.totalDiscount).toFixed(2)}</strong></span>
                      <span>|</span>
                    </>
                  )}
                  <span>Taxable Subtotal: <strong className="text-white">₹{(activePurchase.subtotal || 0).toFixed(2)}</strong></span>
                  <span>|</span>
                  <span>Input GST: <strong className="text-amber-400">₹{(activePurchase.taxAmount !== undefined ? activePurchase.taxAmount : (activePurchase.totalGst || 0)).toFixed(2)}</strong></span>
                  {activePurchase.cgst !== undefined && activePurchase.cgst !== null && (
                    <span className="text-slate-400 font-mono text-[11px]">(CGST: ₹{Number(activePurchase.cgst).toFixed(2)})</span>
                  )}
                  {activePurchase.sgst !== undefined && activePurchase.sgst !== null && (
                    <span className="text-slate-400 font-mono text-[11px]">(SGST: ₹{Number(activePurchase.sgst).toFixed(2)})</span>
                  )}
                  {activePurchase.igst !== undefined && activePurchase.igst !== null && Number(activePurchase.igst) > 0 && (
                    <span className="text-slate-400 font-mono text-[11px]">(IGST: ₹{Number(activePurchase.igst).toFixed(2)})</span>
                  )}
                </div>
                <div className="text-emerald-400 text-sm font-black whitespace-nowrap">
                  Supplier Total: ₹{(activePurchase.totalAmount !== undefined ? activePurchase.totalAmount : (activePurchase.grandTotal || 0)).toFixed(2)}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                * Input GST is charged by the supplier. Stored unit purchase price reflects GST-exclusive cost basis.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;
