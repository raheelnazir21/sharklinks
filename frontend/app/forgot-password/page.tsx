"use client";

import Link from "next/link";
import { useState } from "react";
import { authService } from "@/services/authService";
import { Mail, Send, CheckCircle2 } from "lucide-react";

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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/75 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
            <Mail className="h-6 w-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Forgot Password?</h1>
          <p className="mt-1 text-sm text-slate-400">
            Submit a request and your admin will send you a reset link
          </p>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
            <p className="font-semibold text-emerald-300">Request Submitted!</p>
            <p className="mt-1.5 text-sm text-emerald-400/80">
              Your reset request has been sent to the admin. They will review and
              share a reset link with you shortly.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Please contact your administrator directly if this is urgent.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">
                  Your Email Address
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </label>

              <button
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {loading ? "Submitting..." : "Submit Reset Request"}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-400">
          Remembered it?{" "}
          <Link className="font-semibold text-indigo-300 hover:text-indigo-200" href="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
