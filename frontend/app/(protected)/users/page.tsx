"use client";

import React, { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog, FeedbackDialog } from "@/components/ui/ActionDialogs";
import {
  CheckCircle2,
  Edit3,
  Mail,
  Power,
  Search,
  Shield,
  UserPlus,
  X,
  KeyRound,
  Clock,
  CheckCheck,
  XCircle,
  Copy,
  ExternalLink,
} from "lucide-react";

type Role = "super_admin" | "admin" | "manager" | "qc_officer" | "viewer";

type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at?: string | null;
};

type UserForm = {
  email: string;
  full_name: string;
  password: string;
  confirmPassword: string;
  role: Role;
  is_active: boolean;
};

type ResetRequest = {
  id: string;
  user_id: string;
  user_full_name: string;
  user_email: string;
  status: string;
  requested_at: string;
};

const roles: Role[] = ["super_admin", "admin", "manager", "qc_officer", "viewer"];

const emptyForm: UserForm = {
  email: "",
  full_name: "",
  password: "",
  confirmPassword: "",
  role: "viewer",
  is_active: true,
};

function getApiError(err: any, fallback: string) {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.response?.data?.details ||
    err?.message ||
    fallback
  );
}

function roleLabel(role: Role) {
  return role.replace(/_/g, " ");
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [pendingStatusUser, setPendingStatusUser] = useState<ManagedUser | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  // Password reset requests state
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);
  const [resetLoading, setResetLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [resetLinkModal, setResetLinkModal] = useState<{ url: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/users/");
      setUsers(res.data.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadResetRequests = async () => {
    if (!isAdmin) return;
    setResetLoading(true);
    try {
      const res = await api.get("/users/reset-requests");
      setResetRequests(res.data.data || []);
    } catch {
      // silently fail — non-critical
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadResetRequests();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((item) => {
      const matchesSearch =
        !term ||
        item.full_name.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term);
      const matchesRole = roleFilter === "all" || item.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? item.is_active : !item.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const openEdit = (item: ManagedUser) => {
    setEditing(item);
    setForm({
      email: item.email,
      full_name: item.full_name,
      password: "",
      confirmPassword: "",
      role: item.role,
      is_active: item.is_active,
    });
    setFormError("");
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const updateForm = (field: keyof UserForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError("");
  };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    // Confirm password validation
    if (form.password || form.confirmPassword) {
      if (form.password !== form.confirmPassword) {
        setFormError("Passwords do not match. Please re-enter them.");
        return;
      }
      if (form.password.length < 6) {
        setFormError("Password must be at least 6 characters.");
        return;
      }
    }
    if (!editing && !form.password) {
      setFormError("Password is required for a new user.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const normalizedEmail = form.email.trim().toLowerCase();
      const normalizedName = form.full_name.trim();

      if (!normalizedName) { setFormError("Full name is required."); return; }
      if (!normalizedEmail) { setFormError("Email is required."); return; }

      if (editing) {
        const updatePayload: any = {
          email: normalizedEmail,
          full_name: normalizedName,
          role: form.role,
          is_active: form.is_active,
        };
        if (form.password) updatePayload.password = form.password;
        await api.put(`/users/${editing.id}`, updatePayload);
        setFeedback({ type: "success", title: "Mission Successful", message: "User updated successfully." });
      } else {
        const existingUser = users.find((item) => item.email.toLowerCase() === normalizedEmail);
        if (existingUser) {
          setFormError(`This email already exists for ${existingUser.full_name}. Please edit that user instead.`);
          return;
        }
        await api.post("/users/", {
          email: normalizedEmail,
          full_name: normalizedName,
          password: form.password,
          role: form.role,
          is_active: form.is_active,
        });
        setFeedback({ type: "success", title: "Mission Successful", message: "User created successfully." });
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      setFormError(getApiError(err, "Unable to save user."));
    } finally {
      setSaving(false);
    }
  };

  const confirmToggleStatus = async () => {
    if (!pendingStatusUser) return;
    const item = pendingStatusUser;
    setSaving(true);
    try {
      if (item.is_active) {
        await api.delete(`/users/${item.id}`);
      } else {
        await api.put(`/users/${item.id}`, { is_active: true });
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, is_active: !item.is_active } : u))
      );
      setFeedback({
        type: "success",
        title: "Mission Successful",
        message: item.is_active ? "User deactivated successfully." : "User reactivated successfully.",
      });
      setPendingStatusUser(null);
    } catch (err: any) {
      setFeedback({ type: "error", title: "Operation Failed", message: getApiError(err, "Unable to update user status.") });
    } finally {
      setSaving(false);
    }
  };

  const approveRequest = async (req: ResetRequest) => {
    setApprovingId(req.id);
    try {
      const res = await api.post(`/users/reset-requests/${req.id}/approve`);
      const url: string = res.data.data?.reset_url || "";
      setResetRequests((prev) => prev.filter((r) => r.id !== req.id));
      setResetLinkModal({ url, name: req.user_full_name });
    } catch (err: any) {
      setFeedback({ type: "error", title: "Approval Failed", message: getApiError(err, "Could not approve request.") });
    } finally {
      setApprovingId(null);
    }
  };

  const rejectRequest = async (req: ResetRequest) => {
    setRejectingId(req.id);
    try {
      await api.post(`/users/reset-requests/${req.id}/reject`);
      setResetRequests((prev) => prev.filter((r) => r.id !== req.id));
      setFeedback({ type: "success", title: "Request Rejected", message: `Reset request from ${req.user_full_name} has been rejected.` });
    } catch (err: any) {
      setFeedback({ type: "error", title: "Rejection Failed", message: getApiError(err, "Could not reject request.") });
    } finally {
      setRejectingId(null);
    }
  };

  const copyLink = () => {
    if (resetLinkModal?.url) {
      navigator.clipboard.writeText(resetLinkModal.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div />
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {(error || notice) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || notice}
        </div>
      )}

      {/* ── Password Reset Requests Panel (Admin Only) ─────────────── */}
      {isAdmin && (
        <section className="rounded-2xl border border-amber-200/60 bg-amber-50/60 shadow-sm">
          <div className="flex items-center justify-between border-b border-amber-200/60 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-amber-900">Password Reset Requests</h2>
              {resetRequests.length > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                  {resetRequests.length}
                </span>
              )}
            </div>
            <button
              onClick={loadResetRequests}
              className="text-xs text-amber-600 hover:text-amber-800 font-medium"
            >
              Refresh
            </button>
          </div>

          {resetLoading ? (
            <p className="px-5 py-6 text-center text-sm text-amber-600">Loading requests…</p>
          ) : resetRequests.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-amber-700/60">
              No pending reset requests.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-amber-200/60 bg-amber-100/50 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Requested</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {resetRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-amber-50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-200 text-sm font-bold uppercase text-amber-800">
                            {req.user_full_name?.[0] || "U"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{req.user_full_name}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <Mail className="h-3 w-3" />
                              {req.user_email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          {timeAgo(req.requested_at)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => approveRequest(req)}
                            disabled={approvingId === req.id || !!rejectingId}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            {approvingId === req.id ? "Approving…" : "Approve"}
                          </button>
                          <button
                            onClick={() => rejectRequest(req)}
                            disabled={rejectingId === req.id || !!approvingId}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {rejectingId === req.id ? "Rejecting…" : "Reject"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Users Table ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "all" | Role)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => {
                  const isSelf = item.id === currentUser?.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold uppercase text-indigo-600">
                            {item.full_name?.[0] || "U"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-950">{item.full_name}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                              <Mail className="h-3 w-3" />
                              {item.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700">
                          <Shield className="h-3 w-3" />
                          {roleLabel(item.role)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                            title="Edit user"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setPendingStatusUser(item)}
                            disabled={isSelf}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            title={item.is_active ? "Deactivate user" : "Reactivate user"}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Add / Edit User Modal ──────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={saveUser} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {editing ? "Edit User" : "Add User"}
                </h2>
                <p className="text-sm text-slate-500">
                  {editing ? "Update access and profile details." : "Create a system login."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2">
              {formError && (
                <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {formError}
                </div>
              )}

              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</span>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => updateForm("full_name", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password {editing && <span className="text-slate-400">(leave blank to keep)</span>}
                </span>
                <input
                  type="password"
                  required={!editing}
                  value={form.password}
                  onChange={(e) => updateForm("password", e.target.value)}
                  placeholder={editing ? "New password…" : "Min. 6 characters"}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirm Password
                </span>
                <input
                  type="password"
                  required={!editing}
                  value={form.confirmPassword}
                  onChange={(e) => updateForm("confirmPassword", e.target.value)}
                  placeholder="Re-enter password"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-950 outline-none focus:ring-2 ${
                    form.confirmPassword && form.password !== form.confirmPassword
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
                  }`}
                />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Role</span>
                <select
                  value={form.role}
                  onChange={(e) => updateForm("role", e.target.value as Role)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm capitalize text-slate-950 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 self-end">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateForm("is_active", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Active account
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Reset Link Modal (after admin approves) ────────────────── */}
      {resetLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-950">Reset Link Generated</h2>
              <p className="text-sm text-slate-500">
                Share this link with <span className="font-semibold">{resetLinkModal.name}</span>. It expires in 30 minutes.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="break-all text-sm font-mono text-indigo-700">{resetLinkModal.url}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={copyLink}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <a
                  href={resetLinkModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </div>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => { setResetLinkModal(null); setCopied(false); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingStatusUser)}
        title={pendingStatusUser?.is_active ? "Deactivate user?" : "Reactivate user?"}
        message={
          pendingStatusUser?.is_active
            ? `Are you sure you want to deactivate ${pendingStatusUser.full_name}?`
            : `Are you sure you want to reactivate ${pendingStatusUser?.full_name}?`
        }
        confirmLabel={pendingStatusUser?.is_active ? "Yes, Deactivate" : "Yes, Reactivate"}
        tone={pendingStatusUser?.is_active ? "danger" : "info"}
        loading={saving}
        onCancel={() => setPendingStatusUser(null)}
        onConfirm={confirmToggleStatus}
      />
      <FeedbackDialog
        open={Boolean(feedback)}
        type={feedback?.type}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
