"use client";

import React, { useEffect, useState, use } from "react";
import api from "@/services/api";
import {
  Calendar, Clock, CheckCircle2, AlertCircle, ChevronLeft,
  Edit3, Save, X, Lock, ArrowRight, Upload, FileText,
  ImageIcon, Info, ListChecks, Timer, Zap, Package, Truck, ArrowRightCircle,
  GitBranch, RefreshCcw, MessageSquare, ListOrdered, CheckCircle, ShieldCheck,
  Paperclip, Download, ExternalLink, Trash2, AlertTriangle, ThumbsUp, ThumbsDown,
  AlertOctagon, ArrowUpRight, RotateCcw, CheckSquare
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { IndustrialHeading } from "@/components/ui/PagePrimitives";
import { ConfirmDialog, FeedbackDialog } from "@/components/ui/ActionDialogs";
import OrderHistoryModal from "@/components/orders/OrderHistoryModal";
import StageComments from "@/components/ui/StageComments";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [bulkClasses, setBulkClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stageData, setStageData] = useState<any>({});
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingStageAction, setPendingStageAction] = useState<{ stageId: string; status: string; label: string } | null>(null);
  const [reworkDialog, setReworkDialog] = useState<{ stageId: string; repeatFromStageId: string; reason: string; plan: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  // 3-state approval dialog
  const [approvalDialog, setApprovalDialog] = useState<{ stageId: string; stageName: string } | null>(null);
  const [approvalData, setApprovalData] = useState({ approval: "", condition_type: "", reason: "", plan: "" });
  // Move to Bulk
  const [moveToBulkDialog, setMoveToBulkDialog] = useState(false);
  const [moveToBulkData, setMoveToBulkData] = useState({ bulk_class_id: "", vendor_id: "", new_class_name: "" });
  // Reorder
  const [reorderDialog, setReorderDialog] = useState(false);
  const [reorderData, setReorderData] = useState({ quantity: "", ex_factory_date: "", requirements: "", vendor_id: "" });

  const fetchData = async () => {
    try {
      const [orderRes, stagesRes, vendorsRes, bulkClassRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/stages`),
        api.get("/vendors/"),
        api.get("/orders/bulk-classes"),
      ]);

      const oData = orderRes.data.data;
      const sData = stagesRes.data.data;

      setOrder(oData);
      setStages(sData);
      setVendors(vendorsRes.data.data || []);
      setBulkClasses(bulkClassRes.data.data || []);

      // Default Selection: The first non-completed stage (the working stage)
      const currentWorking = sData.find((s: any) => s.status !== "completed") || sData[sData.length - 1];
      if (currentWorking) {
        setSelectedStageId(currentWorking.id);
      }
    } catch (err) {
      console.warn("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleUpdateStageStatus = async (stageId: string, status: string) => {
    setUpdating(true);
    try {
      await api.put(`/orders/stages/${stageId}`, {
        status,
        remarks: stageData.remarks || ""
      });

      // Refetch data
      const [orderRes, stagesRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/stages`),
      ]);

      setOrder(orderRes.data.data);
      const newStages = stagesRes.data.data;
      setStages(newStages);

      // Auto-move to next stage if completed
      if (status === "completed") {
        const currentIndex = newStages.findIndex((s: any) => s.id === stageId);
        if (currentIndex < newStages.length - 1) {
          setSelectedStageId(newStages[currentIndex + 1].id);
        }
      }

      setStageData({}); // Clear remarks
      setFeedback({ type: "success", title: "Mission Successful", message: "Stage updated successfully." });
    } catch (err: any) {
      setFeedback({ type: "error", title: "Operation Failed", message: err.response?.data?.detail || "Failed to update stage" });
    } finally {
      setUpdating(false);
      setPendingStageAction(null);
    }
  };

  const handleApproveStage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!approvalDialog) return;
    setUpdating(true);
    try {
      await api.post(`/orders/stages/${approvalDialog.stageId}/approve`, approvalData);
      await fetchData();
      setApprovalDialog(null);
      setApprovalData({ approval: "", condition_type: "", reason: "", plan: "" });
      setFeedback({ type: "success", title: "Mission Successful", message: `Stage ${approvalData.approval.replace(/_/g, " ")} recorded.` });
    } catch (err: any) {
      setFeedback({ type: "error", title: "Operation Failed", message: err.response?.data?.detail || "Failed to record approval." });
    } finally {
      setUpdating(false);
    }
  };

  const handleMoveToBulk = async (event: React.FormEvent) => {
    event.preventDefault();
    setUpdating(true);
    try {
      let bulk_class_id = moveToBulkData.bulk_class_id;
      // If no existing class selected but new name given, create it first
      if (!bulk_class_id && moveToBulkData.new_class_name.trim()) {
        const classRes = await api.post("/orders/bulk-classes", {
          name: moveToBulkData.new_class_name.trim(),
          vendor_id: moveToBulkData.vendor_id,
        });
        bulk_class_id = classRes.data.data?.id;
      }
      if (!bulk_class_id) throw new Error("Please select or create a Bulk Project.");
      const res = await api.post(`/orders/${id}/promote-to-bulk`, {
        bulk_class_id,
        vendor_id: moveToBulkData.vendor_id,
      });
      setMoveToBulkDialog(false);
      setFeedback({ type: "success", title: "Promoted!", message: "Sample successfully promoted to bulk order." });
      const newId = res.data.data?.id;
      if (newId) setTimeout(() => router.push(`/orders/${newId}`), 1200);
    } catch (err: any) {
      setFeedback({ type: "error", title: "Failed", message: err.response?.data?.detail || err.message || "Failed to promote to bulk." });
    } finally {
      setUpdating(false);
    }
  };

  const handleReorder = async (event: React.FormEvent) => {
    event.preventDefault();
    setUpdating(true);
    try {
      const res = await api.post(`/orders/${id}/reorder`, {
        quantity: Number(reorderData.quantity),
        ex_factory_date: reorderData.ex_factory_date,
        requirements: reorderData.requirements,
        vendor_id: reorderData.vendor_id,
      });
      setReorderDialog(false);
      setFeedback({ type: "success", title: "Reorder Created!", message: "New bulk order created successfully." });
      const newId = res.data.data?.id;
      if (newId) setTimeout(() => router.push(`/orders/${newId}`), 1200);
    } catch (err: any) {
      setFeedback({ type: "error", title: "Failed", message: err.response?.data?.detail || "Failed to create reorder." });
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectForRework = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reworkDialog) return;
    setUpdating(true);
    try {
      await api.post(`/orders/stages/${reworkDialog.stageId}/rework`, {
        repeat_from_stage_id: reworkDialog.repeatFromStageId,
        reason: reworkDialog.reason,
        plan: reworkDialog.plan,
      });
      await fetchData();
      setStageData({});
      setReworkDialog(null);
      setFeedback({ type: "success", title: "Mission Successful", message: "Stage rejected and new iteration started." });
    } catch (err: any) {
      setFeedback({ type: "error", title: "Operation Failed", message: err.response?.data?.detail || "Failed to start rework iteration." });
    } finally {
      setUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post(`/orders/${id}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      await fetchData();
    } catch (err) {
      alert("Failed to upload attachment.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!order) return <div className="p-20 text-white font-black uppercase tracking-widest text-center bg-slate-950 min-h-screen">Order not found.</div>;

  const isSampling = order.track_type === "sampling";
  const themeColor = isSampling ? "blue" : "emerald";
  const themeHex = isSampling ? "#3b82f6" : "#10b981";

  const currentStage = stages.find(s => s.id === selectedStageId);
  const currentIndex = currentStage ? stages.indexOf(currentStage) : -1;
  const STAGE_LABELS: Record<string, string> = {
    customer_order_wrapping_card: "Customer Order / Wrapping Card",
    pp_sample_development: "PP Sample Development",
    small_vet_dying_shade_band_continuity_approval: "Small Vet Dying — Shade Band Continuity Approval",
    full_flag_dying_production: "Full Flag Dying Production",
    sublimation: "Sublimation",
    bulk_fabric_cutting: "Bulk Fabric Cutting",
    printing_embroidery_embellishment: "Printing / Embroidery / Embellishment",
    stitching: "Stitching",
    end_line_qc: "End Line QC",
    washing: "Washing",
    pressing: "Pressing",
    finishing: "Finishing",
    packing: "Packing",
    final_random_inspection: "Final Random Inspection",
    shipment_ex_factory: "Shipment / Ex-Factory",
    sample_start: "Sample Start",
    fabrication: "Fabrication",
    fabric_cutting: "Fabric Cutting",
    embellishment: "Printing / Embroidery / Embellishment",
    qc_check: "PPS QC Check",
    dispatch: "Dispatch",
    sample_completed: "Sample Completed",
  };

  const stageLabel = (value?: string) => {
    if (!value) return "";
    if (STAGE_LABELS[value]) return STAGE_LABELS[value];
    return value.replace(/_/g, " ");
  };

  // Stages that use the 3-state approval panel
  const APPROVAL_GATED_STAGES = isSampling
    ? ["qc_check"]
    : ["small_vet_dying_shade_band_continuity_approval", "full_flag_dying_production", "final_random_inspection", "pp_sample_development"];

  const isApprovalGated = currentStage && APPROVAL_GATED_STAGES.includes(currentStage.stage_name);

  // Ex-factory date crossed check (visual only)
  const today = new Date();
  const exFactoryDate = order?.ex_factory_date ? new Date(order.ex_factory_date) : null;
  const isExFactoryPassed = exFactoryDate && today > exFactoryDate && order?.status !== "completed";

  // Can always update remarks/data if it's not locked
  const isSelectable = (idx: number) => idx === 0 || stages[idx - 1].status === "completed";
  const canUpdateCurrent = currentStage && isSelectable(currentIndex);
  const canRejectSampleQc = isSampling && currentStage?.stage_name === "qc_check" && canUpdateCurrent;
  const canRejectBulkApproval = !isSampling && canUpdateCurrent && [
    "pp_sample_development",
    "customer_approval",
    "fabric_shade_continuity_approval",
  ].includes(currentStage?.stage_name);
  const canRejectCurrentStage = Boolean(canRejectSampleQc || canRejectBulkApproval);
  const repeatableStages = canRejectCurrentStage
    ? stages.filter((stage) => {
        if (!currentStage) return false;
        if (canRejectSampleQc) return stage.stage_order <= currentStage.stage_order && stage.stage_name !== "qc_check";
        if (currentStage.stage_name === "customer_approval") return stage.stage_order <= currentStage.stage_order;
        return stage.id === currentStage.id;
      })
    : [];
  const referenceAttachments = order.reference_attachments?.length
    ? order.reference_attachments
    : order.reference_image
      ? [{ url: order.reference_image, requirement: "", filename: order.reference_image.split("/").pop() }]
      : [];

  // Group consecutive stages by chunk
  const groupedTimeline: any[] = [];
  let currentChunk: any = null;

  stages.forEach((s, idx) => {
    if (s.chunk_id) {
      if (currentChunk && currentChunk.id === s.chunk_id) {
        currentChunk.stages.push({ s, idx });
      } else {
        currentChunk = {
          type: "chunk",
          id: s.chunk_id,
          name: s.chunk_name,
          target_days: s.chunk_target_days,
          stages: [{ s, idx }]
        };
        groupedTimeline.push(currentChunk);
      }
    } else {
      currentChunk = null;
      groupedTimeline.push({
        type: "standalone",
        s,
        idx
      });
    }
  });

  const getBackUrl = () => {
    if (!order) return "/dashboard";
    if (order.track_type === "sampling") {
      if (order.sample_class_id) {
        return `/orders?track=sampling&sample_class_id=${order.sample_class_id}`;
      }
      return "/samples";
    } else {
      if (order.bulk_class_id) {
        return `/orders?track=bulk&bulk_class_id=${order.bulk_class_id}`;
      }
      return "/bulk-projects";
    }
  };

  const getBackLabel = () => {
    if (!order) return "Back";
    if (order.track_type === "sampling") {
      return order.sample_class_name ? `Back to ${order.sample_class_name}` : "Back to Classes";
    } else {
      return order.bulk_class_name ? `Back to ${order.bulk_class_name}` : "Back to Classes";
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.push(getBackUrl())} 
            className="px-5 py-4 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-2xl transition-all shadow-inner group flex items-center gap-2 active:scale-95 text-[10px] font-black uppercase tracking-[0.2em]"
            title={getBackLabel()}
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>{getBackLabel()}</span>
          </button>
          <div className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <IndustrialHeading
                eyebrow={isSampling ? (order.sample_class_name ? `Sample Class (${order.sample_class_name}) Order Details` : "Sample Class Order Details") : "Bulk Order Detail"}
                title={isSampling ? order.product_name : order.style_name}
                highlight={order.track_type}
                subtitle="Stage timing, attachments, comments and current production status"
                compact
              />
              <div className="flex gap-2 flex-wrap">
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 bg-indigo-500/5 text-indigo-400`}>
                  {order.track_type}
                </span>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    order.status === 'delayed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      `bg-indigo-500/10 text-indigo-400 border-indigo-500/20`
                  }`}>
                  {order.status}
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400"
                >
                  History
                </button>
                {/* Move to Bulk button — only for completed sample orders */}
                {isSampling && order.status === "completed" && (
                  <button
                    type="button"
                    onClick={() => setMoveToBulkDialog(true)}
                    className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1.5"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" /> Move to Bulk
                  </button>
                )}
                {/* Reorder button — only for completed bulk orders */}
                {!isSampling && order.status === "completed" && (
                  <button
                    type="button"
                    onClick={() => { setReorderData({ quantity: String(order.quantity || ""), ex_factory_date: "", requirements: "", vendor_id: String(order.vendor_id || "") }); setReorderDialog(true); }}
                    className="rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 hover:bg-amber-500/20 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reorder
                  </button>
                )}
              </div>
            </div>
            <p className="text-slate-500 text-sm font-bold mt-3 uppercase tracking-[0.2em] flex items-center gap-3">
              <Package className="w-4 h-4" /> PO: {order.order_no || "N/A"} • <span className={`text-${themeColor}-400`}>{order.vendor_name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-[2rem] border border-slate-800 shadow-2xl">
          <div className="px-6 py-2 text-center">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Production Start</p>
            <p className="text-white font-black text-xs uppercase tracking-tighter italic">
              {order.order_placement_date || "---"}
            </p>
          </div>
          <div className="w-px h-10 bg-slate-800"></div>
          <div className="px-6 py-2 text-center">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Target Ex-Factory</p>
            <p className="text-emerald-400 font-black text-xs uppercase tracking-tighter italic">{order.ex_factory_date || "TBD"}</p>
          </div>
        </div>
      </div>

      {/* Ex-Factory Date Passed Alert Banner */}
      {isExFactoryPassed && (
        <div className="flex items-center gap-4 bg-red-500/10 border border-red-500/30 rounded-2xl px-6 py-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 animate-pulse" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-red-400">⚠ Ex-Factory Date Passed — All Active Stages Are in Failure Risk</p>
            <p className="text-[9px] font-bold text-red-500/70 uppercase tracking-widest mt-0.5">Target was {order.ex_factory_date}. Immediate corrective action required.</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">

        {/* Timeline Left Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl">
            <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-8 flex items-center gap-3 opacity-60">
              <Timer className="w-4 h-4" /> Production Timeline
            </h3>
            <div className="space-y-4">
              {groupedTimeline.map((item, groupIdx) => {
                if (item.type === "standalone") {
                  const s = item.s;
                  const idx = item.idx;
                  const isCompleted = s.status === "completed";
                  const isCurrent = s.status === "in_progress";
                  const isSelected = selectedStageId === s.id;
                  const isLocked = !isSelectable(idx);

                  // SLA Logic
                  const targetDate = s.target_date ? new Date(s.target_date) : null;
                  const compDate = s.completion_date ? new Date(s.completion_date) : null;
                  const isDelayed = !isCompleted && targetDate && today > targetDate;
                  const isOverdue = isCompleted && targetDate && compDate && compDate > targetDate;
                  // Ex-factory: mark ALL non-completed stages red
                  const isExFactoryFail = isExFactoryPassed && !isCompleted;

                  return (
                    <button
                      key={s.id}
                      onClick={() => !isLocked && setSelectedStageId(s.id)}
                      disabled={isLocked}
                      style={isSelected ? { backgroundColor: themeHex, borderColor: themeHex, color: "#ffffff" } : undefined}
                      className={`w-full min-w-0 group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${isSelected ? "text-white shadow-xl scale-[1.02] z-10" :
                          isLocked ? "bg-slate-950/20 border-slate-900 text-slate-800 opacity-40 cursor-not-allowed" :
                            isExFactoryFail ? "bg-red-500/15 border-red-500/40 text-red-400 hover:border-red-500/60" :
                            isDelayed ? "bg-red-500/10 border-red-500/30 text-red-500 hover:border-red-500/50" :
                              isCompleted ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:border-emerald-500/50" :
                                "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shadow-inner ${isSelected ? "bg-white/20" : isLocked ? "bg-slate-950" : isExFactoryFail ? "bg-red-500/20" : isDelayed ? "bg-red-500/20" : isCompleted ? "bg-emerald-500/20" : "bg-slate-950"
                        }`}>
                        {isLocked ? <Lock className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <div className="min-w-0 text-left flex-1">
                        <p className="break-words text-[10px] font-black uppercase tracking-widest leading-5">{stageLabel(s.stage_name)}</p>
                        <p className="text-[8px] font-bold opacity-60 uppercase mt-0.5">
                          {isCompleted ? `Comp: ${compDate?.toLocaleDateString()}` : `Tgt: ${targetDate?.toLocaleDateString() || "---"}`}
                        </p>
                      </div>
                      {isCompleted && !isOverdue && <CheckCircle className="w-4 h-4" />}
                      {isExFactoryFail && <AlertOctagon className="w-4 h-4 animate-pulse" />}
                      {!isExFactoryFail && isDelayed && <AlertCircle className="w-4 h-4 animate-pulse" />}
                      {isCurrent && !isExFactoryFail && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    </button>
                  );
                } else {
                  // Render a chunk block
                  const chunkCompleted = item.stages.every((p: any) => p.s.status === "completed");
                  const chunkCurrent = item.stages.some((p: any) => p.s.status === "in_progress");
                  const firstStage = item.stages[0].s;
                  const chunkTargetDate = firstStage.target_date ? new Date(firstStage.target_date) : null;
                  
                  return (
                    <div key={item.id} className="bg-slate-950/40 border border-slate-850 rounded-[2rem] p-4 space-y-3 relative overflow-hidden">
                      <div className="flex items-center justify-between mb-1 px-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${chunkCompleted ? 'bg-emerald-500' : chunkCurrent ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}></span>
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 truncate max-w-[130px]">{item.name}</span>
                        </div>
                        <span className="text-[8px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          {item.target_days}D Chunk
                        </span>
                      </div>
                      <div className="space-y-2 pl-2 border-l border-slate-800">
                        {item.stages.map(({ s, idx }: any) => {
                          const isCompleted = s.status === "completed";
                          const isCurrent = s.status === "in_progress";
                          const isSelected = selectedStageId === s.id;
                          const isLocked = !isSelectable(idx);

                          // SLA Logic
                          const today = new Date();
                          const targetDate = s.target_date ? new Date(s.target_date) : null;
                          const compDate = s.completion_date ? new Date(s.completion_date) : null;
                          const isDelayed = !isCompleted && targetDate && today > targetDate;
                          const isOverdue = isCompleted && targetDate && compDate && compDate > targetDate;

                          return (
                            <button
                              key={s.id}
                              onClick={() => !isLocked && setSelectedStageId(s.id)}
                              disabled={isLocked}
                              style={isSelected ? { backgroundColor: themeHex, borderColor: themeHex, color: "#ffffff" } : undefined}
                              className={`w-full min-w-0 group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${isSelected ? "text-white shadow-xl scale-[1.01] z-10" :
                                  isLocked ? "bg-slate-950/20 border-slate-900 text-slate-800 opacity-40 cursor-not-allowed" :
                                    isDelayed ? "bg-red-500/10 border-red-500/30 text-red-500 hover:border-red-500/50" :
                                      isCompleted ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:border-emerald-500/50" :
                                        "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                                }`}
                            >
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[8px] font-black shadow-inner ${isSelected ? "bg-white/20" : isLocked ? "bg-slate-950" : isDelayed ? "bg-red-500/20" : isCompleted ? "bg-emerald-500/20" : "bg-slate-950"
                                }`}>
                                {isLocked ? <Lock className="w-2.5 h-2.5" /> : idx + 1}
                              </div>
                              <div className="min-w-0 text-left flex-1">
                                <p className="break-words text-[9px] font-black uppercase tracking-widest leading-4">{stageLabel(s.stage_name)}</p>
                              </div>
                              {isCompleted && !isOverdue && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                              {isDelayed && <AlertCircle className="w-3.5 h-3.5 text-red-500 animate-pulse" />}
                              {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>

          {/* Quick Summary Info */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3 opacity-60 italic">
              <Info className="w-4 h-4" /> Technical Stats
            </h3>
            <div className="space-y-6">
              <div>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Target Quantity</p>
                <p className="text-white font-black text-lg">{order.quantity} Pcs</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Category</p>
                <p className="text-white font-black text-xs uppercase tracking-widest">{order.product_type || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stage Detail Panel */}
        <div className="lg:col-span-3 space-y-8">
          {currentStage && (
            <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-96 h-96 bg-${themeColor}-500/5 blur-[120px] -mr-48 -mt-48 rounded-full`}></div>

              <div className="flex flex-col md:flex-row justify-between items-start gap-8 relative z-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div style={{ backgroundColor: themeHex }} className="w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-2xl rotate-3">
                      <Zap className="w-10 h-10" />
                    </div>
                    <div>
                      <h2 className="text-white font-black text-4xl uppercase tracking-tighter italic">
                        {currentStage.stage_name.replace(/_/g, ' ')}
                      </h2>
                      <div className="flex items-center gap-4 mt-3">
                        <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${currentStage.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            `bg-${themeColor}-500/10 text-${themeColor}-400 border-${themeColor}-500/20`
                          }`}>
                          {currentStage.status}
                        </span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <GitBranch className="w-4 h-4" /> Iteration {order.current_iteration || 1} • Sequential Stage {currentStage.stage_order}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {canUpdateCurrent && (
                  <div className="flex flex-wrap gap-3">
                    {currentStage.status === "pending" ? (
                      <button
                        onClick={() => setPendingStageAction({ stageId: currentStage.id, status: "in_progress", label: "start this phase" })}
                        disabled={updating}
                        className="px-8 py-4 bg-white text-slate-950 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                      >
                        <Clock className="w-5 h-5" /> Start Phase
                      </button>
                    ) : currentStage.status === "in_progress" ? (
                      <div className="space-y-4">
                        {/* 3-State Approval Panel for QC / approval-gated stages */}
                        {isApprovalGated ? (
                          <div className="grid grid-cols-1 gap-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500 mb-1">QC Decision</p>
                            <button
                              onClick={() => { setApprovalData({ approval: "approved", condition_type: "", reason: "", plan: "" }); setApprovalDialog({ stageId: currentStage.id, stageName: currentStage.stage_name }); }}
                              disabled={updating}
                              className="w-full px-8 py-4 bg-emerald-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 justify-center"
                            >
                              <ThumbsUp className="w-5 h-5" /> Approved
                            </button>
                            <button
                              onClick={() => { setApprovalData({ approval: "conditional_approved", condition_type: "", reason: "", plan: "" }); setApprovalDialog({ stageId: currentStage.id, stageName: currentStage.stage_name }); }}
                              disabled={updating}
                              className="w-full px-8 py-4 bg-amber-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-amber-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 justify-center"
                            >
                              <AlertCircle className="w-5 h-5" /> Conditional Approved
                            </button>
                            <button
                              onClick={() => { setApprovalData({ approval: "not_approved", condition_type: "", reason: "", plan: "" }); setApprovalDialog({ stageId: currentStage.id, stageName: currentStage.stage_name }); }}
                              disabled={updating}
                              className="w-full px-8 py-4 bg-red-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-red-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 justify-center"
                            >
                              <ThumbsDown className="w-5 h-5" /> Not Approved
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setPendingStageAction({ stageId: currentStage.id, status: "completed", label: "confirm this phase completion" })}
                              disabled={updating}
                              className="w-full px-8 py-4 bg-emerald-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 justify-center"
                            >
                              <CheckCircle2 className="w-5 h-5" /> Confirm Completion
                            </button>
                            {canRejectCurrentStage && repeatableStages.length > 0 && (
                              <button
                                onClick={() => setReworkDialog({
                                  stageId: currentStage.id,
                                  repeatFromStageId: canRejectBulkApproval && currentStage.stage_name !== "customer_approval" ? currentStage.id : repeatableStages[repeatableStages.length - 1].id,
                                  reason: stageData.remarks || "",
                                  plan: "",
                                })}
                                disabled={updating}
                                className="w-full px-8 py-4 bg-red-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-red-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 justify-center"
                              >
                                <RefreshCcw className="w-5 h-5" /> Reject / Repeat Stage
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-2xl">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Phase Completed</span>
                        {currentStage.approval_status === "conditional_approved" && (
                          <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                            Conditional: {currentStage.conditional_action}
                          </span>
                        )}
                        {canRejectCurrentStage && repeatableStages.length > 0 && (
                          <button
                            onClick={() => setReworkDialog({
                              stageId: currentStage.id,
                              repeatFromStageId: canRejectBulkApproval && currentStage.stage_name !== "customer_approval" ? currentStage.id : repeatableStages[repeatableStages.length - 1].id,
                              reason: stageData.remarks || "",
                              plan: "",
                            })}
                            disabled={updating}
                            className="text-[9px] font-black text-white bg-red-600 px-4 py-2 rounded-xl hover:bg-red-500 transition-all border border-red-500/40"
                          >
                            Reject / Repeat
                          </button>
                        )}
                        <button
                          onClick={() => setPendingStageAction({ stageId: currentStage.id, status: "completed", label: "save this completed phase" })}
                          disabled={updating}
                          className="ml-4 text-[9px] font-black text-white bg-slate-900 px-4 py-2 rounded-xl hover:bg-slate-800 transition-all border border-slate-800"
                        >
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!canUpdateCurrent && currentStage.status !== "completed" && (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 flex items-center gap-4 max-w-xs">
                    <Lock className="w-6 h-6 text-slate-700" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed tracking-wider">
                      Stage Locked: Previous phase must be marked as COMPLETED first.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-12 border-t border-slate-800/50 relative z-10">
                <div className="p-6 rounded-[2rem] bg-slate-950/50 border border-slate-800 shadow-inner group hover:border-slate-700 transition-colors">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 block italic">Phase Schedule</span>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-white font-black text-xs">
                      <Calendar className="w-4 h-4 text-slate-700" />
                      Target: {currentStage.target_date ? new Date(currentStage.target_date).toLocaleDateString() : "Pending"}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 font-bold text-[10px]">
                      <Clock className="w-4 h-4" />
                      Started: {currentStage.start_date ? new Date(currentStage.start_date).toLocaleString() : "---"}
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-[2rem] bg-slate-950/50 border border-slate-800 shadow-inner group hover:border-slate-700 transition-colors">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 block italic">Phase Duration</span>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-xs text-white">
                      <Timer className="w-5 h-5 opacity-40" />
                    </div>
                    <div>
                      <p className="text-white font-black text-xs uppercase tracking-tighter">
                        {currentStage.status === 'completed' ? "FINALIZED" : "TRACKING"}
                      </p>
                      <p className="text-[9px] font-bold text-slate-600 uppercase mt-0.5">SLA Enforcement</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-[2rem] bg-slate-950/50 border border-slate-800 shadow-inner group hover:border-slate-700 transition-colors">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 block italic">Phase Status</span>
                  <div className={`flex items-center gap-3 font-black text-[10px] uppercase tracking-widest ${currentStage.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'
                    }`}>
                    {currentStage.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Timer className="w-5 h-5" />}
                    {currentStage.status === 'completed' ? "Completed" : "Active Phase"}
                  </div>
                </div>
              </div>

              {/* ── Threaded Comment System (replaces single remarks textarea) ── */}
              <StageComments
                stageId={currentStage.id}
                orderId={id}
                disabled={false}
              />

              {/* QC Rejection History / CA & PA Log */}
              {order.iteration_history && order.iteration_history.length > 0 && (
                <div className="mt-8 border-t border-slate-800/50 pt-8">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center gap-3">
                    <AlertOctagon className="w-4 h-4 text-red-500" /> QC Rejection Log ({order.iteration_history.length} {order.iteration_history.length === 1 ? "rejection" : "rejections"})
                  </h4>
                  <div className="space-y-4">
                    {order.iteration_history.slice().reverse().map((entry: any, i: number) => (
                      <div key={i} className="bg-slate-950/60 border border-red-500/15 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
                            Iteration {entry.iteration} → {entry.iteration + 1}
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">{entry.date}</span>
                        </div>
                        {entry.rejected_stage && (
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                            Rejected at: <span className="text-slate-300">{entry.rejected_stage?.replace(/_/g, " ")}</span>
                            {entry.repeat_from_stage && <> → Restart from: <span className="text-amber-400">{entry.repeat_from_stage?.replace(/_/g, " ")}</span></>}
                          </p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                            <p className="text-[8px] font-black uppercase tracking-widest text-red-400 mb-2">Corrective Action (CA)</p>
                            <p className="text-xs font-bold text-slate-300 leading-5">{entry.reason || "—"}</p>
                          </div>
                          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                            <p className="text-[8px] font-black uppercase tracking-widest text-amber-400 mb-2">Preventive Action (PA)</p>
                            <p className="text-xs font-bold text-slate-300 leading-5">{entry.plan || "—"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {referenceAttachments.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-8 shadow-2xl">
              <h3 className="mb-6 flex items-center gap-3 text-white font-black text-sm uppercase tracking-widest italic">
                <Paperclip className="h-5 w-5 text-indigo-500" /> Reference Pictures & Requirements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {referenceAttachments.map((attachment: any, index: number) => (
                  <div key={`${attachment.url}-${index}`} className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950">
                    <a href={attachment.url} target="_blank" rel="noreferrer" className="block bg-slate-950 text-center">
                      <img src={attachment.url} alt={attachment.requirement || `Reference ${index + 1}`} className="w-full h-auto max-h-[500px] object-contain mx-auto" />
                    </a>
                    <div className="p-5">
                      <p className="truncate text-[9px] font-black uppercase tracking-widest text-slate-600">
                        {attachment.filename || attachment.url.split("/").pop() || `Picture ${index + 1}`}
                      </p>
                      <p className="mt-3 text-xs font-bold leading-6 text-slate-300">
                        {attachment.requirement || "No requirement added for this picture."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documentation Section */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-white font-black text-xl uppercase tracking-tighter italic flex items-center gap-4">
                <Paperclip className="w-6 h-6 text-indigo-500" /> Phase Documents
              </h3>
              <label className={`cursor-pointer px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${uploading ? 'opacity-50' : ''}`}>
                <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Add Phase Data'}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {order.attachments?.length > 0 ? order.attachments.map((file: any) => (
                <div key={file.id} className="group bg-slate-950 border border-slate-800 rounded-2xl p-5 flex items-center justify-between hover:border-indigo-500/40 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 rounded-xl text-slate-500">
                      {file.file_type.includes('image') ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-white font-bold text-[11px] truncate max-w-[150px]">{file.file_name}</p>
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">
                        {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL}/${file.file_path}`}
                      target="_blank"
                      className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-12 text-center bg-slate-950/40 rounded-3xl border border-dashed border-slate-800">
                  <FileText className="w-10 h-10 text-slate-800 mx-auto mb-4 opacity-40" />
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">No Attachments Uploaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(pendingStageAction)}
        title="Update stage?"
        message={`Are you sure you want to ${pendingStageAction?.label}? This will be tracked in activity logs and order history.`}
        confirmLabel="Yes, Update Stage"
        tone="info"
        loading={updating}
        onCancel={() => setPendingStageAction(null)}
        onConfirm={() => pendingStageAction && handleUpdateStageStatus(pendingStageAction.stageId, pendingStageAction.status)}
      />
      <FeedbackDialog
        open={Boolean(feedback)}
        type={feedback?.type}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        onClose={() => setFeedback(null)}
      />
      <Modal isOpen={Boolean(reworkDialog)} onClose={() => !updating && setReworkDialog(null)} title="Reject and Repeat Stage">
        <form onSubmit={handleRejectForRework} className="space-y-5">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Repeat From Stage</label>
            <select
              required
              value={reworkDialog?.repeatFromStageId || ""}
              onChange={(event) => reworkDialog && setReworkDialog({ ...reworkDialog, repeatFromStageId: event.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
            >
              {repeatableStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.stage_order}. {stageLabel(stage.stage_name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Rejection Reason</label>
            <textarea
              required
              rows={4}
              value={reworkDialog?.reason || ""}
              onChange={(event) => reworkDialog && setReworkDialog({ ...reworkDialog, reason: event.target.value })}
              placeholder="Example: Rejected due to cutting measurement issue."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Correction Plan</label>
            <textarea
              rows={3}
              value={reworkDialog?.plan || ""}
              onChange={(event) => reworkDialog && setReworkDialog({ ...reworkDialog, plan: event.target.value })}
              placeholder="Example: Repeat cutting, re-check measurement, then move forward again."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setReworkDialog(null)} disabled={updating} className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={updating || !reworkDialog?.reason.trim()} className="rounded-xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-red-500 disabled:opacity-50">
              {updating ? "Starting..." : "Start Rework Iteration"}
            </button>
          </div>
        </form>
      </Modal>
      <OrderHistoryModal orderId={historyOpen ? id : null} onClose={() => setHistoryOpen(false)} />

      {/* 3-State Approval Modal */}
      <Modal isOpen={Boolean(approvalDialog)} onClose={() => !updating && setApprovalDialog(null)} title={`QC Decision — ${stageLabel(approvalDialog?.stageName)}`}>
        <form onSubmit={handleApproveStage} className="space-y-5">
          {approvalData.approval === "conditional_approved" && (
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Conditional Requirement</label>
              <select
                required
                value={approvalData.condition_type}
                onChange={(e) => setApprovalData({ ...approvalData, condition_type: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-amber-500"
              >
                <option value="">Select condition type...</option>
                <option value="Fabric shade/resubmission before bulk fabric dying & washing execution">Fabric shade/resubmission before bulk fabric dying &amp; washing execution</option>
                <option value="Embellishment/printing/embroidery strike-off before bulk embellishment execution">Strike-off before bulk embellishment execution</option>
                <option value="Fit sample resubmission before bulk cutting execution">Fit sample resubmission before bulk cutting execution</option>
                <option value="Other — see remarks">Other — see remarks</option>
              </select>
            </div>
          )}
          {approvalData.approval === "not_approved" && (
            <>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Rejection Reason (Corrective Action)</label>
                <textarea
                  required
                  rows={4}
                  value={approvalData.reason}
                  onChange={(e) => setApprovalData({ ...approvalData, reason: e.target.value })}
                  placeholder="Describe the defect / issue found..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Preventive Plan</label>
                <textarea
                  rows={3}
                  value={approvalData.plan}
                  onChange={(e) => setApprovalData({ ...approvalData, plan: e.target.value })}
                  placeholder="What steps will prevent recurrence..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-red-500"
                />
              </div>
            </>
          )}
          <div className={`p-4 rounded-xl text-sm font-bold ${approvalData.approval === "approved" ? "bg-emerald-50 text-emerald-700" : approvalData.approval === "conditional_approved" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
            {approvalData.approval === "approved" && "✅ This will mark the stage as Approved and advance to the next stage."}
            {approvalData.approval === "conditional_approved" && "⚠️ This will mark the stage as Conditionally Approved. The condition must be resolved before the related downstream stage."}
            {approvalData.approval === "not_approved" && "❌ This will reject the stage and start a new rework iteration."}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setApprovalDialog(null)} disabled={updating} className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={updating || (approvalData.approval === "not_approved" && !approvalData.reason.trim()) || (approvalData.approval === "conditional_approved" && !approvalData.condition_type)} className={`rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50 ${approvalData.approval === "approved" ? "bg-emerald-600 hover:bg-emerald-500" : approvalData.approval === "conditional_approved" ? "bg-amber-600 hover:bg-amber-500" : "bg-red-600 hover:bg-red-500"}`}>
              {updating ? "Processing..." : `Confirm ${approvalData.approval?.replace(/_/g, " ")}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Move to Bulk Modal */}
      <Modal isOpen={moveToBulkDialog} onClose={() => !updating && setMoveToBulkDialog(false)} title="Move Sample to Bulk">
        <form onSubmit={handleMoveToBulk} className="space-y-5">
          <p className="text-sm font-bold text-slate-500">This will create a new Bulk Order for this sample product. Select an existing Bulk Project or create a new one.</p>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Existing Bulk Project</label>
            <select
              value={moveToBulkData.bulk_class_id}
              onChange={(e) => setMoveToBulkData({ ...moveToBulkData, bulk_class_id: e.target.value, new_class_name: e.target.value ? "" : moveToBulkData.new_class_name })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="">— Select existing project —</option>
              {bulkClasses.map((bc: any) => (<option key={bc.id} value={bc.id}>{bc.name}</option>))}
            </select>
          </div>
          {!moveToBulkData.bulk_class_id && (
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">OR Create New Bulk Project Name</label>
              <input
                type="text"
                value={moveToBulkData.new_class_name}
                onChange={(e) => setMoveToBulkData({ ...moveToBulkData, new_class_name: e.target.value })}
                placeholder="e.g. Winter Collection Bulk 2026"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
              />
            </div>
          )}
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Vendor for Bulk Order</label>
            <select
              required
              value={moveToBulkData.vendor_id}
              onChange={(e) => setMoveToBulkData({ ...moveToBulkData, vendor_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="">Select vendor...</option>
              {vendors.map((v: any) => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setMoveToBulkDialog(false)} disabled={updating} className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={updating || (!moveToBulkData.bulk_class_id && !moveToBulkData.new_class_name.trim()) || !moveToBulkData.vendor_id} className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-emerald-500 disabled:opacity-50">
              {updating ? "Creating..." : "Promote to Bulk →"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reorder Modal */}
      <Modal isOpen={reorderDialog} onClose={() => !updating && setReorderDialog(false)} title="Create Reorder">
        <form onSubmit={handleReorder} className="space-y-5">
          <p className="text-sm font-bold text-slate-500">Clone this completed bulk order with a new quantity and ex-factory date.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Quantity</label>
              <input required type="number" min="1" value={reorderData.quantity} onChange={(e) => setReorderData({ ...reorderData, quantity: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Ex-Factory Date</label>
              <input required type="date" value={reorderData.ex_factory_date} onChange={(e) => setReorderData({ ...reorderData, ex_factory_date: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Vendor</label>
            <select value={reorderData.vendor_id} onChange={(e) => setReorderData({ ...reorderData, vendor_id: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none">
              <option value="">Keep original vendor</option>
              {vendors.map((v: any) => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Additional Requirements</label>
            <textarea rows={3} value={reorderData.requirements} onChange={(e) => setReorderData({ ...reorderData, requirements: e.target.value })} placeholder="Any new requirements or changes..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setReorderDialog(false)} disabled={updating} className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={updating} className="rounded-xl bg-amber-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-amber-500 disabled:opacity-50">
              {updating ? "Creating..." : "↻ Create Reorder"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
