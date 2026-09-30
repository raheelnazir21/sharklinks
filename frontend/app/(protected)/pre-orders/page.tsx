"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import Modal from "@/components/ui/Modal";
import { ConfirmDialog, FeedbackDialog } from "@/components/ui/ActionDialogs";
import {
  EmptyState,
  Field,
  PageToolbar,
  PrimaryButton,
  SearchInput,
  SkeletonGrid,
  StatusBadge,
  formControlClass,
} from "@/components/ui/PagePrimitives";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Hash,
  Layers,
  Link2,
  Loader2,
  Package,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  User,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PreOrder = {
  id: string;
  class_name: string;
  category: "bulk" | "sampling";
  style_name?: string;
  customer?: string;
  reference_po?: string;
  quantity?: number;
  total_product_count: number;
  processed_product_count: number;
  ex_factory_date?: string;
  priority: "low" | "normal" | "high" | "urgent";
  notes?: string;
  vendor_id?: string;
  vendor_name?: string;
  assigned_manager_id?: string;
  assigned_manager_name?: string;
  assigned_manager_email?: string;
  assigned_by_id?: string;
  assigned_by_name?: string;
  assigned_at?: string;
  linked_class_id?: string;
  linked_order_id?: string;
  linked_at?: string;
  status: "pending" | "partial" | "processed" | "overdue" | "ignored";
  ignore_reason?: string;
  hours_elapsed?: number;
  days_elapsed?: number;
  assignment_email_sent_at?: string;
  first_reminder_sent_at?: string;
  second_reminder_sent_at?: string;
  escalation_sent_at?: string;
  created_at: string;
  updated_at?: string;
};

type Stats = {
  total: number;
  pending: number;
  partial: number;
  processed: number;
  overdue: number;
  ignored: number;
};

type ApiError = {
  response?: { data?: { detail?: string; message?: string } };
};

function getApiError(err: unknown, fallback: string) {
  const e = err as ApiError;
  return e.response?.data?.detail || e.response?.data?.message || fallback;
}

