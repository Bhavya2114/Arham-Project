import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BackupButton from './BackupButton';
import {
  LuLayoutGrid,
  LuPackage,
  LuShoppingCart,
  LuBriefcase,
  LuUsers,
  LuTruck,
  LuBarChart3,
  LuChevronDown,
  LuChevronRight,
  LuX,
  LuLogOut
} from 'react-icons/lu';

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
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${isActive
      ? 'bg-[#FFB82E]/10 text-[#FFC14D]'
      : 'text-[#B8B4AC] hover:bg-[#222327] hover:text-[#F4F1EA]'
    }`;

  const subItemClass = ({ isActive }) =>
    `block py-1.5 px-3 rounded-lg text-[13px] transition-colors ${isActive ? 'bg-[#FFB82E]/10 text-[#FFC14D]' : 'text-[#908C84] hover:text-[#F4F1EA]'}`;

  const iconClass = 'text-[18px] shrink-0';
  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const roleLabel = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : '';

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LuLayoutGrid, match: (p) => p === '/dashboard' },
    { to: '/stock', label: 'Inventory', icon: LuPackage, match: (p) => p === '/stock' },
  ];
  const navItemsAfterPurchases = [
    { to: '/projects', label: 'Projects', icon: LuBriefcase, match: (p) => p.startsWith('/projects') },
    { to: '/labour', label: 'Labour', icon: LuUsers, match: (p) => p.startsWith('/labour') },
    { to: '/suppliers', label: 'Suppliers', icon: LuTruck, match: (p) => p === '/suppliers' },
    { to: '/reports', label: 'Reports & Analytics', icon: LuBarChart3, match: (p) => p.startsWith('/reports') },
  ];

  const renderItem = ({ to, label, icon: Icon, match }) => (
    <NavLink
      key={to}
      to={to}
      onClick={() => setIsOpen(false)}
      className={({ isActive }) => navItemClass(isActive || match(location.pathname))}
    >
      <Icon className={iconClass} />
      <span>{label}</span>
    </NavLink>
  );

  const purchasesActive = location.pathname.startsWith('/purchases');

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar Container */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-60 bg-[#141518] text-[#B8B4AC] border-r border-[#222327] transition-transform duration-300 transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <img
            src="/brand/arham-logo-horizontal-dark.svg"
            alt="Arham Power Solutions"
            className="h-10 w-auto"
          />
          <button
            className="md:hidden p-2 text-[#908C84] hover:text-[#F4F1EA] rounded-lg transition-colors"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <LuX className="text-lg" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map(renderItem)}

          {/* Purchases group */}
          <div>
            <button
              onClick={() => toggleSubMenu('purchases')}
              className={`w-full ${navItemClass(purchasesActive)}`}
            >
              <LuShoppingCart className={iconClass} />
              <span className="flex-1 text-left">Purchases</span>
              {openSubMenus.purchases ? <LuChevronDown className="text-sm opacity-60" /> : <LuChevronRight className="text-sm opacity-60" />}
            </button>
            {openSubMenus.purchases && (
              <div className="ml-[22px] mt-1 mb-1 space-y-0.5 border-l border-[#2A2B30] pl-3">
                <NavLink to="/purchases/new" onClick={() => setIsOpen(false)} className={subItemClass}>
                  Add purchase
                </NavLink>
                <NavLink to="/purchases" end onClick={() => setIsOpen(false)} className={subItemClass}>
                  Purchase history
                </NavLink>
              </div>
            )}
          </div>

          {navItemsAfterPurchases.map(renderItem)}

        </nav>

        {user?.role === 'ADMIN' && <BackupButton />}

        {/* Signed-in user */}
        <div className="mx-3 mb-3 pt-3 border-t border-[#222327] flex items-center gap-3 px-2">
          <span className="w-8 h-8 rounded-full bg-[#FFB82E] text-[#1A1B1E] grid place-items-center text-[13px] font-semibold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-[#F4F1EA] truncate capitalize">{displayName}</div>
            <div className="text-[11.5px] text-[#75716A] truncate">{roleLabel}</div>
          </div>
          <NavLink to="/logout" title="Log out" className="p-1.5 rounded-lg text-[#908C84] hover:text-[#F4F1EA] hover:bg-[#222327]">
            <LuLogOut className="text-base" />
          </NavLink>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
