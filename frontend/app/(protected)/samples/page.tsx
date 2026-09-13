"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { Activity, ArrowRight, Building2, Calendar, Edit3, Filter, Package, Plus, Search, Trash2 } from "lucide-react";

type ApiError = {
  response?: {
    data?: {
      detail?: string;
      message?: string;
      details?: string;
    };
  };
};

function getApiError(err: unknown, fallback: string) {
  const apiError = err as ApiError;
  return (
    apiError.response?.data?.detail ||
    apiError.response?.data?.message ||
    apiError.response?.data?.details ||
    fallback
  );
}

export default function SamplesPage() {
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const isSuperAdmin = user?.role === "super_admin";
  const canManage = !isViewer;
  const [samples, setSamples] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSample, setEditingSample] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [newSample, setNewSample] = useState({
    name: "",
    customer: "",
    serial_number: "",
    vendor_id: "",
    remarks: "",
  });

  const fetchData = async () => {
    try {
      const [samplesRes, vendorsRes] = await Promise.all([
        api.get("/orders/sample-classes"),
        api.get("/vendors/"),
      ]);
      setSamples(samplesRes.data.data || []);
      setVendors(vendorsRes.data.data || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingSample) {
        await api.put(`/orders/sample-classes/${editingSample.id}`, newSample);
      } else {
        await api.post("/orders/sample-classes", newSample);
      }
      setIsModalOpen(false);
      setEditingSample(null);
      setNewSample({ name: "", customer: "", serial_number: "", vendor_id: "", remarks: "" });
      fetchData();
      setFeedback({ type: "success", title: "Mission Successful", message: editingSample ? "Sample class updated successfully." : "Sample class created successfully." });
    } catch (err) {
      setFeedback({ type: "error", title: "Operation Failed", message: "Failed to save sample class." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingSample(null);
    setNewSample({ name: "", customer: "", serial_number: "", vendor_id: "", remarks: "" });
    setIsModalOpen(true);
  };

  const openEdit = (sample: any) => {
    setEditingSample(sample);
    setNewSample({
      name: sample.name || "",
      customer: sample.customer || "",
      serial_number: sample.serial_number || "",
      vendor_id: sample.vendor_id || "",
      remarks: sample.remarks || "",
    });
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/orders/sample-classes/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
      setFeedback({ type: "success", title: "Mission Successful", message: "Sample class deactivated successfully." });
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Operation Failed",
        message: getApiError(err, "Failed to deactivate sample class."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return samples.filter((sample) => {
      const matchesSearch =
        sample.name?.toLowerCase().includes(query) ||
        sample.customer?.toLowerCase().includes(query) ||
        sample.serial_number?.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || sample.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [samples, searchTerm, statusFilter]);

  const statuses = Array.from(new Set(samples.map((sample) => sample.status).filter(Boolean)));

  return (
    <div className="space-y-6 pb-12">
      <PageToolbar>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
          <SearchInput
            icon={<Search className="h-4 w-4" />}
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search sample, customer, serial number..."
          />
          <div className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-600" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">All Status</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          {canManage && (
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" /> New Sample
            </PrimaryButton>
          )}
        </div>
      </PageToolbar>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Sample Classes" value={samples.length} />
        <SummaryCard label="Assigned Vendors" value={samples.filter((sample) => sample.vendor_name).length} />
        <SummaryCard label="Visible Results" value={filtered.length} />
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((sample) => (
            <SampleCard
              key={sample.id}
              sample={sample}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              canEdit={!isViewer && isSuperAdmin}
              canDelete={!isViewer && isSuperAdmin}
            />
          ))}
          {filtered.length === 0 && (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="No sample classes found"
              message="Adjust filters or create a new sample development class."
            />
          )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSample ? "Update Sample Class" : "Create Sample Class"}>
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Serial Number">
              <input
                required
                placeholder="SC-2026-001"
                className={formControlClass}
                value={newSample.serial_number}
                onChange={(event) => setNewSample({ ...newSample, serial_number: event.target.value })}
              />
            </Field>
            <Field label="Customer">
              <input
                required
                placeholder="Nike / Adidas"
                className={formControlClass}
                value={newSample.customer}
                onChange={(event) => setNewSample({ ...newSample, customer: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Manufacturing Vendor">
            <select
              required
              className={formControlClass}
              value={newSample.vendor_id}
              onChange={(event) => setNewSample({ ...newSample, vendor_id: event.target.value })}
            >
              <option value="">Select a Vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sample Class Name">
            <input
              required
              placeholder="Summer performance tee"
              className={formControlClass}
              value={newSample.name}
              onChange={(event) => setNewSample({ ...newSample, name: event.target.value })}
            />
          </Field>
          <Field label="Remarks">
            <textarea
              rows={3}
              placeholder="Design guidelines, tech pack references..."
              className={formControlClass}
              value={newSample.remarks}
              onChange={(event) => setNewSample({ ...newSample, remarks: event.target.value })}
            />
          </Field>
          <PrimaryButton type="submit">
            <Plus className="h-4 w-4" /> {isSubmitting ? "Saving..." : editingSample ? "Update Class" : "Create Class"}
          </PrimaryButton>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Deactivate sample class?"
        message={`Are you sure you want to deactivate ${deleteTarget?.name}? Existing order history will remain available.`}
        confirmLabel="Yes, Deactivate"
        loading={isSubmitting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function SampleCard({
  sample,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  sample: any;
  onEdit: (sample: any) => void;
  onDelete: (sample: any) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const progress = typeof sample.progress === "number"
    ? sample.progress
    : (sample.status === "completed" ? 100 : 0);
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03] transition duration-200 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-950/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
          <Package className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={sample.status === "completed" ? "success" : "info"}>{sample.status || "Active"}</StatusBadge>
          {canEdit && (
            <button type="button" onClick={() => onEdit(sample)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-cyan-700"><Edit3 className="h-4 w-4" /></button>
          )}
          {canDelete && (
            <button type="button" onClick={() => onDelete(sample)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">S/N {sample.serial_number || "---"}</p>
        <h3 className="mt-2 line-clamp-2 text-xl font-black tracking-tight text-slate-950">{sample.name}</h3>
        <p className="mt-2 text-sm font-medium text-slate-500">{sample.customer || "No customer assigned"}</p>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs font-semibold text-slate-600">
        <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-cyan-600" /> {sample.vendor_name || "Vendor not assigned"}</span>
        <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-600" /> {sample.created_at ? new Date(sample.created_at).toLocaleDateString() : "No date"}</span>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-500">
          <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Stage Progress</span>
          <span className="font-mono font-bold text-slate-700">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>{sample.total_stages ? `${sample.completed_stages || 0}/${sample.total_stages} stages completed` : "No active orders"}</span>
          <span>{sample.total_orders ? `${sample.total_orders} order${sample.total_orders > 1 ? "s" : ""}` : "0 orders"}</span>
        </div>
      </div>

      <Link
        href={`/orders?track=sampling&sample_class_id=${sample.id}`}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700"
      >
        View Orders <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}
