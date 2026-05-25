"use client";

import React, { useEffect, useState, use } from "react";
import api from "@/services/api";
import {
  Building2, ChevronLeft, Mail, Phone, MapPin,
  Clock, Package, Plus, Edit3, Trash2, Save, X,
  Layers, GitBranch, CheckCircle2, AlertCircle, MinusCircle,
  ChevronDown, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IndustrialHeading } from "@/components/ui/PagePrimitives";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  idle:     { label: "Idle",     color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  partial:  { label: "Partial",  color: "text-amber-400  bg-amber-500/10  border-amber-500/20",  icon: <MinusCircle  className="w-3 h-3" /> },
  occupied: { label: "Occupied", color: "text-red-400    bg-red-500/10    border-red-500/20",    icon: <AlertCircle  className="w-3 h-3" /> },
};

export default function VendorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [vendor, setVendor] = useState<any>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [samplingOrders, setSamplingOrders] = useState<any[]>([]);
  const [bulkOrders, setBulkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"floors" | "sampling" | "bulk">("floors");
  const [expandedFloor, setExpandedFloor] = useState<string | null>(null);

  // Floor form state
  const [editingFloor, setEditingFloor] = useState<string | null>(null);
  const [newFloorName, setNewFloorName] = useState("");
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [floorForm, setFloorForm] = useState({ name: "", description: "" });

  // Line form state
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [showAddLineFor, setShowAddLineFor] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState({ name: "", description: "", capacity: "" });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [vendorRes, floorsRes, samplingRes, bulkRes] = await Promise.allSettled([
        api.get(`/vendors/${id}`),
        api.get(`/vendors/${id}/floors`),
        api.get(`/orders/`, { params: { vendor_id: id, track_type: "sampling" } }),
        api.get(`/orders/`, { params: { vendor_id: id, track_type: "bulk" } }),
      ]);
      if (vendorRes.status === "fulfilled") setVendor(vendorRes.value.data.data);
      if (floorsRes.status === "fulfilled") setFloors(floorsRes.value.data.data || []);
      if (samplingRes.status === "fulfilled") setSamplingOrders(samplingRes.value.data.data || []);
      if (bulkRes.status === "fulfilled") setBulkOrders(bulkRes.value.data.data || []);
    } catch (err) {
      console.warn("Failed to load vendor profile", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  // ── Floor CRUD ──────────────────────────────────────────────────────────
  const handleAddFloor = async () => {
    if (!floorForm.name.trim()) return;
    try {
      await api.post(`/vendors/${id}/floors`, floorForm);
      setFloorForm({ name: "", description: "" });
      setShowAddFloor(false);
      fetchAll();
    } catch (err) {
      console.warn("Failed to add floor", err);
      alert("Failed to add floor.");
    }
  };

  const handleUpdateFloor = async (floorId: string, data: any) => {
    try {
      await api.put(`/vendors/${id}/floors/${floorId}`, data);
      setEditingFloor(null);
      fetchAll();
    } catch (err) {
      console.warn("Failed to update floor", err);
      alert("Failed to update floor.");
    }
  };

  const handleDeleteFloor = async (floorId: string) => {
    if (!confirm("Delete this floor and all its lines?")) return;
    try {
      await api.delete(`/vendors/${id}/floors/${floorId}`);
      fetchAll();
    } catch (err) {
      console.warn("Failed to delete floor", err);
      alert("Failed to delete floor.");
    }
  };

  // ── Line CRUD ───────────────────────────────────────────────────────────
  const handleAddLine = async (floorId: string) => {
    if (!lineForm.name.trim()) return;
    try {
      await api.post(`/vendors/${id}/floors/${floorId}/lines`, {
        ...lineForm,
        capacity: lineForm.capacity ? parseInt(lineForm.capacity) : null,
      });
      setLineForm({ name: "", description: "", capacity: "" });
      setShowAddLineFor(null);
      fetchAll();
    } catch (err) {
      console.warn("Failed to add line", err);
      alert("Failed to add line.");
    }
  };

  const handleUpdateLine = async (floorId: string, lineId: string, data: any) => {
    try {
      await api.put(`/vendors/${id}/floors/${floorId}/lines/${lineId}`, data);
      setEditingLine(null);
      fetchAll();
    } catch (err) {
      console.warn("Failed to update line", err);
      alert("Failed to update line.");
    }
  };

  const handleDeleteLine = async (floorId: string, lineId: string) => {
    if (!confirm("Delete this line?")) return;
    try {
      await api.delete(`/vendors/${id}/floors/${floorId}/lines/${lineId}`);
      fetchAll();
    } catch (err) {
      console.warn("Failed to delete line", err);
      alert("Failed to delete line.");
    }
  };

  if (loading) return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (!vendor) return <div className="text-slate-950">Vendor not found.</div>;

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || statusConfig.idle;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${cfg.color}`}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  const totalFloors = floors.length;
  const idleFloors = floors.filter(f => f.status === "idle").length;
  const totalLines = floors.reduce((acc, f) => acc + (f.lines?.length || 0), 0);

  return (
    <div className="space-y-8 pb-20">
      {/* Back */}
      <Link href="/vendors" className="inline-flex items-center gap-3 text-slate-500 hover:text-slate-950 text-xs font-black uppercase tracking-widest transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Vendors
      </Link>

      {/* Vendor Hero */}
      <div className="bg-white border border-slate-200 rounded-[3rem] p-12 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[150px] -mr-48 -mt-48 rounded-full"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-10 relative z-10">
          <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-2xl flex-shrink-0">
            <Building2 className="w-12 h-12" />
          </div>
          <div className="flex-1">
            <IndustrialHeading
              eyebrow="Vendor Profile"
              title={vendor.name}
              highlight="Factory"
              subtitle="Floor, line, sampling and bulk production history"
              compact
            />
            <div className="flex flex-wrap gap-6 text-xs font-bold text-slate-600">
              {vendor.country && <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-400" /> {vendor.country}</span>}
              {vendor.email && <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-400" /> {vendor.email}</span>}
              {vendor.phone && <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-indigo-400" /> {vendor.phone}</span>}
            </div>
          </div>
          {/* Stats */}
          <div className="flex gap-4 flex-shrink-0">
            {[
              { label: "Floors", val: totalFloors, color: "indigo" },
              { label: "Lines",  val: totalLines,  color: "purple" },
              { label: "Sampling", val: samplingOrders.length, color: "blue" },
              { label: "Bulk",   val: bulkOrders.length, color: "emerald" },
            ].map(s => (
              <div key={s.label} className={`text-center p-5 bg-${s.color}-500/5 border border-${s.color}-500/20 rounded-[2rem]`}>
                <p className={`text-2xl font-black text-${s.color}-400`}>{s.val}</p>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-white p-2 rounded-[1.5rem] border border-slate-200 w-fit shadow-sm">
        {[
          { key: "floors",   label: "Floors & Lines", icon: <Layers className="w-4 h-4" /> },
          { key: "sampling", label: "Sampling History", icon: <Clock className="w-4 h-4" /> },
          { key: "bulk",     label: "Bulk History",    icon: <Package className="w-4 h-4" /> },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === t.key ? "bg-indigo-600 text-white shadow-xl" : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── FLOORS & LINES TAB ─────────────────────────────────────────── */}
      {activeTab === "floors" && (
        <div className="space-y-4">
          {/* Add Floor Button */}
          <div className="flex items-center justify-between">
            <h2 className="text-slate-950 font-black text-sm uppercase tracking-widest">Production Floors</h2>
            <button onClick={() => setShowAddFloor(true)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg">
              <Plus className="w-4 h-4" /> Add Floor
            </button>
          </div>

          {/* Add Floor Form */}
          {showAddFloor && (
            <div className="bg-white border border-indigo-200 rounded-[2.5rem] p-8 space-y-4 shadow-sm">
              <h3 className="text-indigo-400 font-black text-xs uppercase tracking-widest">New Floor</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Floor Name *</label>
                  <input type="text" placeholder="e.g. Floor 1" value={floorForm.name}
                    onChange={e => setFloorForm({ ...floorForm, name: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</label>
                  <input type="text" placeholder="e.g. Stitching Department" value={floorForm.description}
                    onChange={e => setFloorForm({ ...floorForm, description: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleAddFloor} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save Floor
                </button>
                <button onClick={() => { setShowAddFloor(false); setFloorForm({ name: "", description: "" }); }}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Floors List */}
          {floors.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white">
              <Layers className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-600 font-black uppercase tracking-widest text-sm">No floors added yet.</p>
              <button onClick={() => setShowAddFloor(true)} className="mt-4 text-indigo-400 text-xs font-black hover:underline uppercase tracking-widest">
                Add your first floor →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {floors.map((floor: any) => {
                const isExpanded = expandedFloor === floor.id;
                const statusCfg = statusConfig[floor.status] || statusConfig.idle;
                return (
                  <div key={floor.id} className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                    {/* Floor Header */}
                    <div className="flex items-center gap-6 p-8">
                      <button onClick={() => setExpandedFloor(isExpanded ? null : floor.id)}
                        className="flex items-center gap-4 flex-1 text-left">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                          <Layers className="w-6 h-6" />
                        </div>
                        <div>
                          {editingFloor === floor.id ? (
                            <input
                              autoFocus
                              defaultValue={floor.name}
                              id={`floor-edit-${floor.id}`}
                              className="bg-white border border-indigo-500 rounded-xl px-4 py-1.5 text-slate-950 font-black text-sm focus:outline-none"
                              onKeyDown={e => { if (e.key === "Enter") handleUpdateFloor(floor.id, { name: (e.target as HTMLInputElement).value }); }}
                            />
                          ) : (
                            <h3 className="text-slate-950 font-black text-lg uppercase tracking-tight">{floor.name}</h3>
                          )}
                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                            {floor.description || "No description"} • {floor.line_count || 0} Lines
                          </p>
                        </div>
                        <StatusBadge status={floor.status} />
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-600 ml-auto" /> : <ChevronRight className="w-5 h-5 text-slate-600 ml-auto" />}
                      </button>

                      {/* Floor Actions */}
                      <div className="flex gap-2">
                        {editingFloor === floor.id ? (
                          <>
                            <button onClick={() => {
                              const input = document.getElementById(`floor-edit-${floor.id}`) as HTMLInputElement;
                              handleUpdateFloor(floor.id, { name: input?.value });
                            }} className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingFloor(null)} className="p-2 bg-slate-50 text-slate-500 rounded-xl border border-slate-200 hover:text-slate-950 transition-all">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingFloor(floor.id); setExpandedFloor(floor.id); }}
                              className="p-2 bg-slate-50 text-slate-500 rounded-xl border border-slate-200 hover:text-indigo-600 hover:border-indigo-300 transition-all">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteFloor(floor.id)}
                              className="p-2 bg-slate-50 text-slate-500 rounded-xl border border-slate-200 hover:text-red-600 hover:border-red-300 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Lines (expandable) */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 p-8 space-y-3">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-slate-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                            <GitBranch className="w-4 h-4" /> Production Lines
                          </h4>
                          <button onClick={() => setShowAddLineFor(floor.id)}
                            className="flex items-center gap-2 px-5 py-2 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                            <Plus className="w-3.5 h-3.5" /> Add Line
                          </button>
                        </div>

                        {/* Add Line Form */}
                        {showAddLineFor === floor.id && (
                          <div className="bg-white border border-purple-200 rounded-2xl p-6 space-y-3 mb-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Line Name *</label>
                                <input type="text" placeholder="e.g. Line 1" value={lineForm.name}
                                  onChange={e => setLineForm({ ...lineForm, name: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-purple-500/40" />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                                <input type="text" placeholder="e.g. Stitching Line" value={lineForm.description}
                                  onChange={e => setLineForm({ ...lineForm, description: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-purple-500/40" />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Capacity</label>
                                <input type="number" placeholder="Workers/Machines" value={lineForm.capacity}
                                  onChange={e => setLineForm({ ...lineForm, capacity: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-purple-500/40" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleAddLine(floor.id)}
                                className="px-6 py-2 bg-purple-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-purple-500 flex items-center gap-1.5">
                                <Save className="w-3.5 h-3.5" /> Save Line
                              </button>
                              <button onClick={() => { setShowAddLineFor(null); setLineForm({ name: "", description: "", capacity: "" }); }}
                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Lines Grid */}
                        {floor.lines?.length === 0 ? (
                          <p className="text-slate-700 text-[10px] font-black uppercase tracking-widest text-center py-6">
                            No lines on this floor yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {floor.lines?.map((line: any) => {
                              const lineCfg = statusConfig[line.status] || statusConfig.idle;
                              return (
                                <div key={line.id}
                                  className={`flex items-center justify-between p-5 bg-white rounded-2xl border ${
                                    line.status === "occupied" ? "border-red-500/20" :
                                    line.status === "partial"  ? "border-amber-500/20" : "border-slate-800"
                                  } group`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${lineCfg.color}`}>
                                      <GitBranch className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="text-slate-950 font-black text-xs uppercase tracking-tight">{line.name}</p>
                                      {line.capacity && (
                                        <p className="text-slate-600 text-[9px] font-bold">{line.capacity} cap</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <StatusBadge status={line.status} />
                                    <button onClick={() => handleDeleteLine(floor.id, line.id)}
                                      className="p-1.5 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ORDER HISTORY TABS ──────────────────────────────────────────── */}
      {(activeTab === "sampling" || activeTab === "bulk") && (() => {
        const orders = activeTab === "sampling" ? samplingOrders : bulkOrders;
        const themeColor = activeTab === "sampling" ? "blue" : "emerald";
        return orders.length === 0 ? (
          <div className="py-32 text-center">
            <Package className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 font-black uppercase tracking-widest text-sm">No {activeTab} orders yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order: any) => (
              <Link key={order.id} href={`/orders/${order.id}`}
                className={`block bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 hover:border-${themeColor}-500/30 transition-all group`}>
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-12 h-12 rounded-xl bg-${themeColor}-500/10 border border-${themeColor}-500/20 flex items-center justify-center`}>
                    {activeTab === "sampling" ? <Clock className={`w-6 h-6 text-${themeColor}-400`} /> : <Package className={`w-6 h-6 text-${themeColor}-400`} />}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    order.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    order.status === "delayed"   ? "bg-red-500/10 text-red-400 border-red-500/20" :
                    `bg-${themeColor}-500/10 text-${themeColor}-400 border-${themeColor}-500/20`
                  }`}>
                    {order.status?.replace("_", " ")}
                  </span>
                </div>
                <h3 className="text-white font-black text-lg uppercase tracking-tighter mb-1">
                  {activeTab === "sampling" ? (order.product_name || "Unnamed") : (order.style_name || "Unnamed")}
                </h3>
                <p className={`text-${themeColor}-500 text-[10px] font-black uppercase tracking-widest mb-5`}>
                  {activeTab === "sampling" ? order.product_type : `PO: ${order.order_no}`}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                    <p className="text-slate-600 font-black uppercase tracking-widest mb-1">Deadline</p>
                    <p className="text-white font-bold">{order.ex_factory_date || "TBD"}</p>
                  </div>
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                    <p className="text-slate-600 font-black uppercase tracking-widest mb-1">Qty</p>
                    <p className="text-white font-bold">{order.quantity || "—"} Pcs</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
