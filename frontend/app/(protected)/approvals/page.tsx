"use client";

import React, { useEffect, useState } from "react";
import api from "@/services/api";
import Modal from "@/components/ui/Modal";
import {
  EmptyState,
  Field,
  PageToolbar,
  PrimaryButton,
  SkeletonGrid,
  StatusBadge,
  formControlClass,
} from "@/components/ui/PagePrimitives";
import { CheckCircle, Clock, Eye, FileText, User, XCircle } from "lucide-react";

export default function ApprovalsPage() {
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await api.get("/qc-reports/pending-approvals/");
        setPendingReports(res.data.data || []);
      } catch (err) {
        console.warn("Failed to fetch pending approvals", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPending();
  }, []);

  const approveReport = async (id: string) => {
    try {
      await api.put(`/qc-reports/${id}/approve`);
      setPendingReports((prev) => prev.filter((report) => report.id !== id));
    } catch (err) {
      alert("Failed to process approval");
    }
  };

  const rejectReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rejecting || !reason.trim()) return;
    try {
      await api.put(`/qc-reports/${rejecting.id}/reject`, { rejection_reason: reason.trim() });
      setPendingReports((prev) => prev.filter((report) => report.id !== rejecting.id));
      setRejecting(null);
      setReason("");
    } catch (err) {
      alert("Failed to process rejection");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageToolbar>
        <div className="grid gap-4 md:grid-cols-3">
          <ApprovalStat label="Pending Review" value={pendingReports.length} />
          <ApprovalStat label="Ready For Action" value={pendingReports.filter((report) => report.id).length} />
          <ApprovalStat label="Critical Defects" value={pendingReports.reduce((sum, report) => sum + Number(report.fail_pieces || 0), 0)} />
        </div>
      </PageToolbar>

      {loading ? (
        <SkeletonGrid />
      ) : pendingReports.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {pendingReports.map((report) => (
            <ApprovalCard
              key={report.id}
              report={report}
              onApprove={() => approveReport(report.id)}
              onReject={() => {
                setRejecting(report);
                setReason("");
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CheckCircle className="h-5 w-5" />}
          title="All caught up"
          message="There are no pending QC reports waiting for approval."
        />
      )}

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title="Reject QC Report">
        <form onSubmit={rejectReport} className="space-y-5">
          <p className="text-sm text-slate-500">
            Add a clear reason so the QC team can correct and resubmit the report.
          </p>
          <Field label="Rejection Reason">
            <textarea
              rows={4}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={formControlClass}
              placeholder="Explain what needs correction..."
            />
          </Field>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setRejecting(null)}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <PrimaryButton type="submit">
              <XCircle className="h-4 w-4" /> Reject Report
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ApprovalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ApprovalCard({
  report,
  onApprove,
  onReject,
}: {
  report: any;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <StatusBadge tone="warning">Pending Approval</StatusBadge>
            <h3 className="mt-3 text-lg font-black text-slate-950">Order {report.order_no || "N/A"}</h3>
            <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-500">{report.report_type}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
        <span className="flex items-center gap-2"><User className="h-4 w-4 text-cyan-600" /> {report.checker_name || "QC Officer"}</span>
        <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600" /> {report.submitted_at ? new Date(report.submitted_at).toLocaleString() : "No date"}</span>
        <span className="font-semibold">{report.total_pieces || 0} pcs inspected</span>
        <span className="font-semibold text-blue-800">{report.fail_pieces || 0} defects found</span>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
          <Eye className="h-4 w-4" /> Review
        </button>
        <button
          onClick={onReject}
          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 transition hover:bg-blue-100"
        >
          <XCircle className="h-4 w-4" /> Reject
        </button>
        <button
          onClick={onApprove}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-cyan-500"
        >
          <CheckCircle className="h-4 w-4" /> Approve
        </button>
      </div>
    </article>
  );
}
