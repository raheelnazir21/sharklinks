"use client";
import React, { useState } from "react";
import { Plus, X } from "lucide-react";

interface DefectEntry {
  defect_id: string;
  defect_count: number;
  severity?: string;
}

interface DefectChipRowProps {
  index: number;
  item: any;
  defectMaster: any[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}

export default function DefectChipRow({
  index, item, defectMaster, onUpdate, onRemove
}: DefectChipRowProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDefectId, setPickerDefectId] = useState("");
  const [pickerCount, setPickerCount] = useState(1);

  const entries: DefectEntry[] = item.defect_entries || [];
  const totalDefectsInRow = entries.reduce((s: number, e: DefectEntry) => s + (Number(e.defect_count) || 0), 0);

  const addDefect = () => {
    if (!pickerDefectId) return;
    const updated = [...entries, { defect_id: pickerDefectId, defect_count: pickerCount }];
    onUpdate(index, "defect_entries", updated);
    setPickerDefectId("");
    setPickerCount(1);
    setShowPicker(false);
  };

  const removeDefect = (entryIdx: number) => {
    const updated = entries.filter((_: any, i: number) => i !== entryIdx);
    onUpdate(index, "defect_entries", updated);
  };

  const updateCount = (entryIdx: number, val: number) => {
    const updated = entries.map((e: DefectEntry, i: number) =>
      i === entryIdx ? { ...e, defect_count: val } : e
    );
    onUpdate(index, "defect_entries", updated);
  };

  const getDefectLabel = (defect_id: string) => {
    const d = defectMaster.find((d: any) => String(d.id) === String(defect_id));
    return d ? `${d.code} — ${d.name}` : `#${defect_id}`;
  };

  const getSeverityColor = (defect_id: string) => {
    const d = defectMaster.find((d: any) => String(d.id) === String(defect_id));
    if (!d) return "border-slate-600 text-slate-400";
    if (d.severity === "critical") return "border-red-500/60 bg-red-500/10 text-red-300";
    if (d.severity === "major")    return "border-amber-500/60 bg-amber-500/10 text-amber-300";
    return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  };

  return (
    <tr className={`group transition-all ${totalDefectsInRow > 0 ? "bg-indigo-500/5" : ""}`}>
      {/* Date */}
      <td className="px-4 py-3 min-w-[120px]">
        <input
          type="date"
          value={item.item_date || ""}
          onChange={e => onUpdate(index, "item_date", e.target.value)}
          className="w-full bg-transparent border-b border-slate-800 focus:border-indigo-500 outline-none text-xs text-white py-1"
        />
      </td>

      {/* Hour */}
      <td className="px-4 py-3 min-w-[110px]">
        <input
          type="text"
          value={item.hour || ""}
          onChange={e => onUpdate(index, "hour", e.target.value)}
          placeholder="09:00–10:00"
          className="w-full bg-transparent border-b border-slate-800 focus:border-indigo-500 outline-none text-xs text-white py-1"
        />
      </td>

      {/* Operator Number */}
      <td className="px-4 py-3 min-w-[70px]">
        <input
          type="text"
          value={item.operator_number || ""}
          onChange={e => onUpdate(index, "operator_number", e.target.value)}
          placeholder="Op #"
          className="w-full bg-transparent border-b border-slate-800 focus:border-indigo-500 outline-none text-xs text-white py-1 text-center font-bold"
        />
      </td>

      {/* Operator Flag */}
      <td className="px-4 py-3 min-w-[90px]">
        <div className="flex items-center gap-1.5 justify-center">
          {[
            { id: "green",  color: "bg-emerald-500" },
            { id: "orange", color: "bg-amber-500"  },
            { id: "red",    color: "bg-rose-500"   }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => onUpdate(index, "operator_flag", f.id)}
              className={`w-3.5 h-3.5 rounded-full transition-all ${f.color} ${item.operator_flag === f.id ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-125' : 'opacity-30 hover:opacity-100'}`}
            />
          ))}
        </div>
      </td>

      {/* Batch Size */}
      <td className="px-4 py-3 min-w-[80px]">
        <input
          type="number"
          min={0}
          value={item.batch_size ?? 0}
          onChange={e => onUpdate(index, "batch_size", parseInt(e.target.value) || 0)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none text-center font-bold focus:border-indigo-500"
        />
      </td>

      {/* Defects — chips */}
      <td className="px-4 py-3 min-w-[280px]">
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry: DefectEntry, eIdx: number) => (
            <div
              key={eIdx}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-bold ${getSeverityColor(entry.defect_id)}`}
            >
              <span className="max-w-[140px] truncate">{getDefectLabel(entry.defect_id)}</span>
              <span className="bg-white/10 rounded-md px-1">
                ×
                <input
                  type="number"
                  min={1}
                  value={entry.defect_count}
                  onChange={e => updateCount(eIdx, parseInt(e.target.value) || 1)}
                  className="w-8 bg-transparent outline-none text-center text-[10px]"
                />
              </span>
              <button
                type="button"
                onClick={() => removeDefect(eIdx)}
                className="hover:text-red-400 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}

          {/* Add defect button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-dashed border-slate-600 text-slate-500 hover:border-indigo-500 hover:text-indigo-400 text-[10px] font-bold transition-all"
            >
              <Plus className="w-3 h-3" /> Add
            </button>

            {showPicker && (
              <div className="absolute z-50 top-8 left-0 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl w-72">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Add Defect</p>
                <select
                  value={pickerDefectId}
                  onChange={e => setPickerDefectId(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none mb-2"
                >
                  <option value="">Select defect…</option>
                  {defectMaster.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                  ))}
                </select>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={1}
                    value={pickerCount}
                    onChange={e => setPickerCount(parseInt(e.target.value) || 1)}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none text-center"
                  />
                  <button
                    type="button"
                    onClick={addDefect}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPicker(false)}
                    className="p-2 text-slate-600 hover:text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Corrective Action */}
      <td className="px-4 py-3 min-w-[160px]">
        <input
          type="text"
          value={item.corrective_action || ""}
          onChange={e => onUpdate(index, "corrective_action", e.target.value)}
          placeholder="Action taken…"
          className="w-full bg-transparent border-b border-slate-800 focus:border-indigo-500 outline-none text-xs text-white py-1"
        />
      </td>

      {/* Remarks */}
      <td className="px-4 py-3 min-w-[140px]">
        <input
          type="text"
          value={item.remarks || ""}
          onChange={e => onUpdate(index, "remarks", e.target.value)}
          placeholder="Notes…"
          className="w-full bg-transparent border-b border-slate-800 focus:border-indigo-500 outline-none text-xs text-white py-1"
        />
      </td>

      {/* Remove row */}
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-2 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
