"use client";
import React, { useEffect, useState } from "react";
import { Users, Edit2, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import api from "@/services/api";

const FLAG_CONFIG = {
  green:  { label: "OK",       bg: "bg-emerald-500",  ring: "ring-emerald-500/40", text: "text-emerald-300", emoji: "🟢" },
  orange: { label: "Monitor",  bg: "bg-amber-500",    ring: "ring-amber-500/40",   text: "text-amber-300",   emoji: "🟠" },
  red:    { label: "Critical", bg: "bg-red-500",      ring: "ring-red-500/40",     text: "text-red-300",     emoji: "🔴" },
};

interface OperatorFlagPanelProps {
  lineId: string;
  lineName?: string;
  defectMaster: any[];
}

export default function OperatorFlagPanel({ lineId, lineName, defectMaster }: OperatorFlagPanelProps) {
  const [flags, setFlags] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editFlag, setEditFlag] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    operator_number: 1,
    operator_name: "",
    flag_color: "green",
    defect_id: "",
    note: "",
    corrective_action: "",
  });

  useEffect(() => {
    if (lineId) fetchFlags();
  }, [lineId]);

  const fetchFlags = async () => {
    try {
      const res = await api.get("/qc-reports/operator-flags", { params: { line_id: lineId } });
      setFlags(res.data.data || []);
    } catch {}
  };

  const openCreate = () => {
    setEditFlag(null);
    setForm({ operator_number: 1, operator_name: "", flag_color: "green", defect_id: "", note: "", corrective_action: "" });
    setShowModal(true);
  };

  const openEdit = (flag: any) => {
    setEditFlag(flag);
    setForm({
      operator_number: flag.operator_number,
      operator_name: flag.operator_name || "",
      flag_color: flag.flag_color,
      defect_id: flag.defect_id ? String(flag.defect_id) : "",
      note: flag.note || "",
      corrective_action: flag.corrective_action || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, line_id: lineId, defect_id: form.defect_id ? parseInt(form.defect_id) : null };
      if (editFlag) {
        await api.put(`/qc-reports/operator-flags/${editFlag.id}`, payload);
      } else {
        await api.post("/qc-reports/operator-flags", payload);
      }
      await fetchFlags();
      setShowModal(false);
    } catch {
      alert("Failed to save flag.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (flagId: string) => {
    if (!confirm("Remove this flag and reset operator to green?")) return;
    try {
      await api.delete(`/qc-reports/operator-flags/${flagId}`);
      await fetchFlags();
    } catch {}
  };

  const flagConfig = (color: string) => FLAG_CONFIG[color as keyof typeof FLAG_CONFIG] || FLAG_CONFIG.green;

  // Group by operator number for display; operators not in flags are implicitly green
  const maxOp = flags.length > 0 ? Math.max(...flags.map((f: any) => f.operator_number)) : 0;
  const flagMap: Record<number, any> = {};
  flags.forEach((f: any) => { flagMap[f.operator_number] = f; });

  return (
    <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
      {/* Header */}
      <div
        className="p-6 border-b border-slate-700/50 flex items-center justify-between bg-slate-900/30 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-black text-xs uppercase tracking-widest">Line Operator Tracker</h3>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-0.5">
              {lineName || "Select a line"} — {flags.filter((f: any) => f.flag_color === "red").length} red · {flags.filter((f: any) => f.flag_color === "orange").length} orange
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); openCreate(); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <Plus className="w-3 h-3" /> Flag Operator
          </button>
          {collapsed ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {/* Table */}
      {!collapsed && (
        <div className="overflow-x-auto">
          {flags.length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-xs font-black uppercase tracking-widest">
              No flags raised — all operators nominal 🟢
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-950/50 text-slate-500 text-[9px] font-black uppercase tracking-[0.15em] border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Op #</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Recurring Defect</th>
                  <th className="px-6 py-4">Flag</th>
                  <th className="px-6 py-4">Corrective Action</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {flags.map((flag: any) => {
                  const cfg = flagConfig(flag.flag_color);
                  return (
                    <tr key={flag.id} className="group hover:bg-slate-800/30 transition-all">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-white text-xs font-black">
                          {flag.operator_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-white font-semibold">
                        {flag.operator_name || <span className="text-slate-600 italic text-xs">Unnamed</span>}
                      </td>
                      <td className="px-6 py-4">
                        {flag.defect_code ? (
                          <span className="text-xs text-amber-300 font-bold">{flag.defect_code} — {flag.defect_name}</span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.bg}/10 ${cfg.text} ring-1 ${cfg.ring}`}>
                          <span className={`w-2 h-2 rounded-full ${cfg.bg}`} />
                          {cfg.emoji} {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 max-w-[200px] truncate">
                        {flag.corrective_action || <span className="text-slate-700 italic">None assigned</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button type="button" onClick={() => openEdit(flag)} className="p-1.5 text-slate-600 hover:text-indigo-400 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDelete(flag.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Flag Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2rem] p-8 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-black text-sm uppercase tracking-widest">{editFlag ? "Edit Flag" : "Flag Operator"}</h4>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-600 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Operator #</label>
                <input type="number" min={1} value={form.operator_number} onChange={e => setForm({ ...form, operator_number: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Name (optional)</label>
                <input type="text" value={form.operator_name} onChange={e => setForm({ ...form, operator_name: e.target.value })} placeholder="e.g. Ali Hassan"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none" />
              </div>
            </div>

            {/* Traffic light selector */}
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Flag Status</label>
              <div className="flex gap-3">
                {(["green", "orange", "red"] as const).map(color => {
                  const cfg = flagConfig(color);
                  return (
                    <button key={color} type="button" onClick={() => setForm({ ...form, flag_color: color })}
                      className={`flex-1 py-3 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${form.flag_color === color ? `${cfg.bg} border-transparent text-white shadow-lg` : "border-slate-700 text-slate-500 hover:border-slate-500"}`}>
                      {cfg.emoji} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Recurring Defect</label>
              <select value={form.defect_id} onChange={e => setForm({ ...form, defect_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none">
                <option value="">None / General</option>
                {defectMaster.map((d: any) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Corrective Action</label>
              <textarea rows={2} value={form.corrective_action} onChange={e => setForm({ ...form, corrective_action: e.target.value })}
                placeholder="What was assigned or done…"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none resize-none" />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Auditor Note</label>
              <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Observation…"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none" />
            </div>

            <button type="button" onClick={handleSave} disabled={saving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl transition-all">
              {saving ? "Saving…" : "Save Flag"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
