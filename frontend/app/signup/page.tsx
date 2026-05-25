"use client";

import Link from "next/link";
import { useState } from "react";
import { authService } from "@/services/authService";

export default function SignupPage() {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Password confirmation does not match.");
      return;
    }
    setSaving(true);
    try {
      await authService.signup({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setMessage("Account created. You can sign in now.");
      setForm({ full_name: "", email: "", password: "", confirm: "" });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Unable to create account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/75 p-8 shadow-2xl">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="mt-1 text-sm text-slate-400">Join the Textile QC user panel</p>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {message && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Full Name</span>
            <input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Email</span>
            <input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Password</span>
            <input required type="password" value={form.password} onChange={(e) => update("password", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Confirm Password</span>
            <input required type="password" value={form.confirm} onChange={(e) => update("confirm", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <button disabled={saving} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">
            {saving ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account? <Link className="font-semibold text-indigo-300 hover:text-indigo-200" href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
