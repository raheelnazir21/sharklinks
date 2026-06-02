"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { Building2, Layers, Plus, Trash2, ChevronRight } from "lucide-react";
import { ReportCanvas, ReportToolbar, ReportWorkspace } from "@/components/qc/ReportUI";
import AttachmentPanel from "@/components/qc/AttachmentPanel";

type Fault = { id: string; code: string; name: string; section: "fabric" | "stitching" | "finishing" };
type AuditRow = {
  batch_number: string;
  batch_quantity: number;
  sample_size: number;
  fault_counts: Record<string, number>;
  aql_accept: number;
  aql_reject: number;
  result: string;
  remarks: string;
};
type VendorLine = { id: string; name: string };
type VendorFloor = { id: string; name: string; lines?: VendorLine[] };
type Vendor = { id: string; name: string };
type HeaderState = {
  vendor_id: string;
  floor_id: string;
  line_id: string;
  report_date: string;
  issue_date: string;
  unit_number: string;
  stm: string;
  style_no: string;
  customer: string;
  product_name: string;
  product_color: string;
  auditor_number: string;
  shift: string;
  qc_name: string;
  department: string;
  inspection_level: string;
  aql_critical: string;
  aql_major: string;
  zero_tolerance: string;
  first_pass_qty: number;
  second_pass_qty: number;
  remarks: string;
};
type HeaderKey = keyof HeaderState;

const SECTION_LABELS = {
  fabric: "Fabric",
  stitching: "Stitching",
  finishing: "Finishing",
};

const DEFAULT_FAULT_LIBRARY: Fault[] = [
  { id: "f300", code: "300", name: "Knit Hole", section: "fabric" },
  { id: "f849", code: "849", name: "Yarn Variation", section: "fabric" },
  { id: "f302", code: "302", name: "Heavy Yarn Barre", section: "fabric" },
  { id: "f830", code: "830", name: "Slub", section: "fabric" },
  { id: "f312", code: "312", name: "Thick or Thin / Off Size Yarn", section: "fabric" },
  { id: "f313", code: "313", name: "Compactor / Calender Mark", section: "fabric" },
  { id: "f832", code: "832", name: "Lint Contamination", section: "fabric" },
  { id: "f371", code: "371", name: "Needle Line", section: "fabric" },
  { id: "f332", code: "332", name: "Improper Raising", section: "fabric" },
  { id: "f392", code: "392", name: "Lycra Short", section: "fabric" },
  { id: "f334", code: "334", name: "Blotchy / Yellow", section: "fabric" },
  { id: "f391", code: "391", name: "Pilling", section: "fabric" },
  { id: "f303", code: "303", name: "Multiple Bird Eye", section: "fabric" },
  { id: "f613", code: "613", name: "Creases", section: "fabric" },
  { id: "f859", code: "859", name: "Dye Patches", section: "fabric" },
  { id: "f857", code: "857", name: "Pencil Mark", section: "fabric" },
  { id: "s525", code: "525", name: "Incorrect Operation", section: "stitching" },
  { id: "s528", code: "528", name: "Puckered Seam", section: "stitching" },
  { id: "s533", code: "533", name: "Improper Repair", section: "stitching" },
  { id: "s852", code: "852", name: "Graining", section: "stitching" },
  { id: "s535", code: "535", name: "Label Incorrect / Miss / Defective", section: "stitching" },
  { id: "s538", code: "538", name: "Uneven / Crooked Seam", section: "stitching" },
  { id: "s815", code: "815", name: "Joint Out", section: "stitching" },
  { id: "s623", code: "623", name: "Side Seam Twisted", section: "stitching" },
  { id: "s548", code: "548", name: "Loose Stitches", section: "stitching" },
  { id: "s582", code: "582", name: "Button Not Secure", section: "stitching" },
  { id: "s625", code: "625", name: "Incorrect Drawcard Length", section: "stitching" },
  { id: "s634", code: "634", name: "Faulty Stitching", section: "stitching" },
  { id: "s667", code: "667", name: "Wrong Label", section: "stitching" },
  { id: "s820", code: "820", name: "Label Center Out", section: "stitching" },
  { id: "s823", code: "823", name: "Slanted Label", section: "stitching" },
  { id: "s717", code: "717", name: "All Measurements Wrong Size", section: "stitching" },
  { id: "n307", code: "307", name: "Color Spot", section: "finishing" },
  { id: "n316", code: "316", name: "Defective Printing", section: "finishing" },
  { id: "n317", code: "317", name: "Oil Spot", section: "finishing" },
  { id: "n831", code: "831", name: "Soil / Dust Spot", section: "finishing" },
  { id: "n335", code: "335", name: "Rust Spot", section: "finishing" },
  { id: "n803", code: "803", name: "Gum Spot", section: "finishing" },
  { id: "n614", code: "614", name: "Missing Print", section: "finishing" },
  { id: "n619", code: "619", name: "Embroidery Misplaced", section: "finishing" },
  { id: "n396", code: "396", name: "Washed Garments if not Req.", section: "finishing" },
  { id: "n804", code: "804", name: "Poor Press / Presentation", section: "finishing" },
  { id: "n805", code: "805", name: "Hang / Uncut Thread", section: "finishing" },
  { id: "n306", code: "306", name: "Bowing / Skewing", section: "finishing" },
  { id: "n603", code: "603", name: "Wrong Print", section: "finishing" },
  { id: "n305", code: "305", name: "Pin Hole", section: "finishing" },
];