// ─── Tone maps ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; tone: "info" | "success" | "warning" | "danger" | "neutral"; icon: React.ReactNode }> = {
  pending:   { label: "Pending",   tone: "info",    icon: <Clock className="h-3 w-3" /> },
  partial:   { label: "Partial",   tone: "warning", icon: <Layers className="h-3 w-3" /> },
  overdue:   { label: "Overdue",   tone: "danger",  icon: <AlertTriangle className="h-3 w-3" /> },
  processed: { label: "Processed", tone: "success", icon: <CheckCircle2 className="h-3 w-3" /> },
  ignored:   { label: "Ignored",   tone: "neutral", icon: <XCircle className="h-3 w-3" /> },
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-slate-100 text-slate-600",
  normal: "bg-blue-50 text-blue-700",
  high:   "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PreOrdersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const canCreate = isAdmin;

  const [preOrders, setPreOrders]     = useState<PreOrder[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [vendors, setVendors]         = useState<any[]>([]);
  const [managers, setManagers]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Modal states
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [linkTarget, setLinkTarget]       = useState<PreOrder | null>(null);
  const [linkOrderId, setLinkOrderId]     = useState("");
  const [linkProductsCount, setLinkProductsCount] = useState("1");
  const [isLinking, setIsLinking]         = useState(false);
  const [ignoreTarget, setIgnoreTarget]   = useState<PreOrder | null>(null);
  const [ignoreReason, setIgnoreReason]   = useState("");
  const [isIgnoring, setIsIgnoring]       = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<PreOrder | null>(null);
  const [viewTarget, setViewTarget]       = useState<PreOrder | null>(null);
  const [autoMatchedNote, setAutoMatchedNote] = useState<string>("");
  const [feedback, setFeedback]           = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  // "Initialize / Create Collection Class" states
  const [classModalTarget, setClassModalTarget] = useState<PreOrder | null>(null);
  const [isInitializingClass, setIsInitializingClass] = useState(false);
  const [classForm, setClassForm] = useState({
    class_name: "",
    customer: "",
    serial_number: "",
    vendor_id: "",
    remarks: "",
  });

  const [form, setForm] = useState({
    class_name: "",
    category: "bulk",
    style_name: "",
    customer: "",
    reference_po: "",
    total_product_count: "1", // Required expected product count
    quantity: "",             // Pieces quantity
    priority: "normal",
    notes: "",
    vendor_id: "",
    assigned_manager_id: "",
  });

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch pre-orders
      try {
        const preRes = await api.get("/pre-orders/");
        setPreOrders(preRes.data?.data || []);
      } catch (e) {
        console.warn("Could not load pre-orders:", e);
      }

      // 2. Fetch stats
      try {
        const statsRes = await api.get("/pre-orders/stats/summary");
        setStats(statsRes.data?.data || null);
      } catch (e) {
        console.warn("Could not load pre-order stats:", e);
      }

      // 3. Fetch vendors
      try {
        const vendorRes = await api.get("/vendors/");
        setVendors(vendorRes.data?.data || []);
      } catch (e) {
        console.warn("Could not load vendors:", e);
      }

      // 4. Fetch users for manager list
      try {
        const userRes = await api.get("/users/");
        setManagers(userRes.data?.data || []);
      } catch (e) {
        console.warn("Could not load users:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, user?.id]);

  // Open creation modal with guaranteed users and vendors
  const handleOpenCreate = async () => {
    resetForm();
    setAutoMatchedNote("");
    setIsModalOpen(true);

    if (managers.length === 0) {
      try {
        const res = await api.get("/users/");
        setManagers(res.data?.data || []);
      } catch (e) {
        console.warn("Failed to refresh users on open:", e);
      }
    }
    if (vendors.length === 0) {
      try {
        const res = await api.get("/vendors/");
        setVendors(res.data?.data || []);
      } catch (e) {
        console.warn("Failed to refresh vendors on open:", e);
      }
    }
  };

  // ─── Manager change with company auto-selection ────────────────────────────

  const handleManagerChange = (selectedUserId: string) => {
    const selectedUser = managers.find((m: any) => String(m.id) === String(selectedUserId));

    // Match vendor by assigned_manager_id or by manager name
    const matchedVendor = vendors.find((v: any) => {
      if (v.assigned_manager_id && String(v.assigned_manager_id).toLowerCase() === String(selectedUserId).toLowerCase()) {
        return true;
      }
      if (selectedUser?.full_name && v.assigned_manager_name) {
        return v.assigned_manager_name.trim().toLowerCase() === selectedUser.full_name.trim().toLowerCase();
      }
      return false;
    });

    if (matchedVendor) {
      setAutoMatchedNote(`Auto-selected company: "${matchedVendor.name}" linked to ${selectedUser?.full_name || "this user"}`);
      setForm((prev) => ({
        ...prev,
        assigned_manager_id: selectedUserId,
        vendor_id: matchedVendor.id,
      }));
    } else {
      setAutoMatchedNote("");
      setForm((prev) => ({
        ...prev,
        assigned_manager_id: selectedUserId,
      }));
    }
  };

  // ─── Initialize Collection Class ───────────────────────────────────────────
  const handleOpenInitClass = (req: PreOrder) => {
    // Auto-match vendor if not set on pre-order
    let vendorId = req.vendor_id || "";
    if (!vendorId && vendors.length > 0) {
      const matchedVendor = vendors.find(
        (v: any) =>
          (v.assigned_manager_id && String(v.assigned_manager_id).toLowerCase() === String(req.assigned_manager_id).toLowerCase()) ||
          (req.assigned_manager_name && v.assigned_manager_name && v.assigned_manager_name.toLowerCase().trim() === req.assigned_manager_name.toLowerCase().trim())
      );
      if (matchedVendor) vendorId = matchedVendor.id;
    }

    setClassForm({
      class_name: req.class_name || "",
      customer: req.customer || "",
      serial_number: req.reference_po || "",
      vendor_id: vendorId,
      remarks: req.notes || "",
    });
    setClassModalTarget(req);
  };

  const handleInitClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classModalTarget) return;

    if (!classForm.class_name.trim()) {
      setFeedback({
        type: "error",
        title: "Class Name Required",
        message: "Please enter a collection / class name.",
      });
      return;
    }

    setIsInitializingClass(true);
    try {
      const res = await api.post(`/pre-orders/${classModalTarget.id}/initialize-class`, {
        class_name: classForm.class_name.trim(),
        customer: classForm.customer.trim() || undefined,
        serial_number: classForm.serial_number.trim() || undefined,
        vendor_id: classForm.vendor_id || undefined,
        remarks: classForm.remarks.trim() || undefined,
      });

      const data = res.data?.data;
      setClassModalTarget(null);

      // Instantly navigate the manager to the standard Orders workspace for this class
      if (data?.redirect_url) {
        router.push(data.redirect_url);
      } else {
        await fetchData();
        setFeedback({
          type: "success",
          title: "Class Initialized",
          message: `Collection class "${data?.class_name || classForm.class_name}" has been created. You can now add products.`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Failed to Initialize Class",
        message: getApiError(err, "Could not initialize collection class."),
      });
    } finally {
      setIsInitializingClass(false);
    }
  };

  // ─── Submit new pre-order ────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post("/pre-orders/", {
        ...form,
        total_product_count: form.total_product_count ? Math.max(1, parseInt(form.total_product_count)) : 1,
        quantity: form.quantity ? parseInt(form.quantity) : undefined,
        vendor_id: form.vendor_id || undefined,
      });
      setIsModalOpen(false);
      resetForm();
      await fetchData();
      setFeedback({
        type: "success",
        title: "Order Assigned",
        message: "Pre-order created successfully. The assigned manager has been notified via email.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Failed to Create",
        message: getApiError(err, "Failed to create pre-order request."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      class_name: "",
      category: "bulk",
      style_name: "",
      customer: "",
      reference_po: "",
      total_product_count: "1",
      quantity: "",
      priority: "normal",
      notes: "",
      vendor_id: "",
      assigned_manager_id: "",
    });
    setAutoMatchedNote("");
  };

  // ─── Link to order ───────────────────────────────────────────────────────────

  const handleLink = async () => {
    if (!linkTarget || !linkOrderId.trim()) return;
    setIsLinking(true);
    try {
      await api.post(`/pre-orders/${linkTarget.id}/link-order`, {
        order_id: linkOrderId.trim(),
        products_count: linkProductsCount ? parseInt(linkProductsCount) : 1,
      });
      setLinkTarget(null);
      setLinkOrderId("");
      setLinkProductsCount("1");
      await fetchData();
      setFeedback({
        type: "success",
        title: "Linked Successfully",
        message: "Pre-order updated and linked to the specified order.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Link Failed",
        message: getApiError(err, "Could not link order."),
      });
    } finally {
      setIsLinking(false);
    }
  };

  // ─── Ignore ──────────────────────────────────────────────────────────────────

  const handleIgnore = async () => {
    if (!ignoreTarget) return;
    setIsIgnoring(true);
    try {
      await api.post(`/pre-orders/${ignoreTarget.id}/ignore`, { reason: ignoreReason });
      setIgnoreTarget(null);
      setIgnoreReason("");
      await fetchData();
      setFeedback({
        type: "success",
        title: "Marked as Ignored",
        message: "This pre-order request has been archived/ignored.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Failed",
        message: getApiError(err, "Could not ignore pre-order."),
      });
    } finally {
      setIsIgnoring(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/pre-orders/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchData();
      setFeedback({ type: "success", title: "Deleted", message: "Pre-order request deleted." });
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Failed",
        message: getApiError(err, "Could not delete pre-order."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Filtered list ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = preOrders;
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.class_name?.toLowerCase().includes(q) ||
          r.style_name?.toLowerCase().includes(q) ||
          r.customer?.toLowerCase().includes(q) ||
          r.reference_po?.toLowerCase().includes(q) ||
          r.assigned_manager_name?.toLowerCase().includes(q) ||
          r.vendor_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [preOrders, filterStatus, searchTerm]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12">
      {/* Non-Admin Access Notice */}
      {!isAdmin && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-xs text-blue-800 shadow-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-blue-600" />
            <span>
              <strong>Personal Order Access:</strong> You are viewing orders assigned directly to you. Click <strong>"Proceed to Order"</strong> on an order to launch it into production. If you add fewer than the total product count, the order is flagged as <strong>Partial</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <PageToolbar>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <SearchInput
            icon={<Search className="h-4 w-4" />}
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by class name, style, customer, manager..."
          />
          <select
            className={`${formControlClass} w-44`}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
            <option value="processed">Processed</option>
            <option value="ignored">Ignored</option>
          </select>
          {canCreate ? (
            <PrimaryButton onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" /> New Order Request
            </PrimaryButton>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <Eye className="h-3.5 w-3.5 text-blue-500" /> Assigned Orders Mode
            </div>
          )}
        </div>
      </PageToolbar>

      {/* Stat cards */}
      {stats && (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <StatCard label="Total" value={stats.total} color="text-slate-900" />
          <StatCard label="Pending" value={stats.pending} color="text-sky-600" />
          <StatCard label="Partial" value={stats.partial ?? 0} color="text-amber-600" />
          <StatCard label="Overdue" value={stats.overdue} color="text-red-600" />
          <StatCard label="Processed" value={stats.processed} color="text-emerald-600" />
          <StatCard label="Ignored" value={stats.ignored} color="text-slate-400" />
        </section>
      )}

      {/* Table */}
      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="No pre-order requests found"
          message={
            filterStatus !== "all"
              ? "Try clearing the filter."
              : isAdmin
              ? "Create a new order request to get started."
              : "No orders have been assigned to you yet."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Class / Style", "Category", "Products", "Qty (pcs)", "Assigned To", "Assigned By", "Elapsed", "Priority", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((req) => {
                const meta = STATUS_META[req.status] || STATUS_META.pending;
                const isOverdue = req.status === "overdue";
                const isActionable = req.status === "pending" || req.status === "partial" || req.status === "overdue";
                const isAssignedToCurrentUser = String(req.assigned_manager_id) === String(user?.id);
                const canProceed = isActionable && (isAdmin || isAssignedToCurrentUser);
                const totalProducts = req.total_product_count || 1;
                const processedProducts = req.processed_product_count || 0;
                const remainingProducts = Math.max(0, totalProducts - processedProducts);

                return (
                  <tr key={req.id} className={`transition hover:bg-slate-50 ${isOverdue ? "bg-red-50/40" : req.status === "partial" ? "bg-amber-50/20" : ""}`}>
                    {/* Class / Style */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-900">{req.class_name}</p>
                        {req.linked_class_id && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                            Class Ready
                          </span>
                        )}
                      </div>
                      {req.style_name && <p className="text-xs text-slate-500">{req.style_name}</p>}
                      {req.reference_po && <p className="text-[10px] font-mono text-slate-400">PO: {req.reference_po}</p>}
                      {req.customer && <p className="text-xs text-slate-400">{req.customer}</p>}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          req.category === "bulk" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {req.category}
                      </span>
                    </td>

                    {/* Products Count & Progress */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-xs font-bold ${
                            processedProducts >= totalProducts
                              ? "text-emerald-700"
                              : processedProducts > 0
                              ? "text-amber-700"
                              : "text-slate-600"
                          }`}
                        >
                          <Layers className="h-3 w-3" />
                          {processedProducts} / {totalProducts} products
                        </span>
                        <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              processedProducts >= totalProducts ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                            style={{
                              width: `${Math.min(100, Math.round((processedProducts / totalProducts) * 100))}%`,
                            }}
                          />
                        </div>
                        {remainingProducts > 0 && processedProducts > 0 && (
                          <span className="text-[10px] text-amber-600 font-semibold">{remainingProducts} left</span>
                        )}
                      </div>
                    </td>

                    {/* Qty (pcs) */}
                    <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                      {req.quantity ? req.quantity.toLocaleString() : "—"}
                    </td>

                    {/* Assigned To */}
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <User className="h-3.5 w-3.5 text-blue-500" />
                        {req.assigned_manager_name || "—"}
                      </span>
                      {req.vendor_name && (
                        <p className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Building2 className="h-2.5 w-2.5 text-slate-400" />
                          {req.vendor_name}
                        </p>
                      )}
                    </td>

                    {/* Assigned By */}
                    <td className="px-4 py-3 text-xs text-slate-500">{req.assigned_by_name || "—"}</td>

                    {/* Elapsed */}
                    <td className="px-4 py-3">
                      {req.days_elapsed != null && (
                        <span
                          className={`text-xs font-bold ${
                            (req.days_elapsed ?? 0) >= 2
                              ? "text-red-600"
                              : (req.days_elapsed ?? 0) >= 1
                              ? "text-amber-600"
                              : "text-slate-500"
                          }`}
                        >
                          {req.days_elapsed < 1 ? `${req.hours_elapsed?.toFixed(0)}h` : `${req.days_elapsed.toFixed(1)}d`}
                        </span>
                      )}
                      {/* Reminder flags */}
                      <div className="mt-1 flex gap-1">
                        {req.first_reminder_sent_at && <span title="1st reminder sent" className="h-2 w-2 rounded-full bg-amber-400" />}
                        {req.second_reminder_sent_at && <span title="2nd reminder sent" className="h-2 w-2 rounded-full bg-orange-500" />}
                        {req.escalation_sent_at && <span title="Escalation sent" className="h-2 w-2 rounded-full bg-red-600" />}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${PRIORITY_COLOR[req.priority] || ""}`}>
                        {req.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge tone={meta.tone}>
                        <span className="flex items-center gap-1">
                          {meta.icon}
                          {req.status === "partial"
                            ? `Partial (${processedProducts}/${totalProducts})`
                            : req.status === "processed"
                            ? `Processed (${totalProducts}/${totalProducts})`
                            : meta.label}
                        </span>
                      </StatusBadge>
                      {req.linked_order_id && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-semibold" title={req.linked_order_id}>
                          <Link2 className="h-2.5 w-2.5" /> {req.linked_order_id.length > 22 ? `${req.linked_order_id.slice(0, 20)}...` : req.linked_order_id}
                        </p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 1. Initialize Class Button (if class not yet created) */}
                        {canProceed && !req.linked_class_id && (
                          <button
                            onClick={() => handleOpenInitClass(req)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
                            title="Initialize collection class and proceed to add orders"
                          >
                            <Layers className="h-3.5 w-3.5" /> Initialize Class
                          </button>
                        )}

                        {/* 2. Add / View Orders Button (if class is already created) */}
                        {req.linked_class_id && (
                          <button
                            onClick={() => {
                              const trackParam = req.category === "bulk" ? "bulk" : "sampling";
                              const classParam = req.category === "bulk" ? "bulk_class_id" : "sample_class_id";
                              router.push(`/orders?track=${trackParam}&${classParam}=${req.linked_class_id}`);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black shadow-sm transition-all active:scale-95 ${
                              processedProducts >= totalProducts
                                ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                            title={
                              processedProducts >= totalProducts
                                ? "All products added! Click to view orders"
                                : `Click to manually add orders with staging in this class (${processedProducts}/${totalProducts} added)`
                            }
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {processedProducts >= totalProducts
                              ? `View Orders (${processedProducts}/${totalProducts})`
                              : `Add Orders (${processedProducts}/${totalProducts})`}
                          </button>
                        )}

                        {/* 2. View Details Button */}
                        <button
                          onClick={() => setViewTarget(req)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                          title="Visit and view complete order details"
                        >
                          <Eye className="h-3 w-3 text-slate-500" /> View
                        </button>

                        {/* 3. Admin-only Link Order */}
                        {isAdmin && isActionable && (
                          <button
                            onClick={() => {
                              setLinkTarget(req);
                              setLinkOrderId("");
                              setLinkProductsCount(String(remainingProducts > 0 ? 1 : 1));
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                            title="Link to an existing order in the system"
                          >
                            <Link2 className="h-3 w-3" /> Link
                          </button>
                        )}

                        {/* 4. Admin-only Ignore */}
                        {isAdmin && isActionable && (
                          <button
                            onClick={() => {
                              setIgnoreTarget(req);
                              setIgnoreReason("");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                            title="Mark as ignored (not a real order)"
                          >
                            <XCircle className="h-3 w-3" /> Ignore
                          </button>
                        )}

                        {/* 5. Admin-only Delete */}
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteTarget(req)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Initialize Collection Class Modal ─────────────────────────────── */}
      <Modal
        isOpen={Boolean(classModalTarget)}
        onClose={() => setClassModalTarget(null)}
        title={classModalTarget ? `Initialize Collection Class: ${classModalTarget.class_name}` : "Initialize Class"}
        maxWidth="max-w-xl"
      >
        {classModalTarget && (
          <form onSubmit={handleInitClassSubmit} className="space-y-4 text-sm">
            {/* Header Context */}
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-black uppercase text-blue-800">
                  <Layers className="h-3 w-3" /> {classModalTarget.category === "bulk" ? "Bulk Production Project" : "Sampling Development Class"}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Target Products: <strong className="text-slate-800">{classModalTarget.total_product_count || 1}</strong>
                </span>
              </div>
              <h4 className="mt-2 text-base font-black text-slate-900">
                {classModalTarget.class_name}
              </h4>
              <p className="mt-1 text-xs text-blue-900 leading-relaxed">
                Confirm your collection details below. Once initialized, you will be taken directly to the Order Workspace to manually add each product order with stages, size ratios, and tech packs as you traditionally do.
              </p>
            </div>

            {/* Target Products Tracker Alert */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Fulfillment Target:</span>
                <span className="font-mono font-bold text-slate-900">
                  {classModalTarget.processed_product_count || 0} of {classModalTarget.total_product_count || 1} products added
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round(((classModalTarget.processed_product_count || 0) / (classModalTarget.total_product_count || 1)) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                The system will track orders added under this collection against your assigned target of <strong>{classModalTarget.total_product_count || 1} product(s)</strong>.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Collection / Class Name *">
                <input
                  required
                  placeholder="e.g. Summer Collection 2026"
                  className={formControlClass}
                  value={classForm.class_name}
                  onChange={(e) => setClassForm({ ...classForm, class_name: e.target.value })}
                />
              </Field>
              <Field label="Customer">
                <input
                  placeholder="e.g. Nordic Brands"
                  className={formControlClass}
                  value={classForm.customer}
                  onChange={(e) => setClassForm({ ...classForm, customer: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reference PO / Season Serial">
                <input
                  placeholder="e.g. REF-2026-001"
                  className={formControlClass}
                  value={classForm.serial_number}
                  onChange={(e) => setClassForm({ ...classForm, serial_number: e.target.value })}
                />
              </Field>
              <Field label="Production Vendor / Factory *">
                <select
                  required
                  className={formControlClass}
                  value={classForm.vendor_id}
                  onChange={(e) => setClassForm({ ...classForm, vendor_id: e.target.value })}
                >
                  <option value="">Select factory / vendor...</option>
                  {vendors.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.assigned_manager_name ? `(Manager: ${v.assigned_manager_name})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Collection Remarks & Instructions">
              <textarea
                rows={2}
                placeholder="Instructions transferred with this collection..."
                className={formControlClass}
                value={classForm.remarks}
                onChange={(e) => setClassForm({ ...classForm, remarks: e.target.value })}
              />
            </Field>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClassModalTarget(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={isInitializingClass}>
                {isInitializingClass ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {isInitializingClass ? "Initializing Class..." : "Initialize Class & Go to Add Orders"}
              </PrimaryButton>
            </div>
          </form>
        )}
      </Modal>

      {/* ── New Order Request Modal (Admin only) ─────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Order to Process" maxWidth="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Class / Order Name *">
              <input
                required
                placeholder="e.g. CRPLIM // CRPSNW // FRGRN"
                className={formControlClass}
                value={form.class_name}
                onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              />
            </Field>
            <Field label="Category *">
              <select
                className={formControlClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="bulk">Bulk Production</option>
                <option value="sampling">Sampling Development</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Style Name">
              <input
                placeholder="e.g. Vintage Heavyweight Tee"
                className={formControlClass}
                value={form.style_name}
                onChange={(e) => setForm({ ...form, style_name: e.target.value })}
              />
            </Field>
            <Field label="Reference / PO Number">
              <input
                placeholder="e.g. PO-2026-001"
                className={formControlClass}
                value={form.reference_po}
                onChange={(e) => setForm({ ...form, reference_po: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Customer">
              <input
                placeholder="e.g. Cotton Collective"
                className={formControlClass}
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
              />
            </Field>
            <Field label="Total Product Count *">
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 13"
                className={formControlClass}
                value={form.total_product_count}
                onChange={(e) => setForm({ ...form, total_product_count: e.target.value })}
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Number of products/orders expected. If manager adds less than this, it will be marked as <strong>Partial</strong>.
              </p>
            </Field>
            <Field label="Quantity (pcs)">
              <input
                type="number"
                min="1"
                placeholder="e.g. 500"
                className={formControlClass}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Total garment pieces.
              </p>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assign To *">
              <select
                required
                className={formControlClass}
                value={form.assigned_manager_id}
                onChange={(e) => handleManagerChange(e.target.value)}
              >
                <option value="">Select person to assign...</option>
                {managers.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.email} ({String(m.role || "user").replace("_", " ")})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                className={formControlClass}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>

          {/* Auto-selected Company Notice */}
          {autoMatchedNote && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{autoMatchedNote}</span>
            </div>
          )}

          <Field
            label={`Vendor / Company${
              vendors.find((v: any) => v.id === form.vendor_id)
                ? ` (Selected: ${vendors.find((v: any) => v.id === form.vendor_id)?.name})`
                : " (Auto-selected from assignee or choose manually)"
            }`}
          >
            <select
              className={formControlClass}
              value={form.vendor_id}
              onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
            >
              <option value="">Select vendor / company (optional)</option>
              {vendors.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.assigned_manager_name ? `(Managed by: ${v.assigned_manager_name})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes / Instructions">
            <textarea
              rows={3}
              placeholder="Any specific instructions for the assigned person..."
              className={formControlClass}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {/* Alert banner */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              An <strong>instant email</strong> will be sent to the assigned person. The manager must enter all <strong>{form.total_product_count || 1} products</strong>. Adding fewer will flag the request as <strong>Partial</strong>.
            </p>
          </div>

          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isSubmitting ? "Submitting..." : "Assign Order & Notify Manager"}
          </PrimaryButton>
        </form>
      </Modal>

      {/* ── View Order Details Modal (All users / Managers) ──────────────────── */}
      <Modal isOpen={Boolean(viewTarget)} onClose={() => setViewTarget(null)} title="Order Request Details">
        {viewTarget && (
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">{viewTarget.class_name}</h3>
                  {viewTarget.style_name && <p className="text-xs text-slate-600 mt-0.5">Style: {viewTarget.style_name}</p>}
                </div>
                <StatusBadge tone={(STATUS_META[viewTarget.status] || STATUS_META.pending).tone}>
                  {viewTarget.status === "partial"
                    ? `Partial (${viewTarget.processed_product_count || 0}/${viewTarget.total_product_count || 1})`
                    : viewTarget.status === "processed"
                    ? `Processed (${viewTarget.total_product_count || 1}/${viewTarget.total_product_count || 1})`
                    : (STATUS_META[viewTarget.status] || STATUS_META.pending).label}
                </StatusBadge>
              </div>

              {/* Product Fulfillment Progress Bar */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Product Count Fulfillment:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {viewTarget.processed_product_count || 0} / {viewTarget.total_product_count || 1} products
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (viewTarget.processed_product_count || 0) >= (viewTarget.total_product_count || 1)
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round(((viewTarget.processed_product_count || 0) / (viewTarget.total_product_count || 1)) * 100))}%`,
                    }}
                  />
                </div>
                {(viewTarget.total_product_count || 1) - (viewTarget.processed_product_count || 0) > 0 ? (
                  <p className="text-[11px] text-amber-700 font-semibold">
                    {Math.max(0, (viewTarget.total_product_count || 1) - (viewTarget.processed_product_count || 0))} product(s) remaining to reach total product count ({viewTarget.total_product_count}). Status is Partial.
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    ✓ All {viewTarget.total_product_count} products have been fulfilled and live in production!
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">Category</p>
                  <p className="font-bold text-slate-800 mt-0.5 capitalize">{viewTarget.category}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">Garment Quantity</p>
                  <p className="font-bold text-slate-800 mt-0.5 font-mono">{viewTarget.quantity ? `${viewTarget.quantity.toLocaleString()} pcs` : "—"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">Priority</p>
                  <p className="font-bold text-slate-800 mt-0.5 uppercase">{viewTarget.priority}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">Customer</p>
                  <p className="font-bold text-slate-800 mt-0.5">{viewTarget.customer || "—"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">PO Reference</p>
                  <p className="font-bold text-slate-800 mt-0.5 font-mono">{viewTarget.reference_po || "—"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">Company / Vendor</p>
                  <p className="font-bold text-slate-800 mt-0.5">{viewTarget.vendor_name || "—"}</p>
                </div>
              </div>
            </div>

            {/* Assignment & Timeline */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1.5">
              <p className="text-slate-500">
                <strong>Assigned To:</strong> {viewTarget.assigned_manager_name || "—"} ({viewTarget.assigned_manager_email || "No email"})
              </p>
              <p className="text-slate-500">
                <strong>Assigned By:</strong> {viewTarget.assigned_by_name || "Admin"}
              </p>
              {viewTarget.created_at && (
                <p className="text-slate-500">
                  <strong>Date Assigned:</strong> {new Date(viewTarget.created_at).toLocaleString()}
                </p>
              )}
              {viewTarget.linked_order_id && (
                <p className="text-emerald-700 font-semibold">
                  <strong>Linked Order PO(s):</strong> {viewTarget.linked_order_id}
                </p>
              )}
            </div>

            {/* Notes / Instructions */}
            {viewTarget.notes && (
              <div className="rounded-xl border border-slate-200 bg-amber-50/50 p-3">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Instructions / Notes:</p>
                <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">{viewTarget.notes}</p>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              <div>
                {(viewTarget.status === "pending" || viewTarget.status === "partial" || viewTarget.status === "overdue") &&
                  (isAdmin || String(viewTarget.assigned_manager_id) === String(user?.id)) && (
                    viewTarget.linked_class_id ? (
                      <button
                        onClick={() => {
                          const target = viewTarget;
                          setViewTarget(null);
                          const trackParam = target.category === "bulk" ? "bulk" : "sampling";
                          const classParam = target.category === "bulk" ? "bulk_class_id" : "sample_class_id";
                          router.push(`/orders?track=${trackParam}&${classParam}=${target.linked_class_id}`);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow hover:bg-blue-700 transition-all active:scale-95"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {`Add / View Orders (${viewTarget.processed_product_count || 0}/${viewTarget.total_product_count || 1})`}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const target = viewTarget;
                          setViewTarget(null);
                          handleOpenInitClass(target);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow hover:bg-emerald-700 transition-all active:scale-95"
                      >
                        <Layers className="h-4 w-4" />
                        Initialize Class
                      </button>
                    )
                  )}
              </div>
              <button
                onClick={() => setViewTarget(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Link Order Modal (Admin only) ────────────────────────────────────── */}
      <Modal isOpen={Boolean(linkTarget)} onClose={() => setLinkTarget(null)} title="Link to Existing Order">
        {linkTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-bold text-slate-900">{linkTarget.class_name}</p>
              <p className="text-slate-500">
                {linkTarget.category} · {linkTarget.customer || "No customer"} · {linkTarget.processed_product_count || 0}/{linkTarget.total_product_count || 1} products fulfilled
              </p>
            </div>
            <Field label="Enter Order ID or PO Number *">
              <input
                placeholder="Paste the Order ID from the system..."
                className={formControlClass}
                value={linkOrderId}
                onChange={(e) => setLinkOrderId(e.target.value)}
              />
            </Field>
            <Field label="Products Count to Account for in this Link *">
              <input
                type="number"
                min="1"
                max={Math.max(1, (linkTarget.total_product_count || 1) - (linkTarget.processed_product_count || 0))}
                className={formControlClass}
                value={linkProductsCount}
                onChange={(e) => setLinkProductsCount(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                If the total added is less than {linkTarget.total_product_count}, status will be marked as Partial.
              </p>
            </Field>
            <p className="text-xs text-slate-500">
              Go to the Orders page, copy the Order ID from the URL or order detail, and paste it above.
            </p>
            <PrimaryButton onClick={handleLink} disabled={isLinking || !linkOrderId.trim()}>
              {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {isLinking ? "Linking..." : "Link Order"}
            </PrimaryButton>
          </div>
        )}
      </Modal>

      {/* ── Ignore Modal (Admin only) ────────────────────────────────────────── */}
      <Modal isOpen={Boolean(ignoreTarget)} onClose={() => setIgnoreTarget(null)} title="Mark as Ignored">
        {ignoreTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to mark <strong>{ignoreTarget.class_name}</strong> as ignored? This stops all reminders.
            </p>
            <Field label="Reason (optional)">
              <input
                placeholder="e.g. Duplicate request, order cancelled..."
                className={formControlClass}
                value={ignoreReason}
                onChange={(e) => setIgnoreReason(e.target.value)}
              />
            </Field>
            <button
              onClick={handleIgnore}
              disabled={isIgnoring}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isIgnoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {isIgnoring ? "Ignoring..." : "Confirm Ignore"}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Confirm Delete (Admin only) ─────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete pre-order request?"
        message={`This will permanently delete the pre-order for "${deleteTarget?.class_name}". This cannot be undone.`}
        confirmLabel="Yes, Delete"
        loading={isSubmitting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}
