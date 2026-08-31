"use client";

import React, { useState, useEffect } from "react";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import {
  ChevronRight, Building2, Layers, Settings2,
  ClipboardList, AlertCircle, CheckCircle2,
  ShieldCheck, XCircle, User, Calendar, Clock,
  Factory, Plus, Minus
} from "lucide-react";
import { ReportCanvas, ReportToolbar, ReportWorkspace } from "@/components/qc/ReportUI";
import AttachmentPanel from "@/components/qc/AttachmentPanel";

// ─── Static Control Points per Process (from physical form) ──────────────────
const PROCESS_DEFINITIONS = [
  {
    name: "CUTTING",
    color: "emerald",
    controlPoints: [
      "Fabric identity, GSM, width and relaxation",
      "Roll/shade continuity and panel segregation",
      "Marker, ratio, grain/nap, notches and panel defects",
      "Bundle numbering and cut-panel measurements",
    ],
  },
  {
    name: "SEWING",
    color: "indigo",
    controlPoints: [
      "Approved PP construction and operation sequence",
      "Seam allowance, SPI, machine setting and attachments",
      "Critical measurements, symmetry and plaid/stripe alignment",
      "Skipped/broken stitches, puckering, open seams, loose threads",
    ],
  },
  {
    name: "PRINT / EMB.",
    color: "violet",
    controlPoints: [
      "Approved strike-off, placement, size and color",
      "Registration, coverage, curing/adhesion and cleanliness",
      "Cracking/stretch performance; embroidery density/backing",
      "No damage, staining or distortion to garment",
    ],
  },
  {
    name: "WASH / SHADE",
    color: "cyan",
    controlPoints: [
      "Approved wash effect and shade standard",
      "Lot/panel shade continuity and hand feel",
      "Shrinkage, spirality, pilling, lint and crocking risk",
      "No stains, wash marks, holes or garment damage",
    ],
  },
  {
    name: "FINISHING",
    color: "amber",
    controlPoints: [
      "100% thread trimming, stain and repair control",
      "Final measurements, pressing shape and appearance",
      "Labels, trims and accessories complete/correct",
      "Rejected pieces segregated and rechecked after correction",
    ],
  },
  {
    name: "PACKING",
    color: "rose",
    controlPoints: [
      "Correct style, color, size, folding and polybag",
      "Barcode, size sticker, assortment and carton quantity",
      "Carton markings, condition and sealing",
      "Metal detection / special packing requirement where applicable",
    ],
  },
];

const processColorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  emerald: { bg: "bg-emerald-500/5",  border: "border-emerald-500/20", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  indigo:  { bg: "bg-indigo-500/5",   border: "border-indigo-500/20",  text: "text-indigo-400",  badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" },
  violet:  { bg: "bg-violet-500/5",   border: "border-violet-500/20",  text: "text-violet-400",  badge: "bg-violet-500/10 text-violet-300 border-violet-500/20" },
  cyan:    { bg: "bg-cyan-500/5",     border: "border-cyan-500/20",    text: "text-cyan-400",    badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20" },
  amber:   { bg: "bg-amber-500/5",    border: "border-amber-500/20",   text: "text-amber-400",   badge: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  rose:    { bg: "bg-rose-500/5",     border: "border-rose-500/20",    text: "text-rose-400",    badge: "bg-rose-500/10 text-rose-300 border-rose-500/20" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProcessRow {
  process_name: string;
  active_po_style: string;
  line_area: string;
  qty_checked: number;
  finding_defect: string;
  immediate_action: string;
  status: "P" | "C" | "H";   // Pass | Correct & Continue | Hold
  total_defects: number;
}

function initProcessRows(): ProcessRow[] {
  return PROCESS_DEFINITIONS.map((p) => ({
    process_name: p.name,
    active_po_style: "",
    line_area: "",
    qty_checked: 0,
    finding_defect: "",
    immediate_action: "",
    status: "P",
    total_defects: 0,
  }));
}

// ─── Status Toggle ────────────────────────────────────────────────────────────
function StatusToggle({
  value,
  onChange,
}: {
  value: "P" | "C" | "H";
  onChange: (v: "P" | "C" | "H") => void;
}) {
  const opts: { key: "P" | "C" | "H"; label: string; active: string; inactive: string }[] = [
    {
      key: "P",
      label: "P",
      active: "bg-emerald-600 text-white border-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.4)]",
      inactive: "bg-slate-950 border-slate-700 text-slate-600 hover:border-emerald-500/50 hover:text-emerald-400",
    },
    {
      key: "C",
      label: "C",
      active: "bg-amber-500 text-white border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]",
      inactive: "bg-slate-950 border-slate-700 text-slate-600 hover:border-amber-500/50 hover:text-amber-400",
    },
    {
      key: "H",
      label: "H",
      active: "bg-rose-600 text-white border-rose-600 shadow-[0_0_12px_rgba(239,68,68,0.4)]",
      inactive: "bg-slate-950 border-slate-700 text-slate-600 hover:border-rose-500/50 hover:text-rose-400",
    },
  ];

  return (
    <div className="flex gap-1.5">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`w-9 h-9 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
            value === o.key ? o.active : o.inactive
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NewRandomInlineQCReport() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Master data
  const [vendors, setVendors] = useState<any[]>([]);
  const [floors, setFloors]   = useState<any[]>([]);
  const [lines, setLines]     = useState<any[]>([]);

  // Header state
  const [header, setHeader] = useState({
    vendor_id:              "",
    floor_id:               "",
    line_id:                "",
    report_date:            new Date().toISOString().split("T")[0],
    report_no:              "",
    factory:                "",
    inspector_auditor:      "",
    visit_time:             "",
    shift:                  "Day Shift",
    production_manager:     "",
    qc_manager:             "",
    inspection_duration:    "Minimum first 2 hours",
    factory_representative: "",
  });

  // Process rows state
  const [rows, setRows] = useState<ProcessRow[]>(initProcessRows());

  // Defect summary
  const [defectSummary, setDefectSummary] = useState({
    critical_count: 0,
    major_count:    0,
    minor_count:    0,
    repeat_issue:   false,
  });

  // Overall decision
  const [overallDecision, setOverallDecision] = useState<"pass" | "conditional" | "hold">("pass");

  // Verification
  const [verificationStatus, setVerificationStatus] = useState<"closed" | "pending">("pending");
  const [rootCause,          setRootCause]           = useState("");
  const [dueResponsible,     setDueResponsible]      = useState("");

  // Signatures
  const [signatures, setSignatures] = useState({
    production_manager_signature: "",
    production_manager_date:      "",
    qc_manager_signature:         "",
    qc_manager_date:              "",
    auditor_signature:            "",
    auditor_date:                 "",
  });

  // Load vendors
  useEffect(() => {
    api.get("/vendors/").then((res) => setVendors(res.data.data));
  }, []);

  // Load edit data
  useEffect(() => {
    const reportId = new URLSearchParams(window.location.search).get("edit");
    if (!reportId) return;
    api.get(`/advanced-qc/random-inline/${reportId}`).then((res) => {
      const d = res.data.data;
      setEditId(reportId);
      setHeader({
        vendor_id:              d.vendor_id || "",
        floor_id:               d.floor_id  || "",
        line_id:                d.line_id   || "",
        report_date:            d.report_date || new Date().toISOString().split("T")[0],
        report_no:              d.report_no   || "",
        factory:                d.factory     || "",
        inspector_auditor:      d.inspector_auditor     || "",
        visit_time:             d.visit_time            || "",
        shift:                  d.shift                 || "Day Shift",
        production_manager:     d.production_manager    || "",
        qc_manager:             d.qc_manager            || "",
        inspection_duration:    d.inspection_duration   || "Minimum first 2 hours",
        factory_representative: d.factory_representative || "",
      });
      if (d.rows?.length) {
        setRows(d.rows.map((r: any) => ({
          process_name:    r.process_name,
          active_po_style: r.active_po_style || "",
          line_area:       r.line_area       || "",
          qty_checked:     r.qty_checked     || 0,
          finding_defect:  r.finding_defect  || "",
          immediate_action: r.immediate_action || "",
          status:          r.status          || "P",
          total_defects:   r.total_defects   || 0,
        })));
      }
      setDefectSummary({
        critical_count: d.critical_count || 0,
        major_count:    d.major_count    || 0,
        minor_count:    d.minor_count    || 0,
        repeat_issue:   d.repeat_issue   || false,
      });
      setOverallDecision(d.overall_decision || "pass");
      setVerificationStatus(d.verification_status || "pending");
      setRootCause(d.root_cause || "");
      setDueResponsible(d.due_responsible || "");
      setSignatures({
        production_manager_signature: d.production_manager_signature || "",
        production_manager_date:      d.production_manager_date      || "",
        qc_manager_signature:         d.qc_manager_signature         || "",
        qc_manager_date:              d.qc_manager_date              || "",
        auditor_signature:            d.auditor_signature            || "",
        auditor_date:                 d.auditor_date                 || "",
      });
    }).catch(() => alert("Failed to load report."));
  }, []);

  // Cascade vendor → floors → lines
  useEffect(() => {
    if (header.vendor_id) {
      api.get(`/vendors/${header.vendor_id}/floors/`).then((res) => setFloors(res.data.data));
    } else {
      setFloors([]); setLines([]);
    }
  }, [header.vendor_id]);

  useEffect(() => {
    if (header.floor_id) {
      const f = floors.find((f) => f.id === header.floor_id);
      setLines(f?.lines || []);
    } else {
      setLines([]);
    }
  }, [header.floor_id, floors]);

  // Row helpers
  const updateRow = (idx: number, field: keyof ProcessRow, value: any) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  // Derived stats
  const stats = {
    totalDefects:  rows.reduce((s, r) => s + (r.total_defects || 0), 0),
    passed:        rows.filter((r) => r.status === "P").length,
    conditional:   rows.filter((r) => r.status === "C").length,
    held:          rows.filter((r) => r.status === "H").length,
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...header,
        vendor_id: header.vendor_id || null,
        floor_id:  header.floor_id  || null,
        line_id:   header.line_id   || null,
        ...defectSummary,
        overall_decision:    overallDecision,
        verification_status: verificationStatus,
        root_cause:          rootCause,
        due_responsible:     dueResponsible,
        ...signatures,
        rows: rows.map((r) => ({
          process_name:    r.process_name,
          active_po_style: r.active_po_style,
          line_area:       r.line_area,
          qty_checked:     r.qty_checked,
          finding_defect:  r.finding_defect,
          immediate_action: r.immediate_action,
          status:          r.status,
          total_defects:   r.total_defects,
        })),
      };

      const res = editId
        ? await api.put(`/advanced-qc/random-inline/${editId}`, payload)
        : await api.post("/advanced-qc/random-inline/", payload);

      const reportId = editId || res.data?.data?.id;
      if (reportId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append("file", file);
          try {
            await api.post(`/qc-reports/${reportId}/attachments`, fd, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          } catch { /* non-fatal */ }
        }
      }
      router.push("/qc-reports");
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Unknown error";
      alert(`Failed: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <ReportWorkspace maxWidth="max-w-[1800px]">
      <ReportToolbar
        title="Random Inline QC Report"
        subtitle="Cut-to-Pack Process Control & Immediate Corrective Action"
        meta="Process Quality"
        onSave={handleSave}
        saving={saving}
        saveLabel={editId ? "Update Report" : "Submit Report"}
        savingLabel="Processing..."
      />

      <ReportCanvas title="Random Inline QC Report" subtitle="Cut-to-Pack Process Control & Immediate Corrective Action">

        {/* ── Section 1: Header ─────────────────────────────────────────────── */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/5 blur-[120px] -mr-40 -mt-40" />
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Report Header</p>
              <h2 className="text-sm font-black text-white uppercase tracking-tight">Audit Information</h2>
            </div>
          </div>

          {/* Row 1: Vendor / Floor / Line / Date / Report No */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6 relative z-10">
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Building2 className="w-3 h-3" /> Vendor
              </label>
              <select
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                value={header.vendor_id}
                onChange={(e) => setHeader({ ...header, vendor_id: e.target.value, floor_id: "", line_id: "" })}
              >
                <option value="">Select Vendor</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Layers className="w-3 h-3" /> Floor
              </label>
              <select
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                value={header.floor_id}
                onChange={(e) => setHeader({ ...header, floor_id: e.target.value, line_id: "" })}
                disabled={!header.vendor_id}
              >
                <option value="">Select Floor</option>
                {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Settings2 className="w-3 h-3" /> Line
              </label>
              <select
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                value={header.line_id}
                onChange={(e) => setHeader({ ...header, line_id: e.target.value })}
                disabled={!header.floor_id}
              >
                <option value="">Select Line</option>
                {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Date
              </label>
              <input
                type="date"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                value={header.report_date}
                onChange={(e) => setHeader({ ...header, report_date: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Report No.</label>
              <input
                type="text"
                placeholder="e.g. RIQ-001"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 placeholder:text-slate-800"
                value={header.report_no}
                onChange={(e) => setHeader({ ...header, report_no: e.target.value })}
              />
            </div>
          </div>

          {/* Row 2: Factory / Inspector / Visit Time / Shift / Inspection Duration / Factory Rep / Prod Manager / QC Manager */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {[
              { label: "Factory",                   key: "factory",                placeholder: "Factory name" },
              { label: "Inspector / Auditor",       key: "inspector_auditor",      placeholder: "Inspector name" },
              { label: "Visit Time",                key: "visit_time",             placeholder: "e.g. 09:00 AM" },
              { label: "Shift",                     key: "shift",                  placeholder: "Day Shift" },
              { label: "Production Manager",        key: "production_manager",     placeholder: "Manager name" },
              { label: "QC Manager",                key: "qc_manager",             placeholder: "QC Manager name" },
              { label: "Inspection Duration",       key: "inspection_duration",    placeholder: "Minimum first 2 hours" },
              { label: "Factory Representative",    key: "factory_representative", placeholder: "Rep name" },
            ].map((f) => (
              <div key={f.key} className="space-y-3">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{f.label}</label>
                <input
                  type="text"
                  placeholder={f.placeholder}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 placeholder:text-slate-800"
                  value={(header as any)[f.key]}
                  onChange={(e) => setHeader({ ...header, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 2: Process Rows Table ─────────────────────────────────── */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[3.5rem] overflow-hidden shadow-2xl">
          <div className="p-10 border-b border-slate-800 bg-slate-900/30">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Cut-to-Pack Inspection</p>
                <h2 className="text-sm font-black text-white uppercase tracking-tight">Process Control Table</h2>
              </div>
            </div>
            {/* Status key legend */}
            <div className="mt-6 flex flex-wrap gap-4">
              {[
                { code: "P", label: "Pass",                     color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                { code: "C", label: "Correct immediately & continue under control", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                { code: "H", label: "Hold / Stop affected process until correction verified", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
              ].map((s) => (
                <div key={s.code} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest ${s.color}`}>
                  <span className="font-black">{s.code}</span> = {s.label}
                </div>
              ))}
            </div>
          </div>

          {/* Process cards */}
          <div className="p-8 space-y-6">
            {rows.map((row, idx) => {
              const def    = PROCESS_DEFINITIONS[idx];
              const colors = processColorMap[def?.color || "indigo"];
              return (
                <div
                  key={row.process_name}
                  className={`rounded-[2rem] border ${colors.border} ${colors.bg} overflow-hidden transition-all hover:shadow-lg`}
                >
                  {/* Process header bar */}
                  <div className={`px-8 py-5 border-b ${colors.border} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                    <div className="flex items-center gap-4">
                      <div className={`px-5 py-2 rounded-xl border ${colors.badge} text-[10px] font-black uppercase tracking-widest`}>
                        {row.process_name}
                      </div>
                      <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">
                        {def?.controlPoints?.length} control points
                      </p>
                    </div>
                    <StatusToggle value={row.status} onChange={(v) => updateRow(idx, "status", v)} />
                  </div>

                  <div className="p-8 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                    {/* Left: Control Points (read-only) */}
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Control Points to Verify</p>
                      <ul className="space-y-2">
                        {def?.controlPoints.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-[10px] font-bold text-slate-400 leading-5">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${colors.text.replace("text-", "bg-")}`} />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Middle: PO/Style, Line/Area, Qty, Defects */}
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Active PO / Style</label>
                        <input
                          type="text"
                          placeholder="e.g. PO-45001 / ST-2401"
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-800"
                          value={row.active_po_style}
                          onChange={(e) => updateRow(idx, "active_po_style", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Line / Area</label>
                          <input
                            type="text"
                            placeholder="e.g. Line 3"
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-800"
                            value={row.line_area}
                            onChange={(e) => updateRow(idx, "line_area", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Qty Checked</label>
                          <input
                            type="number"
                            placeholder="0"
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-800"
                            value={row.qty_checked || ""}
                            onChange={(e) => updateRow(idx, "qty_checked", parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Finding / Defect</label>
                        <textarea
                          rows={3}
                          placeholder="Describe finding or defect observed..."
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-800 resize-none"
                          value={row.finding_defect}
                          onChange={(e) => updateRow(idx, "finding_defect", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Right: Immediate Action + Defect count */}
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Immediate Action / Owner</label>
                        <textarea
                          rows={5}
                          placeholder="Corrective action taken and responsible person..."
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-800 resize-none"
                          value={row.immediate_action}
                          onChange={(e) => updateRow(idx, "immediate_action", e.target.value)}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Defect Count</label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => updateRow(idx, "total_defects", Math.max(0, row.total_defects - 1))}
                            className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center hover:text-white transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-black text-rose-400 text-center focus:outline-none"
                            value={row.total_defects}
                            onChange={(e) => updateRow(idx, "total_defects", parseInt(e.target.value) || 0)}
                          />
                          <button
                            type="button"
                            onClick={() => updateRow(idx, "total_defects", row.total_defects + 1)}
                            className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center hover:text-white transition-all"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section 3: Live Summary Bar ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Processes Passed",  val: stats.passed,      color: "emerald" },
            { label: "Conditional",       val: stats.conditional,  color: "amber" },
            { label: "Hold / Stopped",    val: stats.held,         color: "rose" },
            { label: "Total Defects",     val: stats.totalDefects, color: "indigo" },
          ].map((s) => (
            <div key={s.label} className={`bg-white border border-slate-200 rounded-[2rem] p-8 relative overflow-hidden shadow-sm`}>
              <div className={`absolute top-0 right-0 w-24 h-24 bg-${s.color}-500/10 blur-[50px] -mr-12 -mt-12`} />
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">{s.label}</p>
              <p className={`text-4xl font-black text-${s.color === "indigo" ? "slate-950" : s.color + "-500"} italic tracking-tighter`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* ── Section 4: Defect Summary + Overall Decision ──────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Defect Summary */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 space-y-8 shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Defect Summary</h3>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: "Critical", key: "critical_count" as const, color: "rose" },
                { label: "Major",    key: "major_count"    as const, color: "amber" },
                { label: "Minor",    key: "minor_count"    as const, color: "blue" },
              ].map((s) => (
                <div key={s.key} className="space-y-3">
                  <label className={`block text-[9px] font-black text-${s.color}-400 uppercase tracking-[0.2em]`}>{s.label}</label>
                  <input
                    type="number"
                    min={0}
                    className={`w-full bg-slate-950 border border-${s.color}-500/20 rounded-xl px-4 py-3 text-sm font-black text-${s.color}-400 text-center focus:outline-none focus:ring-2 focus:ring-${s.color}-500/20`}
                    value={defectSummary[s.key]}
                    onChange={(e) => setDefectSummary({ ...defectSummary, [s.key]: parseInt(e.target.value) || 0 })}
                  />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-4 cursor-pointer group">
              <div
                onClick={() => setDefectSummary({ ...defectSummary, repeat_issue: !defectSummary.repeat_issue })}
                className={`w-12 h-6 rounded-full border transition-all ${
                  defectSummary.repeat_issue
                    ? "bg-rose-600 border-rose-600"
                    : "bg-slate-950 border-slate-700"
                } relative`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-all shadow-lg ${
                  defectSummary.repeat_issue ? "left-6 bg-white" : "left-0.5 bg-slate-600"
                }`} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-all">
                Repeat Issue
              </span>
              {defectSummary.repeat_issue && (
                <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[8px] font-black text-rose-400 uppercase tracking-widest">Yes</span>
              )}
            </label>
          </div>

          {/* Overall Decision */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 space-y-8 shadow-2xl">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Overall Decision</h3>
            </div>
            <div className="space-y-4">
              {[
                {
                  key: "pass" as const,
                  label: "PASS — Continue",
                  desc: "All processes meet quality standards.",
                  icon: <CheckCircle2 className="w-5 h-5" />,
                  active: "border-emerald-500 bg-emerald-500/10 text-emerald-400",
                  inactive: "border-slate-800 bg-slate-950/40 text-slate-600 hover:border-slate-600",
                },
                {
                  key: "conditional" as const,
                  label: "CONDITIONAL — Correct & Continue",
                  desc: "Issues found but production may proceed with correction.",
                  icon: <AlertCircle className="w-5 h-5" />,
                  active: "border-amber-500 bg-amber-500/10 text-amber-400",
                  inactive: "border-slate-800 bg-slate-950/40 text-slate-600 hover:border-slate-600",
                },
                {
                  key: "hold" as const,
                  label: "HOLD — Stop Affected Process",
                  desc: "Critical issues require immediate halt and audit.",
                  icon: <XCircle className="w-5 h-5" />,
                  active: "border-rose-500 bg-rose-500/10 text-rose-400",
                  inactive: "border-slate-800 bg-slate-950/40 text-slate-600 hover:border-slate-600",
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setOverallDecision(opt.key)}
                  className={`w-full flex items-start gap-4 p-5 rounded-2xl border transition-all text-left ${
                    overallDecision === opt.key ? opt.active : opt.inactive
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{opt.icon}</div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest">{opt.label}</p>
                    <p className="text-[9px] font-bold mt-1 opacity-70">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section 5: Verification & Root Cause ──────────────────────────── */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-white font-black text-xs uppercase tracking-widest">Verification & Root Cause</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Verification Status */}
            <div className="space-y-5">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Verification Status</p>
              <div className="flex flex-col gap-3">
                {[
                  { key: "closed" as const,  label: "Closed",  color: "emerald" },
                  { key: "pending" as const, label: "Pending", color: "amber" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setVerificationStatus(opt.key)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                      verificationStatus === opt.key
                        ? `bg-${opt.color}-500/10 border-${opt.color}-500/30 text-${opt.color}-400`
                        : "bg-slate-950/40 border-slate-800 text-slate-600 hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full border-2 ${verificationStatus === opt.key ? `bg-${opt.color}-500 border-${opt.color}-500` : "border-slate-700"}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Root Cause */}
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Root Cause / Containment</label>
              <textarea
                rows={6}
                placeholder="Describe root cause and containment actions..."
                className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl p-5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-800 resize-none"
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
              />
            </div>

            {/* Due / Responsible */}
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Due / Responsible</label>
              <textarea
                rows={6}
                placeholder="Responsible person and due date..."
                className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl p-5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-800 resize-none"
                value={dueResponsible}
                onChange={(e) => setDueResponsible(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Section 6: Signatures ─────────────────────────────────────────── */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <User className="w-5 h-5 text-slate-400" />
            <h3 className="text-white font-black text-xs uppercase tracking-widest">Signatures</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { title: "Production Manager", sigKey: "production_manager_signature" as const, dateKey: "production_manager_date" as const },
              { title: "QC Manager",         sigKey: "qc_manager_signature"         as const, dateKey: "qc_manager_date"         as const },
              { title: "Auditor / Inspector", sigKey: "auditor_signature"           as const, dateKey: "auditor_date"            as const },
            ].map((s) => (
              <div key={s.sigKey} className="space-y-6 border border-slate-800 rounded-3xl p-8">
                <p className="text-[9px] font-black text-violet-400 uppercase tracking-[0.2em]">{s.title}</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Signature</label>
                    <input
                      type="text"
                      placeholder="Full name as signature"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-800"
                      value={signatures[s.sigKey]}
                      onChange={(e) => setSignatures({ ...signatures, [s.sigKey]: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Date / Time
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      value={signatures[s.dateKey]}
                      onChange={(e) => setSignatures({ ...signatures, [s.dateKey]: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ReportCanvas>

      {/* Attachments */}
      <AttachmentPanel
        reportId={editId || undefined}
        pendingFiles={pendingFiles}
        onPendingChange={setPendingFiles}
      />

      {/* Final Submit */}
      <div className="flex justify-end mt-10">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-14 py-5 rounded-full text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center gap-4 ${
            saving
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_40px_rgba(124,58,237,0.35)] hover:shadow-[0_0_60px_rgba(124,58,237,0.5)] hover:-translate-y-1"
          }`}
        >
          {saving ? "Processing..." : (
            <>{editId ? "Update Report" : "Submit Report"} <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </ReportWorkspace>
  );
}