const DEFAULT_COLUMNS = DEFAULT_FAULT_LIBRARY.slice(0, 6);
const emptyRow = (): AuditRow => ({
  batch_number: "",
  batch_quantity: 0,
  sample_size: 0,
  fault_counts: {},
  aql_accept: 0,
  aql_reject: 0,
  result: "",
  remarks: "",
});

function pct(part: number, total: number) {
  return total ? Number(((part / total) * 100).toFixed(2)) : 0;
}

function getAQL(lotSize: number) {
  if (lotSize <= 0) return { sample: 0, ac: 0, re: 0 };
  if (lotSize <= 50) return { sample: 13, ac: 0, re: 1 };
  if (lotSize <= 90) return { sample: 20, ac: 1, re: 2 };
  if (lotSize <= 150) return { sample: 32, ac: 1, re: 2 };
  if (lotSize <= 280) return { sample: 50, ac: 2, re: 3 };
  if (lotSize <= 500) return { sample: 80, ac: 3, re: 4 };
  if (lotSize <= 1200) return { sample: 125, ac: 5, re: 6 };
  return { sample: 200, ac: 7, re: 8 };
}

function qualityTone(dhu: number) {
  if (dhu > 10) return {
    panel: "border-red-200 bg-red-50",
    label: "text-red-700",
    value: "text-red-700",
    recommendation: "High defect rate - immediate review",
  };
  if (dhu > 5) return {
    panel: "border-amber-200 bg-amber-50",
    label: "text-amber-700",
    value: "text-amber-700",
    recommendation: "Watch closely - needs correction",
  };
  return {
    panel: "border-emerald-200 bg-emerald-50",
    label: "text-emerald-700",
    value: "text-emerald-700",
    recommendation: "Good quality level",
  };
}

