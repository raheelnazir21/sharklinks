"use client";

import React, { useEffect, useState } from "react";
import api from "@/services/api";
import { 
  Plus, Search, Tag, AlertCircle, CheckCircle2, 
  Trash2, Filter, Layers, Code, ShieldCheck 
} from 'lucide-react';
import Modal from "@/components/ui/Modal";
import { IndustrialHeading } from "@/components/ui/PagePrimitives";

const REPORT_TYPES = [
  { id: "cut_panel", label: "Cut Panel" },
  { id: "inline", label: "Inline QC" },
  { id: "end_line", label: "End Line QC" },
  { id: "finishing", label: "Finishing QC" },
  { id: "qa_audit", label: "QA Audit" },
];

const SEVERITIES = ["minor", "major", "critical"];

export default function DefectMasterPage() {
  const [categories, setCategories] = useState([]);
  const [defects, setDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("inline");
  
  // Modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isDefModalOpen, setIsDefModalOpen] = useState(false);

  const [catForm, setCatForm] = useState({ name: "", report_type: "inline" });
  const [defForm, setDefForm] = useState({ 
    name: "", code: "", report_type: "inline", 
    category_id: "", severity: "major" 
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, defRes] = await Promise.all([
        api.get("/qc-reports/defect-categories/", { params: { report_type: filterType } }),
        api.get("/qc-reports/defect-codes/", { params: { report_type: filterType } }),
      ]);
      setCategories(catRes.data.data);
      setDefects(defRes.data.data);
    } catch (err) {
      console.warn("Failed to fetch defect master", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterType]);

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/qc-reports/defect-categories/", catForm);
    setIsCatModalOpen(false);
    setCatForm({ name: "", report_type: filterType });
    fetchData();
  };

  const handleCreateDef = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/qc-reports/defect-codes/", defForm);
    setIsDefModalOpen(false);
    setDefForm({ name: "", code: "", report_type: filterType, category_id: "", severity: "major" });
    fetchData();
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Toolbar & Filter Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Module Selector */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-fit">
          {REPORT_TYPES.map(t => (
            <button key={t.id} onClick={() => setFilterType(t.id)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                filterType === t.id ? "bg-emerald-600 text-white shadow-md shadow-[0_4px_14px_rgba(0,68,230,0.2)]" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setIsCatModalOpen(true)}
            className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border border-slate-300 shadow-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" /> Add Category
          </button>
          <button onClick={() => {
            setDefForm(prev => ({ ...prev, report_type: filterType }));
            setIsDefModalOpen(true);
          }}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
            <Plus className="w-4 h-4 text-white" /> Add Defect Code
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Categories Panel */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-slate-800 font-black text-xs uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" /> Categories
          </h2>
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 space-y-3 shadow-sm">
            {categories.length === 0 ? (
              <p className="text-slate-500 text-[10px] font-black uppercase text-center py-10">No categories found</p>
            ) : categories.map((cat: any) => (
              <div key={cat.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-emerald-500/40 transition-all group">
                <span className="text-slate-900 font-black text-[10px] uppercase tracking-widest">{cat.name}</span>
                <Tag className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
            ))}
          </div>
        </div>

        {/* Defects Table Panel */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-slate-800 font-black text-xs uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Defect Codes
          </h2>
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
               <div className="relative flex-1 max-w-xs">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input type="text" placeholder="Search codes..." className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0044E6]/30" />
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-200">
                  <tr>
                    <th className="px-8 py-5">Code</th>
                    <th className="px-8 py-5">Defect Name</th>
                    <th className="px-8 py-5">Severity</th>
                    <th className="px-8 py-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={4} className="py-20 text-center"><div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                  ) : defects.length === 0 ? (
                    <tr><td colSpan={4} className="py-20 text-center text-slate-500 text-xs font-black uppercase">No defect codes found for this module.</td></tr>
                  ) : defects.map((def: any) => (
                    <tr key={def.id} className="hover:bg-slate-50 transition-all group">
                      <td className="px-8 py-5">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase">
                          {def.code}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-slate-900 font-black text-[11px] uppercase tracking-wide">{def.name}</p>
                        <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-0.5">ID: {def.id}</p>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase border ${
                          def.severity === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          def.severity === 'major' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {def.severity}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <button className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-all">
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>


      {/* MODALS */}
      <Modal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title="Add Defect Category">
        <form onSubmit={handleCreateCat} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Category Name</label>
               <input required type="text" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} placeholder="e.g. Sewing Defect" className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
             </div>
             <div>
               <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Report Type</label>
               <select value={catForm.report_type} onChange={e => setCatForm({...catForm, report_type: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none">
                 {REPORT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
               </select>
             </div>
          </div>
          <button type="submit" className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl transition-all">Save Category</button>
        </form>
      </Modal>

      <Modal isOpen={isDefModalOpen} onClose={() => setIsDefModalOpen(false)} title="Add Defect Code">
        <form onSubmit={handleCreateDef} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Defect Name</label>
               <input required type="text" value={defForm.name} onChange={e => setDefForm({...defForm, name: e.target.value})} placeholder="e.g. Broken Stitch" className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
             </div>
             <div>
               <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Defect Code</label>
               <input required type="text" value={defForm.code} onChange={e => setDefForm({...defForm, code: e.target.value})} placeholder="e.g. IN-001" className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
             </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Category</label>
               <select required value={defForm.category_id} onChange={e => setDefForm({...defForm, category_id: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none">
                 <option value="">Select Category</option>
                 {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Severity</label>
               <select value={defForm.severity} onChange={e => setDefForm({...defForm, severity: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none">
                 {SEVERITIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
               </select>
             </div>
          </div>
          <button type="submit" className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl transition-all">Save Defect Code</button>
        </form>
      </Modal>
    </div>
  );
}
