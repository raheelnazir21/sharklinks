"use client";
import React, { Suspense, useState, useEffect, useCallback } from "react";
import api from "@/services/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, Building2, Layers, Settings2, ChevronRight } from "lucide-react";
import { ReportCanvas, ReportToolbar, ReportWorkspace } from "@/components/qc/ReportUI";
import AttachmentPanel from "@/components/qc/AttachmentPanel";

const DEFAULT_HOURS = [
  "09:00 - 10:00","10:00 - 11:00","11:00 - 12:00",
  "12:00 - 13:00","13:00 - 14:00","14:00 - 15:00",
  "15:00 - 16:00","16:00 - 17:00",
];

function calcDHU(defects: number, pcs: number) {
  if (!pcs) return 0;
  return parseFloat(((defects / pcs) * 100).toFixed(2));
}

function getAQL(lotSize: number, aql: number = 2.5) {
  if (lotSize <= 0) return { sample: 0, ac: 0, re: 0 };
  if (lotSize <= 50) return { sample: 13, ac: 0, re: 1 };
  if (lotSize <= 90) return { sample: 20, ac: 1, re: 2 };
  if (lotSize <= 150) return { sample: 32, ac: 1, re: 2 };
  if (lotSize <= 280) return { sample: 50, ac: 2, re: 3 };
  if (lotSize <= 500) return { sample: 80, ac: 3, re: 4 };
  if (lotSize <= 1200) return { sample: 125, ac: 5, re: 6 };
  return { sample: 200, ac: 7, re: 8 };
}

function getNextHourSlot(rows: { hour: string }[]) {
  const last = rows[rows.length - 1]?.hour || "09:00 - 10:00";
  const end = last.split("-").pop()?.trim() || "10:00";
  const [hourText, minuteText = "00"] = end.split(":");
  const hour = Number(hourText) || 0;
  const nextHour = hour + 1;
  const format = (h: number) => `${String(h).padStart(2, "0")}:${minuteText.padStart(2, "0")}`;
  return `${end} - ${format(nextHour)}`;
}

export default function FinishEndlineQCPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white font-black uppercase tracking-widest">Loading report...</div>}>
      <FinishEndlineQCContent />
    </Suspense>
  );
}

function FinishEndlineQCContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportType = searchParams.get("type") || "finish";
  const editId = searchParams.get("edit");
  const isEndline = reportType === "endline";

  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  // Master Data
  const [vendors, setVendors] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);

  const [header, setHeader] = useState({
    vendor_id: "", floor_id: "", line_id: "",
    style_no: "", po_number: "", article_code: "", product_color: "", shift: "Day Shift", line: "",
    qc_name: "", department: isEndline ? "STITCHING (ENDLINE)" : "FINISHING",
    inspection_level: "II", aql_standard: 2.5,
    report_date: new Date().toISOString().slice(0, 10),
    remarks: "", prepared_by: "", checked_by: "",
  });

  const [defectCols, setDefectCols] = useState([
    { id: "d1", name: "Open Stitch" },
    { id: "d2", name: "Skip Stitch" },
    { id: "d3", name: "Needle Hole" },
  ]);

  type RowData = { hour: string; pcs: number; defects: Record<string, number> };
  const [rows, setRows] = useState<RowData[]>(
    DEFAULT_HOURS.map(h => ({ hour: h, pcs: 0, defects: {} }))
  );

  // Load Vendors
  useEffect(() => {
    api.get("/vendors/").then(res => setVendors(res.data.data));
  }, []);

  useEffect(() => {
    if (!editId) return;
    api.get(`/advanced-qc/finish-endline/${editId}`).then((res) => {
      const data = res.data.data;
      setHeader((prev) => ({ ...prev, ...data }));
      setDefectCols(data.defect_columns || []);
      setRows((data.hourly_rows || []).map((row: any) => ({
        hour: row.hour_slot,
        pcs: row.total_pcs,
        defects: row.defect_counts || {},
      })));
    }).catch(() => alert("Failed to load Finish/Endline QC report."));
  }, [editId]);

  // Load Floors when Vendor changes
  useEffect(() => {
    if (header.vendor_id) {
      api.get(`/vendors/${header.vendor_id}/floors`).then(res => setFloors(res.data.data));
    } else {
      setFloors([]);
      setLines([]);
    }
  }, [header.vendor_id]);

  // Load Lines when Floor changes
  useEffect(() => {
    if (header.floor_id) {
      const selectedFloor = floors.find(f => f.id === header.floor_id);
      setLines(selectedFloor?.lines || []);
    } else {
      setLines([]);
    }
  }, [header.floor_id, floors]);

  const updateRow = (idx: number, field: string, val: any) => {
    setRows(prev => {
      const next = [...prev];
      if (field === "pcs") next[idx] = { ...next[idx], pcs: Number(val) || 0 };
      else next[idx] = { ...next[idx], defects: { ...next[idx].defects, [field]: Number(val) || 0 } };
      return next;
    });
  };

  const addHourRow = () => {
    setRows(prev => [...prev, { hour: getNextHourSlot(prev), pcs: 0, defects: {} }]);
  };

  const addDefectCol = () => {
    const id = `d${Date.now()}`;
    setDefectCols(p => [...p, { id, name: "New Defect" }]);
  };

  const removeDefectCol = (id: string) => {
    setDefectCols(p => p.filter(d => d.id !== id));
    setRows(p => p.map(r => { const d = { ...r.defects }; delete d[id]; return { ...r, defects: d }; }));
  };

  const updateColName = (id: string, name: string) =>
    setDefectCols(p => p.map(d => d.id === id ? { ...d, name } : d));

  // Computed totals
  const rowTotals = rows.map(r => ({
    total: Object.values(r.defects).reduce((a, b) => a + b, 0),
    dhu: calcDHU(Object.values(r.defects).reduce((a, b) => a + b, 0), r.pcs),
  }));

  const colTotals = defectCols.reduce((acc, col) => {
    acc[col.id] = rows.reduce((s, r) => s + (r.defects[col.id] || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  const grandPcs = rows.reduce((s, r) => s + r.pcs, 0);
  const grandDefects = rows.reduce((s, r) => s + Object.values(r.defects).reduce((a, b) => a + b, 0), 0);
  const grandDHU = calcDHU(grandDefects, grandPcs);
  const aqlData = getAQL(grandPcs, header.aql_standard);
  const aqlResult = grandDefects <= aqlData.ac ? "PASS" : "FAIL";

  const handleSave = async () => {
    if (!header.vendor_id || !header.floor_id) {
      alert("Please select Vendor and Floor.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        report_type: reportType,
        ...header,
        vendor_id: header.vendor_id || null,
        floor_id: header.floor_id || null,
        line_id: header.line_id || null,
        defect_columns: defectCols,
        hourly_rows: rows.map((r, i) => ({
          hour_slot: r.hour,
          total_pcs: r.pcs,
          defect_counts: r.defects,
        })),
      };
      const res = editId
        ? await api.put(`/advanced-qc/finish-endline/${editId}`, payload)
        : await api.post("/advanced-qc/finish-endline/", payload);
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
      router.push(`/qc-reports`);
    } catch (err: any) {
      let errorMsg = "Failed to save report.";
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
    } finally { setSaving(false); }
  };

  const title = isEndline ? "ENDLINE QC REPORT" : "FINISHING QC REPORT";

  return (
    <ReportWorkspace maxWidth="max-w-[1400px]">
      <ReportToolbar
        title={title}
        subtitle="Industrial QC feeding and AQL control"
        meta={isEndline ? "End Line Inspection" : "Finishing Quality"}
        onSave={handleSave}
        saving={saving}
        saveLabel={editId ? "Update Report" : "Submit Report"}
      />

      {/* Report Card */}
      <ReportCanvas title={title}>

          {/* Header Grid */}
          <div className="border border-gray-300">
            {/* Vendor & Floor Row */}
            <div className="grid grid-cols-2 border-b border-gray-300">
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-2 font-black text-[10px] uppercase bg-gray-100 border-r border-gray-300 min-w-[100px] flex items-center gap-2"><Building2 size={12}/> VENDOR <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <select className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none bg-transparent" value={header.vendor_id} onChange={e => setHeader(p => ({...p, vendor_id: e.target.value, floor_id: "", line_id: ""}))}>
                  <option value="">Select Vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="flex">
                <span className="px-3 py-2 font-black text-[10px] uppercase bg-gray-100 border-r border-gray-300 min-w-[100px] flex items-center gap-2"><Layers size={12}/> FLOOR <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <select className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none bg-transparent" value={header.floor_id} onChange={e => setHeader(p => ({...p, floor_id: e.target.value, line_id: ""}))} disabled={!header.vendor_id}>
                  <option value="">Select Floor</option>
                  {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 border-b border-gray-300">
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[100px]">STYLE <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <input className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none" value={header.style_no} onChange={e => setHeader(p => ({...p, style_no: e.target.value}))} placeholder="ST-24-101" />
              </div>
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[80px]">DATE <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <input type="date" className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none" value={header.report_date} onChange={e => setHeader(p => ({...p, report_date: e.target.value}))} />
              </div>
              <div className="flex">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[100px]">QC NAME <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <input className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none" value={header.qc_name} onChange={e => setHeader(p => ({...p, qc_name: e.target.value}))} placeholder="Ali Hassan" />
              </div>
            </div>
            <div className="grid grid-cols-3 border-b border-gray-300">
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[100px]">PO NUMBER <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <input className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none" value={header.po_number} onChange={e => setHeader(p => ({...p, po_number: e.target.value}))} placeholder="PO-45001234" />
              </div>
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[80px]">LINE <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <select className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none bg-transparent" value={header.line_id} onChange={e => setHeader(p => ({...p, line_id: e.target.value}))} disabled={!header.floor_id}>
                  <option value="">Select Line</option>
                  {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="flex">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[100px]">DEPARTMENT</span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <input className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none" value={header.department} onChange={e => setHeader(p => ({...p, department: e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 border-b border-gray-300">
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[100px]">ARTICLE <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <input className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none" value={header.article_code} onChange={e => setHeader(p => ({...p, article_code: e.target.value}))} placeholder="ART-001" />
              </div>
              <div className="flex">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[100px]">COLOR <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <input className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none" value={header.product_color} onChange={e => setHeader(p => ({...p, product_color: e.target.value}))} placeholder="Navy Blue" />
              </div>
            </div>
            <div className="grid grid-cols-3">
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[100px]">SHIFT</span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <select className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none bg-transparent" value={header.shift} onChange={e => setHeader(p => ({...p, shift: e.target.value}))}>
                  <option>Day Shift</option><option>Night Shift</option><option>Morning Shift</option>
                </select>
              </div>
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[80px]">REPORT TYPE</span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <span className="flex-1 px-1 py-2 text-xs font-black text-gray-900">{title}</span>
              </div>
              <div className="flex">
                <span className="px-3 py-2 font-black text-xs uppercase bg-gray-100 border-r border-gray-300 min-w-[100px]">INSPECTION LEVEL</span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600 mr-2">:</span>
                <select className="flex-1 px-1 py-2 text-xs font-black text-gray-900 outline-none bg-transparent" value={header.inspection_level} onChange={e => setHeader(p => ({...p, inspection_level: e.target.value}))}>
                  <option>I</option><option>II</option><option>III</option>
                </select>
              </div>
            </div>
          </div>

          {/* Defect Column Manager */}
          <div className="px-4 py-3 bg-slate-50 border-b border-gray-300 flex items-center gap-3 flex-wrap print:hidden">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Defect Columns:</span>
            {defectCols.map((col, ci) => (
              <div key={col.id} className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1">
                <input className="text-xs font-bold text-gray-800 outline-none w-28" value={col.name} onChange={e => updateColName(col.id, e.target.value)} />
                {defectCols.length > 1 && (
                  <button onClick={() => removeDefectCol(col.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addDefectCol} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase hover:bg-indigo-500 transition-all">
              <Plus className="w-3 h-3" /> Add Defect
            </button>
            <button onClick={addHourRow} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase hover:bg-emerald-500 transition-all">
              <Plus className="w-3 h-3" /> Add Hour
            </button>
          </div>

          {/* Main Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-950">
                  <th className="border border-gray-400 px-3 py-3 text-center font-black uppercase tracking-wide whitespace-nowrap" rowSpan={2}>HOURS</th>
                  <th className="border border-gray-400 px-3 py-3 text-center font-black uppercase tracking-wide whitespace-nowrap" rowSpan={2}>TOTAL PCS<br/>INSPECTED</th>
                  <th className="border border-gray-400 px-3 py-3 text-center font-black uppercase tracking-wide" colSpan={defectCols.length}>DEFECTS (ID & NAME)</th>
                  <th className="border border-gray-400 px-3 py-3 text-center font-black uppercase tracking-wide whitespace-nowrap" rowSpan={2}>TOTAL<br/>DEFECTS</th>
                  <th className="border border-gray-400 px-3 py-3 text-center font-black uppercase tracking-wide whitespace-nowrap" rowSpan={2}>DHU<br/>(Defects /<br/>Total Pcs)</th>
                </tr>
                <tr className="bg-slate-50 text-slate-950">
                  {defectCols.map((col, ci) => (
                    <th key={col.id} className="border border-gray-400 px-3 py-2 text-center font-black uppercase text-[10px] whitespace-nowrap">
                      DEFECT {ci + 1}<br/><span className="font-normal normal-case">({col.name})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const tot = rowTotals[ri];
                  const dhuColor = tot.dhu > 10 ? "text-red-600 font-black" : tot.dhu > 5 ? "text-orange-500 font-black" : "text-green-600 font-semibold";
                  return (
                    <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-700 whitespace-nowrap text-center">{row.hour}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        <input type="number" min={0} className="w-16 text-center font-black text-gray-900 outline-none bg-transparent" value={row.pcs || ""} onChange={e => updateRow(ri, "pcs", e.target.value)} placeholder="0" />
                      </td>
                      {defectCols.map(col => (
                        <td key={col.id} className="border border-gray-300 px-2 py-1 text-center">
                          <input type="number" min={0} className="w-12 text-center font-semibold text-gray-900 outline-none bg-transparent" value={row.defects[col.id] || ""} onChange={e => updateRow(ri, col.id, e.target.value)} placeholder="0" />
                        </td>
                      ))}
                      <td className="border border-gray-300 px-3 py-2 text-center font-black text-gray-900">{tot.total || "-"}</td>
                      <td className={`border border-gray-300 px-3 py-2 text-center ${dhuColor}`}>
                        {tot.total > 0 ? `${tot.total} / ${row.pcs}\n(${tot.dhu}%)` : "-"}
                      </td>
                    </tr>
                  );
                })}

                {/* Day Total Row */}
                <tr className="bg-slate-100 text-slate-950 font-black">
                  <td className="border border-gray-400 px-3 py-3 text-center uppercase tracking-widest">DAY TOTAL</td>
                  <td className="border border-gray-400 px-3 py-3 text-center text-lg">{grandPcs}</td>
                  {defectCols.map(col => (
                    <td key={col.id} className="border border-gray-400 px-3 py-3 text-center text-base">{colTotals[col.id] || 0}</td>
                  ))}
                  <td className="border border-gray-400 px-3 py-3 text-center text-lg">{grandDefects}</td>
                  <td className="border border-gray-400 px-3 py-3 text-center">
                    <div>{grandDefects} / {grandPcs}</div>
                    <div className={`text-sm ${grandDHU > 10 ? "text-red-600" : grandDHU > 5 ? "text-amber-600" : "text-green-600"}`}>({grandDHU}%)</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* AQL Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-gray-300">
            {[
              { label: "AQL Standard", value: `${header.aql_standard}` },
              { label: "Sample Size", value: aqlData.sample },
              { label: "Acceptance Qty (AC)", value: aqlData.ac },
              { label: "Rejection Qty (RE)", value: aqlData.re },
              { label: "Observed Defects", value: grandDefects },
              { label: "Total PCS Inspected", value: grandPcs },
              { label: "Overall DHU %", value: `${grandDHU}%` },
              { label: "AQL Result", value: aqlResult, highlight: true },
            ].map((item, i) => (
              <div key={i} className={`px-4 py-3 border border-gray-200 ${item.highlight ? (aqlResult === "PASS" ? "bg-green-50" : "bg-red-50") : "bg-gray-50"}`}>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{item.label}</p>
                <p className={`text-lg font-black mt-0.5 ${item.highlight ? (aqlResult === "PASS" ? "text-green-600" : "text-red-600") : "text-gray-900"}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Remarks & Signatures */}
          <div className="border-t border-gray-300 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-300">
            <div className="px-4 py-3 col-span-1">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">REMARKS :</p>
              <textarea rows={2} className="w-full text-xs text-gray-700 outline-none resize-none border-b border-gray-300" value={header.remarks} onChange={e => setHeader(p => ({...p, remarks: e.target.value}))} />
            </div>
            <div className="px-4 py-3">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">PREPARED BY :</p>
              <input className="w-full text-sm font-black text-gray-900 outline-none border-b border-gray-300 pb-1" value={header.prepared_by} onChange={e => setHeader(p => ({...p, prepared_by: e.target.value}))} />
            </div>
            <div className="px-4 py-3">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">CHECKED BY :</p>
              <input className="w-full text-sm font-black text-gray-900 outline-none border-b border-gray-300 pb-1" value={header.checked_by} onChange={e => setHeader(p => ({...p, checked_by: e.target.value}))} />
            </div>
          </div>
      </ReportCanvas>

        {/* AQL Info card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-slate-950 font-black text-sm uppercase tracking-widest mb-4">AQL Calculation Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Inspected", value: grandPcs, color: "blue" },
              { label: "Total Defects", value: grandDefects, color: "rose" },
              { label: "DHU %", value: `${grandDHU}%`, color: grandDHU > 10 ? "red" : grandDHU > 5 ? "amber" : "emerald" },
              { label: "AQL Result", value: aqlResult, color: aqlResult === "PASS" ? "emerald" : "red" },
            ].map((s, i) => (
              <div key={i} className={`bg-${s.color}-500/10 border border-${s.color}-500/20 rounded-xl p-4 text-center`}>
                <p className={`text-${s.color}-400 text-xs font-black uppercase tracking-widest`}>{s.label}</p>
                <p className={`text-${s.color}-300 text-2xl font-black mt-1`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <AttachmentPanel
          reportId={editId || undefined}
          pendingFiles={pendingFiles}
          onPendingChange={setPendingFiles}
        />

        {/* Independent Submit Button */}
        <div className="flex justify-end mt-10 print:hidden">
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

      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </ReportWorkspace>
  );
}
