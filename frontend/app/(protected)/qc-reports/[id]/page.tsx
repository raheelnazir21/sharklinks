"use client";

import React, { useEffect, useState, use } from "react";
import api from "@/services/api";
import { 
  ChevronLeft, Printer, Download, Share2, 
  Building2, Calendar, User, Clock, CheckCircle2,
  AlertTriangle, FileText, BarChart, Layers, GitBranch, ShieldCheck,
  Pencil, Trash2, X
} from 'lucide-react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useHeader } from "@/hooks/useHeader";
import { useAuth } from "@/hooks/useAuth";
import { IndustrialHeading } from "@/components/ui/PagePrimitives";
import AttachmentPanel from "@/components/qc/AttachmentPanel";

function getEditRoute(reportType: string, reportId: string): string {
  switch (reportType) {
    case "inline":
      return `/qc-reports/inline/new?edit=${reportId}`;
    case "finish":
    case "endline":
      return `/qc-reports/finish-endline/new?type=${reportType}&edit=${reportId}`;
    case "cut_panel":
      return `/qc-reports/cut-panel/new?edit=${reportId}`;
    case "batch_audit":
      return `/qc-reports/batch-audit/new?edit=${reportId}`;
    default:
      return `/qc-reports`;
  }
}

function getDeleteEndpoint(reportType: string, reportId: string): string {
  switch (reportType) {
    case "inline":
      return `/advanced-qc/inline/${reportId}`;
    case "finish":
    case "endline":
      return `/advanced-qc/finish-endline/${reportId}`;
    case "cut_panel":
      return `/advanced-qc/cut-panel/${reportId}`;
    case "batch_audit":
      return `/advanced-qc/batch-audit/${reportId}`;
    default:
      return "";
  }
}

