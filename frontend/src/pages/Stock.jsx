import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../utils/api';
import {
  FaBoxes,
  FaExclamationTriangle,
  FaChevronDown,
  FaSearch
} from 'react-icons/fa';

// Quantities can pick up float noise from adding / subtracting (6.800000000000001); show at most 3 decimals
const formatQty = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

const Stock = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'IN_STOCK' | 'OUT_OF_STOCK'
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  // Close export menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Inventory Products
  const fetchStockData = async () => {
    setLoading(true);
    setError(null);
    try {
      const prodRes = await axiosInstance.get('/products');
      setProducts(prodRes.data?.data || []);
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

  // Calculate Summary KPI Stats (Only In Stock & Out of Stock; Low Stock UI is removed)
  const totalProducts = products.length;
  let inStockCount = 0;
  let outOfStockCount = 0;
  let inventoryCostValue = 0;

  products.forEach((p) => {
    const stock = Number(p.currentStock) || 0;
    const cost = Number(p.costPrice) || 0;

    inventoryCostValue += stock * cost;

    if (stock === 0) {
      outOfStockCount++;
    } else {
      inStockCount++;
    }
  });

  // Filter Products Logic
  const filteredProducts = products.filter((p) => {
    const name = p.name || '';
    const sku = p.sku || '';
    const category = p.category || '';
    const term = searchTerm.toLowerCase().trim();

    // Preserve backend search capability (name, category, sku), but UI focuses on product name
    const matchesSearch =
      !term ||
      name.toLowerCase().includes(term) ||
      sku.toLowerCase().includes(term) ||
      category.toLowerCase().includes(term);

    const current = Number(p.currentStock) || 0;
    const status = current === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK';

    const matchesStatus = statusFilter ? status === statusFilter : true;

    return matchesSearch && matchesStatus;
  });

  // CSV Export Handler (keeps full accounting data including SKU, but sets simplified stock status)
  const handleExportCSV = () => {
    setExportMenuOpen(false);
    if (filteredProducts.length === 0) return;

    const headers = [
      'Product Name',
      'SKU',
      'Category',
      'Cost Price (INR)',
      'Current Stock',
      'Unit',
      'Stock Status',
      'Stock Value (INR)'
    ];

    const rows = filteredProducts.map((p) => {
      const stock = Number(p.currentStock) || 0;
      const cost = Number(p.costPrice) || 0;
      const value = stock * cost;
      const status = stock === 0 ? 'Out of Stock' : 'In Stock';

      return [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.sku || '').replace(/"/g, '""')}"`,
        `"${(p.category || '').replace(/"/g, '""')}"`,
        cost.toFixed(2),
        stock,
        `"${p.unit || 'pcs'}"`,
        `"${status}"`,
        value.toFixed(2)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_stock_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // PDF Report Export Handler (generated directly in-place matching the redesigned 6 visible columns)
  const handleExportPDF = () => {
    setExportMenuOpen(false);
    if (filteredProducts.length === 0) return;

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const rowsHtml = filteredProducts.map((p, idx) => {
      const stock = Number(p.currentStock) || 0;
      const cost = Number(p.costPrice) || 0;
      const value = stock * cost;
      const isOut = stock === 0;
      const status = isOut ? 'Out of Stock' : 'In Stock';
      const statusColor = isOut ? '#e11d48' : '#059669';
      const qtyColor = isOut ? '#e11d48' : '#0f172a';

      return `
        <tr style="${isOut ? 'background-color: #fff8f8;' : ''}">
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${p.name || ''}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: ${qtyColor};">${formatQty(stock)} <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">${p.unit || 'NOS'}</span></td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155;">₹${cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #0f172a;">₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: ${statusColor}; font-weight: 600;">● ${status}</td>
        </tr>
      `;
    }).join('');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Inventory Overview Report - ${formattedDate}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 30px; color: #1e293b; }
            h1 { margin-bottom: 4px; font-size: 22px; color: #0f172a; }
            .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
            th { background-color: #f8fafc; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #cbd5e1; font-weight: 700; letter-spacing: 0.05em; }
            .summary { display: flex; gap: 24px; margin-bottom: 20px; font-size: 13px; font-weight: bold; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
            @media print {
              body { margin: 15px; }
            }
          </style>
        </head>
        <body>
          <h1>Inventory Overview Report</h1>
          <div class="meta">Generated on ${formattedDate} at ${formattedTime} | Showing ${filteredProducts.length} items</div>
          <div class="summary">
            <div>Total Inventory Valuation: ₹${Math.round(inventoryCostValue).toLocaleString('en-IN')}</div>
            <div>Total Products: ${filteredProducts.length}</div>
            <div>In Stock: ${inStockCount}</div>
            <div>Out of Stock: ${outOfStockCount}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">#</th>
                <th>PRODUCT</th>
                <th style="text-align: right;">QUANTITY</th>
                <th style="text-align: right;">COST PRICE</th>
                <th style="text-align: right;">STOCK VALUE</th>
                <th style="text-align: center;">STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 250);
  };

  return (
    <div className="space-y-4">
      {/* 1. Page Header & Top-Right Export Action */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Inventory
        </h1>

        {/* Compact Export Button & Dropdown */}
        <div className="relative flex-shrink-0" ref={exportMenuRef}>
          <button
            type="button"
            id="export-menu-btn"
            onClick={() => setExportMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors focus:outline-none cursor-pointer"
            aria-label="Export Menu"
            title="Export Options"
          >
            <span>Export</span>
            <FaChevronDown className={`text-[9px] text-slate-400 transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-1">
              <button
                type="button"
                onClick={handleExportPDF}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                PDF Report
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                Excel (.xlsx)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Exactly 4 KPI Cards Matching Reference Screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1 — TOTAL PRODUCTS */}
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          aria-pressed={statusFilter === ''}
          className={`bg-white rounded-2xl px-5 py-4 text-left transition-all duration-150 shadow-sm cursor-pointer select-none focus:outline-none ${
            statusFilter === ''
              ? 'border-2 border-emerald-600 shadow-sm'
              : 'border border-gray-200/80 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block mr-2 flex-shrink-0"></span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total products
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 leading-tight">
            {totalProducts}
          </div>
        </button>

        {/* CARD 2 — IN STOCK */}
        <button
          type="button"
          onClick={() => setStatusFilter((prev) => (prev === 'IN_STOCK' ? '' : 'IN_STOCK'))}
          aria-pressed={statusFilter === 'IN_STOCK'}
          className={`bg-white rounded-2xl px-5 py-4 text-left transition-all duration-150 shadow-sm cursor-pointer select-none focus:outline-none ${
            statusFilter === 'IN_STOCK'
              ? 'border-2 border-emerald-600 shadow-sm'
              : 'border border-gray-200/80 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block mr-2 flex-shrink-0"></span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              In stock
            </span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-600 mt-1 leading-tight">
            {inStockCount}
          </div>
        </button>

        {/* CARD 3 — OUT OF STOCK */}
        <button
          type="button"
          onClick={() => setStatusFilter((prev) => (prev === 'OUT_OF_STOCK' ? '' : 'OUT_OF_STOCK'))}
          aria-pressed={statusFilter === 'OUT_OF_STOCK'}
          className={`bg-white rounded-2xl px-5 py-4 text-left transition-all duration-150 shadow-sm cursor-pointer select-none focus:outline-none ${
            statusFilter === 'OUT_OF_STOCK'
              ? 'border-2 border-emerald-600 shadow-sm'
              : 'border border-gray-200/80 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-rose-600 inline-block mr-2 flex-shrink-0"></span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Out of stock
            </span>
          </div>
          <div className="text-3xl font-extrabold text-rose-600 mt-1 leading-tight">
            {outOfStockCount}
          </div>
        </button>

        {/* CARD 4 — INVENTORY VALUE (Light Mint Green Background Matching Reference) */}
        <div className="bg-emerald-50 border border-[#3A3B41] rounded-2xl px-5 py-4 text-left shadow-sm">
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block mr-2 flex-shrink-0"></span>
            <span className="text-[11px] font-bold text-emerald-800/70 uppercase tracking-wider">
              Inventory value
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[#FFC14D] mt-1 leading-tight">
            ₹{Math.round(inventoryCostValue).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* 3. Compact Full-Width Search Area */}
      <div className="bg-white border border-gray-200/80 rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-2.5">
        <FaSearch className="text-slate-400 text-xs flex-shrink-0" />
        <input
          type="text"
          placeholder="Search product name"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-400 hover:text-slate-600 font-semibold ml-2 focus:outline-none cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* 4. Product Table Container with Dynamic Content-Based Height */}
      <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2.5">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600"></div>
            <p className="text-xs text-gray-400 font-medium">Loading inventory stock...</p>
          </div>
        ) : error ? (
          <div className="p-5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center space-x-2.5">
            <FaExclamationTriangle className="text-red-500 text-base flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center space-y-2.5">
            <div className="w-10 h-10 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-lg">
              <FaBoxes />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-gray-800">No products in inventory</h3>
              <p className="text-[11px] text-gray-500">Items received via purchase orders will appear here in inventory.</p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center space-y-1.5">
            <p className="text-xs font-bold text-gray-700">No products match the selected filters</p>
            <p className="text-[11px] text-gray-400">Try adjusting search keywords or clearing status filters.</p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
              }}
              className="text-xs text-emerald-600 font-bold underline hover:text-emerald-700 mt-1 cursor-pointer"
            >
              Clear Search & Filters
            </button>
          </div>
        ) : (
          /* Dynamic Content-Based Table: Tightly fit for few rows, max-height + scroll for many */
          <div className="w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] custom-table-scrollbar">
            <table className="w-full text-left text-xs sm:text-sm text-slate-600 border-collapse min-w-[700px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <tr>
                  <th className="sticky top-0 z-10 bg-white px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-12">
                    #
                  </th>
                  <th className="sticky top-0 z-10 bg-white px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    PRODUCT
                  </th>
                  <th className="sticky top-0 z-10 bg-white px-5 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    QUANTITY
                  </th>
                  <th className="sticky top-0 z-10 bg-white px-5 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    COST PRICE
                  </th>
                  <th className="sticky top-0 z-10 bg-white px-5 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    STOCK VALUE
                  </th>
                  <th className="sticky top-0 z-10 bg-white px-5 py-3.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    STATUS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80">
                {filteredProducts.map((p, idx) => {
                  const current = Number(p.currentStock) || 0;
                  const costPrice = Number(p.costPrice) || 0;
                  const stockValue = current * costPrice;
                  const isOut = current === 0;

                  return (
                    <tr
                      key={p.id || idx}
                      className={`transition-colors border-b border-gray-100/80 ${
                        isOut
                          ? 'bg-[#25262A] hover:bg-rose-50/40'
                          : 'bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      {/* # */}
                      <td className="px-5 py-4 text-left text-slate-400 font-medium text-sm">
                        {idx + 1}
                      </td>

                      {/* PRODUCT */}
                      <td className="px-5 py-4 text-left font-bold text-slate-900 text-sm break-words">
                        {p.name}
                      </td>

                      {/* QUANTITY */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-medium">
                        <span className={`font-bold text-sm ${isOut ? 'text-rose-600' : 'text-slate-900'}`}>
                          {formatQty(current)}
                        </span>
                        <span className="text-slate-400 text-xs font-normal ml-1">
                          {p.unit || 'NOS'}
                        </span>
                      </td>

                      {/* COST PRICE */}
                      <td className="px-5 py-4 text-right font-bold text-slate-900 text-sm whitespace-nowrap">
                        ₹{costPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* STOCK VALUE */}
                      <td className="px-5 py-4 text-right font-bold text-slate-900 text-sm whitespace-nowrap">
                        ₹{stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* STATUS */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-100/70 text-rose-700 border border-rose-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>Out of Stock</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>In Stock</span>
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
