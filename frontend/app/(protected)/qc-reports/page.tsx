"use client";

import React, { useEffect, useState, useMemo } from "react";
import api from "@/services/api";
import { 
  FileCheck, Plus, Search, Filter, AlertCircle, 
  CheckCircle2, Clock, MoreVertical, LayoutDashboard,
  ShieldCheck, ArrowRight, TrendingUp, BarChart3,
  Layers, Package, Building2, Table as TableIcon,
  ChevronLeft, ChevronRight, Eye, Settings2, Download,
  ClipboardList
} from 'lucide-react';
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const ALL_COLUMNS = [
  { id: "date", label: "Date" },
  { id: "hour", label: "Hour" },
  { id: "vendor_name", label: "Vendor" },
  { id: "floor_name", label: "Floor" },
  { id: "line_name", label: "Line" },
  { id: "style_name", label: "Style/PO" },
  { id: "article_code", label: "Article Code" },
  { id: "product_color", label: "Color" },
  { id: "report_type", label: "Report Type" },
  { id: "defect_name", label: "Defect Name" },
  { id: "defect_count", label: "Count" },
  { id: "severity", label: "Severity" },
  { id: "auditor_name", label: "Auditor" },
  { id: "action", label: "Remarks" }
];

const REPORT_TYPES = [
  {
    href: "/qc-reports/inline/new",
    title: "Inline QC Report",
    subtitle: "Operation-wise hourly tracking",
    icon: CheckCircle2,
    tone: "emerald",
    fields: "Vendor -> Floor -> Line",
  },
  {
    href: "/qc-reports/finish-endline/new?type=finish",
    title: "Finishing QC Report",
    subtitle: "Final quality and AQL control",
    icon: FileCheck,
    tone: "indigo",
    fields: "Style, PO, Article, Color",
  },
  {
    href: "/qc-reports/finish-endline/new?type=endline",
    title: "End Line QC Report",
    subtitle: "Line exit inspection",
    icon: ShieldCheck,
    tone: "rose",
    fields: "Line output and defect rate",
  },
  {
    href: "/qc-reports/cut-panel/new",
    title: "Cut Panel Report",
    subtitle: "Lot-wise cut part inspection",
    icon: Layers,
    tone: "amber",
    fields: "Cutting, print/embroidery, knitting/dyeing",
  },
  {
    href: "/qc-reports/batch-audit/new",
    title: "QA Batch Audit Report",
    subtitle: "Finishing batch audit",
    icon: FileCheck,
    tone: "cyan",
    fields: "Editable fault master and AQL result",
  },
  {
    href: "/qc-reports/random-inline/new",
    title: "Random Inline QC Report",
    subtitle: "Cut-to-pack process control & corrective action",
    icon: ClipboardList,
    tone: "violet",
    fields: "Cutting → Sewing → Print → Wash → Finishing → Packing",
  },
];

