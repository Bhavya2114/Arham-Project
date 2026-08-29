import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/api';
import { 
  FaBoxes, 
  FaExclamationTriangle, 
  FaSearch, 
  FaRupeeSign
} from 'react-icons/fa';

const Stock = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchStockData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        axiosInstance.get('/products'),
        axiosInstance.get('/categories')
      ]);
      setProducts(prodRes.data.data || []);
      setCategories(catRes.data.data || []);
    } catch (err) {
      console.error('Error fetching inventory stock:', err);
      setError(err.response?.data?.message || 'Failed to load inventory stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  // Calculate Summary KPI Stats
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((sum, p) => sum + (p.currentStock || 0), 0);
  
  let inStockCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let inventoryCostValue = 0;
  let potentialRetailValue = 0;

  products.forEach((p) => {
    const stock = p.currentStock || 0;
    const minStock = p.minStockQuantity || 5;
    const cost = p.costPrice || 0;
    const price = p.sellingPrice || p.unitPrice || 0;

    inventoryCostValue += stock * cost;
    potentialRetailValue += stock * price;

    if (stock === 0) outOfStockCount++;
    else if (stock <= minStock) lowStockCount++;
    else inStockCount++;
  });

  // Filter Products Logic
  const filteredProducts = products.filter((p) => {
    const name = p.name || '';
    const sku = p.sku || '';
    const category = p.category || '';
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      name.toLowerCase().includes(term) ||
      sku.toLowerCase().includes(term) ||
      category.toLowerCase().includes(term);

    const matchesCategory = categoryFilter ? p.category === categoryFilter : true;

    let status = 'IN_STOCK';
    if (p.currentStock === 0) status = 'OUT_OF_STOCK';
    else if (p.currentStock <= (p.minStockQuantity || 5)) status = 'LOW_STOCK';

    const matchesStatus = statusFilter ? status === statusFilter : true;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Inventory Overview</h2>
        <p className="text-gray-500 text-sm">View current stock levels, item availability, categories, and inventory health.</p>
      </div>

      {/* Summary KPI Quick Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Products (All Stock) */}
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          aria-pressed={statusFilter === ''}
          className={`p-4 rounded-2xl transition-all duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:-translate-y-0.5 select-none ${
            statusFilter === ''
              ? 'bg-blue-50/80 border-2 border-blue-500 shadow-md ring-2 ring-blue-500/20'
              : 'bg-white border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-extrabold uppercase ${statusFilter === '' ? 'text-blue-700' : 'text-gray-400'}`}>
              Total Products
            </span>
            {statusFilter === '' && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            )}
          </div>
          <span className={`text-xl font-extrabold block mt-1 ${statusFilter === '' ? 'text-blue-900' : 'text-gray-900'}`}>
            {totalProducts} Items
          </span>
          <span className="text-[10px] text-gray-400 font-medium block mt-0.5">Click to show all</span>
        </button>

        {/* Total Stock Units */}
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          aria-pressed={statusFilter === ''}
          className={`p-4 rounded-2xl transition-all duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 hover:-translate-y-0.5 select-none ${
            statusFilter === ''
              ? 'bg-slate-100/90 border-2 border-slate-600 shadow-md ring-2 ring-slate-500/20'
              : 'bg-white border border-gray-200 shadow-sm hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-extrabold uppercase ${statusFilter === '' ? 'text-slate-700' : 'text-gray-400'}`}>
              Total Stock
            </span>
            {statusFilter === '' && (
              <span className="w-2 h-2 rounded-full bg-slate-600"></span>
            )}
          </div>
          <span className={`text-xl font-extrabold block mt-1 ${statusFilter === '' ? 'text-slate-900' : 'text-gray-900'}`}>
            {totalStockUnits.toLocaleString()} units
          </span>
          <span className="text-[10px] text-gray-400 font-medium block mt-0.5">Click to show all</span>
        </button>

        {/* In Stock */}
        <button
          type="button"
          onClick={() => setStatusFilter('IN_STOCK')}
          aria-pressed={statusFilter === 'IN_STOCK'}
          className={`p-4 rounded-2xl transition-all duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 hover:-translate-y-0.5 select-none ${
            statusFilter === 'IN_STOCK'
              ? 'bg-emerald-100/90 border-2 border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
              : 'bg-white border border-emerald-100 bg-emerald-50/30 shadow-sm hover:border-emerald-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-700 font-extrabold uppercase">In Stock</span>
            {statusFilter === 'IN_STOCK' && (
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            )}
          </div>
          <span className="text-xl font-extrabold text-emerald-800 block mt-1">{inStockCount} Normal</span>
          <span className="text-[10px] text-emerald-600/80 font-medium block mt-0.5">Click to filter</span>
        </button>

        {/* Low Stock Alert */}
        <button
          type="button"
          onClick={() => setStatusFilter('LOW_STOCK')}
          aria-pressed={statusFilter === 'LOW_STOCK'}
          className={`p-4 rounded-2xl transition-all duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 hover:-translate-y-0.5 select-none ${
            statusFilter === 'LOW_STOCK'
              ? 'bg-amber-100/90 border-2 border-amber-600 shadow-md ring-2 ring-amber-500/30'
              : 'bg-white border border-amber-100 bg-amber-50/30 shadow-sm hover:border-amber-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-700 font-extrabold uppercase">Low Stock Alert</span>
            {statusFilter === 'LOW_STOCK' && (
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
            )}
          </div>
          <span className="text-xl font-extrabold text-amber-800 block mt-1">{lowStockCount} Deficit</span>
          <span className="text-[10px] text-amber-600/80 font-medium block mt-0.5">Click to filter</span>
        </button>

        {/* Out of Stock */}
        <button
          type="button"
          onClick={() => setStatusFilter('OUT_OF_STOCK')}
          aria-pressed={statusFilter === 'OUT_OF_STOCK'}
          className={`p-4 rounded-2xl transition-all duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 hover:-translate-y-0.5 select-none col-span-2 lg:col-span-1 ${
            statusFilter === 'OUT_OF_STOCK'
              ? 'bg-red-100/90 border-2 border-red-600 shadow-md ring-2 ring-red-500/30'
              : 'bg-white border border-red-100 bg-red-50/30 shadow-sm hover:border-red-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-700 font-extrabold uppercase">Out of Stock</span>
            {statusFilter === 'OUT_OF_STOCK' && (
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
            )}
          </div>
          <span className="text-xl font-extrabold text-red-800 block mt-1">{outOfStockCount} Empty</span>
          <span className="text-[10px] text-red-600/80 font-medium block mt-0.5">Click to filter</span>
        </button>
      </div>

      {/* Valuation Summary Banner */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between text-xs font-bold gap-3">
        <div className="flex items-center space-x-2">
          <FaRupeeSign className="text-emerald-400 text-base" />
          <span>Inventory Cost Valuation: <span className="text-emerald-400 text-sm font-black">₹{inventoryCostValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
        </div>
        <div>
          <span>Potential Retail Valuation: <span className="text-blue-400 text-sm font-black">₹{potentialRetailValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
        </div>
      </div>

      {/* Search & Combined Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search product / SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white font-medium text-gray-700"
        >
          <option value="">All Categories ({categories.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white font-medium text-gray-700"
        >
          <option value="">All Stock Statuses</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>
      </div>

      {/* Stock Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading stock inventory...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center space-x-3">
            <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : products.length === 0 ? (
          /* Empty Inventory State */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              <FaBoxes />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">No products in inventory</h3>
              <p className="text-xs text-gray-500">Items received via purchase orders will appear here in inventory.</p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty Search Filter State */
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">No products match the selected filters</p>
            <p className="text-xs text-gray-400">Try adjusting search keywords or clearing status filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
                setStatusFilter('');
              }}
              className="text-xs text-emerald-600 font-bold underline hover:text-emerald-700 mt-2"
            >
              Clear Search & Filters
            </button>
          </div>
        ) : (
          /* Stock Table */
          <div className="w-full overflow-x-auto lg:overflow-x-visible">
            <table className="w-full text-left text-xs sm:text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-3 sm:px-4 sm:py-3.5 min-w-[160px]">Product / Item Name</th>
                  <th className="px-3.5 py-3 sm:px-4 sm:py-3.5 whitespace-nowrap">SKU</th>
                  <th className="px-3.5 py-3 sm:px-4 sm:py-3.5 whitespace-nowrap">Category</th>
                  <th className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-right whitespace-nowrap">Cost Price</th>
                  <th className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-right whitespace-nowrap">Selling Price</th>
                  <th className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-center whitespace-nowrap">Current Stock</th>
                  <th className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-center whitespace-nowrap">Min Threshold</th>
                  <th className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const minStock = p.minStockQuantity || 5;
                  const current = p.currentStock || 0;
                  const isOut = current === 0;
                  const isLow = current > 0 && current <= minStock;
                  const sellingPrice = p.sellingPrice || p.unitPrice || 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-100/70 transition-colors duration-150 ${
                        isOut ? 'bg-red-50/30' : isLow ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-3.5 py-3 sm:px-4 sm:py-3.5 font-bold text-gray-900 break-words min-w-[160px] max-w-[240px]">
                        {p.name}
                      </td>
                      <td className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-xs font-mono text-gray-400 whitespace-nowrap">{p.sku}</td>
                      <td className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-xs font-semibold text-gray-600 whitespace-nowrap">{p.category}</td>
                      <td className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-right text-xs font-medium text-gray-500 whitespace-nowrap">
                        ₹{(p.costPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-right text-xs font-semibold text-emerald-700 whitespace-nowrap">
                        ₹{sellingPrice.toFixed(2)}
                      </td>
                      <td className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-center font-black text-slate-900 text-sm sm:text-base whitespace-nowrap">
                        {current} <span className="text-xs text-gray-400 font-normal">{p.unit || 'pcs'}</span>
                      </td>
                      <td className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">{minStock}</td>
                      <td className="px-3.5 py-3 sm:px-4 sm:py-3.5 text-center whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-block px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-extrabold whitespace-nowrap">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-extrabold whitespace-nowrap">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-extrabold whitespace-nowrap">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stock;
