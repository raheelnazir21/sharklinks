"use client";

import { useState } from "react";
import Image from "next/image";
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
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    Icon: TrendingUp,
    color: "#0044E6",
    bg: "#EBF0FF",
    title: "Production Planning & Tracking",
    desc: "Real-time visibility from planning to delivery",
  },
  {
    Icon: ShieldCheck,
    color: "#0044E6",
    bg: "#EBF0FF",
    title: "Quality Management System",
    desc: "Built-in QC, QA and audit at every step",
  },
  {
    Icon: BarChart3,
    color: "#0044E6",
    bg: "#EBF0FF",
    title: "Analytics & Performance Intelligence",
    desc: "Powerful dashboards and actionable insights",
  },
  {
    Icon: Users2,
    color: "#0044E6",
    bg: "#EBF0FF",
    title: "Team & Workflow Management",
    desc: "Secure roles, approvals and collaboration",
  },
];

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
      setError(err?.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/auth/google/login`;
  };

  return (
    <main className="relative w-full min-h-screen flex overflow-x-hidden overflow-y-auto font-sans bg-slate-50">

      {/* ── Background Layer ── */}
      <div className="absolute inset-0 z-0 bg-slate-200">
        <Image
          src="/factory_bg.png"
          alt="Factory Background"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      {/* ── Overlay Layer: Massive White Gradient on Left ── */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.96) 28%, rgba(255,255,255,0.75) 48%, rgba(255,255,255,0) 70%)'
        }}
      />

      {/* ── Bottom Layered Waves ── */}
      <div className="absolute bottom-0 left-0 w-full z-[2] pointer-events-none overflow-hidden leading-[0]">
        <svg viewBox="0 0 1440 280" className="w-full h-auto min-h-[22vh] max-h-[32vh]" preserveAspectRatio="none">
          <path fill="#0044E6" fillOpacity="0.75" d="M0,192L48,181.3C96,171,192,149,288,149.3C384,149,480,171,576,192C672,213,768,235,864,224C960,213,1056,171,1152,154.7C1248,139,1344,149,1392,154.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          <path fill="#0036B8" fillOpacity="0.95" d="M0,224L48,229.3C96,235,192,245,288,229.3C384,213,480,171,576,160C672,149,768,171,864,186.7C960,203,1056,213,1152,208C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          <path fill="#16233B" d="M0,288L48,272C96,256,192,224,288,218.7C384,213,480,235,576,234.7C672,235,768,213,864,186.7C960,160,1056,128,1152,133.3C1248,139,1344,181,1392,202.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
      </div>

      {/* ── Main Layout ── */}
      <div className="relative z-10 flex w-full h-full min-h-screen flex-col md:flex-row">

        {/* ════════════ LEFT PANEL — hidden on mobile, visible md+ ════════════ */}
        <div className="hidden md:flex md:w-[55%] flex-col justify-between p-10 lg:p-14 2xl:p-20 pt-12 pb-8 min-h-screen">

          {/* Logo */}
          <div className="mb-16">
            <Image
              src="/sharknits_logo.png"
              alt="Sharknits WIP & Production Management"
              width={727}
              height={528}
              className="w-auto h-20 max-w-[280px] object-contain object-left"
              priority
            />
          </div>

          {/* Hero Content */}
          <div className="flex flex-col justify-center max-w-[880px]">
            <h1 className="text-[30px] lg:text-[38px] xl:text-[44px] font-black text-[#16233B] leading-[1.1] tracking-tight mb-5">
              Manufacturing Excellence.<br />
              <span className="bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent pb-2">
                Sharknits Production & WIP.
              </span>
            </h1>

            <div className="w-[50px] h-[3px] bg-[#0044E6] mb-6 rounded-full" />

            <p className="text-slate-600 text-[16px] lg:text-[18px] font-medium leading-relaxed mb-8 max-w-[500px]">
              Complete Manufacturing, Quality Control<br />
              &amp; Performance Intelligence
            </p>

            {/* Feature Cards */}
            <div className="flex flex-col gap-3.5">
              {FEATURES.map((f, i) => {
                const Icon = f.Icon;
                return (
                  <div key={i} className="flex items-center gap-4 bg-white rounded-2xl p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(20,184,166,0.12)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: f.bg }}>
                      <Icon size={20} color={f.color} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h4 className="text-[#0F172A] font-bold text-[14px] leading-snug">{f.title}</h4>
                      <p className="text-slate-500 text-[12.5px] leading-snug mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Left Footer - on the Navy Wave */}
          <div className="flex items-center gap-4 text-white/95 text-[11px] font-semibold tracking-wider uppercase mt-auto pb-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={16} />
              <span>Secure</span>
            </div>
            <span className="text-white/30">|</span>
            <span>Reliable</span>
            <span className="text-white/30">|</span>
            <span>Intelligent</span>
            <span className="text-white/30">|</span>
            <span>Efficient</span>
          </div>

        </div>

        {/* ════════════ RIGHT PANEL — full-width on mobile, 45% on md+ ════════════ */}
        <div className="w-full md:w-[45%] flex items-center justify-center p-5 sm:p-8 relative min-h-screen">

          {/* Login Card */}
          <div className="w-full max-w-[440px] bg-white rounded-[32px] p-10 shadow-[0_12px_48px_rgba(0,0,0,0.1)] relative">

            {/* Card Header & Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="mb-6 flex justify-center w-full px-2">
                <Image
                  src="/sharknits_logo.png"
                  alt="Sharknits"
                  width={727}
                  height={528}
                  className="w-auto h-16 object-contain"
                  priority
                />
              </div>

              <h2 className="text-[26px] font-black text-[#16233B] tracking-tight mb-1">Welcome Back</h2>
              <p className="text-slate-500 text-[13.5px] font-medium">Sign in to your account to continue</p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-600 text-[13px] font-semibold rounded-xl p-3 mb-6">
                <ShieldCheck size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-[14px] text-slate-900 focus:outline-none focus:border-[#0044E6] focus:ring-1 focus:ring-[#0044E6]/20 transition-all placeholder:text-slate-400 shadow-sm"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
                  <Link href="/forgot-password" className="text-[11.5px] font-bold text-[#0044E6] hover:text-[#0036B8] transition-colors">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-11 text-[14px] text-slate-900 focus:outline-none focus:border-[#0044E6] focus:ring-1 focus:ring-[#0044E6]/20 transition-all placeholder:text-slate-400 shadow-sm"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0044E6] transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <label className="flex items-center gap-2.5 mt-1 cursor-pointer w-fit group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-[15px] h-[15px] rounded border-slate-300 text-[#0044E6] focus:ring-[#0044E6]/20"
                />
                <span className="text-[13px] text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Remember me</span>
              </label>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-3 bg-gradient-to-r from-[#0044E6] to-[#0036B8] text-white font-bold text-[14.5px] py-3.5 rounded-xl shadow-[0_6px_20px_rgba(0,68,230,0.25)] hover:shadow-[0_8px_25px_rgba(0,68,230,0.35)] hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Signing in..." : (
                  <>
                    Sign In
                    <ArrowRight size={17} strokeWidth={2.5} />
                  </>
                )}
              </button>

            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 mt-6">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Or continue with</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            {/* Google Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full mt-5 bg-white border border-slate-200 text-slate-700 font-bold text-[13.5px] py-3 rounded-xl shadow-sm hover:bg-slate-50 transition-all flex justify-center items-center gap-2.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z" />
                <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067C3.196 21.303 7.265 24 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z" />
                <path fill="#4A90D9" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z" />
                <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z" />
              </svg>
              Google
            </button>

            {/* Create Account Link */}
            <p className="text-center mt-6 text-[13px] text-slate-500 font-medium">
              New to the system? <Link href="/signup" className="text-[#0044E6] font-bold hover:text-[#0036B8] transition-colors">Create an account</Link>
            </p>

          </div>

          {/* Bottom Right Footer Outside Card */}
          <div className="absolute bottom-6 right-8 flex items-center gap-2 text-slate-500 text-[11px] font-bold tracking-wide">
            <Lock size={12} className="text-slate-400" />
            <span>Enterprise Secure</span>
            <span className="text-slate-300">•</span>
            <span>v2.4.1</span>
          </div>

        </div>

      </div>

    </main>
  );
}
