import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { 
  FaExclamationTriangle, 
  FaWarehouse, 
  FaSync,
  FaPlus,
  FaBoxes,
  FaTimesCircle
} from 'react-icons/fa';

const LowStock = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, OUT_OF_STOCK, LOW_STOCK

  const fetchLowStock = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/products/low-stock');
      setProducts(res.data.data || []);
    } catch (err) {
      console.error("Error loading low stock products:", err);
      setError(err.response?.data?.message || "Failed to load low stock registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStock();
  }, []);

  const outOfStockItems = products.filter((p) => (p.currentStock || 0) === 0);
  const lowStockItems = products.filter((p) => (p.currentStock || 0) > 0);

  const displayedProducts = products.filter((p) => {
    if (activeTab === 'OUT_OF_STOCK') return (p.currentStock || 0) === 0;
    if (activeTab === 'LOW_STOCK') return (p.currentStock || 0) > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Low Stock & Reorder Warnings</h2>
          <p className="text-gray-500 text-sm">Actionable alerts for products whose stock levels are at or below minimum threshold quantities.</p>
        </div>
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            onClick={fetchLowStock}
            className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2.5 rounded-xl border border-gray-200 text-xs transition-colors"
          >
            <FaSync />
            <span>Refresh</span>
          </button>
          <Link
            to="/purchases/new"
            className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm text-xs transition-colors"
          >
            <FaPlus />
            <span>+ Create Purchase Order</span>
          </Link>
        </div>
      </div>

      {/* Summary Alert Banners */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center space-x-3 text-red-800">
            <FaTimesCircle className="text-red-600 text-2xl flex-shrink-0" />
            <div>
              <span className="font-extrabold text-sm block">{outOfStockItems.length} Products Out of Stock</span>
              <span className="text-xs text-red-600">Immediate procurement required to restore sales billing.</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center space-x-3 text-amber-800">
            <FaExclamationTriangle className="text-amber-600 text-2xl flex-shrink-0" />
            <div>
              <span className="font-extrabold text-sm block">{lowStockItems.length} Products Need Attention</span>
              <span className="text-xs text-amber-600">Stock level is below minimum threshold setting.</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {!loading && !error && products.length > 0 && (
        <div className="flex space-x-2 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            All Reorder Items ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('OUT_OF_STOCK')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'OUT_OF_STOCK'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Out of Stock ({outOfStockItems.length})
          </button>
          <button
            onClick={() => setActiveTab('LOW_STOCK')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'LOW_STOCK'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Low Stock Deficit ({lowStockItems.length})
          </button>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-gray-200 rounded-2xl">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
          <p className="text-sm text-gray-400 mt-2 font-medium">Checking inventory threshold levels...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-semibold flex items-center space-x-3">
          <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : products.length === 0 ? (
        /* Empty Healthy Inventory State */
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-gray-200 rounded-2xl text-center px-4 space-y-3">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl">
            ✓
          </div>
          <h3 className="text-lg font-bold text-gray-800">Inventory Levels 100% Healthy!</h3>
          <p className="text-xs text-gray-400 max-w-md">
            🎉 All inventory items are currently above minimum stock thresholds. No reorder shortfalls detected.
          </p>
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="p-10 bg-white border border-gray-200 rounded-2xl text-center text-xs text-gray-400 font-medium">
          No products match the selected tab filter.
        </div>
      ) : (
        /* Reorder Items Table */
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[750px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Product Name & SKU</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5 text-center">Current Stock</th>
                  <th className="px-6 py-3.5 text-center">Min Threshold</th>
                  <th className="px-6 py-3.5 text-center">Reorder Deficit</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedProducts.map((p) => {
                  const current = p.currentStock || 0;
                  const minStock = p.minStockQuantity || 5;
                  const deficit = Math.max(0, minStock - current);
                  const isOut = current === 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        isOut ? 'bg-red-50/40' : 'bg-amber-50/30'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 flex items-center space-x-2">
                          <FaExclamationTriangle className={isOut ? 'text-red-500' : 'text-amber-500'} />
                          <span>{p.name}</span>
                        </div>
                        <div className="text-xs font-mono text-gray-400 pl-6">{p.sku}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-gray-600">{p.category}</td>
                      <td className="px-6 py-4 text-center font-black text-red-600 text-base">
                        {current}
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-semibold text-gray-500">{minStock}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-extrabold text-red-700 bg-red-100 px-2.5 py-1 rounded-md text-xs">
                          +{deficit} required
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isOut ? (
                          <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">Out of Stock</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">Low Stock</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to="/purchases/new"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center space-x-1"
                        >
                          <FaPlus className="text-[10px]" />
                          <span>Order Stock</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LowStock;
