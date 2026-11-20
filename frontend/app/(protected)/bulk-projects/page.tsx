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
import { Activity, ArrowRight, Building2, Calendar, Download, Edit3, FileSpreadsheet, Layers, Plus, Search, Timer, Trash2 } from "lucide-react";

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

export default function BulkProjectsPage() {
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const isSuperAdmin = user?.role === "super_admin";
  const isManager = user?.role === "manager";
  const canManage = !isViewer;
  const [projects, setProjects] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [newProject, setNewProject] = useState({
    name: "",
    customer: "",
    serial_number: "",
    vendor_id: "",
    remarks: "",
  });

  const fetchData = async () => {
    try {
      const [projRes, vendorRes] = await Promise.all([
        api.get("/orders/bulk-classes"),
        api.get("/vendors/"),
      ]);
      setProjects(projRes.data.data || []);
      setVendors(vendorRes.data.data || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const res = await api.get("/orders/bulk-classes/export/excel", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `bulk-projects-wip-${new Date().toISOString().split("T")[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Export Failed",
        message: getApiError(err, "Failed to download bulk projects Excel workbook."),
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCsv = async (view: "table" | "matrix" = "table") => {
    setIsExporting(true);
    try {
      const res = await api.get(`/orders/bulk-classes/export/csv?view=${view}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `bulk-projects-${view}-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Export Failed",
        message: getApiError(err, "Failed to download bulk projects CSV."),
      });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingProject) {
        await api.put(`/orders/bulk-classes/${editingProject.id}`, newProject);
      } else {
        await api.post("/orders/bulk-classes", newProject);
      }
      setIsModalOpen(false);
      setEditingProject(null);
      setNewProject({ name: "", customer: "", serial_number: "", vendor_id: "", remarks: "" });
      fetchData();
      setFeedback({ type: "success", title: "Mission Successful", message: editingProject ? "Bulk project updated successfully." : "Bulk project created successfully." });
    } catch (err) {
      setFeedback({ type: "error", title: "Operation Failed", message: "Failed to save bulk project." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingProject(null);
    setNewProject({ name: "", customer: "", serial_number: "", vendor_id: "", remarks: "" });
    setIsModalOpen(true);
  };

  const openEdit = (project: any) => {
    setEditingProject(project);
    setNewProject({
      name: project.name || "",
      customer: project.customer || "",
      serial_number: project.serial_number || "",
      vendor_id: project.vendor_id || "",
      remarks: project.remarks || "",
    });
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/orders/bulk-classes/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
      setFeedback({ type: "success", title: "Mission Successful", message: "Bulk project deactivated successfully." });
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Operation Failed",
        message: getApiError(err, "Failed to deactivate bulk project."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return projects.filter((project) =>
      project.name?.toLowerCase().includes(query) ||
      project.customer?.toLowerCase().includes(query) ||
      project.serial_number?.toLowerCase().includes(query) ||
      project.vendor_names?.join(" ")?.toLowerCase().includes(query)
    );
  }, [projects, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      <PageToolbar>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <SearchInput
            icon={<Search className="h-4 w-4" />}
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search bulk project, customer, project number..."
          />
          {!isViewer && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#C7D6FF] bg-[#EBF0FF] px-4 text-sm font-bold text-[#0044E6] shadow-sm transition hover:bg-[#dbe8ff] active:scale-95 disabled:opacity-50"
                title="Download Multi-Sheet Excel Workbook with individual tabs per project"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#0044E6]" />
                {isExportingExcel ? "Exporting..." : "Export Excel (.xlsx)"}
              </button>
              <button
                type="button"
                onClick={() => handleExportCsv("table")}
                disabled={isExporting}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95 disabled:opacity-50"
                title="Download WIP Product Master Table (CSV)"
              >
                <Download className="h-4 w-4 text-[#0044E6]" />
                {isExporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          )}
          {canManage && (
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" /> New Bulk Project
            </PrimaryButton>
          )}
        </div>
      </PageToolbar>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Active Projects" value={projects.length} />
        <SummaryCard label="Visible Results" value={filtered.length} />
        <SummaryCard label="In Production" value={projects.filter((project) => project.status !== "completed").length} />
        <SummaryCard label="Completed" value={projects.filter((project) => project.status === "completed").length} />
      </section>

      {loading ? (
        <SkeletonGrid />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <BulkCard
              key={project.id}
              project={project}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              canEdit={!isViewer && (isSuperAdmin || isManager)}
              canDelete={!isViewer && (isSuperAdmin || isManager)}
            />
          ))}
          {filtered.length === 0 && (
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="No bulk projects found"
              message="Adjust search or register a new bulk production project."
            />
          )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProject ? "Update Bulk Project" : "Create Bulk Project"}>
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project Number">
              <input
                required
                placeholder="BP-2026-001"
                className={formControlClass}
                value={newProject.serial_number}
                onChange={(event) => setNewProject({ ...newProject, serial_number: event.target.value })}
              />
            </Field>
            <Field label="Customer">
              <input
                required
                placeholder="Target / Walmart"
                className={formControlClass}
                value={newProject.customer}
                onChange={(event) => setNewProject({ ...newProject, customer: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Project Name">
            <input
              required
              placeholder="Winter jackets phase 1"
              className={formControlClass}
              value={newProject.name}
              onChange={(event) => setNewProject({ ...newProject, name: event.target.value })}
            />
          </Field>
          <Field label="Manufacturing Vendor">
            <select
              className={formControlClass}
              value={newProject.vendor_id}
              onChange={(event) => setNewProject({ ...newProject, vendor_id: event.target.value })}
            >
              <option value="">Select a Vendor (optional)</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Remarks">
            <textarea
              rows={3}
              placeholder="Production scope, target audit dates..."
              className={formControlClass}
              value={newProject.remarks}
              onChange={(event) => setNewProject({ ...newProject, remarks: event.target.value })}
            />
          </Field>
          <PrimaryButton type="submit">
            <Plus className="h-4 w-4" /> {isSubmitting ? "Saving..." : editingProject ? "Update Project" : "Create Project"}
          </PrimaryButton>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Deactivate bulk project?"
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

function BulkCard({
  project,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  project: any;
  onEdit: (project: any) => void;
  onDelete: (project: any) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const status = project.status || "active";
  const progress = typeof project.progress === "number"
    ? project.progress
    : (status === "completed" ? 100 : 0);
  const delayed = status === "delayed";
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03] transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Layers className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={delayed ? "danger" : status === "completed" ? "success" : "info"}>
            {status}
          </StatusBadge>
          {canEdit && (
            <button type="button" onClick={() => onEdit(project)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-blue-700"><Edit3 className="h-4 w-4" /></button>
          )}
          {canDelete && (
            <button type="button" onClick={() => onDelete(project)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">P/N {project.serial_number || "---"}</p>
        <h3 className="mt-2 line-clamp-2 text-xl font-black tracking-tight text-slate-950">{project.name}</h3>
        <p className="mt-2 text-sm font-medium text-slate-500">{project.customer || "No customer assigned"}</p>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs font-semibold text-slate-600">
        <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-600" /> {project.vendor_name || (project.vendor_names?.length ? project.vendor_names.join(", ") : "Vendor not assigned yet")}</span>
        <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-600" /> {project.created_at ? new Date(project.created_at).toLocaleDateString() : "No date"}</span>
        <span className="flex items-center gap-2"><Timer className="h-4 w-4 text-cyan-600" /> Production tracking active</span>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-500">
          <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Production Progress</span>
          <span className="font-mono font-bold text-slate-700">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>{project.total_stages ? `${project.completed_stages || 0}/${project.total_stages} stages completed` : "No active orders"}</span>
          <span>{project.total_orders ? `${project.total_orders} order${project.total_orders > 1 ? "s" : ""}` : "0 orders"}</span>
        </div>
      </div>

      <Link
        href={`/orders?track=bulk&bulk_class_id=${project.id}`}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700"
      >
        View Batch Items <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}