const toneClasses: Record<string, { icon: string; badge: string; ring: string }> = {
  emerald: { icon: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20", ring: "hover:border-emerald-500/40" },
  indigo: { icon: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", badge: "text-indigo-300 bg-indigo-500/10 border-indigo-500/20", ring: "hover:border-indigo-500/40" },
  rose: { icon: "bg-rose-500/10 text-rose-400 border-rose-500/20", badge: "text-rose-300 bg-rose-500/10 border-rose-500/20", ring: "hover:border-rose-500/40" },
  amber: { icon: "bg-amber-500/10 text-amber-400 border-amber-500/20", badge: "text-amber-300 bg-amber-500/10 border-amber-500/20", ring: "hover:border-amber-500/40" },
  cyan: { icon: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", badge: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20", ring: "hover:border-cyan-500/40" },
  violet: { icon: "bg-violet-500/10 text-violet-400 border-violet-500/20", badge: "text-violet-300 bg-violet-500/10 border-violet-500/20", ring: "hover:border-violet-500/40" },
};

export default function QCReportsDashboard() {
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard | analysis
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Analysis View State
  const [detailedLogs, setDetailedLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.map(c => c.id));
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [reportsRes, analyticsRes] = await Promise.all([
        api.get("/qc-reports/"),
        api.get("/qc-reports/analytics/")
      ]);
      setReports(reportsRes.data.data);
      setAnalytics(analyticsRes.data.data);
    } catch (err) {
      console.warn("Failed to fetch QC data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get("/qc-reports/detailed-logs/", {
        params: {
          skip: (page - 1) * limit,
          limit: limit
        }
      });
      setDetailedLogs(res.data.data.items);
      setTotalLogs(res.data.data.total);
    } catch (err) {
      console.warn("Failed to fetch detailed logs", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "dashboard") {
      fetchDashboardData();
    } else {
      fetchDetailedLogs();
    }
  }, [activeTab, page, limit]);

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return detailedLogs;
    const q = searchQuery.toLowerCase();
    return detailedLogs.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(q)
      )
    );
  }, [detailedLogs, searchQuery]);

  return (
    <div className="space-y-10 pb-20">
      <div className="flex justify-end">
        <div className="flex gap-4 relative">
          <Link href="/qc-reports/defects" 
            className="px-8 py-4 bg-white hover:bg-slate-100 text-slate-700 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all border border-slate-200 flex items-center gap-3 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-indigo-600" /> Defect Master
          </Link>
      </div>
      </div>

      {!isViewer && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Create Inspection</p>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-950 mt-1">Select Report Type</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {REPORT_TYPES.map((report) => {
              const Icon = report.icon;
              const tone = toneClasses[report.tone];
              return (
                <Link
                  key={report.href}
                  href={report.href}
                  className={`group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 ${tone.ring}`}
                >
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border ${tone.icon}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-black uppercase leading-tight text-slate-950">{report.title}</h3>
                  <p className="mt-2 min-h-10 text-xs font-bold leading-5 text-slate-500">{report.subtitle}</p>
                  <div className={`mt-4 rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${tone.badge}`}>
                    {report.fields}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-950">
                    Open Report
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-[1.5rem] border border-slate-200 w-fit shadow-sm">
        <button 
          onClick={() => setActiveTab("dashboard")}
          className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <LayoutDashboard className="w-4 h-4" /> Performance Hub
        </button>
        <button 
          onClick={() => setActiveTab("analysis")}
          className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <TableIcon className="w-4 h-4" /> Detailed Analysis
        </button>
      </div>

      {activeTab === "dashboard" ? (
        <>
          {/* Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Total Inspections", val: analytics?.total_inspections ?? 0, icon: <FileCheck />, color: "blue" },
              { label: "Avg. DHU (Quality)", val: `${analytics?.avg_dhu ?? 0}%`, icon: <AlertCircle />, color: "amber" },
              { label: "Avg. FPY (Yield)", val: `${analytics?.avg_fpy ?? 0}%`, icon: <TrendingUp />, color: "emerald" },
              { label: "Total Defects", val: analytics?.total_defects ?? 0, icon: <BarChart3 />, color: "rose" },
            ].map((s, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-[2rem] p-8 relative overflow-hidden group shadow-sm">
                <div className={`absolute top-0 right-0 w-24 h-24 bg-${s.color}-500/10 blur-[50px] -mr-12 -mt-12 group-hover:bg-${s.color}-500/20 transition-all`}></div>
                <div className={`w-12 h-12 rounded-2xl bg-${s.color}-500/10 border border-${s.color}-500/20 flex items-center justify-center text-${s.color}-400 mb-6`}>
                  {s.icon}
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-3xl font-black text-slate-950 tracking-tighter italic">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Main List Section */}
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <h2 className="text-slate-950 font-black text-sm uppercase tracking-widest flex items-center gap-3">
                    <Package className="w-5 h-5 text-indigo-600" /> Recent QC Logs
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-200">
                      <tr>
                        <th className="px-8 py-5">Report Info</th>
                        <th className="px-8 py-5">Location</th>
                        <th className="px-8 py-5">Performance</th>
                        <th className="px-8 py-5 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loading ? (
                        <tr><td colSpan={4} className="py-20 text-center"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                      ) : reports.length === 0 ? (
                        <tr><td colSpan={4} className="py-24 text-center text-slate-600 text-xs font-black uppercase">No inspection data found.</td></tr>
                      ) : reports.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-all group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 border border-slate-200 transition-all">
                                  <FileCheck className="w-5 h-5" />
                               </div>
                               <div>
                                 <p className="text-slate-950 font-black text-xs uppercase tracking-tight">
                                   {r.style_name || 'N/A'}
                                   {r.article_code && <span className="ml-2 text-indigo-400">[{r.article_code}]</span>}
                                 </p>
                                 <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest mt-0.5">
                                   {r.report_type.replace('_', ' ')} • {r.inspection_date}
                                   {r.product_color && <span className="ml-2 text-slate-500 italic">({r.product_color})</span>}
                                 </p>
                               </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                               <Building2 className="w-3.5 h-3.5 text-slate-600" /> {r.vendor_name}
                             </p>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                                  <p className="text-emerald-500 text-[11px] font-black italic">{r.dhu_percent}%</p>
                                  <p className="text-[8px] text-slate-700 font-black uppercase mt-0.5">DHU</p>
                               </div>
                               <div className="p-2.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-center min-w-[50px]">
                                  <p className="text-slate-950 text-[11px] font-black italic">{r.total_defects}</p>
                                  <p className="text-[8px] text-slate-700 font-black uppercase mt-0.5">FLTS</p>
                               </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <Link href={`/qc-reports/${r.id}`} className="p-3 bg-slate-50 text-slate-500 hover:text-slate-950 rounded-xl border border-slate-200 transition-all inline-block">
                               <ArrowRight className="w-4 h-4" />
                             </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Quick Analytics */}
            <div className="xl:col-span-1 space-y-8">
               {/* Top Defects */}
               <div className="bg-white border border-slate-200 rounded-[2rem] p-10 space-y-8 shadow-sm">
                  <h3 className="text-slate-950 font-black text-xs uppercase tracking-widest flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-500" /> Top 5 Defects
                  </h3>
                  <div className="space-y-4">
                    {analytics?.top_defects?.map((d: any, idx: number) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="text-slate-950 text-[10px] font-black uppercase tracking-tight">{d.name}</span>
                          <span className="text-slate-500 text-[9px] font-black italic">{d.count} Instances</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(d.count / (analytics.total_defects || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        </>
      ) : (
        /* Detailed Analysis View (Excel Style) */
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col min-h-[600px]">
          <div className="p-8 border-b border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/30">
            <div className="flex items-center gap-6">
              <h2 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-3">
                <Layers className="w-5 h-5 text-indigo-400" /> Defects Log
              </h2>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  className="bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-[10px] font-black text-white w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 uppercase tracking-widest"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setShowColumnToggle(!showColumnToggle)}
                  className="px-6 py-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:text-white transition-all shadow-inner"
                >
                  <Settings2 className="w-4 h-4" /> Show Columns
                </button>
                {showColumnToggle && (
                  <div className="absolute right-0 mt-3 w-64 bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl z-50 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Visible Data</p>
                      <button onClick={() => setShowColumnToggle(false)} className="text-slate-600 hover:text-white"><CloseIcon size={14} /></button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                      {ALL_COLUMNS.map(col => (
                        <label key={col.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800 cursor-pointer transition-all">
                          <input 
                            type="checkbox" 
                            checked={visibleColumns.includes(col.id)} 
                            onChange={() => toggleColumn(col.id)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button className="px-6 py-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-600 hover:text-white transition-all shadow-xl">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-950/80 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  {ALL_COLUMNS.filter(c => visibleColumns.includes(c.id)).map(col => (
                    <th key={col.id} className="px-8 py-5 border-r border-slate-800/50 last:border-0">{col.label}</th>
                  ))}
                  <th className="px-8 py-5 text-right sticky right-0 bg-slate-950">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {loadingLogs ? (
                  <tr><td colSpan={visibleColumns.length + 1} className="py-20 text-center"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={visibleColumns.length + 1} className="py-24 text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">No logs match your criteria.</td></tr>
                ) : filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-700/10 transition-all group">
                    {ALL_COLUMNS.filter(c => visibleColumns.includes(c.id)).map(col => (
                      <td key={col.id} className="px-8 py-5 border-r border-slate-800/20 last:border-0 whitespace-nowrap">
                        {col.id === "severity" ? (
                          <div className="flex flex-col gap-1">
                            {(log.defects || []).map((d: any, di: number) => (
                              <span key={di} className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border w-fit ${
                                d.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                                d.severity === 'major' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}>
                                {d.severity}
                              </span>
                            ))}
                          </div>
                        ) : col.id === "defect_name" ? (
                          <div className="flex flex-col gap-1">
                            {(log.defects || []).map((d: any, di: number) => (
                              <span key={di} className="text-white font-bold text-[10px] uppercase tracking-tight">
                                {d.defect_code ? `${d.defect_code}: ` : ""}{d.defect_name}
                              </span>
                            ))}
                          </div>
                        ) : col.id === "defect_count" ? (
                          <div className="flex flex-col gap-1">
                            {(log.defects || []).map((d: any, di: number) => (
                              <span key={di} className="text-white font-black text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 w-fit">
                                {d.count}
                              </span>
                            ))}
                          </div>
                        ) : col.id === "date" ? (
                          <span className="text-white font-black text-[11px] italic tracking-tighter">{log[col.id]}</span>
                        ) : (
                          <span className="text-slate-400 font-bold text-[10px] uppercase tracking-tight">{log[col.id] || "---"}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-8 py-5 text-right sticky right-0 bg-slate-900/50 backdrop-blur-sm">
                       <Link href={`/qc-reports/${log.report_id}`} className="p-2.5 bg-slate-800 text-slate-500 hover:text-white rounded-xl border border-slate-700 transition-all inline-block shadow-inner">
                         <Eye className="w-3.5 h-3.5" />
                       </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-8 bg-slate-900/50 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                Showing <span className="text-white">{(page - 1) * limit + 1} - {Math.min(page * limit, totalLogs)}</span> of {totalLogs} records
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Rows per page:</span>
                <select 
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-[10px] font-black text-white focus:outline-none"
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-3 bg-slate-900 border border-slate-800 text-slate-500 hover:text-white rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex gap-1.5 mx-2">
                {Array.from({ length: Math.min(5, Math.ceil(totalLogs / limit)) }).map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setPage(i + 1)}
                    className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${page === i + 1 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                disabled={page >= Math.ceil(totalLogs / limit)}
                onClick={() => setPage(p => p + 1)}
                className="p-3 bg-slate-900 border border-slate-800 text-slate-500 hover:text-white rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CloseIcon({ size }: { size: number }) {
  return <Plus className="rotate-45" size={size} />;
}
