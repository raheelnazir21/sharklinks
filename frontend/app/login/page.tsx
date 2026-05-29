"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  ShieldCheck, 
  BarChart3, 
  Users2,
  ChevronRight
} from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    setError("");

    if (!trimmedEmail || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "Login failed. Check your credentials."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    // Propose Google SSO flow placeholder
    console.log("Initiating Google SSO...");
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/google/login`;
  };

  return (
    <main className="min-h-screen w-full flex flex-col md:flex-row bg-[#FAFAF9] font-sans antialiased text-slate-800 relative overflow-hidden">
      
      {/* LEFT SIDE: Brand & Feature Presentation */}
      <section className="relative w-full md:w-[50%] lg:w-[48%] min-h-[50vh] md:min-h-screen bg-slate-50 flex flex-col justify-between p-8 md:py-16 md:pl-16 md:pr-12 lg:pl-24 lg:pr-16 overflow-hidden border-r border-slate-100 shrink-0">
        
        {/* Factory Faded Image Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-15 select-none pointer-events-none" 
          style={{ backgroundImage: "url('/factory_bg.png')" }} 
        />
        
        {/* Light Abstract Background Gradients & Patterns */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-teal-200/20 to-emerald-200/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-teal-100/20 to-slate-200/20 blur-2xl pointer-events-none" />

        {/* Content Container (Ensure layout is on top of absolute assets) */}
        <div className="relative z-10 w-full flex flex-col h-full justify-between gap-8 md:gap-0">
          
          {/* Logo / Header */}
          <div className="flex items-center gap-3">
            {/* Hexagonal Textile QC Logo */}
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 shadow-sm shadow-teal-500/5">
              <svg className="w-6 h-6 text-[#14B8A6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 leading-none tracking-tight">Textile QC System</h2>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Production & Quality Control</span>
            </div>
          </div>

          {/* Core Slogan / Hero Section */}
          <div className="my-auto py-8">
            <h1 className="text-3xl lg:text-4.5xl font-black text-slate-950 leading-[1.1] tracking-tight mb-4">
              Smart Quality.<br />
              <span className="bg-gradient-to-r from-[#14B8A6] to-[#10B981] bg-clip-text text-transparent">Stronger Production.</span>
            </h1>
            <p className="text-slate-500 text-sm lg:text-[14.5px] leading-relaxed max-w-sm">
              One integrated platform to manage sampling, bulk production, quality control, approvals, and factory operations.
            </p>

            {/* Premium Glassmorphism Feature Cards */}
            <div className="mt-8 space-y-3.5 max-w-[380px]">
              
              {/* Feature 1 */}
              <div className="group flex items-center gap-3.5 p-3 rounded-2xl backdrop-blur-md bg-white/75 border border-white/50 shadow-sm shadow-slate-100/50 hover:bg-white/95 transition-all duration-300 transform hover:translate-x-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-50 group-hover:bg-teal-100 transition-colors">
                  <TrendingUp className="w-[18px] h-[18px] text-[#14B8A6]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Real-Time Production Tracking</h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Monitor every stage in real time</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="group flex items-center gap-3.5 p-3 rounded-2xl backdrop-blur-md bg-white/75 border border-white/50 shadow-sm shadow-slate-100/50 hover:bg-white/95 transition-all duration-300 transform hover:translate-x-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                  <ShieldCheck className="w-[18px] h-[18px] text-[#10B981]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Quality You Can Trust</h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Built-in QC and QA at every step</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="group flex items-center gap-3.5 p-3 rounded-2xl backdrop-blur-md bg-white/75 border border-white/50 shadow-sm shadow-slate-100/50 hover:bg-white/95 transition-all duration-300 transform hover:translate-x-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-50 group-hover:bg-teal-100 transition-colors">
                  <BarChart3 className="w-[18px] h-[18px] text-[#14B8A6]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Data-Driven Decisions</h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Powerful dashboards and reports</p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="group flex items-center gap-3.5 p-3 rounded-2xl backdrop-blur-md bg-white/75 border border-white/50 shadow-sm shadow-slate-100/50 hover:bg-white/95 transition-all duration-300 transform hover:translate-x-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                  <Users2 className="w-[18px] h-[18px] text-[#10B981]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Team & Role Management</h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Secure role-based access control</p>
                </div>
              </div>

            </div>
          </div>

          {/* Footer Copyright */}
          <div className="text-[11px] text-slate-400 font-medium">
            © {new Date().getFullYear()} Textile QC System. All rights reserved.
          </div>

        </div>

        {/* Soft Wave Overlay Shapes at Bottom Left */}
        <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-[0] z-0 pointer-events-none select-none opacity-45">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-full h-[60px] text-teal-100/30 fill-current">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C26.9,8.75,57.05,18.3,90.35,26.7,175.76,48.24,251.71,62.06,321.39,56.44Z" />
          </svg>
        </div>

      </section>

      {/* RIGHT SIDE: Centered Premium Login Card */}
      <section className="relative flex-1 flex flex-col items-center md:items-start justify-center p-6 md:p-12 md:pl-16 lg:pl-28 min-h-[50vh] md:min-h-screen">
        
        {/* Subtle Background Gradients & Abstract Shapes */}
        <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] rounded-full bg-teal-500/[0.02] blur-3xl pointer-events-none" />
        <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-emerald-500/[0.02] blur-3xl pointer-events-none" />
        
        {/* Decorative Grid Dot Pattern */}
        <div className="absolute top-12 right-12 opacity-50 bg-[radial-gradient(#14B8A6_1px,transparent_1px)] [background-size:16px_16px] w-[96px] h-[96px] pointer-events-none" />

        {/* Premium Floating Card Container */}
        <div className="relative z-10 w-full max-w-[440px] bg-white border border-[#14B8A6]/10 rounded-[28px] p-8 lg:p-10 shadow-[0_20px_50px_rgba(20,184,166,0.04),0_1px_4px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_25px_60px_rgba(20,184,166,0.07)]">
          
          {/* Card Top: Hexagonal circular logo / Greetings */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 border border-teal-100/50 shadow-inner mb-4">
              <svg className="w-8 h-8 text-[#14B8A6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              {/* Soft Aqua Glowing Ring */}
              <div className="absolute inset-0 -m-1 rounded-full border border-teal-500/10 animate-pulse pointer-events-none" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Welcome Back</h2>
            <p className="text-slate-400 text-xs mt-1.5 font-medium">Sign in to your account to continue</p>
          </div>

          {/* Display Login Errors */}
          {error && (
            <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold rounded-2xl px-4 py-3 mb-6 animate-shake">
              <svg className="w-4 h-4 shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Input: Email Address */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#14B8A6] transition-colors">
                  <Mail className="w-4.5 h-4.5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-2xl pl-11 pr-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#14B8A6] transition-all"
                />
              </div>
            </div>

            {/* Input: Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-bold text-[#14B8A6] hover:text-[#10B981] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#14B8A6] transition-colors">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-2xl pl-11 pr-11 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#14B8A6] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#14B8A6] transition-colors cursor-pointer"
                >
                  {showPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Checkbox: Remember Me */}
            <div className="flex items-center pt-1">
              <label className="relative flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-[18px] h-[18px] bg-slate-50 border border-slate-200 rounded-[6px] flex items-center justify-center peer-checked:bg-[#14B8A6] peer-checked:border-[#14B8A6] transition-all">
                  <svg className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Remember me</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              id="login-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#14B8A6] to-[#10B981] hover:from-[#0d9488] hover:to-[#059669] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl py-3.5 text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/10 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Social Logins */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100" />
            </div>
            <span className="relative bg-white px-4 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              or continue with
            </span>
          </div>

          <div className="space-y-3">
            {/* Google Authentication (Only Google added as requested) */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl py-3 px-4 text-xs transition-all duration-200 cursor-pointer"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                <path fill="#ea4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.852 5.852 0 0 1 8.1 12.68a5.86 5.86 0 0 1 5.89-5.857c1.624 0 3.099.624 4.225 1.636l3.136-3.136c-2.032-1.9-4.828-3.08-7.36-3.08A10.026 10.026 0 0 0 4 12.274a10.034 10.034 0 0 0 10.029 10.03c5.688 0 9.873-3.953 9.873-10.029 0-.61-.06-1.196-.17-1.74H12.24Z"/>
              </svg>
              <span>Google</span>
            </button>
          </div>

          {/* Form Bottom: Create Account */}
          <p className="mt-8 text-center text-xs text-slate-400 font-medium">
            New to the system?{" "}
            <Link href="/signup" className="font-bold text-[#14B8A6] hover:text-[#10B981] transition-colors">
              Create an account
            </Link>
          </p>

        </div>

        {/* Small branding footer inside screen bottom */}
        <div className="absolute bottom-6 text-[10.5px] text-slate-400 font-semibold tracking-wide flex items-center gap-2 pointer-events-none select-none">
          <span>Enterprise Secure</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span>v2.4.1</span>
        </div>

      </section>

    </main>
  );
}