export default function BatchAuditReportPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const newFaultIndex = useRef(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [floors, setFloors] = useState<VendorFloor[]>([]);
  const [faultLibrary, setFaultLibrary] = useState<Fault[]>(DEFAULT_FAULT_LIBRARY);
  const [faultColumns, setFaultColumns] = useState<Fault[]>(DEFAULT_COLUMNS);
  const [showFaultMaster, setShowFaultMaster] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>(Array.from({ length: 10 }, emptyRow));
  const [header, setHeader] = useState<HeaderState>({
    vendor_id: "",
    floor_id: "",
    line_id: "",
    report_date: new Date().toISOString().slice(0, 10),
    issue_date: "",
    unit_number: "",
    stm: "",
    style_no: "",
    customer: "",
    product_name: "",
    product_color: "",
    auditor_number: "",
    shift: "Day Shift",
    qc_name: "",
    department: "FINISHING",
    inspection_level: "II",
    aql_critical: "Zero Tolerance",
    aql_major: "2.5",
    zero_tolerance: "Critical",
    first_pass_qty: 0,
    second_pass_qty: 0,
    remarks: "",
  });

  useEffect(() => {
    api.get("/vendors/").then((res) => setVendors(res.data.data || []));
  }, []);

  useEffect(() => {
    const reportId = new URLSearchParams(window.location.search).get("edit");
    if (!reportId) return;
    api.get(`/advanced-qc/batch-audit/${reportId}`).then((res) => {
      const data = res.data.data;
      setEditId(reportId);
      setHeader((prev) => ({ ...prev, ...data, issue_date: data.issue_date || "" }));
      setFaultLibrary(data.fault_library || []);
      setFaultColumns(data.fault_columns || []);
      setRows(data.rows || []);
    }).catch(() => alert("Failed to load Batch Audit report."));
  }, []);

  useEffect(() => {
    if (header.vendor_id) {
      api.get(`/vendors/${header.vendor_id}/floors`).then((res) => setFloors(res.data.data || []));
    }
  }, [header.vendor_id]);

  const lines = useMemo(() => floors.find((item) => item.id === header.floor_id)?.lines || [], [header.floor_id, floors]);

  const totals = useMemo(() => {
    const totalQuantity = rows.reduce((sum, row) => sum + (Number(row.batch_quantity) || 0), 0);
    const sampleQty = rows.reduce((sum, row) => sum + (Number(row.sample_size) || 0), 0);
    const totalFaults = rows.reduce((sum, row) => sum + faultColumns.reduce((inner, fault) => inner + (Number(row.fault_counts[fault.id]) || 0), 0), 0);
    return {
      totalQuantity,
      sampleQty,
      totalFaults,
      oqi: pct(totalFaults, sampleQty),
      fpy: pct(Number(header.first_pass_qty) || 0, totalQuantity),
    };
  }, [rows, faultColumns, header.first_pass_qty]);

  const topFaults = useMemo(() => {
    return faultColumns
      .map((fault) => ({
        ...fault,
        count: rows.reduce((sum, row) => sum + (Number(row.fault_counts[fault.id]) || 0), 0),
      }))
      .filter((fault) => fault.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [faultColumns, rows]);

  const aqlData = useMemo(() => getAQL(totals.totalQuantity || totals.sampleQty), [totals.totalQuantity, totals.sampleQty]);
  const aqlResult = totals.totalFaults <= aqlData.ac ? "PASS" : "FAIL";
  const batchQualityTone = qualityTone(totals.oqi);

  const setRow = (index: number, patch: Partial<AuditRow>) => {
    setRows((prev) => prev.map((row, idx) => idx === index ? { ...row, ...patch } : row));
  };

  const setFaultCount = (rowIndex: number, faultId: string, value: string) => {
    setRows((prev) => prev.map((row, idx) => idx === rowIndex ? {
      ...row,
      fault_counts: { ...row.fault_counts, [faultId]: Number(value) || 0 },
    } : row));
  };

  const updateLibraryFault = (id: string, patch: Partial<Fault>) => {
    setFaultLibrary((prev) => prev.map((fault) => fault.id === id ? { ...fault, ...patch } : fault));
    setFaultColumns((prev) => prev.map((fault) => fault.id === id ? { ...fault, ...patch } : fault));
  };

  const addLibraryFault = (section: Fault["section"]) => {
    newFaultIndex.current += 1;
    const fault = { id: `${section}_${newFaultIndex.current}`, code: "", name: "New Fault", section };
    setFaultLibrary((prev) => [...prev, fault]);
  };

  const toggleFaultColumn = (fault: Fault) => {
    setFaultColumns((prev) => prev.some((item) => item.id === fault.id) ? prev.filter((item) => item.id !== fault.id) : [...prev, fault]);
  };

  const handleSave = async () => {
    if (!header.vendor_id || !header.floor_id || !header.line_id) {
      alert("Please select Vendor, Floor and Line.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...header,
        issue_date: header.issue_date || null,
        first_pass_qty: Number(header.first_pass_qty) || 0,
        second_pass_qty: Number(header.second_pass_qty) || 0,
        fault_library: faultLibrary,
        fault_columns: faultColumns,
        rows: rows.map((row) => ({
          ...row,
          batch_quantity: Number(row.batch_quantity) || 0,
          sample_size: Number(row.sample_size) || 0,
          aql_accept: Number(row.aql_accept) || 0,
          aql_reject: Number(row.aql_reject) || 0,
        })),
      };
      const res = editId
        ? await api.put(`/advanced-qc/batch-audit/${editId}`, payload)
        : await api.post("/advanced-qc/batch-audit/", payload);
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
      let errorMsg = "Failed to save batch audit report.";
      const detail = err?.response?.data?.detail;
      const message = err?.response?.data?.message;
      if (message) {
        errorMsg = typeof message === 'string' ? message : JSON.stringify(message);
      } else if (detail) {
        if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (Array.isArray(detail)) {
          try {
            errorMsg = detail.map((d: any) => {
              const field = d.loc ? d.loc[d.loc.length - 1] : "field";
              return `${field}: ${d.msg}`;
            }).join("\n");
          } catch {
            errorMsg = JSON.stringify(detail);
          }
        } else {
          errorMsg = JSON.stringify(detail);
        }
      } else if (err?.message) {
        errorMsg = err.message;
      }
      alert(`Failed: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReportWorkspace maxWidth="max-w-[1900px]">
      <ReportToolbar
        title="QA Batch Audit Report"
        subtitle="Finishing batch audit with editable fault master"
        meta="Quality Audit"
        onSave={handleSave}
        saving={saving}
        saveLabel={editId ? "Update Report" : "Submit Report"}
      />

        <div className="bg-white text-gray-950 rounded-2xl border border-slate-200 p-4 shadow-xl print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Fault Defaults</h2>
              <p className="text-xs text-gray-500 font-bold mt-1">Generic editable fault master for this audit layout. Add selected faults into the table columns.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["fabric", "stitching", "finishing"] as const).map((section) => (
                <button key={section} type="button" onClick={() => addLibraryFault(section)} className="inline-flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase">
                  <Plus className="w-3.5 h-3.5" /> Add {SECTION_LABELS[section]} Fault
                </button>
              ))}
              <button type="button" onClick={() => setShowFaultMaster((value) => !value)} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase">
                {showFaultMaster ? "Hide Defaults" : "Edit Defaults"}
              </button>
            </div>
          </div>

          {showFaultMaster && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
              {(["fabric", "stitching", "finishing"] as const).map((section) => (
                <div key={section} className="border border-gray-300 rounded-xl overflow-hidden">
                  <div className="bg-gray-100 border-b border-gray-300 text-center py-2 font-black uppercase">{SECTION_LABELS[section]}</div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {faultLibrary.filter((fault) => fault.section === section).map((fault) => (
                      <div key={fault.id} className="grid grid-cols-[72px_1fr_60px] border-b border-gray-200 last:border-b-0">
                        <input className="px-2 py-2 text-xs text-center font-black outline-none border-r border-gray-200" value={fault.code} onChange={(e) => updateLibraryFault(fault.id, { code: e.target.value })} />
                        <input className="px-2 py-2 text-xs outline-none border-r border-gray-200" value={fault.name} onChange={(e) => updateLibraryFault(fault.id, { name: e.target.value })} />
                        <button type="button" onClick={() => toggleFaultColumn(fault)} className={`text-[9px] font-black ${faultColumns.some((item) => item.id === fault.id) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                          {faultColumns.some((item) => item.id === fault.id) ? "USED" : "ADD"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ReportCanvas>
          <div className="grid grid-cols-[1fr_160px_180px] border border-gray-900">
            <h2 className="py-3 text-center text-xl font-black">Finishing Batch Audit</h2>
            <div className="border-l border-gray-900 py-3 text-center font-black">Date of Issue</div>
            <input type="date" className="border-l border-gray-900 text-center font-black outline-none" value={header.issue_date} onChange={(e) => setHeader((p) => ({ ...p, issue_date: e.target.value }))} />
          </div>

          <div className="border-x border-gray-900">
            <div className="grid grid-cols-5 border-b border-gray-300">
              {[
                ["Unit #", "unit_number"],
                ["STM #", "stm"],
                ["Style", "style_no"],
                ["Customer", "customer"],
                ["Date", "report_date"],
              ].map(([label, key]) => (
                <div key={key} className="flex border-r border-gray-300 last:border-r-0">
                  <span className="px-3 py-3 font-black text-xs min-w-[88px]">{label} {['style_no', 'report_date', 'unit_number', 'stm'].includes(key) && <span className="text-rose-500">*</span>} :</span>
                  <input type={key === "report_date" ? "date" : "text"} className="flex-1 min-w-0 px-2 py-3 text-xs font-black outline-none" value={header[key as HeaderKey]} onChange={(e) => setHeader((p) => ({ ...p, [key as HeaderKey]: e.target.value }))} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 border-b border-gray-300">
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-3 font-black text-xs min-w-[92px]">Vendor <span className="text-rose-500">*</span> :</span>
                <select className="flex-1 px-2 py-3 text-xs font-black outline-none bg-transparent" value={header.vendor_id} onChange={(e) => {
                  setFloors([]);
                  setHeader((p) => ({ ...p, vendor_id: e.target.value, floor_id: "", line_id: "" }));
                }}>
                  <option value="">Select Vendor</option>
                  {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
              </div>
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-3 font-black text-xs min-w-[92px] flex items-center gap-2"><Building2 size={12}/> Floor <span className="text-rose-500">*</span> :</span>
                <select className="flex-1 px-2 py-3 text-xs font-black outline-none bg-transparent" value={header.floor_id} onChange={(e) => setHeader((p) => ({ ...p, floor_id: e.target.value, line_id: "" }))}>
                  <option value="">Select Floor</option>
                  {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                </select>
              </div>
              <div className="flex">
                <span className="px-3 py-3 font-black text-xs min-w-[92px] flex items-center gap-2"><Layers size={12}/> Line <span className="text-rose-500">*</span> :</span>
                <select className="flex-1 px-2 py-3 text-xs font-black outline-none bg-transparent" value={header.line_id} onChange={(e) => setHeader((p) => ({ ...p, line_id: e.target.value }))}>
                  <option value="">Select Line</option>
                  {lines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 border-b border-gray-300">
              {[
                ["Color", "product_color"],
                ["Product", "product_name"],
                ["Auditor #", "auditor_number"],
                ["QC Name", "qc_name"],
              ].map(([label, key]) => (
                <div key={key} className="flex border-r border-gray-300 last:border-r-0">
                  <span className="px-3 py-3 font-black text-xs min-w-[96px]">{label} {['qc_name', 'product_color', 'product_name'].includes(key) && <span className="text-rose-500">*</span>} :</span>
                  <input className="flex-1 min-w-0 px-2 py-3 text-xs font-black outline-none" value={header[key as HeaderKey]} onChange={(e) => setHeader((p) => ({ ...p, [key as HeaderKey]: e.target.value }))} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 border-b-2 border-gray-900">
              {[
                ["Inspection Level", "inspection_level"],
                ["AQL-Critical", "aql_critical"],
                ["Zero Tolerance", "zero_tolerance"],
                ["AQL-Major", "aql_major"],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center border-r border-gray-900 last:border-r-0">
                  <span className="px-3 py-3 font-black text-xs">{label}</span>
                  <input className="flex-1 min-w-0 px-2 py-3 text-xs text-center outline-none" value={header[key as HeaderKey]} onChange={(e) => setHeader((p) => ({ ...p, [key as HeaderKey]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-900">
            <table className="w-full min-w-[1500px] border-collapse text-center">
              <thead className="bg-slate-50 text-slate-950">
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-gray-900 px-2 py-3 text-xs">Batch #</th>
                  <th rowSpan={2} className="border border-gray-900 px-2 py-3 text-xs">Batch Quantity</th>
                  <th rowSpan={2} className="border border-gray-900 px-2 py-3 text-xs">Sample Size</th>
                  <th colSpan={faultColumns.length || 1} className="border border-gray-900 px-2 py-2 text-xs">Faults</th>
                  <th rowSpan={2} className="border border-gray-900 px-2 py-3 text-xs">Total Faults</th>
                  <th colSpan={2} className="border border-gray-900 px-2 py-2 text-xs">AQL</th>
                  <th rowSpan={2} className="border border-gray-900 px-2 py-3 text-xs">Result</th>
                  <th rowSpan={2} className="border border-gray-900 px-2 py-3 text-xs">Remarks</th>
                  <th rowSpan={2} className="border border-gray-900 px-2 py-3"></th>
                </tr>
                <tr>
                  {faultColumns.length ? faultColumns.map((fault) => (
                    <th key={fault.id} className="border border-gray-900 px-1 py-2">
                      <div className="text-[9px] font-black">{fault.code}</div>
                      <div className="text-[9px]">{fault.name}</div>
                    </th>
                  )) : <th className="border border-gray-900 text-[10px]">Select faults below</th>}
                  <th className="border border-gray-900 text-xs">Acp</th>
                  <th className="border border-gray-900 text-xs">Rej</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const rowFaults = faultColumns.reduce((sum, fault) => sum + (Number(row.fault_counts[fault.id]) || 0), 0);
                  return (
                    <tr key={rowIndex}>
                      <td className="border border-gray-400 p-1"><input className="w-full text-center text-xs outline-none" value={row.batch_number} onChange={(e) => setRow(rowIndex, { batch_number: e.target.value })} /></td>
                      <td className="border border-gray-400 p-1"><input type="number" className="w-full text-center text-xs outline-none" value={row.batch_quantity || ""} onChange={(e) => setRow(rowIndex, { batch_quantity: Number(e.target.value) || 0 })} /></td>
                      <td className="border border-gray-400 p-1"><input type="number" className="w-full text-center text-xs outline-none" value={row.sample_size || ""} onChange={(e) => setRow(rowIndex, { sample_size: Number(e.target.value) || 0 })} /></td>
                      {faultColumns.length ? faultColumns.map((fault) => (
                        <td key={fault.id} className="border border-gray-400 p-1">
                          <input type="number" min="0" className="w-full text-center text-xs outline-none" value={row.fault_counts[fault.id] || ""} onChange={(e) => setFaultCount(rowIndex, fault.id, e.target.value)} />
                        </td>
                      )) : <td className="border border-gray-400"></td>}
                      <td className="border border-gray-900 text-xs font-black">{rowFaults}</td>
                      <td className="border border-gray-400 p-1"><input type="number" className="w-full text-center text-xs outline-none" value={row.aql_accept || ""} onChange={(e) => setRow(rowIndex, { aql_accept: Number(e.target.value) || 0 })} /></td>
                      <td className="border border-gray-400 p-1"><input type="number" className="w-full text-center text-xs outline-none" value={row.aql_reject || ""} onChange={(e) => setRow(rowIndex, { aql_reject: Number(e.target.value) || 0 })} /></td>
                      <td className="border border-gray-400 p-1"><input className="w-full text-center text-xs outline-none" value={row.result} onChange={(e) => setRow(rowIndex, { result: e.target.value })} /></td>
                      <td className="border border-gray-400 p-1"><input className="w-full text-center text-xs outline-none" value={row.remarks} onChange={(e) => setRow(rowIndex, { remarks: e.target.value })} /></td>
                      <td className="border border-gray-400"><button type="button" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== rowIndex))} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="border border-gray-900 py-3 font-black">Grand Total</td>
                  <td className="border border-gray-900 font-black">{totals.totalQuantity}</td>
                  <td className="border border-gray-900 font-black">{totals.sampleQty}</td>
                  <td colSpan={Math.max(faultColumns.length, 1)} className="border border-gray-900 font-black">Total Faults: {totals.totalFaults}</td>
                  <td className="border border-gray-900 font-black">{totals.totalFaults}</td>
                  <td colSpan={2} className="border border-gray-900 font-black">O.Q.I %: {totals.oqi}%</td>
                  <td colSpan={3} className="border border-gray-900 font-black">F.P.Y %: {totals.fpy}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 border-x border-b border-gray-900 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase">
              <Plus className="w-4 h-4" /> Add Batch Row
            </button>
            <div className="flex gap-5 text-xs font-black">
              <label>First Pass QTY <input type="number" className="ml-2 w-24 border-b border-gray-500 outline-none text-center" value={header.first_pass_qty || ""} onChange={(e) => setHeader((p) => ({ ...p, first_pass_qty: Number(e.target.value) || 0 }))} /></label>
              <label>Second Pass QTY <input type="number" className="ml-2 w-24 border-b border-gray-500 outline-none text-center" value={header.second_pass_qty || ""} onChange={(e) => setHeader((p) => ({ ...p, second_pass_qty: Number(e.target.value) || 0 }))} /></label>
              <span>Total QTY: {totals.totalQuantity}</span>
            </div>
          </div>
        </ReportCanvas>

        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 bg-white text-gray-950 rounded-2xl border border-slate-200 p-4 shadow-xl print:shadow-none">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: "Total Checked", value: totals.sampleQty, className: "border-sky-200 bg-sky-50", labelClass: "text-sky-700", valueClass: "text-sky-800" },
              { label: "Total Defects", value: totals.totalFaults, className: "border-rose-200 bg-rose-50", labelClass: "text-rose-700", valueClass: "text-rose-800" },
              { label: "DHU %", value: `${totals.oqi}%`, className: batchQualityTone.panel, labelClass: batchQualityTone.label, valueClass: batchQualityTone.value },
              { label: " AQL Sample", value: aqlData.sample, className: "border-indigo-200 bg-indigo-50", labelClass: "text-indigo-700", valueClass: "text-indigo-800" },
              { label: "AC / RE", value: `${aqlData.ac} / ${aqlData.re}`, className: "border-slate-200 bg-slate-50", labelClass: "text-slate-600", valueClass: "text-slate-900" },
              { label: "AQL Result", value: aqlResult, className: aqlResult === "PASS" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50", labelClass: aqlResult === "PASS" ? "text-emerald-700" : "text-red-700", valueClass: aqlResult === "PASS" ? "text-emerald-700" : "text-red-700" },
            ].map((item) => (
              <div key={item.label} className={`border rounded-lg p-3 ${item.className}`}>
                <p className={`text-[9px] font-black uppercase ${item.labelClass}`}>{item.label}</p>
                <p className={`text-xl font-black mt-1 ${item.valueClass}`}>{item.value}</p>
              </div>
            ))}
            <div className="md:col-span-3 border border-gray-200 rounded-lg p-3 bg-white">
              <p className="text-[9px] font-black uppercase text-gray-500">Recommendation</p>
              <p className={`text-xs font-black mt-1 ${batchQualityTone.value}`}>{batchQualityTone.recommendation}</p>
            </div>
          </div>
          <div className="border border-gray-300 rounded-lg bg-white p-3 min-h-[150px]">
            <h3 className="text-[10px] font-black uppercase tracking-widest mb-2">Top 5 Defects</h3>
            {topFaults.length ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {topFaults.map((fault) => (
                  <div key={fault.id} className="border border-gray-200 rounded-lg px-3 py-2">
                    <p className="text-[9px] font-black text-gray-500">{fault.code || fault.section.toUpperCase()}</p>
                    <p className="text-xs font-black truncate">{fault.name}</p>
                    <p className="text-lg font-black text-indigo-600">{fault.count}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-gray-500">No defect counts entered yet.</p>
            )}
          </div>
        </div>

        <AttachmentPanel
          reportId={editId || undefined}
          pendingFiles={pendingFiles}
          onPendingChange={setPendingFiles}
        />

        {/* Independent Submit Button */}
        <div className="flex justify-end mt-10">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-12 py-5 rounded-full text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center gap-4 ${
              saving 
                ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] hover:-translate-y-1"
            }`}
          >
            {saving ? (
              <>Processing...</>
            ) : (
              <>
                {editId ? "Update Report" : "Submit Report"} <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
    </ReportWorkspace>
  );
}