export default function QCReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const { setHeaderConfig } = useHeader();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await api.get(`/qc-reports/${id}`);
        setReport(res.data.data);
      } catch (err) {
        console.warn("Failed to fetch report detail", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  useEffect(() => {
    if (!report?.header) return;
    const h = report.header;
    setHeaderConfig({
      eyebrow: `Inspection Certificate #${id.slice(0, 8).toUpperCase()}`,
      title: (h.report_type || "QC").replace(/_/g, " "),
      highlight: "Report",
      subtitle: `Vendor: ${h.vendor_name || "N/A"} • Order: ${h.order_no || "N/A"} • Passed: ${h.quantity_passed || 0}/${h.quantity_checked || 0} Pcs`,
    });
    return () => {
      setHeaderConfig(null);
    };
  }, [id, report, setHeaderConfig]);

  const handleDelete = async () => {
    if (!report) return;
    const reportType = report.header?.report_type;
    const endpoint = getDeleteEndpoint(reportType, id);
    if (!endpoint) return;

    setDeleting(true);
    try {
      await api.delete(endpoint);
      router.push("/qc-reports");
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to delete report.";
      alert(msg);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!report) return <div className="text-white">Report not found.</div>;

  const { header, items } = report;
  const reportType = header?.report_type;
  const editRoute = getEditRoute(reportType, id);
  const deleteEndpoint = getDeleteEndpoint(reportType, id);

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <Link href="/qc-reports" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-95">
          <ChevronLeft className="w-4 h-4" /> Back to QC Reports
        </Link>
        <div className="flex gap-3">
          {deleteEndpoint && !isViewer && (
            <>
              <Link href={editRoute} className="px-6 py-3 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-amber-500/30 flex items-center gap-2">
                <Pencil className="w-4 h-4" /> Edit Report
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-6 py-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/30 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
          <button onClick={() => window.print()} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700 flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Report
          </button>
          <button className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-10 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-white font-black text-sm uppercase tracking-widest">Delete Report</h3>
              </div>
              <button onClick={() => setShowDeleteModal(false)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-400 text-xs font-bold leading-relaxed mb-8">
              Are you sure you want to permanently delete this <span className="text-white uppercase">{reportType?.replace('_', ' ')}</span> report?
              This action cannot be undone and all associated data (defect logs, hourly entries, attachments) will be removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-6 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Report Document */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-[4rem] overflow-hidden shadow-2xl printable-area">
        {/* Header Ribbon */}
        <div className="bg-indigo-600/10 border-b border-indigo-500/20 p-12 flex flex-col md:flex-row justify-between gap-8">
           <div className="flex gap-6">
              <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white shadow-2xl">
                 <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Cert #{id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    QC Inspection
                  </span>
                </div>
                <h2 className="text-3xl font-black text-white capitalize tracking-tight">{header.report_type.replace(/_/g, ' ')} Report</h2>
                <div className="flex gap-4 mt-4">
                   <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-black uppercase tracking-wider">
                     <CheckCircle2 className="w-4 h-4" /> FPY: {header.fpy_percent}%
                   </span>
                   <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-black uppercase tracking-wider">
                     <AlertTriangle className="w-4 h-4" /> DHU: {header.dhu_percent}%
                   </span>
                </div>
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Checked", val: header.quantity_checked, unit: "Pcs" },
                { label: "Passed",  val: header.quantity_passed,  unit: "Pcs" },
                { label: "Rejected", val: header.quantity_rejected, unit: "Pcs" },
                { label: "Status",   val: "Verified", color: "emerald" },
              ].map((s, i) => (
                <div key={i} className="bg-slate-950/50 border border-slate-800 p-5 rounded-3xl min-w-[120px] text-center">
                   <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest mb-1">{s.label}</p>
                   <p className={`text-xl font-black ${s.color ? `text-${s.color}-400` : 'text-white'} italic`}>{s.val} <span className="text-[10px] font-bold not-italic text-slate-700">{s.unit}</span></p>
                </div>
              ))}
           </div>
        </div>

        <div className="p-12 space-y-12">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
             <div className="space-y-6">
                <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em] opacity-40 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" /> Plant Location
                </h3>
                <div className="space-y-4">
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Vendor</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.vendor_name}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Floor</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.floor_name || 'N/A'}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Line</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.line_name || 'N/A'}</span>
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em] opacity-40 flex items-center gap-2">
                  <BarChart className="w-4 h-4 text-indigo-400" /> Order Details
                </h3>
                <div className="space-y-4">
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">PO Number</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.order_no}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Style Name</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.style_name}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Article Code</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.article_code || 'N/A'}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Color</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.product_color || 'N/A'}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Stage</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.stage || 'N/A'}</span>
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em] opacity-40 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> Audit Control
                </h3>
                <div className="space-y-4">
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Date</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.inspection_date}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Auditor</span>
                      <span className="text-white text-xs font-black uppercase italic">{header.auditor_name}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Shift</span>
                      <span className="text-white text-xs font-black uppercase italic">Shift {header.shift || 'A'}</span>
                   </div>
                </div>
             </div>
          </div>

          {/* Defects Data Table */}
          <div className="space-y-6">
             <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-3">
               <AlertTriangle className="w-5 h-5 text-amber-500" /> Defect Breakdown
             </h3>
             <div className="bg-slate-950/40 border border-slate-800 rounded-[2.5rem] overflow-hidden">
                <table className="w-full text-left">
                   <thead className="bg-slate-900/50 text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-800">
                      <tr>
                        <th className="px-8 py-5">Date</th>
                        <th className="px-8 py-5">Hour</th>
                        <th className="px-8 py-5">Defect Code</th>
                        <th className="px-8 py-5">Defect Name</th>
                        <th className="px-8 py-5 text-center">Qty</th>
                        <th className="px-8 py-5">Severity</th>
                        <th className="px-8 py-5">Remarks</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50">
                      {items.map((item: any, i: number) => (
                        <tr key={i}>
                           <td className="px-8 py-5 text-white font-black text-xs uppercase tracking-tight italic">{item.item_date || header.inspection_date}</td>
                           <td className="px-8 py-5 text-slate-400 text-xs font-bold uppercase">{item.hour || '—'}</td>
                           <td className="px-8 py-5">
                              <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase">
                                {item.defect_code}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-slate-400 text-xs font-bold uppercase">{item.defect_name}</td>
                           <td className="px-8 py-5 text-center text-white font-black text-sm italic">{item.count}</td>
                           <td className="px-8 py-5">
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                                item.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                item.severity === 'major' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}>
                                {item.severity}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-slate-500 text-[10px] font-bold italic">{item.remarks || '—'}</td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr><td colSpan={6} className="py-20 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest">No defects recorded. Quality Passed.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>

          {/* Remarks Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
             <div className="space-y-4">
                <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em] opacity-40">Auditor Observations</h3>
                <div className="p-8 bg-slate-950/40 border border-slate-800 rounded-[2.5rem] min-h-[150px]">
                   <p className="text-slate-400 text-xs font-medium leading-relaxed italic">{report.header.remarks || 'No detailed remarks provided.'}</p>
                </div>
             </div>
             <div className="space-y-4 flex flex-col justify-end">
                <div className="p-8 bg-indigo-600/5 border border-indigo-500/10 rounded-[2.5rem] flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-600">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-white font-black text-xs uppercase tracking-tight">Inspector Signature</p>
                        <p className="text-slate-600 text-[9px] font-black uppercase mt-1">Verified via Digital ID</p>
                      </div>
                   </div>
                   <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
                </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Attachments */}
      <AttachmentPanel
        reportId={id}
        initialAttachments={report.attachments || []}
        pendingFiles={pendingFiles}
        onPendingChange={setPendingFiles}
      />

      <p className="text-center text-slate-600 text-[9px] font-black uppercase tracking-[0.4em] pt-10">
        Generated by Textile QC Intelligence • End of Report
      </p>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
