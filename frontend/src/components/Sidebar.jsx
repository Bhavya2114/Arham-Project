import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FaHome, 
  FaUsers, 
  FaBox, 
  FaTruck,
  FaShoppingCart,
  FaChartBar,
  FaCog,
  FaChevronDown,
  FaChevronRight,
  FaTimes,
  FaBuilding
} from 'react-icons/fa';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user } = useAuth();
  const location = useLocation();

  // Collapsible sub-menu states
  const [openSubMenus, setOpenSubMenus] = useState({
    purchases: location.pathname.startsWith('/purchases'),
    sales: location.pathname.startsWith('/billing') || location.pathname.startsWith('/sales'),
  });

  const toggleSubMenu = (menuKey) => {
    setOpenSubMenus((prev) => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-slate-900 text-white transition-transform duration-300 transform 
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:relative md:translate-x-0`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-lg">
              I
            </div>
            <span className="text-xl font-extrabold tracking-wider text-emerald-400">INVENTORY POS</span>
          </div>
          <button 
            className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Dashboard */}
          <NavLink
            to="/dashboard"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <FaHome className="text-base mr-3" />
            <span>Dashboard</span>
          </NavLink>

          {/* Inventory (Single Navigation Link) */}
          <NavLink
            to="/stock"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive || location.pathname === '/stock'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <FaBox className="text-base mr-3" />
            <span>Inventory</span>
          </NavLink>

          {/* Purchases Group */}
          <div>
            <button
              onClick={() => toggleSubMenu('purchases')}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                location.pathname.startsWith('/purchases')
                  ? 'text-emerald-400 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center">
                <FaTruck className="text-base mr-3" />
                <span>Purchases</span>
              </div>
              {openSubMenus.purchases ? <FaChevronDown className="text-xs" /> : <FaChevronRight className="text-xs" />}
            </button>
            {openSubMenus.purchases && (
              <div className="ml-8 mt-1 space-y-1 border-l-2 border-slate-800 pl-3">
                <NavLink
                  to="/purchases/new"
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                      isActive ? 'bg-emerald-600/30 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
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
                    `block py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                      isActive ? 'bg-emerald-600/30 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  Purchase History
                </NavLink>
              </div>
            )}
          </div>

          {/* Sales Group */}
          <div>
            <button
              onClick={() => toggleSubMenu('sales')}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                location.pathname.startsWith('/billing') || location.pathname === '/sales'
                  ? 'text-emerald-400 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center">
                <FaShoppingCart className="text-base mr-3" />
                <span>Sales & Billing</span>
              </div>
              {openSubMenus.sales ? <FaChevronDown className="text-xs" /> : <FaChevronRight className="text-xs" />}
            </button>
            {openSubMenus.sales && (
              <div className="ml-8 mt-1 space-y-1 border-l-2 border-slate-800 pl-3">
                <NavLink
                  to="/billing"
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                      isActive ? 'bg-emerald-600/30 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  ⚡ POS Billing / New Sale
                </NavLink>
                <NavLink
                  to="/sales"
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                      isActive ? 'bg-emerald-600/30 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  Sales History
                </NavLink>
              </div>
            )}
          </div>

          {/* Customers */}
          <NavLink
            to="/customers"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <FaUsers className="text-base mr-3" />
            <span>Customers</span>
          </NavLink>

          {/* Projects */}
          <NavLink
            to="/projects"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive || location.pathname.startsWith('/projects')
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <FaBuilding className="text-base mr-3" />
            <span>Projects</span>
          </NavLink>

          {/* Suppliers */}
          <NavLink
            to="/suppliers"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <FaTruck className="text-base mr-3" />
            <span>Suppliers</span>
          </NavLink>

          {/* Reports */}
          <NavLink
            to="/reports"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <FaChartBar className="text-base mr-3" />
            <span>Reports & Analytics</span>
          </NavLink>

          {/* Settings */}
          <NavLink
            to="/settings"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <FaCog className="text-base mr-3" />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer / User Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="text-xs text-slate-400">Logged in as:</div>
          <div className="font-semibold text-sm truncate text-white">{user?.email}</div>
          <div className="text-xs text-emerald-400 font-bold mt-0.5">{user?.role}</div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;