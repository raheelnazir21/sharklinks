"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { Building2, Layers, Plus, Trash2, ChevronRight } from "lucide-react";
import { ReportCanvas, ReportToolbar, ReportWorkspace } from "@/components/qc/ReportUI";
import AttachmentPanel from "@/components/qc/AttachmentPanel";

type DefectColumn = { id: string; name: string; section: "cutting" | "printing" | "knitting" };
type CutRow = { bundle_number: string; size: string; pcs: number; defect_counts: Record<string, number> };
type VendorLine = { id: string; name: string };
type VendorFloor = { id: string; name: string; lines?: VendorLine[] };
type Vendor = { id: string; name: string };
type HeaderState = {
  vendor_id: string;
  floor_id: string;
  line_id: string;
  report_date: string;
  style_no: string;
  po_number: string;
  article_code: string;
  product_color: string;
  shift: string;
  qc_name: string;
  department: string;
  aql_standard: number;
  model_number: string;
  customer: string;
  stm: string;
  lot_number: string;
  lot_qty: number | string;
  remarks: string;
  quality_inspector: string;
  quality_supervisor: string;
  production_supervisor: string;
};
type HeaderKey = keyof HeaderState;

const SECTION_LABELS = {
  cutting: "Cutting",
  printing: "Printing & Embroidery",
  knitting: "Knitting and Dyeing",
};

const DEFAULT_DEFECTS: DefectColumn[] = [
  { id: "missing_parts", name: "Missing Parts", section: "cutting" },
  { id: "shaded_components", name: "Shaded Components", section: "cutting" },
  { id: "uneven_shape", name: "Uneven Shape", section: "cutting" },
  { id: "missing_shape", name: "Missing Shape", section: "cutting" },
  { id: "wrong_size_panel", name: "Wrong Size Panel", section: "cutting" },
  { id: "specs_out", name: "Specs Out", section: "printing" },
  { id: "slanted", name: "Slanted", section: "printing" },
  { id: "damage", name: "Damage", section: "printing" },
  { id: "placement_out", name: "Placement Out", section: "printing" },
  { id: "incorrect", name: "Incorrect", section: "printing" },
  { id: "stain", name: "Stain", section: "printing" },
  { id: "color_patch", name: "Color Patch", section: "knitting" },
  { id: "knt_line", name: "Knt.Line", section: "knitting" },
  { id: "knt_hole", name: "Knt.Hole", section: "knitting" },
  { id: "dead_cotton", name: "Dead Cotton", section: "knitting" },
  { id: "yarn_variation", name: "Yarn Variation", section: "knitting" },
  { id: "contamination", name: "Contamination", section: "knitting" },
];

const emptyRow = (): CutRow => ({ bundle_number: "", size: "", pcs: 0, defect_counts: {} });

