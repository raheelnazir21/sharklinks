"use client";

import React, { useState, useEffect, useMemo } from "react";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { 
  Plus, Trash2, ChevronRight, 
  AlertCircle, CheckCircle2, Info, User, Settings2,
  Building2, Layers
} from "lucide-react";
import { ReportCanvas, ReportToolbar, ReportWorkspace } from "@/components/qc/ReportUI";

const DEFAULT_HOUR_SLOTS = [
  "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", 
  "12:00 - 01:00", "01:00 - 02:00", "02:00 - 03:00",
  "03:00 - 04:00", "04:00 - 05:00"
];

const SEVERITIES = ["minor", "major", "critical"];

function getNextHourSlot(slots: string[]) {
  const last = slots[slots.length - 1] || "09:00 - 10:00";
  const end = last.split("-").pop()?.trim() || "10:00";
  const [hourText, minuteText = "00"] = end.split(":");
  const hour = Number(hourText) || 0;
  const nextHour = hour + 1;
  const format = (h: number) => `${String(h).padStart(2, "0")}:${minuteText.padStart(2, "0")}`;
  return `${end} - ${format(nextHour)}`;
}

export default function NewInlineQCReport() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [hourSlots, setHourSlots] = useState(DEFAULT_HOUR_SLOTS);
  
  // Master Data
  const [vendors, setVendors] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);

  // Header State
  const [header, setHeader] = useState({
    vendor_id: "", floor_id: "", line_id: "",
    floor: "", line_number: "", style_no: "", po_number: "",
    article_code: "", product_color: "",
    inspection_date: new Date().toISOString().split('T')[0],
    department: "STITCHING", section: "INLINE", shift: "Day Shift",
    qc_name: "", qc_code: "", inspection_level: "II",
    aql_standard: 2.5, table_number: "",
    remarks: "", prepared_by: "", checked_by: "", approved_by: ""
  });

  // Operations State
  const [operations, setOperations] = useState<any[]>([
    {
      id: Date.now(),
      operation_name: "Shoulder Attached",
      operator_name: "Raheel",
      defect_rows: [
        {
          id: Date.now() + 1,
          defect_name: "Open Stitch",
          severity: "minor",
          hourly_data: DEFAULT_HOUR_SLOTS.map(h => ({ hour: h, checked: 0, defects: 0 }))
        }
      ]
    }
  ]);

  // Load Vendors
  useEffect(() => {
    api.get("/vendors/").then(res => setVendors(res.data.data));
  }, []);

  // Load Floors when Vendor changes
  useEffect(() => {
    if (header.vendor_id) {
      api.get(`/vendors/${header.vendor_id}/floors/`).then(res => setFloors(res.data.data));
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

  const addOperation = () => {
    setOperations([...operations, {
      id: Date.now(),
      operation_name: "",
      operator_name: "",
      defect_rows: [
        {
          id: Date.now() + 1,
          defect_name: "",
          severity: "minor",
          hourly_data: hourSlots.map(h => ({ hour: h, checked: 0, defects: 0 }))
        }
      ]
    }]);
  };

  const removeOperation = (opId: number) => {
    setOperations(operations.filter(op => op.id !== opId));
  };

  const addDefectRow = (opId: number) => {
    setOperations(operations.map(op => {
      if (op.id === opId) {
        return {
          ...op,
          defect_rows: [...op.defect_rows, {
            id: Date.now(),
            defect_name: "",
            severity: "minor",
            hourly_data: hourSlots.map(h => ({ hour: h, checked: 0, defects: 0 }))
          }]
        };
      }
      return op;
    }));
  };

  const addHourSlot = () => {
    const nextSlot = getNextHourSlot(hourSlots);
    setHourSlots(prev => [...prev, nextSlot]);
    setOperations(prev => prev.map(op => ({
      ...op,
      defect_rows: op.defect_rows.map((row: any) => ({
        ...row,
        hourly_data: [...row.hourly_data, { hour: nextSlot, checked: 0, defects: 0 }]
      }))
    })));
  };

  const updateOpField = (opId: number, field: string, value: string) => {
    setOperations(operations.map(op => op.id === opId ? { ...op, [field]: value } : op));
  };

  const updateDefectField = (opId: number, rowId: number, field: string, value: string) => {
    setOperations(operations.map(op => {
      if (op.id === opId) {
        return {
          ...op,
          defect_rows: op.defect_rows.map((row: any) => row.id === rowId ? { ...row, [field]: value } : row)
        };
      }
      return op;
    }));
  };

  const updateHourlyData = (opId: number, rowId: number, hourIdx: number, field: string, value: number) => {
    setOperations(operations.map(op => {
      if (op.id === opId) {
        return {
          ...op,
          defect_rows: op.defect_rows.map((row: any) => {
            if (row.id === rowId) {
              const newData = [...row.hourly_data];
              newData[hourIdx] = { ...newData[hourIdx], [field]: value };
              return { ...row, hourly_data: newData };
            }
            return row;
          })
        };
      }
      return op;
    }));
  };

  // Calculations
  const calculatedData = useMemo(() => {
    let totalChecked = 0;
    let totalDefects = 0;
    let totalMinor = 0;
    let totalMajor = 0;
    let totalCritical = 0;
    const defectMap: Record<string, number> = {};
    const hourlySummary: Record<string, { defects: number, checked: number }> = {};

    const processedOps = operations.map(op => {
      let opChecked = 0;
      let opDefects = 0;
      
      const processedRows = op.defect_rows.map((row: any) => {
        const rowChecked = row.hourly_data.reduce((acc: number, h: any) => acc + h.checked, 0);
        const rowDefects = row.hourly_data.reduce((acc: number, h: any) => acc + h.defects, 0);
        
        // Severity counts
        if (row.severity === 'minor') totalMinor += rowDefects;
        else if (row.severity === 'major') totalMajor += rowDefects;
        else if (row.severity === 'critical') totalCritical += rowDefects;

        // Global defect map
        if (row.defect_name) {
          defectMap[row.defect_name] = (defectMap[row.defect_name] || 0) + rowDefects;
        }

        // Hourly summary map
        row.hourly_data.forEach((h: any) => {
          if (!hourlySummary[h.hour]) hourlySummary[h.hour] = { defects: 0, checked: 0 };
          hourlySummary[h.hour].defects += h.defects;
          hourlySummary[h.hour].checked += h.checked;
        });

        opChecked = Math.max(opChecked, rowChecked);
        opDefects += rowDefects;

        return { ...row, totalChecked: rowChecked, totalDefects: rowDefects };
      });

      totalChecked += opChecked;
      totalDefects += opDefects;

      const dhu = opChecked > 0 ? (opDefects / opChecked) * 100 : 0;
      let trafficLight = "green";
      if (dhu > 7) trafficLight = "red";
      else if (dhu > 3) trafficLight = "yellow";

      return { ...op, defect_rows: processedRows, totalChecked: opChecked, totalDefects: opDefects, dhu, trafficLight };
    });

    // Top 5 Defects
    const topDefects = Object.entries(defectMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count, pct: totalDefects > 0 ? (count / totalDefects) * 100 : 0 }));

    return { 
      processedOps, totalChecked, totalDefects, totalMinor, totalMajor, totalCritical, 
      topDefects, hourlySummary 
    };
  }, [operations]);

  const handleSave = async () => {
    if (!header.vendor_id || !header.floor_id) {
      alert("Please select Vendor and Floor.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...header,
        vendor_id: header.vendor_id || null,
        floor_id: header.floor_id || null,
        line_id: header.line_id || null,
        operations: operations.map(op => ({
            operation_name: op.operation_name,
            operator_name: op.operator_name,
            defect_rows: op.defect_rows.map((row: any) => ({
              defect_name: row.defect_name,
              severity: row.severity,
              hourly_data: row.hourly_data
            }))
          }))
        };
        const res = await api.post("/advanced-qc/inline/", payload);
        router.push(`/qc-reports`);
    } catch (err) {
      alert("Failed to create Inline QC report.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReportWorkspace maxWidth="max-w-[1600px]">
        <ReportToolbar
          title="Inline QC Report"
          subtitle="Operation-wise tracking with hourly defect feeding"
          meta="Production Quality"
          onSave={handleSave}
          saving={saving}
          saveLabel="Submit Report"
          savingLabel="Processing..."
        />

        <ReportCanvas title="Inline QC Report" subtitle="Operation-wise hourly feeding manual form">
        {/* Header Information Grid */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[3rem] p-10 overflow-hidden relative shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] -mr-32 -mt-32"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            
            {/* Vendor Selector */}
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic flex items-center gap-2">
                <Building2 className="w-3 h-3" /> Vendor
              </label>
              <select 
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={header.vendor_id}
                onChange={(e) => setHeader({ ...header, vendor_id: e.target.value, floor_id: "", line_id: "" })}
              >
                <option value="">Select Vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            {/* Floor Selector */}
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic flex items-center gap-2">
                <Layers className="w-3 h-3" /> Floor
              </label>
              <select 
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={header.floor_id}
                onChange={(e) => setHeader({ ...header, floor_id: e.target.value, line_id: "" })}
                disabled={!header.vendor_id}
              >
                <option value="">Select Floor</option>
                {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {/* Line Selector */}
            <div className="space-y-3">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic flex items-center gap-2">
                <Settings2 className="w-3 h-3" /> Line
              </label>
              <select 
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={header.line_id}
                onChange={(e) => setHeader({ ...header, line_id: e.target.value })}
                disabled={!header.floor_id}
              >
                <option value="">Select Line</option>
                {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            {[
              { label: "Style No", key: "style_no", placeholder: "e.g. ST-24-101" },
              { label: "PO No", key: "po_number", placeholder: "e.g. PO-45001234" },
              { label: "Article Code", key: "article_code", placeholder: "e.g. ART-001" },
              { label: "Color", key: "product_color", placeholder: "e.g. Navy Blue" },
              { label: "Department", key: "department", placeholder: "STITCHING" },
              { label: "Section", key: "section", placeholder: "INLINE" },
              { label: "QC Name", key: "qc_name", placeholder: "Inspector Name" },
            ].map((f) => (
              <div key={f.key} className="space-y-3">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">{f.label}</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder:text-slate-800"
                  placeholder={f.placeholder}
                  value={(header as any)[f.key]}
                  onChange={(e) => setHeader({ ...header, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic QC Feeding Table */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[3.5rem] overflow-hidden shadow-2xl">
          <div className="p-10 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between">
            <h2 className="text-white font-black text-sm uppercase tracking-[0.3em] flex items-center gap-4">
              <Settings2 className="w-6 h-6 text-indigo-500" /> Operation-Wise Feeding
            </h2>
            <button 
              onClick={addOperation}
              className="px-8 py-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-3"
            >
              <Plus className="w-4 h-4" /> Add Operation
            </button>
            <button 
              onClick={addHourSlot}
              className="px-8 py-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-3"
            >
              <Plus className="w-4 h-4" /> Add Hour
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="bg-slate-950/80 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-800">
                <tr>
                  <th className="px-8 py-6 w-12 text-center">#</th>
                  <th className="px-8 py-6 min-w-[200px]">Operation / Operator</th>
                  <th className="px-8 py-6 w-32 text-center">Traffic Light</th>
                  <th className="px-8 py-6 min-w-[250px]">Defect Details</th>
                  {hourSlots.map(h => (
                    <th key={h} className="px-4 py-6 text-center text-[8px] border-l border-slate-800/30 bg-slate-900/20 whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-8 py-6 w-32 text-center border-l border-slate-800/50 bg-indigo-600/5">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {calculatedData.processedOps.map((op, idx) => (
                  <React.Fragment key={op.id}>
                    {op.defect_rows.map((row: any, rIdx: number) => (
                      <tr key={row.id} className="group hover:bg-slate-800/20 transition-all">
                        {rIdx === 0 && (
                          <>
                            <td rowSpan={op.defect_rows.length} className="px-8 py-8 text-center text-slate-700 font-black italic">{idx + 1}</td>
                            <td rowSpan={op.defect_rows.length} className="px-8 py-8 border-r border-slate-800/30">
                              <div className="space-y-4">
                                <input 
                                  placeholder="Operation Name"
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-black text-white focus:outline-none"
                                  value={op.operation_name}
                                  onChange={(e) => updateOpField(op.id, 'operation_name', e.target.value)}
                                />
                                <div className="flex items-center gap-3 px-2">
                                  <User className="w-4 h-4 text-slate-700" />
                                  <input 
                                    placeholder="Operator Name"
                                    className="bg-transparent border-none text-[10px] font-black text-indigo-400 uppercase tracking-widest focus:outline-none placeholder:text-slate-800"
                                    value={op.operator_name}
                                    onChange={(e) => updateOpField(op.id, 'operator_name', e.target.value)}
                                  />
                                </div>
                              </div>
                            </td>
                            <td rowSpan={op.defect_rows.length} className="px-8 py-8 text-center border-r border-slate-800/30">
                              <div className="flex flex-col items-center gap-3">
                                <div className={`w-8 h-8 rounded-full shadow-2xl animate-pulse ${
                                  op.trafficLight === 'green' ? 'bg-emerald-500 shadow-emerald-500/40' :
                                  op.trafficLight === 'yellow' ? 'bg-amber-500 shadow-amber-500/40' :
                                  'bg-rose-500 shadow-rose-500/40'
                                }`}></div>
                                <span className={`text-[8px] font-black uppercase tracking-widest ${
                                  op.trafficLight === 'green' ? 'text-emerald-500' :
                                  op.trafficLight === 'yellow' ? 'text-amber-500' :
                                  'text-rose-500'
                                }`}>{op.trafficLight}</span>
                              </div>
                            </td>
                          </>
                        )}
                        <td className="px-8 py-6 border-r border-slate-800/30">
                          <div className="flex flex-col gap-3">
                            <input 
                              placeholder="Defect Name"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] font-bold text-white focus:outline-none"
                              value={row.defect_name}
                              onChange={(e) => updateDefectField(op.id, row.id, 'defect_name', e.target.value)}
                            />
                            <div className="flex gap-2">
                              {SEVERITIES.map(s => (
                                <button 
                                  key={s}
                                  onClick={() => updateDefectField(op.id, row.id, 'severity', s)}
                                  className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase tracking-widest border transition-all ${
                                    row.severity === s ? (
                                      s === 'minor' ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' :
                                      s === 'major' ? 'bg-orange-500/20 border-orange-500/40 text-orange-500' :
                                      'bg-rose-500/20 border-rose-500/40 text-rose-500'
                                    ) : 'bg-slate-900 border-slate-800 text-slate-700'
                                  }`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                        {row.hourly_data.map((h: any, hIdx: number) => (
                          <td key={hIdx} className="px-2 py-6 border-l border-slate-800/10">
                            <div className="flex flex-col items-center gap-2">
                              <input 
                                type="number"
                                className="w-10 bg-slate-950 border border-slate-800 rounded-lg py-1 text-center text-[10px] font-black text-rose-500 focus:outline-none"
                                value={h.defects || ""}
                                onChange={(e) => updateHourlyData(op.id, row.id, hIdx, 'defects', parseInt(e.target.value) || 0)}
                                placeholder="D"
                              />
                              <div className="h-[1px] w-4 bg-slate-800"></div>
                              <input 
                                type="number"
                                className="w-10 bg-slate-950 border border-slate-800 rounded-lg py-1 text-center text-[10px] font-black text-emerald-500 focus:outline-none"
                                value={h.checked || ""}
                                onChange={(e) => updateHourlyData(op.id, row.id, hIdx, 'checked', parseInt(e.target.value) || 0)}
                                placeholder="P"
                              />
                            </div>
                          </td>
                        ))}
                        {rIdx === 0 && (
                          <td rowSpan={op.defect_rows.length} className="px-8 py-8 border-l border-slate-800/50 bg-indigo-600/5 text-center">
                            <div className="space-y-2">
                              <p className="text-xl font-black text-white italic tracking-tighter">{op.dhu.toFixed(2)}%</p>
                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">TOTAL DHU</p>
                              <div className="mt-4 pt-4 border-t border-slate-800/50">
                                <p className="text-[10px] font-black text-indigo-400">{op.totalChecked}</p>
                                <p className="text-[7px] font-black text-slate-600 uppercase">CHK PCS</p>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="print:hidden w-10">
                          <div className="flex flex-col gap-2 px-4 opacity-0 group-hover:opacity-100 transition-all">
                            {rIdx === 0 && (
                              <button onClick={() => addDefectRow(op.id)} className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-all">
                                <Plus size={14} />
                              </button>
                            )}
                            <button onClick={() => removeOperation(op.id)} className="p-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition-all">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Analytics Summary Bar */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* DHU Summary */}
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 space-y-6 shadow-xl">
              <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Quality Summary
              </h3>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Overall DHU %</p>
                  <p className={`text-4xl font-black italic tracking-tighter mt-2 ${
                    calculatedData.totalChecked > 0 && (calculatedData.totalDefects / calculatedData.totalChecked * 100) > 7 ? 'text-rose-500' : 'text-emerald-500'
                  }`}>
                    {calculatedData.totalChecked > 0 ? (calculatedData.totalDefects / calculatedData.totalChecked * 100).toFixed(2) : "0.00"}%
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AQL Result</p>
                  <p className="text-4xl font-black italic tracking-tighter mt-2 text-indigo-400">PASS</p>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-800 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-white font-black text-lg">{calculatedData.totalChecked}</p>
                  <p className="text-[7px] text-slate-600 font-black uppercase tracking-widest">Checked</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-lg">{calculatedData.totalDefects}</p>
                  <p className="text-[7px] text-slate-600 font-black uppercase tracking-widest">Defects</p>
                </div>
                <div className="text-center">
                  <p className="text-emerald-500 font-black text-lg">91.67%</p>
                  <p className="text-[7px] text-slate-600 font-black uppercase tracking-widest">Pass Rate</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 space-y-6 shadow-xl">
              <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Severity Mix
              </h3>
              <div className="space-y-4">
                {[
                  { label: "Minor", count: calculatedData.totalMinor, color: "bg-amber-500", shadow: "shadow-amber-500/20" },
                  { label: "Major", count: calculatedData.totalMajor, color: "bg-orange-500", shadow: "shadow-orange-500/20" },
                  { label: "Critical", count: calculatedData.totalCritical, color: "bg-rose-500", shadow: "shadow-rose-500/20" },
                ].map((s) => (
                  <div key={s.label} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">{s.label}</span>
                      <span className="text-[10px] font-black text-slate-500 italic">{s.count} Defects</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${s.color} ${s.shadow} rounded-full transition-all duration-1000`} 
                        style={{ width: `${calculatedData.totalDefects > 0 ? (s.count / calculatedData.totalDefects) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top 5 Defects */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 space-y-8 shadow-xl">
            <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-3">
              <Info className="w-5 h-5 text-indigo-500" /> Top 5 Defects
            </h3>
            <div className="space-y-5">
              {calculatedData.topDefects.length > 0 ? calculatedData.topDefects.map((d, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <span className="w-6 h-6 rounded-lg bg-slate-950 flex items-center justify-center text-[10px] font-black text-slate-700 group-hover:text-indigo-400 transition-all">{i + 1}</span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight">{d.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-white italic">{d.count}</p>
                    <p className="text-[7px] font-black text-slate-700 uppercase">{d.pct.toFixed(1)}%</p>
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center text-slate-700 text-[10px] font-black uppercase tracking-widest">No defect data recorded</div>
              )}
            </div>
          </div>

          {/* Traffic Light Rule Card */}
          <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900/40 border border-slate-800 rounded-[3rem] p-10 space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Settings2 size={120} className="text-indigo-500" />
            </div>
            <h3 className="text-white font-black text-xs uppercase tracking-widest relative z-10">Traffic Light Protocol</h3>
            <div className="space-y-5 relative z-10">
              <div className="flex items-start gap-4 p-4 bg-slate-950/40 rounded-2xl border border-slate-800/50">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 shadow-[0_0_15px_rgba(16,185,129,0.4)]"></div>
                <div>
                  <p className="text-[9px] font-black text-white uppercase tracking-widest">Green (0-3%)</p>
                  <p className="text-[8px] text-slate-600 mt-1 font-bold">Standard performance level. Monitor hourly.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-slate-950/40 rounded-2xl border border-slate-800/50">
                <div className="w-3 h-3 rounded-full bg-amber-500 mt-1 shadow-[0_0_15px_rgba(245,158,11,0.4)]"></div>
                <div>
                  <p className="text-[9px] font-black text-white uppercase tracking-widest">Yellow (3-7%)</p>
                  <p className="text-[8px] text-slate-600 mt-1 font-bold">Mandatory warning stage. Corrective action required.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-slate-950/40 rounded-2xl border border-slate-800/50">
                <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 shadow-[0_0_15px_rgba(244,63,94,0.4)]"></div>
                <div>
                  <p className="text-[9px] font-black text-white uppercase tracking-widest">Red ({'>'}7%)</p>
                  <p className="text-[8px] text-slate-600 mt-1 font-bold">Critical alert. Stop production for audit.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Remarks */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 grid grid-cols-1 md:grid-cols-2 gap-10 shadow-2xl">
          <div className="space-y-4">
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Remarks & Observations</label>
            <textarea 
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder:text-slate-800 resize-none"
              placeholder="Enter audit remarks here..."
              value={header.remarks}
              onChange={(e) => setHeader({ ...header, remarks: e.target.value })}
            ></textarea>
          </div>
          <div className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Prepared By</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:outline-none"
                  value={header.prepared_by}
                  onChange={(e) => setHeader({ ...header, prepared_by: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Checked By</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:outline-none"
                  value={header.checked_by}
                  onChange={(e) => setHeader({ ...header, checked_by: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Approved By</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:outline-none"
                  value={header.approved_by}
                  onChange={(e) => setHeader({ ...header, approved_by: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
        </ReportCanvas>
    </ReportWorkspace>
  );
}
