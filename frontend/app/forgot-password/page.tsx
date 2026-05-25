"use client";

import Link from "next/link";
import { useState } from "react";
import { authService } from "@/services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setResetUrl(null);
    setLoading(true);
    try {
      const data = await authService.forgotPassword(email.trim());
      setMessage("If this email exists, the reset link is ready.");
      setResetUrl(data.reset_url);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Unable to prepare reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/75 p-8 shadow-2xl">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="mt-1 text-sm text-slate-400">Enter your email to create a reset link</p>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {message && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Email</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <button disabled={loading} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">
            {loading ? "Preparing..." : "Prepare Reset Link"}
          </button>
        </form>

        {resetUrl && (
          <a href={resetUrl} className="mt-4 block rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-center text-sm font-semibold text-indigo-200 hover:bg-indigo-500/20">
            Open reset link
          </a>
        )}

        <p className="mt-6 text-center text-sm text-slate-400">
          Remembered it? <Link className="font-semibold text-indigo-300 hover:text-indigo-200" href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
