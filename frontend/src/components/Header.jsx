import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaSignOutAlt, FaUserCircle, FaBars } from 'react-icons/fa';

const Header = ({ onMenuToggle }) => {
  const { user } = useAuth();
  const location = useLocation();

  // Map route path to page title
  const getPageTitle = (path) => {
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/products') return 'Products Directory';
    if (path === '/categories') return 'Categories Management';
    if (path === '/stock') return 'Stock Ledger & Inventory';
    if (path === '/purchases/new') return 'Add New Purchase Entry';
    if (path === '/purchases') return 'Purchase History';
    if (path === '/billing') return 'POS Billing & Invoicing';
    if (path === '/sales') return 'Sales History & Invoices';
    if (path === '/customers') return 'Customer CRM';
    if (path === '/suppliers') return 'Suppliers Directory';
    if (path.startsWith('/reports')) return 'Reports & Financial Analytics';
    if (path === '/settings') return 'Settings';
    return 'Inventory Management System';
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'SALES':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'WAREHOUSE':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'ACCOUNTS':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm z-10">
      {/* Title & Mobile Toggle */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FaBars className="text-lg" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">
          {getPageTitle(location.pathname)}
        </h1>
      </div>

      {/* User Actions */}
      <div className="flex items-center space-x-4">
        {/* User Info & Badge (Desktop) */}
        <div className="hidden sm:flex flex-col items-end">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-gray-700">
              {user?.name || user?.email}
            </span>
            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${getRoleBadgeClass(user?.role)}`}>
              {user?.role}
            </span>
          </div>
          <span className="text-xs text-gray-500">{user?.email}</span>
        </div>

        {/* User Info (Mobile) */}
        <div className="sm:hidden flex items-center space-x-2">
          <FaUserCircle className="text-gray-600 text-xl" />
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${getRoleBadgeClass(user?.role)}`}>
            {user?.role}
          </span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-200"></div>

        {/* Logout */}
        <Link
          to="/logout"
          className="flex items-center justify-center p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
          title="Logout"
        >
          <FaSignOutAlt className="text-lg" />
        </Link>
      </div>
    </header>
  );
};

export default Header;
