"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authService } from "@/services/authService";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) {
      setError("Reset token is missing.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Password confirmation does not match.");
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setMessage("Password updated. Please sign in with your new password.");
      setPassword("");
      setConfirm("");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/75 p-8 shadow-2xl">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold text-white">Choose New Password</h1>
          <p className="mt-1 text-sm text-slate-400">This reset link expires after 30 minutes</p>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {message && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">New Password</span>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Confirm New Password</span>
            <input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <button disabled={loading} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Back to <Link className="font-semibold text-indigo-300 hover:text-indigo-200" href="/login">sign in</Link>
        </p>
      </section>
    </main>
  );
}
