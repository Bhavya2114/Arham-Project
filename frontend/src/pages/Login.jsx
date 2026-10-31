import React, { useState } from "react";
import axiosInstance from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiLogIn,
  FiClipboard,
  FiShield,
  FiZap,
  FiHexagon,
  FiSettings,
} from "react-icons/fi";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import { TbCircuitSwitchClosed } from "react-icons/tb";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await axiosInstance.post("/auth/login", {
        email: email.trim(),
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
        setErrorMessage("Invalid credentials or server unavailable. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#25262A] text-slate-800 font-sans selection:bg-emerald-600 selection:text-white relative bg-cover bg-center bg-no-repeat overflow-x-hidden"
      style={{
        backgroundImage: "url('/electrical_contractor_bg.jpg')",
      }}
    >
      {/* Subtle translucent overlay to ensure text contrast while keeping background sharp and visible */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#141518]/95 via-[#141518]/70 to-black/30 pointer-events-none" />

      {/* Main Centered Container that brings Left Content and Right Login Card closer together */}
      <div className="relative z-10 w-full max-w-[1360px] 2xl:max-w-[1440px] mx-auto min-h-screen flex flex-col lg:flex-row items-stretch justify-between px-6 sm:px-10 lg:px-12 xl:px-14">

        {/* ========================================================= */}
        {/* LEFT COLUMN: BRANDING & ELECTRICAL FEATURES */}
        {/* ========================================================= */}
        <div className="w-full lg:w-[54%] xl:w-[53%] flex flex-col justify-between py-6 sm:py-8 lg:py-10 xl:py-12 pr-0 lg:pr-6 xl:pr-8">

          {/* Top Brand Logo */}
          <div className="flex items-center">
            <img
              src="/brand/arham-logo-horizontal-dark.svg"
              alt="Arham Power Solutions"
              className="h-12 sm:h-14 w-auto"
            />
          </div>

          {/* Hero Pitch & Feature List */}
          <div className="my-6 lg:my-auto py-2 w-full max-w-[560px]">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl xl:text-[42px] font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                Simplify. Manage.<br />
                <span className="text-[#FFC14D]">Power Every Connection.</span>
              </h1>
              <p className="text-slate-700 text-sm sm:text-[15px] font-medium leading-relaxed max-w-lg pt-1">
                Arham Management System helps you manage electrical installations, maintenance, and operations across your projects with efficiency and control.
              </p>
            </div>

            {/* Compact Feature Rows */}
            <div className="mt-7 space-y-3.5 w-full">

              {/* Feature 1 */}
              <div className="flex items-center gap-3.5 group">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/90 text-[#FFC14D] border border-emerald-600/20 shadow-sm shrink-0">
                  <HiOutlineBuildingOffice2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight leading-snug">Project & Site Management</h3>
                  <p className="text-xs text-slate-600 font-medium">Organize and manage your projects and sites</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-center gap-3.5 group">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/90 text-[#FFC14D] border border-emerald-600/20 shadow-sm shrink-0">
                  <TbCircuitSwitchClosed className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight leading-snug">Electrical Work Management</h3>
                  <p className="text-xs text-slate-600 font-medium">Track wiring, installations, inspections, and tasks</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-center gap-3.5 group">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/90 text-[#FFC14D] border border-emerald-600/20 shadow-sm shrink-0">
                  <FiClipboard className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight leading-snug">Work Orders & Tasks</h3>
                  <p className="text-xs text-slate-600 font-medium">Create, assign, and monitor work orders easily</p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex items-center gap-3.5 group">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/90 text-[#FFC14D] border border-emerald-600/20 shadow-sm shrink-0">
                  <FiShield className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight leading-snug">Safety & Compliance</h3>
                  <p className="text-xs text-slate-600 font-medium">Ensure safety standards and regulatory compliance</p>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Left Statement Badge & Copyright */}
          <div className="space-y-3.5 pt-3">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#141518] text-white shadow-md border border-emerald-800/50 relative overflow-hidden max-w-sm">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <FiZap className="w-3.5 h-3.5 fill-emerald-400" />
              </div>
              <div className="pr-3">
                <p className="text-[11px] font-bold text-white leading-tight">
                  Better management.
                </p>
                <p className="text-[10px] text-emerald-200/90 leading-tight">
                  Safer operations. Stronger connections.
                </p>
              </div>
              {/* Subtle circuit line SVG decoration */}
              <svg
                className="absolute right-0 top-0 bottom-0 h-full w-20 text-emerald-500/15 pointer-events-none"
                viewBox="0 0 100 50"
                fill="none"
              >
                <path d="M10 25H40L55 10H80M40 25L55 40H90" stroke="currentColor" strokeWidth="2" />
                <circle cx="80" cy="10" r="3" fill="currentColor" />
                <circle cx="90" cy="40" r="3" fill="currentColor" />
              </svg>
            </div>

            <p className="text-xs text-slate-600 font-semibold">
              &copy; 2026 Arham Management System. All rights reserved.
            </p>
          </div>

        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: FLOATING CLEAN LOGIN CARD */}
        {/* ========================================================= */}
        <div className="w-full lg:w-[46%] xl:w-[47%] flex items-center justify-center lg:justify-start pl-0 lg:pl-6 xl:pl-10 py-6 sm:py-8 lg:py-10">

          <div className="w-full max-w-[450px] bg-white rounded-[28px] shadow-[0_25px_65px_-15px_rgba(0,0,0,0.15)] border border-slate-100 p-7 sm:p-9 transition-all duration-300">

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-[30px] font-extrabold text-slate-900 tracking-tight">
                Welcome <span className="text-[#FFC14D]">Back!</span>
              </h2>
              <p className="text-slate-500 text-xs sm:text-[13px] mt-1 font-medium">
                Sign in to continue to your account
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form className="space-y-4" onSubmit={handleLogin} autoComplete="off">

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-[13px] font-bold text-slate-800 block">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <FiMail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    name="arham_login_email"
                    id="arham_login_email"
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                    }}
                    className="block w-full pl-10 pr-4 h-12 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 focus:border-[#FFB82E] transition-all text-sm bg-white hover:border-slate-300"
                    placeholder="Enter your email address"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-[13px] font-bold text-slate-800 block">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <FiLock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="arham_login_password"
                    id="arham_login_password"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                    className="block w-full pl-10 pr-11 h-12 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 focus:border-[#FFB82E] transition-all text-sm bg-white hover:border-slate-300"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <FiEyeOff className="w-4 h-4" />
                    ) : (
                      <FiEye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 flex justify-center items-center gap-2 bg-[#FFB82E] hover:bg-[#F2A516] text-white rounded-xl font-bold shadow-md shadow-emerald-950/10 hover:shadow-lg hover:shadow-emerald-950/15 active:scale-[0.99] transition-all disabled:opacity-75 disabled:pointer-events-none text-base tracking-wide"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <>
                      <FiLogIn className="w-4 h-4 stroke-[2.5]" />
                      <span>Login</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Bottom Trust Indicators */}
            <div className="mt-7 pt-4 border-t border-slate-100 flex items-center justify-center gap-7 text-slate-400 text-xs font-semibold">
              <div className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
                <FiShield className="w-3.5 h-3.5 text-emerald-700" />
                <span>Secure</span>
              </div>
              <div className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
                <FiHexagon className="w-3.5 h-3.5 text-sky-600" />
                <span>Reliable</span>
              </div>
              <div className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
                <FiSettings className="w-3.5 h-3.5 text-amber-600" />
                <span>Professional</span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

export default Login;
