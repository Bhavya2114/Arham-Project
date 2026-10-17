import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FaChevronDown,
  FaChevronRight,
  FaTimes
} from 'react-icons/fa';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user } = useAuth();
  const location = useLocation();

  // Collapsible sub-menu states
  const [openSubMenus, setOpenSubMenus] = useState({
    purchases: location.pathname.startsWith('/purchases'),
  });

  const toggleSubMenu = (menuKey) => {
    setOpenSubMenus((prev) => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const navItemClass = (isActive) =>
    `flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
      ? 'bg-[#059669] text-white shadow-sm'
      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
    }`;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900 bg-opacity-50 transition-opacity md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar Container */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-[#0b1329] text-white transition-transform duration-300 transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center space-x-1.5">
            <span className="text-lg font-bold tracking-wider text-slate-100">PROJECT</span>
            <span className="text-lg font-extrabold tracking-wider text-[#10b981]">ERP</span>
          </div>
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-3 space-y-1.5 overflow-y-auto">
          {/* Dashboard */}
          <NavLink
            to="/dashboard"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => navItemClass(isActive)}
          >
            <span>Dashboard</span>
          </NavLink>

          {/* Inventory */}
          <NavLink
            to="/stock"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => navItemClass(isActive || location.pathname === '/stock')}
          >
            <span>Inventory</span>
          </NavLink>

          {/* Purchases Group */}
          <div>
            <button
              onClick={() => toggleSubMenu('purchases')}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${location.pathname.startsWith('/purchases')
                  ? 'bg-slate-800/60 text-[#10b981] font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <span>Purchases</span>
              {openSubMenus.purchases ? <FaChevronDown className="text-xs opacity-60" /> : <FaChevronRight className="text-xs opacity-60" />}
            </button>
            {openSubMenus.purchases && (
              <div className="ml-4 mt-1 space-y-1 border-l border-slate-800 pl-3">
                <NavLink
                  to="/purchases/new"
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-[#059669]/30 text-[#10b981] font-bold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  + Add Purchase
                </NavLink>
                <NavLink
                  to="/purchases"
                  end
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-[#059669]/30 text-[#10b981] font-bold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  Purchase History
                </NavLink>
              </div>
            )}
          </div>

          {/* Projects */}
          <NavLink
            to="/projects"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => navItemClass(isActive || location.pathname.startsWith('/projects'))}
          >
            <span>Projects</span>
          </NavLink>

          {/* Labour */}
          <NavLink
            to="/labour"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => navItemClass(isActive || location.pathname.startsWith('/labour'))}
          >
            <span>Labour</span>
          </NavLink>

          {/* Suppliers */}
          <NavLink
            to="/suppliers"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => navItemClass(isActive)}
          >
            <span>Suppliers</span>
          </NavLink>

          {/* Reports */}
          <NavLink
            to="/reports"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => navItemClass(isActive)}
          >
            <span>Reports & Analytics</span>
          </NavLink>

          {/* Settings */}
          <NavLink
            to="/settings"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => navItemClass(isActive)}
          >
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer / User Info */}
        <div className="p-4 border-t border-slate-800/80 bg-[#090f21]">
          <div className="text-[11px] text-slate-400">Logged in as:</div>
          <div className="font-semibold text-xs truncate text-white">{user?.email}</div>
          <div className="text-[11px] text-[#10b981] font-bold mt-0.5">{user?.role}</div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;