function percent(defects: number, pcs: number) {
  return pcs ? Number(((defects / pcs) * 100).toFixed(2)) : 0;
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

function dhuTone(dhu: number) {
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

export default function NewCutPanelReportPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const newDefectIndex = useRef(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [floors, setFloors] = useState<VendorFloor[]>([]);
  const [defects, setDefects] = useState<DefectColumn[]>(DEFAULT_DEFECTS);
  const [rows, setRows] = useState<CutRow[]>(Array.from({ length: 8 }, emptyRow));
  const [header, setHeader] = useState<HeaderState>({
    vendor_id: "",
    floor_id: "",
    line_id: "",
    report_date: new Date().toISOString().slice(0, 10),
    style_no: "",
    po_number: "",
    article_code: "",
    product_color: "",
    shift: "Day Shift",
    qc_name: "",
    department: "CUTTING",
    aql_standard: 2.5,
    model_number: "",
    customer: "",
    stm: "",
    lot_number: "",
    lot_qty: 0,
    remarks: "",
    quality_inspector: "",
    quality_supervisor: "",
    production_supervisor: "",
  });

  useEffect(() => {
    api.get("/vendors/").then((res) => setVendors(res.data.data || []));
  }, []);

  useEffect(() => {
    const reportId = new URLSearchParams(window.location.search).get("edit");
    if (!reportId) return;
    api.get(`/advanced-qc/cut-panel/${reportId}`).then((res) => {
      const data = res.data.data;
      setEditId(reportId);
      setHeader((prev) => ({ ...prev, ...data }));
      setDefects(data.defect_columns || []);
      setRows(data.rows || []);
    }).catch(() => alert("Failed to load Cut Panel report."));
  }, []);

  useEffect(() => {
    if (header.vendor_id) {
      api.get(`/vendors/${header.vendor_id}/floors`).then((res) => setFloors(res.data.data || []));
    }
  }, [header.vendor_id]);

  const lines = useMemo(() => floors.find((item) => item.id === header.floor_id)?.lines || [], [header.floor_id, floors]);

  const totals = useMemo(() => {
    const columnTotals = defects.reduce((acc, defect) => ({ ...acc, [defect.id]: 0 }), {} as Record<string, number>);
    let checked = 0;
    let totalDefects = 0;
    rows.forEach((row) => {
      checked += Number(row.pcs) || 0;
      defects.forEach((defect) => {
        const count = Number(row.defect_counts[defect.id]) || 0;
        columnTotals[defect.id] += count;
        totalDefects += count;
      });
    });
    return { checked, totalDefects, columnTotals, defectPercent: percent(totalDefects, checked) };
  }, [rows, defects]);

  const aqlData = useMemo(() => getAQL(totals.checked || Number(header.lot_qty) || 0), [totals.checked, header.lot_qty]);
  const aqlResult = totals.totalDefects <= aqlData.ac ? "PASS" : "FAIL";
  const qualityTone = dhuTone(totals.defectPercent);

  const sectionSummary = useMemo(() => {
    return (["cutting", "printing", "knitting"] as const)
      .map((section) => {
        const sectionDefects = defects.filter((defect) => defect.section === section);
        const total = sectionDefects.reduce((sum, defect) => sum + (totals.columnTotals[defect.id] || 0), 0);
        const top = sectionDefects
          .map((defect) => ({ ...defect, count: totals.columnTotals[defect.id] || 0 }))
          .filter((defect) => defect.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        return {
          section,
          label: SECTION_LABELS[section],
          defectColumns: sectionDefects.length,
          total,
          dhu: percent(total, totals.checked),
          top,
        };
      })
      .filter((item) => item.defectColumns > 0);
  }, [defects, totals.checked, totals.columnTotals]);

  const setRow = (index: number, patch: Partial<CutRow>) => {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const setDefectCount = (rowIndex: number, defectId: string, value: string) => {
    setRows((prev) => prev.map((row, idx) => (
      idx === rowIndex
        ? { ...row, defect_counts: { ...row.defect_counts, [defectId]: Number(value) || 0 } }
        : row
    )));
  };

  const addDefect = (section: DefectColumn["section"]) => {
    newDefectIndex.current += 1;
    const id = `${section}_${newDefectIndex.current}`;
    setDefects((prev) => [...prev, { id, name: "New Defect", section }]);
  };

  const updateDefect = (id: string, name: string) => {
    setDefects((prev) => prev.map((defect) => defect.id === id ? { ...defect, name } : defect));
  };

  const removeDefect = (id: string) => {
    setDefects((prev) => prev.filter((defect) => defect.id !== id));
    setRows((prev) => prev.map((row) => {
      const counts = { ...row.defect_counts };
      delete counts[id];
      return { ...row, defect_counts: counts };
    }));
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
        lot_qty: Number(header.lot_qty) || 0,
        defect_columns: defects,
        rows: rows.map((row) => ({
          ...row,
          pcs: Number(row.pcs) || 0,
          defect_counts: row.defect_counts,
        })),
      };
      const res = editId
        ? await api.put(`/advanced-qc/cut-panel/${editId}`, payload)
        : await api.post("/advanced-qc/cut-panel/", payload);
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
      let errorMsg = "Failed to save cut panel report.";
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
    <ReportWorkspace maxWidth="max-w-[1800px]">
      <ReportToolbar
        title="Cut Panel Report"
        subtitle="Lot-wise cut part inspection with editable defect columns"
        meta="Production Quality"
        onSave={handleSave}
        saving={saving}
        saveLabel={editId ? "Update Report" : "Submit Report"}
      />

      <ReportCanvas title="Lot Wise Cut Part Inspection Report">

          <div className="border border-gray-300">
            <div className="grid grid-cols-2 border-b border-gray-300">
              <div className="flex border-r border-gray-300">
                <span className="px-3 py-2 font-black text-[10px] uppercase bg-gray-100 border-r border-gray-300 min-w-[110px] flex items-center gap-2"><Building2 size={12}/> Vendor <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600">:</span>
                <select className="flex-1 px-1 py-2 text-xs font-black outline-none bg-transparent" value={header.vendor_id} onChange={(e) => {
                  setFloors([]);
                  setHeader((p) => ({ ...p, vendor_id: e.target.value, floor_id: "", line_id: "" }));
                }}>
                  <option value="">Select Vendor</option>
                  {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
              </div>
              <div className="flex">
                <span className="px-3 py-2 font-black text-[10px] uppercase bg-gray-100 border-r border-gray-300 min-w-[110px] flex items-center gap-2"><Layers size={12}/> Floor <span className="text-rose-500">*</span></span>
                <span className="px-2 py-2 text-xs font-semibold text-gray-600">:</span>
                <select className="flex-1 px-1 py-2 text-xs font-black outline-none bg-transparent" value={header.floor_id} onChange={(e) => setHeader((p) => ({ ...p, floor_id: e.target.value, line_id: "" }))}>
                  <option value="">Select Floor</option>
                  {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 border-b border-gray-300">
              {[
                ["Style", "style_no", "ST-24-101"],
                ["Date", "report_date", ""],
                ["QC Name", "qc_name", "Ali Hassan"],
                ["Line", "line_id", ""],
              ].map(([label, key, placeholder]) => (
                <div key={key} className="flex border-r border-gray-300 last:border-r-0">
                  <span className="px-3 py-2 font-black text-[10px] uppercase bg-gray-100 border-r border-gray-300 min-w-[92px]">{label} <span className="text-rose-500">*</span></span>
                  <span className="px-2 py-2 text-xs font-semibold text-gray-600">:</span>
                  {key === "line_id" ? (
                    <select className="flex-1 px-1 py-2 text-xs font-black outline-none bg-transparent" value={header.line_id} onChange={(e) => setHeader((p) => ({ ...p, line_id: e.target.value }))}>
                      <option value="">Select Line</option>
                      {lines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}
                    </select>
                  ) : (
                  <input type={key === "report_date" ? "date" : "text"} className="flex-1 min-w-0 px-1 py-2 text-xs font-black outline-none" placeholder={placeholder} value={header[key as HeaderKey]} onChange={(e) => setHeader((p) => ({ ...p, [key as HeaderKey]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 border-b border-gray-300">
              {[
                ["PO Number", "po_number", "PO-45001234"],
                ["Article", "article_code", "ART-001"],
                ["Color", "product_color", "Navy Blue"],
                ["Shift", "shift", "Day Shift"],
              ].map(([label, key, placeholder]) => (
                <div key={key} className="flex border-r border-gray-300 last:border-r-0">
                  <span className="px-3 py-2 font-black text-[10px] uppercase bg-gray-100 border-r border-gray-300 min-w-[92px]">{label} <span className="text-rose-500">*</span></span>
                  <span className="px-2 py-2 text-xs font-semibold text-gray-600">:</span>
                  <input className="flex-1 min-w-0 px-1 py-2 text-xs font-black outline-none" placeholder={placeholder} value={header[key as HeaderKey]} onChange={(e) => setHeader((p) => ({ ...p, [key as HeaderKey]: e.target.value }))} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5">
              {[
                ["Model #", "model_number"],
                ["Customer", "customer"],
                ["STM #", "stm"],
                ["Lot #", "lot_number"],
                ["Lot Qty", "lot_qty"],
              ].map(([label, key]) => (
                <div key={key} className="flex border-r border-gray-300 last:border-r-0">
                  <span className="px-3 py-2 font-black text-[10px] uppercase bg-gray-100 border-r border-gray-300 min-w-[86px]">{label}</span>
                  <span className="px-2 py-2 text-xs font-semibold text-gray-600">:</span>
                  <input type={key === "lot_qty" ? "number" : "text"} className="flex-1 min-w-0 px-1 py-2 text-xs font-black outline-none" value={header[key as HeaderKey]} onChange={(e) => setHeader((p) => ({ ...p, [key as HeaderKey]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-x border-gray-300">
            <div className="flex flex-wrap gap-2">
              {(["cutting", "printing", "knitting"] as const).map((section) => (
                <button key={section} type="button" onClick={() => addDefect(section)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-black uppercase">
                  <Plus className="w-3.5 h-3.5" /> Add {SECTION_LABELS[section]} Defect
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-300">
            <table className="w-full min-w-[1700px] border-collapse text-center">
              <thead className="bg-slate-50 text-slate-950">
                <tr>
                  <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-[10px]">Bundle #</th>
                  <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-[10px]">Size</th>
                  <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-[10px]">Pcs.</th>
                  {(["cutting", "printing", "knitting"] as const).map((section) => (
                    <th key={section} colSpan={defects.filter((defect) => defect.section === section).length || 1} className="border-2 border-gray-300 px-2 py-2 text-xs font-black">
                      {SECTION_LABELS[section]}
                    </th>
                  ))}
                  <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-[10px]">T.Defect</th>
                  <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-[10px]">Defects %</th>
                  <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-[10px]"></th>
                </tr>
                <tr className="bg-slate-100">
                  {(["cutting", "printing", "knitting"] as const).flatMap((section) => {
                    const sectionDefects = defects.filter((defect) => defect.section === section);
                    return sectionDefects.length ? sectionDefects.map((defect) => (
                      <th key={defect.id} className="border border-gray-400 px-1 py-2 align-top">
                        <div className="flex items-center gap-1">
                          <input className="w-full text-center text-[10px] font-black outline-none" value={defect.name} onChange={(e) => updateDefect(defect.id, e.target.value)} />
                          <button type="button" onClick={() => removeDefect(defect.id)} className="text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    )) : [<th key={`${section}-empty`} className="border border-gray-400 px-1 py-2 text-[10px] text-gray-400">No defects</th>];
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const rowDefects = defects.reduce((sum, defect) => sum + (Number(row.defect_counts[defect.id]) || 0), 0);
                  return (
                    <tr key={rowIndex}>
                      <td className="border border-gray-300 p-1"><input className="w-full text-center text-xs outline-none" value={row.bundle_number} onChange={(e) => setRow(rowIndex, { bundle_number: e.target.value })} /></td>
                      <td className="border border-gray-300 p-1"><input className="w-full text-center text-xs outline-none" value={row.size} onChange={(e) => setRow(rowIndex, { size: e.target.value })} /></td>
                      <td className="border border-gray-300 p-1"><input type="number" className="w-full text-center text-xs outline-none" value={row.pcs || ""} onChange={(e) => setRow(rowIndex, { pcs: Number(e.target.value) || 0 })} /></td>
                      {(["cutting", "printing", "knitting"] as const).flatMap((section) => {
                        const sectionDefects = defects.filter((defect) => defect.section === section);
                        return sectionDefects.length ? sectionDefects.map((defect) => (
                          <td key={defect.id} className="border border-gray-300 p-1">
                            <input type="number" min="0" className="w-full text-center text-xs outline-none" value={row.defect_counts[defect.id] || ""} onChange={(e) => setDefectCount(rowIndex, defect.id, e.target.value)} />
                          </td>
                        )) : [<td key={`${section}-empty-${rowIndex}`} className="border border-gray-300"></td>];
                      })}
                      <td className="border border-gray-400 text-xs font-black">{rowDefects}</td>
                      <td className="border border-gray-400 text-xs font-black">{percent(rowDefects, row.pcs)}%</td>
                      <td className="border border-gray-300">
                        <button type="button" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== rowIndex))} className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={3} className="border border-gray-400 text-left px-3 py-3 font-black text-xs">Total Defects</td>
                  {(["cutting", "printing", "knitting"] as const).flatMap((section) => {
                    const sectionDefects = defects.filter((defect) => defect.section === section);
                    return sectionDefects.length ? sectionDefects.map((defect) => (
                      <td key={defect.id} className="border border-gray-400 text-xs font-black">{totals.columnTotals[defect.id] || 0}</td>
                    )) : [<td key={`${section}-total-empty`} className="border border-gray-400"></td>];
                  })}
                  <td className="border border-gray-900 text-xs font-black">{totals.totalDefects}</td>
                  <td className="border border-gray-900 text-xs font-black">{totals.defectPercent}%</td>
                  <td className="border border-gray-300"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 border-x border-b border-gray-300 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-black uppercase">
              <Plus className="w-4 h-4" /> Add Bundle Row
            </button>
            <div className="flex flex-wrap gap-4 text-xs font-black">
              <span>Total Checked: {totals.checked}</span>
              <span>Total Defects: {totals.totalDefects}</span>
              <span>DHU %: {totals.defectPercent}%</span>
              <span> AQL: {aqlResult} ({aqlData.ac}/{aqlData.re})</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 text-xs font-black">
            {[
              ["Quality Inspector", "quality_inspector"],
              ["Quality Supervisor", "quality_supervisor"],
              ["Production Supervisor", "production_supervisor"],
            ].map(([label, key]) => (
              <label key={key} className="flex items-center gap-2">
                <span>{label}</span>
                <input className="flex-1 border-b border-gray-500 outline-none px-2 py-1" value={header[key as HeaderKey]} onChange={(e) => setHeader((p) => ({ ...p, [key as HeaderKey]: e.target.value }))} />
              </label>
            ))}
          </div>
      </ReportCanvas>

        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 bg-white text-gray-950 rounded-2xl border border-slate-200 p-4 shadow-xl print:shadow-none">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: "Total Checked", value: totals.checked, className: "border-sky-200 bg-sky-50", labelClass: "text-sky-700", valueClass: "text-sky-800" },
              { label: "Total Defects", value: totals.totalDefects, className: "border-rose-200 bg-rose-50", labelClass: "text-rose-700", valueClass: "text-rose-800" },
              { label: "DHU %", value: `${totals.defectPercent}%`, className: qualityTone.panel, labelClass: qualityTone.label, valueClass: qualityTone.value },
              { label: " AQL Sample", value: aqlData.sample, className: "border-indigo-200 bg-indigo-50", labelClass: "text-indigo-700", valueClass: "text-indigo-800" },
              { label: "AC / RE", value: `${aqlData.ac} / ${aqlData.re}`, className: "border-slate-200 bg-slate-50", labelClass: "text-slate-600", valueClass: "text-slate-900" },
              { label: " AQL Result", value: aqlResult, className: aqlResult === "PASS" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50", labelClass: aqlResult === "PASS" ? "text-emerald-700" : "text-red-700", valueClass: aqlResult === "PASS" ? "text-emerald-700" : "text-red-700" },
            ].map((item) => (
              <div key={item.label} className={`border rounded-lg p-3 ${item.className}`}>
                <p className={`text-[9px] font-black uppercase ${item.labelClass}`}>{item.label}</p>
                <p className={`text-xl font-black mt-1 ${item.valueClass}`}>{item.value}</p>
              </div>
            ))}
            <div className="md:col-span-3 border border-gray-200 rounded-lg p-3 bg-white">
              <p className="text-[9px] font-black uppercase text-gray-500">Recommendation</p>
              <p className={`text-xs font-black mt-1 ${qualityTone.value}`}>{qualityTone.recommendation}</p>
            </div>
          </div>
          <div className="border border-gray-300 rounded-lg bg-white p-3 min-h-[150px]">
            <h3 className="text-[10px] font-black uppercase tracking-widest mb-2">Section Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {sectionSummary.map((item) => {
                const tone = dhuTone(item.dhu);
                return (
                  <div key={item.section} className={`border rounded-lg px-3 py-2 ${tone.panel}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-[9px] font-black uppercase ${tone.label}`}>{item.label}</p>
                        <p className={`text-xl font-black mt-1 ${tone.value}`}>{item.total}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase text-gray-500">DHU</p>
                        <p className={`text-sm font-black ${tone.value}`}>{item.dhu}%</p>
                      </div>
                    </div>
                    <div className="mt-2 border-t border-white/70 pt-2">
                      {item.top.length ? (
                        item.top.map((defect) => (
                          <div key={defect.id} className="flex justify-between gap-2 text-[10px] font-bold text-gray-700">
                            <span className="truncate">{defect.name}</span>
                            <span>{defect.count}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] font-bold text-gray-500">No defects entered.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
