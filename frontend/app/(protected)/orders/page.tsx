"use client";

import React, { useEffect, useState, Suspense } from "react";
import api from "@/services/api";
import { 
  Plus, Search, Package, Calendar, AlertCircle, CheckCircle, Clock, 
  Building2, Tag, Shirt, Layers, ChevronLeft, Info, Edit3, Trash2, History, Factory,
  Paperclip, Upload, X, Pin
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { ConfirmDialog, FeedbackDialog } from "@/components/ui/ActionDialogs";
import OrderHistoryModal from "@/components/orders/OrderHistoryModal";

const DEFAULT_BULK_STAGES = [
  { name: "customer_order_wrapping_card", label: "Customer Order / Wrapping Card" },
  { name: "pp_sample_development", label: "PP Sample Development" },
  { name: "customer_approval", label: "Customer Approval" },
  { name: "fabric_shade_continuity_approval", label: "Fabric Shade Continuity Approval" },
  { name: "sublimation", label: "Sublimation" },
  { name: "bulk_fabric_cutting", label: "Bulk Fabric Cutting" },
  { name: "printing_embroidery_embellishment", label: "Printing / Embroidery / Embellishment" },
  { name: "stitching", label: "Stitching" },
  { name: "end_line_qc", label: "End Line QC" },
  { name: "washing", label: "Washing" },
  { name: "pressing", label: "Pressing" },
  { name: "finishing", label: "Finishing" },
  { name: "packing", label: "Packing" },
  { name: "final_random_inspection", label: "Final Random Inspection" },
  { name: "shipment_ex_factory", label: "Shipment / Ex-Factory" },
];

const DEFAULT_SAMPLE_STAGES = [
  { name: "sample_start", label: "Sample Start" },
  { name: "fabrication", label: "Fabrication" },
  { name: "fabric_cutting", label: "Fabric Cutting" },
  { name: "embellishment", label: "Printing / Embroidery / Embellishment" },
  { name: "stitching", label: "Stitching" },
  { name: "washing", label: "Washing" },
  { name: "finishing", label: "Finishing" },
  { name: "qc_check", label: "QC Check" },
  { name: "dispatch", label: "Dispatch" },
  { name: "sample_completed", label: "Sample Completed" },
];

const EX_FACTORY_BUFFER_DAYS = [15, 30];

type ReferenceAttachment = {
  url: string;
  requirement: string;
  filename?: string;
};

type FloorLineAssignment = {
  floor_id: string;
  line_ids: string[];
};

type BulkItem = {
  order_no: string;
  product_name: string;
  vendor_id: string;
  quantity: string;
  ex_factory_date: string;
  floor_assignments: FloorLineAssignment[];
  reference_attachments: ReferenceAttachment[];
};

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addBufferDays(baseDateValue: string | null | undefined, days: number) {
  const [year, month, day] = (baseDateValue || "").split("-").map(Number);
  const baseDate = year && month && day ? new Date(year, month - 1, day) : new Date();
  baseDate.setDate(baseDate.getDate() + days);
  return formatDateInputValue(baseDate);
}

function createBlankBulkItem(): BulkItem {
  return {
    order_no: "",
    product_name: "",
    vendor_id: "",
    quantity: "",
    ex_factory_date: "",
    floor_assignments: [],
    reference_attachments: [],
  };
}

function buildStagePayload(
  stages: Array<{ name: string; label: string }>,
  stageDays: Record<string, number>,
  moduleType: "sampling" | "bulk",
  chunkedStageNames: string[] = []
) {
  return stages
    .filter((stage) => Number(stageDays[stage.name]) > 0 || chunkedStageNames.includes(stage.name))
    .map((stage, index) => ({
      stage_name: stage.name,
      stage_order: index + 1,
      target_days: chunkedStageNames.includes(stage.name) ? 0 : Number(stageDays[stage.name]),
      module_type: moduleType,
      is_required: true,
    }));
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-32">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const track = searchParams.get("track") || "bulk"; 
  const sampleClassId = searchParams.get("sample_class_id");
  const bulkClassId = searchParams.get("bulk_class_id");
  
  const isSampling = track === "sampling";
  const themeColor = isSampling ? "blue" : "emerald";
  const themeHex = isSampling ? "#3b82f6" : "#10b981";
  
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [uploadingReference, setUploadingReference] = useState(false);
  
  // Creation state
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([createBlankBulkItem()]);
  const [stageDays, setStageDays] = useState<Record<string, number>>(
    (isSampling ? DEFAULT_SAMPLE_STAGES : DEFAULT_BULK_STAGES).reduce((acc, s) => ({ ...acc, [s.name]: 0 }), {})
  );

  // Stage Chunking State
  interface ChunkType {
    id: string;
    name: string;
    target_days: number;
    stage_names: string[];
  }
  const [chunks, setChunks] = useState<ChunkType[]>([]);
  const [selectedMergeStages, setSelectedMergeStages] = useState<string[]>([]);
  const [mergingName, setMergingName] = useState("");
  const [mergingDays, setMergingDays] = useState<number>(0);
  const [isMergePanelOpen, setIsMergePanelOpen] = useState(false);

  const [formData, setFormData] = useState({
    order_no: "",
    vendor_id: "",
    style_name: "",
    product_name: "",
    product_type: "",
    fabric: "",
    quantity: "",
    ex_factory_date: "",
    order_placement_date: "", // Date Sent
    tech_pack_no: "", // Internal Code
    priority: "normal",
    track_type: track,
    sample_class_id: sampleClassId || null,
    bulk_class_id: bulkClassId || null,
    sample_department_id: "",
    remarks: "",
    requirements: "",
    reference_image: "",
    reference_attachments: [] as ReferenceAttachment[],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, vendorsRes] = await Promise.all([
        api.get("/orders/", { 
          params: { 
            status: statusFilter || undefined,
            track_type: track,
            ...(sampleClassId ? { sample_class_id: sampleClassId } : {}),
            ...(bulkClassId ? { bulk_class_id: bulkClassId } : {}),
          } 
        }),
        api.get("/vendors/")
      ]);
      setOrders(ordersRes.data.data);
      setVendors(vendorsRes.data.data);
    } catch (err) {
      console.warn("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, track, sampleClassId, bulkClassId]);

  const handleAddBulkItem = () => {
    setBulkItems([...bulkItems, createBlankBulkItem()]);
  };

  const handleRemoveBulkItem = (index: number) => {
    setBulkItems(bulkItems.filter((_, i) => i !== index));
  };

  const updateBulkItem = (index: number, field: string, value: any) => {
    const newItems = [...bulkItems];
    (newItems[index] as any)[field] = value;
    if (field === 'vendor_id') {
      newItems[index].floor_assignments = [];
    }
    setBulkItems(newItems);
  };

  const updateBulkFloorAssignments = (index: number, assignments: FloorLineAssignment[]) => {
    const newItems = [...bulkItems];
    newItems[index].floor_assignments = assignments;
    setBulkItems(newItems);
  };

  const handleReferenceUpload = async (file: File | null, bulkIndex?: number) => {
    if (!file) return;

    setUploadingReference(true);
    const uploadData = new FormData();
    uploadData.append("file", file);

    try {
      const res = await api.post("/uploads/image", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const attachment: ReferenceAttachment = {
        url: res.data.data?.url || "",
        filename: res.data.data?.filename || file.name,
        requirement: "",
      };

      if (typeof bulkIndex === "number") {
        setBulkItems((prev) => prev.map((item, index) => (
          index === bulkIndex
            ? {
                ...item,
                reference_attachments: [...item.reference_attachments, attachment],
              }
            : item
        )));
      } else {
        setFormData((prev) => ({
          ...prev,
          reference_image: prev.reference_image || attachment.url,
          reference_attachments: [...prev.reference_attachments, attachment],
        }));
      }
      setFeedback({ type: "success", title: "Mission Successful", message: "Attachment added successfully." });
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "Upload Failed",
        message: err?.response?.data?.detail || "Only image attachments are supported here.",
      });
    } finally {
      setUploadingReference(false);
    }
  };

  const updateFormReferenceAttachment = (index: number, field: keyof ReferenceAttachment, value: string) => {
    setFormData((prev) => ({
      ...prev,
      reference_attachments: prev.reference_attachments.map((attachment, attachmentIndex) => (
        attachmentIndex === index ? { ...attachment, [field]: value } : attachment
      )),
    }));
  };

  const removeFormReferenceAttachment = (index: number) => {
    setFormData((prev) => {
      const nextAttachments = prev.reference_attachments.filter((_, attachmentIndex) => attachmentIndex !== index);
      return {
        ...prev,
        reference_attachments: nextAttachments,
        reference_image: nextAttachments[0]?.url || "",
      };
    });
  };

  const updateBulkReferenceAttachment = (bulkIndex: number, attachmentIndex: number, field: keyof ReferenceAttachment, value: string) => {
    setBulkItems((prev) => prev.map((item, index) => (
      index === bulkIndex
        ? {
            ...item,
            reference_attachments: item.reference_attachments.map((attachment, currentAttachmentIndex) => (
              currentAttachmentIndex === attachmentIndex ? { ...attachment, [field]: value } : attachment
            )),
          }
        : item
    )));
  };

  const removeBulkReferenceAttachment = (bulkIndex: number, attachmentIndex: number) => {
    setBulkItems((prev) => prev.map((item, index) => (
      index === bulkIndex
        ? {
            ...item,
            reference_attachments: item.reference_attachments.filter((_, currentAttachmentIndex) => currentAttachmentIndex !== attachmentIndex),
          }
        : item
    )));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Sanitize data: convert empty strings to null for optional fields
    const sanitizedData = { ...formData };
    (Object.keys(sanitizedData) as Array<keyof typeof sanitizedData>).forEach(key => {
      if (sanitizedData[key] === "") sanitizedData[key] = null as any;
    });

    try {
      if (editingOrder) {
        await api.put(`/orders/${editingOrder.id}`, {
          vendor_id: sanitizedData.vendor_id,
          order_no: sanitizedData.order_no,
          style_name: sanitizedData.style_name,
          product_name: sanitizedData.product_name,
          product_type: sanitizedData.product_type,
          fabric: sanitizedData.fabric,
          quantity: parseInt(formData.quantity) || 0,
          ex_factory_date: sanitizedData.ex_factory_date,
          priority: sanitizedData.priority,
          remarks: sanitizedData.remarks,
          requirements: sanitizedData.requirements,
          reference_image: sanitizedData.reference_image,
          reference_attachments: sanitizedData.reference_attachments,
          // Always persist the class context so editing from a class view links the order
          ...(sanitizedData.sample_class_id ? { sample_class_id: sanitizedData.sample_class_id } : {}),
          ...(sanitizedData.bulk_class_id ? { bulk_class_id: sanitizedData.bulk_class_id } : {}),
        });
        setIsModalOpen(false);
        setEditingOrder(null);
        fetchData();
        setFeedback({ type: "success", title: "Mission Successful", message: "Order updated successfully." });
        return;
      }

      const chunkedStageNames = chunks.flatMap(c => c.stage_names);
      const stageChunksPayload = chunks.map(c => ({
        name: c.name,
        target_days: c.target_days,
        stage_names: c.stage_names,
      }));

      if (!isSampling) {
        const selectedStages = buildStagePayload(DEFAULT_BULK_STAGES, stageDays, "bulk", chunkedStageNames);
        if (!selectedStages.length) {
          setFeedback({ type: "error", title: "Operation Failed", message: "Add predicted days for at least one bulk stage." });
          return;
        }

        const payload = {
          bulk_class_id: bulkClassId,
          items: bulkItems.map(item => ({
            ...sanitizedData,
            order_no: item.order_no,
            product_name: item.product_name,
            vendor_id: item.vendor_id,
            quantity: parseInt(item.quantity) || 0,
            ex_factory_date: item.ex_factory_date || null,
            reference_image: item.reference_attachments[0]?.url || null,
            reference_attachments: item.reference_attachments,
            assignments: item.floor_assignments
              .filter((assignment) => assignment.floor_id)
              .map((assignment) => ({
                floor_id: assignment.floor_id,
                line_ids: assignment.line_ids,
              })),
            stages: selectedStages,
            stage_chunks: stageChunksPayload,
          }))
        };
        await api.post("/orders/bulk", payload);
        setIsModalOpen(false);
        fetchData();
        setFeedback({ type: "success", title: "Mission Successful", message: "Bulk orders created successfully." });
      } else {
        const selectedStages = buildStagePayload(DEFAULT_SAMPLE_STAGES, stageDays, "sampling", chunkedStageNames);
        if (!selectedStages.length) {
          setFeedback({ type: "error", title: "Operation Failed", message: "Add predicted days for at least one sample stage." });
          return;
        }

        const res = await api.post("/orders/", {
          ...sanitizedData,
          quantity: parseInt(formData.quantity) || 0,
          stages: selectedStages,
          stage_chunks: stageChunksPayload,
        });
        setIsModalOpen(false);
        setFeedback({ type: "success", title: "Mission Successful", message: "Sample order created successfully." });
        const newOrderId = res.data.data.id;
        router.push(`/orders/${newOrderId}`);
      }
      
      setBulkItems([createBlankBulkItem()]);
      setChunks([]);
      setStageDays((isSampling ? DEFAULT_SAMPLE_STAGES : DEFAULT_BULK_STAGES).reduce((acc, s) => ({ ...acc, [s.name]: 0 }), {}));
    } catch (err: any) {
      console.error("Failed to create order entry", err);
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create entry.";
      setFeedback({ type: "error", title: "Operation Failed", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditOrder = (order: any) => {
    setChunks([]);
    setSelectedMergeStages([]);
    setEditingOrder(order);
    setFormData({
      order_no: order.order_no || "",
      vendor_id: order.vendor_id || "",
      style_name: order.style_name || "",
      product_name: order.product_name || "",
      product_type: order.product_type || "",
      fabric: order.fabric || "",
      quantity: String(order.quantity || ""),
      ex_factory_date: order.ex_factory_date || "",
      order_placement_date: "",
      tech_pack_no: "",
      priority: order.priority || "normal",
      track_type: order.track_type || track,
      sample_class_id: sampleClassId || null,
      bulk_class_id: bulkClassId || null,
      sample_department_id: "",
      remarks: "",
      requirements: "",
      reference_image: order.reference_image || order.reference_attachments?.[0]?.url || "",
      reference_attachments: order.reference_attachments || (order.reference_image ? [{ url: order.reference_image, requirement: "", filename: order.reference_image.split("/").pop() }] : []),
    });
    setIsModalOpen(true);
  };

  const openCreateOrder = () => {
    setChunks([]);
    setSelectedMergeStages([]);
    setEditingOrder(null);
    setFormData({
      order_no: "",
      vendor_id: "",
      style_name: "",
      product_name: "",
      product_type: "",
      fabric: "",
      quantity: "",
      ex_factory_date: "",
      order_placement_date: "",
      tech_pack_no: "",
      priority: "normal",
      track_type: track,
      sample_class_id: sampleClassId || null,
      bulk_class_id: bulkClassId || null,
      sample_department_id: "",
      remarks: "",
      requirements: "",
      reference_image: "",
      reference_attachments: [],
    });
    setIsModalOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/orders/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
      setFeedback({ type: "success", title: "Mission Successful", message: "Order cancelled successfully." });
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "Operation Failed",
        message: err?.response?.data?.detail || err?.response?.data?.message || "Failed to cancel order.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // One-time assignment: link an existing (unassigned) order to the current sample/bulk class
  const assignToClass = async (orderId: string) => {
    if (!sampleClassId && !bulkClassId) return;
    try {
      await api.put(`/orders/${orderId}`, {
        ...(sampleClassId ? { sample_class_id: sampleClassId } : {}),
        ...(bulkClassId ? { bulk_class_id: bulkClassId } : {}),
      });
      fetchData();
      setFeedback({ type: "success", title: "Assigned!", message: "Order permanently linked to this class." });
    } catch (err: any) {
      setFeedback({ type: "error", title: "Failed", message: err?.response?.data?.detail || "Could not assign order." });
    }
  };


  const filtered = orders.filter((o: any) => 
    (o.order_no?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (o.style_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (o.product_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-700">
      <div className="flex justify-end">
        <button 
          onClick={openCreateOrder}
          style={{ backgroundColor: themeHex }}
          className="hover:opacity-90 text-white px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center gap-4 shadow-2xl active:scale-95"
        >
          <Plus className="w-5 h-5" /> {isSampling ? "Initiate Prototype" : "Register Style PO"}
        </button>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[2.5rem] p-6 flex flex-wrap gap-6 items-center shadow-xl">
        <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 min-w-[350px] flex-1">
          <Search className="w-5 h-5 text-slate-700" />
          <input 
            type="text" 
            placeholder="Search products..." 
            className="bg-transparent border-none text-white text-sm focus:outline-none w-full font-bold placeholder:text-slate-800" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-32">
          <div className={`w-16 h-16 border-4 border-${themeColor}-500 border-t-transparent rounded-full animate-spin`}></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((order: any) => (
            <div 
              key={order.id} 
              onClick={() => router.push(`/orders/${order.id}`)}
              className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[3rem] p-10 hover:border-slate-600 transition-all group cursor-pointer relative overflow-hidden shadow-xl"
            >
              <div className="flex items-start justify-between mb-8">
                <div className={`w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-700 group-hover:text-${themeColor}-400 group-hover:border-${themeColor}-500/30 transition-all duration-500`}>
                  {isSampling ? <Shirt className="w-8 h-8" /> : <Package className="w-8 h-8" />}
                </div>
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${
                  order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                  order.status === 'delayed' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                  `bg-${themeColor}-500/10 text-${themeColor}-400 border-${themeColor}-500/20`
                }`}>
                  {order.status}
                </span>
              </div>
              <h3 className="text-white font-black text-2xl mb-1 uppercase tracking-tighter italic">
                {isSampling ? order.product_name : order.style_name}
              </h3>
              <p className={`text-${themeColor}-500 text-[10px] font-black uppercase tracking-[0.3em] mb-8`}>
                 {isSampling ? "Sampling" : `PO: ${order.order_no}`} • {order.vendor_name}
              </p>
              {(() => {
                const currentClassId = isSampling ? order.sample_class_id : order.bulk_class_id;
                const targetClassId = isSampling ? sampleClassId : bulkClassId;
                const showButton = !!targetClassId && String(currentClassId) !== String(targetClassId);
                const buttonCount = 3 + (showButton ? 1 : 0);
                return (
                  <div className="mt-6 grid gap-2" style={{ gridTemplateColumns: `repeat(${buttonCount},1fr)` }}>
                    {showButton && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          assignToClass(order.id);
                        }}
                        className={`rounded-2xl border px-3 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${
                          currentClassId
                            ? 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-400'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-400'
                        }`}
                        title={currentClassId ? "Reassign to this class" : "Assign to this class"}
                      >
                        <Pin className="mx-auto mb-1 h-4 w-4" />
                        {currentClassId ? 'Reassign' : 'Assign'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditOrder(order);
                      }}
                      className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-blue-500/40 hover:text-blue-400"
                    >
                      <Edit3 className="mx-auto mb-1 h-4 w-4" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setHistoryOrderId(order.id);
                      }}
                      className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400"
                    >
                      <History className="mx-auto mb-1 h-4 w-4" /> History
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(order);
                      }}
                      className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-red-500/40 hover:text-red-400"
                    >
                      <Trash2 className="mx-auto mb-1 h-4 w-4" /> Delete
                    </button>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
        }}
        title={editingOrder ? "Update Order" : isSampling ? "Initialize Prototype" : "Add Products"}
      >
        <form onSubmit={handleCreateOrder} className="space-y-8 max-h-[80vh] overflow-y-auto px-2 pr-6 custom-scrollbar">
          {editingOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Product Name</label>
                  <input required className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.product_name} onChange={(e) => setFormData({...formData, product_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Style Name</label>
                  <input className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.style_name} onChange={(e) => setFormData({...formData, style_name: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">PO / Order Number</label>
                <input className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.order_no} onChange={(e) => setFormData({...formData, order_no: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Quantity</label>
                  <input required type="number" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Ex-Factory Date</label>
                  <input type="date" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.ex_factory_date} onChange={(e) => setFormData({...formData, ex_factory_date: e.target.value})} />
                  <ExFactoryBufferButtons
                    baseLabel="today"
                    onSelect={(days) => setFormData({...formData, ex_factory_date: addBufferDays(formData.ex_factory_date, days)})}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Priority</label>
                  <select className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Assigned Vendor</label>
                <select required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.vendor_id} onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}>
                  <option value="">Select Vendor</option>
                  {vendors.map((v: any) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                </select>
              </div>
              <ReferenceAttachmentButton
                attachments={formData.reference_attachments}
                uploading={uploadingReference}
                onUpload={(file) => handleReferenceUpload(file)}
                onRequirementChange={updateFormReferenceAttachment}
                onRemove={removeFormReferenceAttachment}
              />
            </div>
          )}

          {!editingOrder && isSampling && (
            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Prototype Name</label>
                  <input required type="text" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none placeholder:text-slate-800" placeholder="e.g. Summer T-Shirt Sample" value={formData.product_name} onChange={(e) => setFormData({...formData, product_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Style Name</label>
                  <input required type="text" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none placeholder:text-slate-800" placeholder="Style #ST-99" value={formData.style_name} onChange={(e) => setFormData({...formData, style_name: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Internal Code (Tech Pack #)</label>
                  <input type="text" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.tech_pack_no} onChange={(e) => setFormData({...formData, tech_pack_no: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Quantity</label>
                  <input required type="number" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Date Sent</label>
                  <input type="date" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.order_placement_date} onChange={(e) => setFormData({...formData, order_placement_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Ex-Factory Date</label>
                  <input type="date" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.ex_factory_date} onChange={(e) => setFormData({...formData, ex_factory_date: e.target.value})} />
                  <ExFactoryBufferButtons
                    baseLabel="date sent"
                    onSelect={(days) => setFormData({...formData, ex_factory_date: addBufferDays(formData.order_placement_date, days)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 italic">Assigned Vendor</label>
                  <select required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={formData.vendor_id} onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}>
                    <option value="">Select Vendor</option>
                    {vendors.map((v: any) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 italic">Sampling Department</label>
                  <SamplingDepartmentSelector
                    vendorId={formData.vendor_id}
                    value={formData.sample_department_id}
                    onChange={(departmentId) => setFormData({...formData, sample_department_id: departmentId})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Requirements</label>
                <textarea rows={1} className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none resize-none" value={formData.requirements} onChange={(e) => setFormData({...formData, requirements: e.target.value})} />
              </div>

              <ReferenceAttachmentButton
                attachments={formData.reference_attachments}
                uploading={uploadingReference}
                onUpload={(file) => handleReferenceUpload(file)}
                onRequirementChange={updateFormReferenceAttachment}
                onRemove={removeFormReferenceAttachment}
              />

              <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
                <h4 className="text-white text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3 italic">
                  <Plus className="w-4 h-4 text-blue-500" /> Predicted Stage Days (SLA Grouping Enabled)
                </h4>
                <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Select multiple stages to merge them under a combined SLA chunk, or assign days individually.
                </p>
                <StageMergingComponent
                  defaultStages={DEFAULT_SAMPLE_STAGES}
                  stageDays={stageDays}
                  setStageDays={setStageDays}
                  chunks={chunks}
                  setChunks={setChunks}
                  selectedMergeStages={selectedMergeStages}
                  setSelectedMergeStages={setSelectedMergeStages}
                  themeHex="#3b82f6"
                  themeColor="blue"
                />
              </div>
            </div>
          )}

          {!editingOrder && !isSampling && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h4 className="text-white text-xs font-black uppercase tracking-widest italic">Product Batches</h4>
                <button type="button" onClick={handleAddBulkItem} className="text-emerald-400 hover:text-emerald-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Another
                </button>
              </div>

              {bulkItems.map((item, idx) => (
                <div key={idx} className="bg-slate-950/50 border border-slate-800 p-8 rounded-[2rem] relative">
                  {bulkItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBulkItem(idx)}
                      className="absolute right-6 top-6 rounded-full border border-red-500/30 bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                      title="Remove this product"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Product Name</label>
                      <input required type="text" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={item.product_name} onChange={(e) => updateBulkItem(idx, 'product_name', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">PO #</label>
                      <input required type="text" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={item.order_no} onChange={(e) => updateBulkItem(idx, 'order_no', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Quantity</label>
                      <input required type="number" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={item.quantity} onChange={(e) => updateBulkItem(idx, 'quantity', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">Ex-Factory Date</label>
                      <input required type="date" className="w-full bg-slate-950 border border-slate-900 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={item.ex_factory_date} onChange={(e) => updateBulkItem(idx, 'ex_factory_date', e.target.value)} />
                      <ExFactoryBufferButtons
                        baseLabel="today"
                        onSelect={(days) => updateBulkItem(idx, 'ex_factory_date', addBufferDays(null, days))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-3 italic">Vendor</label>
                      <select required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-xs font-bold text-white focus:outline-none" value={item.vendor_id} onChange={(e) => updateBulkItem(idx, 'vendor_id', e.target.value)}>
                        <option value="">Select Vendor</option>
                        {vendors.map((v: any) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                      </select>
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-3 italic">Floors & Lines</label>
                      <VendorFloorLineSelector
                        vendorId={item.vendor_id}
                        value={item.floor_assignments}
                        onChange={(assignments) => updateBulkFloorAssignments(idx, assignments)}
                      />
                    </div>
                  </div>
                  <div className="mt-8">
                    <ReferenceAttachmentButton
                      attachments={item.reference_attachments}
                      uploading={uploadingReference}
                      onUpload={(file) => handleReferenceUpload(file, idx)}
                      onRequirementChange={(attachmentIndex, field, value) => updateBulkReferenceAttachment(idx, attachmentIndex, field, value)}
                      onRemove={(attachmentIndex) => removeBulkReferenceAttachment(idx, attachmentIndex)}
                    />
                  </div>
                </div>
              ))}

              <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
                <h4 className="text-white text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3 italic">
                  <Plus className="w-4 h-4 text-emerald-500" /> Predicted Stage Days (SLA Grouping Enabled)
                </h4>
                <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Select multiple stages to merge them under a combined SLA chunk, or assign days individually.
                </p>
                <StageMergingComponent
                  defaultStages={DEFAULT_BULK_STAGES}
                  stageDays={stageDays}
                  setStageDays={setStageDays}
                  chunks={chunks}
                  setChunks={setChunks}
                  selectedMergeStages={selectedMergeStages}
                  setSelectedMergeStages={setSelectedMergeStages}
                  themeHex="#10b981"
                  themeColor="emerald"
                />
              </div>
            </div>
          )}

          <button type="submit" disabled={isSubmitting} style={{ backgroundColor: themeHex }} className="w-full text-white font-black py-6 rounded-[2.5rem] mt-8 uppercase tracking-[0.4em] text-[10px]">
            {isSubmitting ? "Processing..." : editingOrder ? "Update Order" : "Launch Track"}
          </button>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Cancel order?"
        message={`Are you sure you want to cancel/deactivate ${deleteTarget?.order_no || deleteTarget?.product_name || "this order"}? It will remain available in history.`}
        confirmLabel="Yes, Cancel Order"
        loading={isSubmitting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteOrder}
      />
      <FeedbackDialog
        open={Boolean(feedback)}
        type={feedback?.type}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        onClose={() => setFeedback(null)}
      />
      <OrderHistoryModal orderId={historyOrderId} onClose={() => setHistoryOrderId(null)} />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}</style>
    </div>
  );
}

function StageMergingComponent({
  defaultStages,
  stageDays,
  setStageDays,
  chunks,
  setChunks,
  selectedMergeStages,
  setSelectedMergeStages,
  themeHex,
  themeColor
}: any) {
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [chunkDaysInput, setChunkDaysInput] = useState<number>(3);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // helper to check if a stage is chunked
  const isChunked = (stageName: string) => chunks.some((c: any) => c.stage_names.includes(stageName));

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleToggleSelect = (stageName: string) => {
    if (selectedMergeStages.includes(stageName)) {
      setSelectedMergeStages(selectedMergeStages.filter((n: string) => n !== stageName));
    } else {
      setSelectedMergeStages([...selectedMergeStages, stageName]);
    }
  };

  const getAutoChunkName = () => {
    const selectedStagesSorted = defaultStages
      .filter((s: any) => selectedMergeStages.includes(s.name));
    if (selectedStagesSorted.length === 0) return "Merged Phase";
    if (selectedStagesSorted.length === 1) return selectedStagesSorted[0].label;
    return `${selectedStagesSorted[0].label} to ${selectedStagesSorted[selectedStagesSorted.length - 1].label}`;
  };

  const handleMergeClick = () => {
    if (selectedMergeStages.length < 2) return;
    setChunkDaysInput(3);
    setShowMergeModal(true);
  };

  const handleUnmerge = (chunkId: string) => {
    setChunks(chunks.filter((c: any) => c.id !== chunkId));
    setToastMessage("Chunk dissolved!");
  };

  return (
    <div className="space-y-6">
      {/* Active Chunks List */}
      {chunks.length > 0 && (
        <div className="space-y-4">
          <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Merged Chunks</h5>
          {chunks.map((chunk: any) => (
            <div key={chunk.id} className="bg-slate-950 border border-indigo-500/20 rounded-[2rem] p-6 shadow-lg relative overflow-hidden">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                  <div className="min-w-0">
                    <h4 className="text-white text-xs font-black uppercase tracking-wider truncate" title={chunk.name}>
                      {chunk.name}
                    </h4>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{chunk.stage_names.length} Stages Merged</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnmerge(chunk.id)}
                  className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-all active:scale-95 shrink-0"
                >
                  Unmerge
                </button>
              </div>
              
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 mb-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Total Chunk SLA Days</span>
                <input 
                  type="number" min="1"
                  required
                  className="w-16 bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-[10px] font-black text-indigo-400 text-center focus:outline-none"
                  value={chunk.target_days}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setChunks(chunks.map((c: any) => c.id === chunk.id ? { ...c, target_days: val } : c));
                  }}
                />
              </div>

              <div className="pl-4 border-l border-indigo-500/10 space-y-2">
                {chunk.stage_names.map((sName: string) => {
                  const s = defaultStages.find((st: any) => st.name === sName);
                  return s ? (
                    <div key={sName} className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-700"></span>
                      {s.label}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Standalone / Merging Selector list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Individual & Available Stages</h5>
          {selectedMergeStages.length >= 2 && (
            <button
              type="button"
              onClick={handleMergeClick}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              Merge Selected ({selectedMergeStages.length})
            </button>
          )}
        </div>

        <div className="space-y-3">
          {defaultStages.map((s: any, idx: number) => {
            const chunked = isChunked(s.name);
            if (chunked) return null; // skip chunked stages from standalone list
            const isSelected = selectedMergeStages.includes(s.name);

            return (
              <div 
                key={s.name} 
                className={`flex items-center justify-between bg-slate-950 border transition-all duration-300 rounded-2xl px-6 py-4 ${
                  isSelected ? "border-indigo-500 bg-slate-950 shadow-indigo-500/5 shadow-2xl" : "border-slate-900 hover:border-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelect(s.name)}
                    className="h-4 w-4 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    {idx + 1}. {s.label}
                  </span>
                </div>
                
                <input 
                  type="number" min="0"
                  placeholder="Skip"
                  disabled={isSelected}
                  className="w-16 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-black text-center disabled:opacity-40"
                  style={{ color: themeHex }}
                  value={stageDays[s.name] || ""}
                  onChange={(e) => setStageDays({...stageDays, [s.name]: parseInt(e.target.value) || 0})}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* SLA Duration Custom Merge Dialog */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 max-w-sm w-full space-y-6 shadow-2xl animate-in zoom-in duration-300">
            <div className="text-center space-y-2">
              <h3 className="text-white font-black text-lg uppercase tracking-wider">Set SLA Days</h3>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-normal max-h-12 overflow-y-auto">
                Grouping: {getAutoChunkName()}
              </p>
            </div>
            
            <div className="space-y-3">
              <label className="block text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">
                Total Target Days
              </label>
              <input 
                type="number" min="1"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-3 text-lg font-black text-center text-indigo-400 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                value={chunkDaysInput}
                onChange={(e) => setChunkDaysInput(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="rounded-full border border-slate-800 bg-slate-950 px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-900 hover:text-white transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const chunkName = getAutoChunkName();
                  const newChunk = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: chunkName,
                    target_days: chunkDaysInput,
                    stage_names: [...selectedMergeStages]
                  };
                  setChunks([...chunks, newChunk]);
                  
                  // Clear individual predicted days for these merged stages
                  const updatedDays = { ...stageDays };
                  selectedMergeStages.forEach((name: string) => {
                    updatedDays[name] = 0;
                  });
                  setStageDays(updatedDays);
                  
                  setSelectedMergeStages([]);
                  setShowMergeModal(false);
                  setToastMessage("Stages merged successfully!");
                }}
                className="rounded-full text-white px-5 py-3 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl hover:opacity-90"
                style={{ backgroundColor: themeHex }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-disappearing toast notification */}
      {toastMessage && (
        <div className="fixed bottom-10 right-10 z-[10000] bg-slate-900 border border-emerald-500/20 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-xs font-black uppercase tracking-widest text-emerald-400">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

function ExFactoryBufferButtons({ baseLabel, onSelect }: { baseLabel: string, onSelect: (days: number) => void }) {
    return (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Dispatch buffer</span>
          {EX_FACTORY_BUFFER_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onSelect(days)}
              className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:border-slate-600 hover:text-white"
              title={`Set ex-factory ${days} days from ${baseLabel}`}
            >
              +{days} days
            </button>
          ))}
        </div>
    );
}

function ReferenceAttachmentButton({
  attachments,
  uploading,
  onUpload,
  onRequirementChange,
  onRemove,
}: {
  attachments: ReferenceAttachment[];
  uploading: boolean;
  onUpload: (file: File | null) => void;
  onRequirementChange: (index: number, field: keyof ReferenceAttachment, value: string) => void;
  onRemove: (index: number) => void;
}) {
    return (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-slate-400">
                <Paperclip className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white">Reference Pictures</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
                  {attachments.length ? `${attachments.length} picture${attachments.length === 1 ? "" : "s"} attached` : "Add product images with requirements"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className={`cursor-pointer rounded-full bg-indigo-600 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white hover:bg-indigo-500 ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                <span className="flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : "Add Picture"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => {
                    Array.from(event.target.files || []).forEach((file) => onUpload(file));
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          {attachments.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {attachments.map((attachment, index) => (
                <div key={`${attachment.url}-${index}`} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3 md:grid-cols-[88px_1fr_auto] md:items-center">
                  <a href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                    <img src={attachment.url} alt={attachment.requirement || "Reference picture"} className="h-20 w-full object-cover md:w-20" />
                  </a>
                  <div>
                    <p className="mb-2 truncate text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {attachment.filename || attachment.url.split("/").pop() || `Picture ${index + 1}`}
                    </p>
                    <textarea
                      rows={2}
                      className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none placeholder:text-slate-700"
                      placeholder="Requirement for this picture..."
                      value={attachment.requirement}
                      onChange={(event) => onRequirementChange(index, "requirement", event.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="justify-self-start rounded-full border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10 md:justify-self-end"
                    title="Remove picture"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
    );
}

function VendorFloorLineSelector({
  vendorId,
  value,
  onChange,
}: {
  vendorId: string;
  value: FloorLineAssignment[];
  onChange: (assignments: FloorLineAssignment[]) => void;
}) {
    const [floors, setFloors] = useState<any[]>([]);

    useEffect(() => {
        if (!vendorId) {
          setFloors([]);
          onChange([]);
          return;
        }
        api.get(`/vendors/${vendorId}/floors`)
          .then(res => setFloors(res.data.data || []))
          .catch(() => setFloors([]));
    }, [vendorId]);

    const isFloorSelected = (floorId: string) => value.some((assignment) => assignment.floor_id === floorId);
    const floorAssignment = (floorId: string) => value.find((assignment) => assignment.floor_id === floorId);

    const toggleFloor = (floorId: string) => {
      if (isFloorSelected(floorId)) {
        onChange(value.filter((assignment) => assignment.floor_id !== floorId));
        return;
      }
      onChange([...value, { floor_id: floorId, line_ids: [] }]);
    };

    const toggleLine = (floorId: string, lineId: string) => {
      onChange(value.map((assignment) => {
        if (assignment.floor_id !== floorId) return assignment;
        const exists = assignment.line_ids.includes(lineId);
        return {
          ...assignment,
          line_ids: exists
            ? assignment.line_ids.filter((id) => id !== lineId)
            : [...assignment.line_ids, lineId],
        };
      }));
    };

    if (!vendorId) {
      return <div className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-4 text-xs font-bold text-slate-500">Select vendor first</div>;
    }

    return (
        <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3">
          {floors.length === 0 ? (
            <p className="px-2 py-3 text-xs font-bold text-slate-500">No active floors found.</p>
          ) : floors.map((floor: any) => {
            const selected = isFloorSelected(floor.id);
            const assignment = floorAssignment(floor.id);
            return (
              <div key={floor.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleFloor(floor.id)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">{floor.name}</span>
                  <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {selected ? `${assignment?.line_ids.length || 0} lines` : "not assigned"}
                  </span>
                </label>
                {selected && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(floor.lines || []).map((line: any) => (
                      <label key={line.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={assignment?.line_ids.includes(line.id) || false}
                          onChange={() => toggleLine(floor.id, line.id)}
                          className="h-3.5 w-3.5 accent-emerald-500"
                        />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">{line.name}</span>
                      </label>
                    ))}
                    {(!floor.lines || floor.lines.length === 0) && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">No lines. Full floor assignment.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <p className="px-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Select a floor with no lines checked to assign the full floor.
          </p>
        </div>
    );
}

function SamplingDepartmentSelector({ vendorId, value, onChange }: { vendorId: string, value: string, onChange: (id: string) => void }) {
    const [departments, setDepartments] = useState<any[]>([]);

    useEffect(() => {
        if (!vendorId) {
          setDepartments([]);
          onChange("");
          return;
        }

        api.get(`/vendors/${vendorId}/departments`, { params: { department_type: "sampling", ensure_sampling: true } })
          .then(res => {
            const rows = res.data.data || [];
            setDepartments(rows);
            if (!value && rows[0]?.id) onChange(rows[0].id);
          })
          .catch(() => {
            setDepartments([]);
            onChange("");
          });
    }, [vendorId]);

    return (
        <div className="space-y-2">
          <select
            required
            disabled={!vendorId}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-xs font-bold text-white focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
              <option value="">{vendorId ? "Select Sampling Department" : "Select Vendor First"}</option>
              {departments.map((department: any) => (<option key={department.id} value={department.id}>{department.name}</option>))}
          </select>
          <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-400">
            <Factory className="h-3.5 w-3.5" /> Sample orders route to this department, no floor or line needed.
          </p>
        </div>
    );
}

const ArrowRight = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
);
