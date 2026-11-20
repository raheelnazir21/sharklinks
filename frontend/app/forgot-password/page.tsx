"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { authService } from "@/services/authService";
import {
  Mail,
  Lock,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Users2,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

const FEATURES = [
  {
    Icon: TrendingUp,
    color: "#14B8A6",
    bg: "#F0FDFA",
    title: "Production Planning & Tracking",
    desc: "Real-time visibility from planning to delivery",
  },
  {
    Icon: ShieldCheck,
    color: "#22C55E",
    bg: "#F0FDF4",
    title: "Quality Management System",
    desc: "Built-in QC, QA and audit at every step",
  },
  {
    Icon: BarChart3,
    color: "#14B8A6",
    bg: "#F0FDFA",
    title: "Analytics & Performance Intelligence",
    desc: "Powerful dashboards and actionable insights",
  },
  {
    Icon: Users2,
    color: "#22C55E",
    bg: "#F0FDF4",
    title: "Team & Workflow Management",
    desc: "Secure roles, approvals and collaboration",
  },
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Unable to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <path fill="#22C55E" fillOpacity="0.75" d="M0,192L48,181.3C96,171,192,149,288,149.3C384,149,480,171,576,192C672,213,768,235,864,224C960,213,1056,171,1152,154.7C1248,139,1344,149,1392,154.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          <path fill="#0D9488" fillOpacity="0.95" d="M0,224L48,229.3C96,235,192,245,288,229.3C384,213,480,171,576,160C672,149,768,171,864,186.7C960,203,1056,213,1152,208C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          <path fill="#0F172A" d="M0,288L48,272C96,256,192,224,288,218.7C384,213,480,235,576,234.7C672,235,768,213,864,186.7C960,160,1056,128,1152,133.3C1248,139,1344,181,1392,202.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
      </div>

      {/* ── Main Layout ── */}
      <div className="relative z-10 flex w-full h-full min-h-screen">
        
        {/* ════════════ LEFT PANEL ════════════ */}
        <div className="w-[55%] flex flex-col justify-between p-10 lg:p-14 2xl:p-20 pt-12 pb-8 min-h-screen">
          
          {/* Logo */}
          <div className="mb-16">
            <Image 
              src="/sharknits_logo.png" 
              alt="Sharknits" 
              width={727} 
              height={528} 
              className="w-auto h-20 max-w-[280px] object-contain object-left" 
              priority 
            />
          </div>

          {/* Hero Content */}
          <div className="flex flex-col justify-center max-w-[880px]">
            <h1 className="text-[30px] lg:text-[38px] xl:text-[44px] font-black text-[#0F172A] leading-[1.1] tracking-tight mb-5">
              Manufacturing Excellence.<br />
              <span className="bg-gradient-to-r from-[#0044E6] to-[#4477FF] bg-clip-text text-transparent pb-2">
                Powered by Intelligence.
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

        {/* ════════════ RIGHT PANEL ════════════ */}
        <div className="w-[45%] flex items-center justify-center p-8 relative min-h-screen">
          
          {/* Reset Card */}
          <div className="w-full max-w-[440px] bg-white rounded-[32px] p-10 shadow-[0_12px_48px_rgba(0,0,0,0.1)] relative">
            
            {/* Card Header & Logo */}
            <div className="flex flex-col items-center mb-6">
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
              
              <h2 className="text-[26px] font-black text-[#0F172A] tracking-tight mb-1">Forgot Password?</h2>
              <p className="text-slate-500 text-[13.5px] font-medium text-center">
                Submit a request and your admin will send you a reset link
              </p>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center justify-center bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 mb-6 text-center shadow-sm">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                <h3 className="font-bold text-emerald-800 text-[16px] mb-1">Request Submitted!</h3>
                <p className="text-[13px] text-emerald-700/80 leading-relaxed mb-4">
                  Your reset request has been sent to the admin. They will review and share a reset link with you shortly.
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Please contact your administrator directly if this is urgent.
                </p>
              </div>
            ) : (
              <>
                {/* Error Banner */}
                {error && (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-600 text-[13px] font-semibold rounded-xl p-3 mb-6">
                    <ShieldCheck size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={submit} className="flex flex-col gap-4">
                  
                  {/* Email Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Your Email Address</label>
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

                  {/* Submit Button */}
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full mt-3 bg-gradient-to-r from-[#0044E6] to-[#0036B8] text-white font-bold text-[14.5px] py-3.5 rounded-xl shadow-[0_6px_20px_rgba(0,68,230,0.25)] hover:shadow-[0_8px_25px_rgba(0,68,230,0.35)] hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? "Submitting..." : (
                      <>
                        Submit Reset Request
                        <ArrowRight size={17} strokeWidth={2.5} />
                      </>
                    )}
                  </button>

                </form>
              </>
            )}

            {/* Login Link */}
            <p className="text-center mt-8 text-[13px] text-slate-500 font-medium">
              Remembered it? <Link href="/login" className="text-[#0044E6] font-bold hover:text-[#0036B8] transition-colors">Sign in</Link>
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
