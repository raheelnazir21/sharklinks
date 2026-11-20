"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { User, Shield, Key, LogOut, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import api from "@/services/api";

type Tab = "profile" | "security";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setPwError("New password must be different from your current password.");
      return;
    }

    setPwLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwSuccess("Password changed successfully! You may need to sign in again on other devices.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to change password. Please try again."
      );
    } finally {
      setPwLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { id: "security", label: "Security", icon: <Key className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-4xl space-y-6 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Sidebar */}
        <div className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                activeTab === tab.id
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:bg-slate-800 rounded-xl text-sm font-medium transition-all text-left"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Content */}
        <div className="md:col-span-2 space-y-6">

          {/* ── Profile Tab ─────────────────────────────────────── */}
          {activeTab === "profile" && (
            <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-[#16233B] font-semibold mb-6 flex items-center gap-2">
                <User className="w-4 h-4 text-[#0044E6]" /> Account Profile
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1.5 ml-1">
                      Full Name
                    </label>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-[#16233B] text-sm font-medium">
                      {user?.full_name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1.5 ml-1">
                      Email Address
                    </label>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-[#16233B] text-sm font-medium">
                      {user?.email}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1.5 ml-1">
                    Current Role
                  </label>
                  <div className="bg-[#EBF0FF] border border-[#C7D6FF] rounded-lg px-4 py-2.5 text-[#0044E6] text-sm font-semibold capitalize inline-flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" />
                    {user?.role?.replace(/_/g, " ")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Security Tab ─────────────────────────────────────── */}
          {activeTab === "security" && (
            <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-[#16233B] font-semibold mb-1 flex items-center gap-2">
                <Key className="w-4 h-4 text-[#0044E6]" /> Change Password
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                Use this if you know your current password. If you forgot it, use the{" "}
                <a href="/forgot-password" className="text-[#0044E6] hover:underline font-semibold">
                  Forgot Password
                </a>{" "}
                page instead.
              </p>

              {pwSuccess && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <p className="text-sm text-emerald-300">{pwSuccess}</p>
                </div>
              )}
              {pwError && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{pwError}</p>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-slate-400 text-xs uppercase font-bold tracking-wider mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      required
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => { setCurrentPassword(e.target.value); setPwError(""); setPwSuccess(""); }}
                      placeholder="Your current password"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-slate-400 text-xs uppercase font-bold tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      required
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPwError(""); setPwSuccess(""); }}
                      placeholder="Min. 6 characters"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-slate-400 text-xs uppercase font-bold tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      required
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPwError(""); setPwSuccess(""); }}
                      placeholder="Re-enter new password"
                      className={`w-full rounded-lg border px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 bg-slate-900/50 ${
                        confirmPassword && newPassword !== confirmPassword
                          ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20"
                          : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  <Key className="w-4 h-4" />
                  {pwLoading ? "Updating…" : "Update Password"}
                </button>
              </form>
            </div>
          )}

          {/* Danger Zone — always visible */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-red-500/20 rounded-2xl p-6">
            <h3 className="text-[#16233B] font-semibold mb-2">Danger Zone</h3>
            <p className="text-slate-500 text-sm mb-4">Sign out of your account on this device.</p>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl text-sm font-bold transition-all"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
