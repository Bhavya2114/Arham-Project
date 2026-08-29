import React, { useState } from "react";
import axiosInstance from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { 
  FiMail, 
  FiLock, 
  FiEye, 
  FiEyeOff, 
  FiPackage, 
  FiActivity, 
  FiBarChart2, 
  FiLogIn, 
  FiUser, 
  FiPhoneCall, 
  FiHome 
} from "react-icons/fi";

const demoAccounts = {
  admin: {
    username: "admin@erp.com",
    password: "Password@123",
    role: "Admin"
  },
  sales: {
    username: "sales@erp.com",
    password: "Password@123",
    role: "Sales"
  },
  warehouse: {
    username: "warehouse@erp.com",
    password: "Password@123",
    role: "Warehouse"
  },
  accounts: {
    username: "accounts@erp.com",
    password: "Password@123",
    role: "Accounts"
  }
};

const demoAccountCards = [
  { key: "admin", label: "Admin", user: "admin", icon: FiUser },
  { key: "sales", label: "Sales", user: "sales", icon: FiPhoneCall },
  { key: "warehouse", label: "Warehouse", user: "warehouse", icon: FiPackage },
  { key: "accounts", label: "Accounts", user: "accounts", icon: FiHome }
];

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await axiosInstance.post("/auth/login", {
        email,
        password,
      });

      const { token, user } = response.data;
      if (token && user) {
        login(user, token);
        if (["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"].includes(user.role)) {
          navigate("/dashboard");
        } else {
          setErrorMessage("Unauthorized role.");
        }
      } else {
        setErrorMessage("Invalid response from server.");
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage("Error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = (roleKey) => {
    const account = demoAccounts[roleKey];
    setEmail(account.username);
    setPassword(account.password);
    setSelectedRole(roleKey);
  };

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row bg-[#f8fafc] font-sans">
      {/* Left Side: Branding & Marketing */}
      <div className="w-full md:w-1/2 bg-[#002b1c] text-white p-6 md:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden select-none">
        {/* Subtle background glow for texture */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/5 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2 bg-emerald-900/40 rounded-xl border border-emerald-500/20">
            <svg className="h-6 w-6 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              Inventory <span className="text-[#10b981]">MS</span>
            </h1>
            <p className="text-[11px] text-emerald-400/80 font-medium">Inventory Management System</p>
          </div>
        </div>

        {/* Hero Copy */}
        <div className="my-6 md:my-auto py-2 md:py-8 relative z-10 flex-1 flex flex-col justify-center">
          <div>
            <h2 className="text-[32px] lg:text-[38px] font-extrabold tracking-tight leading-tight text-white">
              Smarter Inventory.<br />
              <span className="text-[#10b981]">Better Business.</span>
            </h2>
            <p className="mt-3 text-emerald-100/75 text-[14px] leading-relaxed max-w-md">
              Track stock, manage products, and streamline your inventory operations all in one place.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="mt-6 md:mt-8 space-y-3 md:space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-emerald-900/30 rounded-full border border-emerald-500/20 text-[#10b981] shrink-0">
                <FiPackage className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Real-time Stock Tracking</h3>
                <p className="text-xs text-emerald-300/60 mt-0.5">Monitor inventory in real time</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-emerald-900/30 rounded-full border border-emerald-500/20 text-[#10b981] shrink-0">
                <FiActivity className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Low Stock Alerts</h3>
                <p className="text-xs text-emerald-300/60 mt-0.5">Get notified before stock runs out</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-emerald-900/30 rounded-full border border-emerald-500/20 text-[#10b981] shrink-0">
                <FiBarChart2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Detailed Reports</h3>
                <p className="text-xs text-emerald-300/60 mt-0.5">Analyze and grow your business</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info (branding side) */}
        <div className="text-xs text-emerald-300/60 z-10 mt-3 md:mt-0">
          Professional Operations Portal v1.0
        </div>
      </div>

      {/* Right Side: Form Panel */}
      <div className="flex-1 flex flex-col justify-between items-center px-6 py-6 md:py-8 bg-white relative md:overflow-y-auto w-full md:w-1/2">
        {/* Placeholder div to push content down on desktop */}
        <div className="hidden md:block h-2"></div>

        {/* Form Container */}
        <div className="w-full max-w-[480px] space-y-4 md:space-y-5 my-auto md:-translate-y-5 transition-transform duration-300">
          {/* Welcome Header */}
          <div className="text-center">
            <h2 className="text-[30px] lg:text-[34px] font-extrabold text-slate-800 tracking-tight leading-none">
              Welcome <span className="text-[#005f3d]">Back!</span>
            </h2>
            <p className="mt-2 text-xs text-slate-500 font-medium">
              Sign in to continue to Inventory MS
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-1">
              <label className="text-[13px] font-semibold text-slate-700 block">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FiMail className="h-4.5 w-4.5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedRole(null);
                  }}
                  className="block w-full pl-10 pr-4 h-[46px] border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all text-sm bg-slate-50/20"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[13px] font-semibold text-slate-700 block">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FiLock className="h-4.5 w-4.5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSelectedRole(null);
                  }}
                  className="block w-full pl-10 pr-10 h-[46px] border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all text-sm bg-slate-50/20"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <FiEyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <FiEye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[48px] flex justify-center items-center gap-2 bg-[#005f3d] hover:bg-[#004f32] text-white rounded-xl font-semibold shadow-md shadow-emerald-900/5 hover:shadow-[#004f32]/10 active:scale-[0.99] transition-all disabled:opacity-75 disabled:pointer-events-none text-sm"
              >
                {loading ? (
                  <span>Logging in...</span>
                ) : (
                  <>
                    <FiLogIn className="h-4.5 w-4.5" />
                    <span>{selectedRole ? `Login as ${demoAccounts[selectedRole].role}` : "Login"}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative flex py-0.5 items-center">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-3 text-slate-400 text-[10px] uppercase tracking-wider font-semibold bg-white px-2">or</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* Demo Account Section */}
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-[12px] font-bold text-slate-700 flex items-center justify-center gap-1.5">
                <span className="text-amber-500 text-sm">⚡</span> Demo Accounts Quick-Login:
              </p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Select a role to auto-fill demo credentials
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
              {demoAccountCards.map((card) => {
                const IconComponent = card.icon;
                const isActive = selectedRole === card.key;
                return (
                  <div
                    key={card.key}
                    onClick={() => handleSelectRole(card.key)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center cursor-pointer select-none transition-all duration-300 ease-in-out ${
                      isActive
                        ? "border-[#005f3d] bg-emerald-50/40 shadow-md ring-2 ring-[#005f3d]/20"
                        : "border-slate-200 bg-white hover:border-emerald-600/30 hover:bg-emerald-50/5 hover:shadow-md hover:scale-[1.02]"
                    }`}
                  >
                    <div className={`p-1.5 rounded-full mb-1 flex items-center justify-center transition-colors ${
                      isActive ? "bg-emerald-100 text-[#005f3d]" : "bg-emerald-50 text-[#005f3d]/80"
                    }`}>
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold text-[11px] text-[#005f3d] tracking-tight flex items-center justify-center gap-1">
                      {isActive && <span className="text-[10px] font-extrabold">✓</span>}
                      {card.label}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium mt-0.5">User: {card.user}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer copyright */}
        <div className="mt-4 md:mt-6 text-center w-full">
          <p className="text-[11px] text-slate-400 font-medium">
            &copy; 2026 Inventory MS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

