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
import { useHeader } from "@/hooks/useHeader";
import { IndustrialHeading } from "@/components/ui/PagePrimitives";
import { ConfirmDialog, FeedbackDialog } from "@/components/ui/ActionDialogs";
import OrderHistoryModal from "@/components/orders/OrderHistoryModal";
import StageComments from "@/components/ui/StageComments";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_BULK_STAGES,
  buildStagePayload,
  StageMergingComponent,
  VendorFloorLineSelector,
  ReferenceAttachmentButton,
  ReferenceAttachment,
  FloorLineAssignment,
  StageChunk,
} from "@/components/orders/OrderFormComponents";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const canManage = !isViewer;
  const { setHeaderConfig } = useHeader();
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
  const [approvalData, setApprovalData] = useState({ approval: "", condition_type: "", reason: "", plan: "", repeat_from_stage_id: "" });
  // Move to Bulk
  const [moveToBulkDialog, setMoveToBulkDialog] = useState(false);
  const [moveToBulkData, setMoveToBulkData] = useState<{
    bulk_class_id: string;
    new_class_name: string;
    product_name: string;
    style_name: string;
    order_no: string;
    quantity: string;
    ex_factory_date: string;
    order_placement_date: string;
    priority: string;
    fabric: string;
    tech_pack_no: string;
    vendor_id: string;
    requirements: string;
    floor_assignments: FloorLineAssignment[];
    reference_attachments: ReferenceAttachment[];
  }>({
    bulk_class_id: "",
    new_class_name: "",
    product_name: "",
    style_name: "",
    order_no: "",
    quantity: "",
    ex_factory_date: "",
    order_placement_date: "",
    priority: "normal",
    fabric: "",
    tech_pack_no: "",
    vendor_id: "",
    requirements: "",
    floor_assignments: [],
    reference_attachments: [],
  });
  const [moveToBulkStageDays, setMoveToBulkStageDays] = useState<Record<string, number>>({});
  const [moveToBulkStageBuffers, setMoveToBulkStageBuffers] = useState<Record<string, number>>({});
  const [moveToBulkChunks, setMoveToBulkChunks] = useState<StageChunk[]>([]);
  const [moveToBulkSelectedStages, setMoveToBulkSelectedStages] = useState<string[]>([]);
  const [uploadingBulkReference, setUploadingBulkReference] = useState(false);
  // Reorder
  const [reorderDialog, setReorderDialog] = useState(false);
  const [reorderData, setReorderData] = useState<{
    bulk_class_id: string;
    new_class_name: string;
    product_name: string;
    style_name: string;
    order_no: string;
    quantity: string;
    ex_factory_date: string;
    order_placement_date: string;
    priority: string;
    fabric: string;
    tech_pack_no: string;
    vendor_id: string;
    requirements: string;
    floor_assignments: FloorLineAssignment[];
    reference_attachments: ReferenceAttachment[];
  }>({
    bulk_class_id: "",
    new_class_name: "",
    product_name: "",
    style_name: "",
    order_no: "",
    quantity: "",
    ex_factory_date: "",
    order_placement_date: "",
    priority: "normal",
    fabric: "",
    tech_pack_no: "",
    vendor_id: "",
    requirements: "",
    floor_assignments: [],
    reference_attachments: [],
  });
  const [reorderStageDays, setReorderStageDays] = useState<Record<string, number>>({});
  const [reorderStageBuffers, setReorderStageBuffers] = useState<Record<string, number>>({});
  const [reorderChunks, setReorderChunks] = useState<StageChunk[]>([]);
  const [reorderSelectedStages, setReorderSelectedStages] = useState<string[]>([]);
  const [uploadingReorderReference, setUploadingReorderReference] = useState(false);
  // Condition clearance
  const [clearConditionDialog, setClearConditionDialog] = useState<{
    stageId: string;
    stageName: string;
    conditionAction: string;
  } | null>(null);
  const [clearProofFile, setClearProofFile] = useState<File | null>(null);
  const [clearProofNotes, setClearProofNotes] = useState("");
  const [clearingCondition, setClearingCondition] = useState(false);

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

  useEffect(() => {
    if (!order) return;
    const isSamplingOrder = order.track_type === "sampling" || !!order.sample_class_name;
    const classEyebrow = isSamplingOrder
      ? (order.sample_class_name ? `Sample Class (${order.sample_class_name}) Order Details` : "Sample Class Order Details")
      : (order.bulk_class_name ? `Bulk Project (${order.bulk_class_name}) Order Details` : "Bulk Order Detail");
    
    setHeaderConfig({
      eyebrow: classEyebrow,
      title:
        (isSamplingOrder
          ? order.product_name || order.style_name
          : order.style_name || order.product_name) || "Order",
      highlight: order.track_type ? `[${order.track_type.toUpperCase()}]` : "",
      subtitle: `PO: ${order.order_no || "N/A"} • Vendor: ${order.vendor_name || "N/A"}${order.quantity ? ` • Qty: ${order.quantity} Pcs` : ""}`,
    });

    return () => {
      setHeaderConfig(null);
    };
  }, [order, setHeaderConfig]);

  const handleUpdateStageStatus = async (stageId: string, status: string) => {
    if (isStageConditionallyBlocked && (status === "in_progress" || status === "completed")) {
      setFeedback({
        type: "error",
        title: "Stage Locked",
        message: `This stage cannot proceed because conditional defect "${upstreamLockStage?.conditional_action}" from ${stageLabel(upstreamLockStage?.stage_name)} is pending clearance. Please upload proof attachment first.`,
      });
      return;
    }
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
      setApprovalData({ approval: "", condition_type: "", reason: "", plan: "", repeat_from_stage_id: "" });
      setFeedback({ type: "success", title: "Mission Successful", message: `Stage ${approvalData.approval.replace(/_/g, " ")} recorded.` });
    } catch (err: any) {
      setFeedback({ type: "error", title: "Operation Failed", message: err.response?.data?.detail || "Failed to record approval." });
    } finally {
      setUpdating(false);
    }
  };

  const handleClearCondition = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clearConditionDialog) return;
    if (!clearProofFile) {
      setFeedback({ type: "error", title: "Missing Proof Attachment", message: "A proof attachment (image or PDF) is mandatory to clear this defect condition." });
      return;
    }
    if (!clearProofNotes.trim()) {
      setFeedback({ type: "error", title: "Missing Notes", message: "Clearance remarks and confirmation are required." });
      return;
    }

    setClearingCondition(true);
    try {
      const formData = new FormData();
      formData.append("file", clearProofFile);
      formData.append("notes", clearProofNotes.trim());

      await api.post(`/orders/stages/${clearConditionDialog.stageId}/clear-condition`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await fetchData();
      setClearConditionDialog(null);
      setClearProofFile(null);
      setClearProofNotes("");
      setFeedback({
        type: "success",
        title: "Defect Condition Cleared",
        message: "Proof attachment verified and saved! Downstream phase is now unlocked.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "Clearance Failed",
        message: err.response?.data?.detail || "Failed to clear defect condition.",
      });
    } finally {
      setClearingCondition(false);
    }
  };

  const openMoveToBulkModal = () => {
    if (!order) return;
    const initialDays: Record<string, number> = {
      customer_order_wrapping_card: 1,
      pp_sample_development: 3,
      small_vet_dying_shade_band_continuity_approval: 2,
      full_flag_dying_production: 5,
      sublimation: 2,
      bulk_fabric_cutting: 2,
      printing_embroidery_embellishment: 3,
      stitching: 5,
      end_line_qc: 1,
      washing: 2,
      pressing: 1,
      finishing: 2,
      packing: 1,
      final_random_inspection: 1,
      shipment_ex_factory: 1,
    };
    const initialBuffers: Record<string, number> = {};
    DEFAULT_BULK_STAGES.forEach((s) => {
      initialBuffers[s.name] = 0;
    });

    const existingAttachments: ReferenceAttachment[] = Array.isArray(order.reference_attachments) && order.reference_attachments.length > 0
      ? order.reference_attachments.map((a: any) => ({
          url: a.url || "",
          requirement: a.requirement || "",
          filename: a.filename || "",
        }))
      : (order.reference_image ? [{ url: order.reference_image, requirement: "Sample product reference", filename: "Sample Photo" }] : []);

    setMoveToBulkData({
      bulk_class_id: "",
      new_class_name: "",
      product_name: order.product_name || order.style_name || "",
      // PO # is required below. Samples are often raised without one, so derive a
      // suggestion from whatever identifier the sample does have instead of
      // opening the form with an empty required field.
      style_name: order.style_name || order.product_name || "",
      order_no: `${order.order_no || order.tech_pack_no || order.style_name || "BULK"}-BLK`,
      quantity: "",
      ex_factory_date: "",
      order_placement_date: new Date().toISOString().split("T")[0],
      priority: order.priority || "normal",
      fabric: order.fabric || "",
      tech_pack_no: order.tech_pack_no || "",
      vendor_id: order.vendor_id ? String(order.vendor_id) : "",
      requirements: order.requirements || "",
      floor_assignments: [],
      reference_attachments: existingAttachments,
    });
    setMoveToBulkStageDays(initialDays);
    setMoveToBulkStageBuffers(initialBuffers);
    setMoveToBulkChunks([]);
    setMoveToBulkSelectedStages([]);
    setMoveToBulkDialog(true);
  };

  const handleMoveToBulkReferenceUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingBulkReference(true);
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
      setMoveToBulkData((prev) => ({
        ...prev,
        reference_attachments: [...prev.reference_attachments, attachment],
      }));
      setFeedback({ type: "success", title: "Image Uploaded", message: "Reference picture added." });
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "Upload Failed",
        message: err?.response?.data?.detail || "Only image attachments are supported here.",
      });
    } finally {
      setUploadingBulkReference(false);
    }
  };

  /**
   * These forms are long and scrollable, so a native browser validation bubble on a
   * required field can land off-screen and look like nothing happened. Check the
   * required fields here and name the missing one in a visible dialog.
   */
  const firstMissingField = (data: { product_name: string; style_name: string; order_no: string; vendor_id: string; quantity: string; ex_factory_date: string }) => {
    if (!data.product_name.trim()) return "Product Name";
    if (!data.style_name.trim()) return "Style Name";
    if (!data.order_no.trim()) return "PO #";
    if (!data.vendor_id) return "Assigned Vendor";
    if (!data.quantity || parseInt(data.quantity) <= 0) return "a valid Quantity";
    if (!data.ex_factory_date) return "Ex-Factory Date";
    return null;
  };

  const handleMoveToBulk = async (event: React.FormEvent) => {
    event.preventDefault();
    const missing = firstMissingField(moveToBulkData);
    if (missing) {
      setFeedback({ type: "error", title: "Missing Required Field", message: `Please fill in ${missing} before launching the bulk order.` });
      return;
    }
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

      const chunkedStageNames = moveToBulkChunks.flatMap((c) => c.stage_names);
      const selectedStages = buildStagePayload(
        DEFAULT_BULK_STAGES,
        moveToBulkStageDays,
        moveToBulkStageBuffers,
        "bulk",
        chunkedStageNames
      );

      if (!selectedStages.length) {
        setFeedback({ type: "error", title: "Missing Stages", message: "Configure predicted days for at least one bulk stage." });
        setUpdating(false);
        return;
      }

      const stageChunksPayload = moveToBulkChunks.map((chunk) => ({
        name: chunk.name,
        target_days: Number(chunk.target_days) || 1,
        buffer_days: Number(chunk.buffer_days) || 0,
        stage_names: chunk.stage_names,
      }));

      const res = await api.post(`/orders/${id}/promote-to-bulk`, {
        bulk_class_id,
        vendor_id: moveToBulkData.vendor_id,
        product_name: moveToBulkData.product_name,
        style_name: moveToBulkData.style_name,
        order_no: moveToBulkData.order_no,
        quantity: parseInt(moveToBulkData.quantity) || 0,
        ex_factory_date: moveToBulkData.ex_factory_date || null,
        order_placement_date: moveToBulkData.order_placement_date || null,
        priority: moveToBulkData.priority,
        fabric: moveToBulkData.fabric,
        tech_pack_no: moveToBulkData.tech_pack_no,
        requirements: moveToBulkData.requirements,
        reference_image: moveToBulkData.reference_attachments[0]?.url || null,
        reference_attachments: moveToBulkData.reference_attachments,
        assignments: moveToBulkData.floor_assignments
          .filter((assignment) => assignment.floor_id)
          .map((assignment) => ({
            floor_id: assignment.floor_id,
            line_ids: assignment.line_ids,
          })),
        stages: selectedStages,
        stage_chunks: stageChunksPayload,
      });

      setMoveToBulkDialog(false);
      setFeedback({ type: "success", title: "Promoted to Bulk!", message: "Bulk order created successfully." });
      const newId = res.data.data?.id;
      if (newId) setTimeout(() => router.push(`/orders/${newId}`), 1200);
    } catch (err: any) {
      setFeedback({ type: "error", title: "Failed", message: err.response?.data?.detail || err.message || "Failed to promote to bulk." });
    } finally {
      setUpdating(false);
    }
  };

  const openReorderModal = () => {
    if (!order) return;
    const initialDays: Record<string, number> = {};
    const initialBuffers: Record<string, number> = {};

    if (stages && stages.length > 0) {
      stages.forEach((s) => {
        initialDays[s.stage_name] = s.predicted_target_days || s.target_days || 1;
        initialBuffers[s.stage_name] = s.buffer_days || 0;
      });
    } else {
      DEFAULT_BULK_STAGES.forEach((s) => {
        initialDays[s.name] = 1;
        initialBuffers[s.name] = 0;
      });
    }

    const existingAttachments: ReferenceAttachment[] = Array.isArray(order.reference_attachments) && order.reference_attachments.length > 0
      ? order.reference_attachments.map((a: any) => ({
          url: a.url || "",
          requirement: a.requirement || "",
          filename: a.filename || "",
        }))
      : (order.reference_image ? [{ url: order.reference_image, requirement: "Product reference", filename: "Product Photo" }] : []);

    const existingAssignments: FloorLineAssignment[] = Array.isArray(order.assignments) && order.assignments.length > 0
      ? order.assignments.map((a: any) => ({
          floor_id: a.floor_id || "",
          line_ids: a.line_ids || [],
        }))
      : [];

    setReorderData({
      bulk_class_id: order.bulk_class_id ? String(order.bulk_class_id) : "",
      new_class_name: "",
      product_name: order.product_name || order.style_name || "",
      // Style Name is required below; bulk orders created before it was collected
      // have none, so fall back to the product name rather than an empty field.
      style_name: order.style_name || order.product_name || "",
      order_no: order.order_no ? `${order.order_no}-RO` : "",
      quantity: order.quantity ? String(order.quantity) : "",
      ex_factory_date: "",
      order_placement_date: new Date().toISOString().split("T")[0],
      priority: order.priority || "normal",
      fabric: order.fabric || "",
      tech_pack_no: order.tech_pack_no || "",
      vendor_id: order.vendor_id ? String(order.vendor_id) : "",
      requirements: order.requirements || "",
      floor_assignments: existingAssignments,
      reference_attachments: existingAttachments,
    });
    setReorderStageDays(initialDays);
    setReorderStageBuffers(initialBuffers);
    setReorderChunks([]);
    setReorderSelectedStages([]);
    setReorderDialog(true);
  };

  const handleReorderReferenceUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingReorderReference(true);
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
      setReorderData((prev) => ({
        ...prev,
        reference_attachments: [...prev.reference_attachments, attachment],
      }));
      setFeedback({ type: "success", title: "Image Uploaded", message: "Reference picture added." });
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "Upload Failed",
        message: err?.response?.data?.detail || "Only image attachments are supported here.",
      });
    } finally {
      setUploadingReorderReference(false);
    }
  };

  const handleReorder = async (event: React.FormEvent) => {
    event.preventDefault();
    const missing = firstMissingField(reorderData);
    if (missing) {
      setFeedback({ type: "error", title: "Missing Required Field", message: `Please fill in ${missing} before creating the reorder.` });
      return;
    }
    setUpdating(true);
    try {
      let bulk_class_id = reorderData.bulk_class_id;
      // If no existing class selected but new name given, create it first
      if (!bulk_class_id && reorderData.new_class_name.trim()) {
        const classRes = await api.post("/orders/bulk-classes", {
          name: reorderData.new_class_name.trim(),
          vendor_id: reorderData.vendor_id,
        });
        bulk_class_id = classRes.data.data?.id;
      }
      if (!bulk_class_id) throw new Error("Please select or create a Bulk Project.");

      const chunkedStageNames = reorderChunks.flatMap((c) => c.stage_names);
      const selectedStages = buildStagePayload(
        DEFAULT_BULK_STAGES,
        reorderStageDays,
        reorderStageBuffers,
        "bulk",
        chunkedStageNames
      );

      if (!selectedStages.length) {
        setFeedback({ type: "error", title: "Missing Stages", message: "Configure predicted days for at least one bulk stage." });
        setUpdating(false);
        return;
      }

      const stageChunksPayload = reorderChunks.map((chunk) => ({
        name: chunk.name,
        target_days: Number(chunk.target_days) || 1,
        buffer_days: Number(chunk.buffer_days) || 0,
        stage_names: chunk.stage_names,
      }));

      const res = await api.post(`/orders/${id}/reorder`, {
        bulk_class_id,
        vendor_id: reorderData.vendor_id,
        product_name: reorderData.product_name,
        style_name: reorderData.style_name,
        order_no: reorderData.order_no,
        quantity: parseInt(reorderData.quantity) || 0,
        ex_factory_date: reorderData.ex_factory_date || null,
        order_placement_date: reorderData.order_placement_date || null,
        priority: reorderData.priority,
        fabric: reorderData.fabric,
        tech_pack_no: reorderData.tech_pack_no,
        requirements: reorderData.requirements,
        reference_image: reorderData.reference_attachments[0]?.url || null,
        reference_attachments: reorderData.reference_attachments,
        assignments: reorderData.floor_assignments
          .filter((assignment) => assignment.floor_id)
          .map((assignment) => ({
            floor_id: assignment.floor_id,
            line_ids: assignment.line_ids,
          })),
        stages: selectedStages,
        stage_chunks: stageChunksPayload,
      });

      setReorderDialog(false);
      setFeedback({ type: "success", title: "Reorder Created!", message: "New bulk reorder created successfully." });
      const newId = res.data.data?.id;
      if (newId) setTimeout(() => router.push(`/orders/${newId}`), 1200);
    } catch (err: any) {
      setFeedback({ type: "error", title: "Failed", message: err.response?.data?.detail || err.message || "Failed to create reorder." });
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
  // PP Sample Development in bulk has 3 options (Approved, Conditional Approved, Not Approved)
  // All other bulk stages have only 2 options (Accept / Reject)
  const APPROVAL_GATED_STAGES = isSampling
    ? ["qc_check"]
    : ["pp_sample_development"];

  const isApprovalGated = currentStage && APPROVAL_GATED_STAGES.includes(currentStage.stage_name);

  // Conditional approval downstream gating helper (bulk only)
  const getUpstreamGatingCondition = (targetStageName: string) => {
    if (isSampling || !targetStageName) return null;
    const target = targetStageName.toLowerCase();

    for (const st of stages) {
      if (st.approval_status === "conditional_approved" && st.condition_status === "pending") {
        const gated = (st.gated_stage_name || "").toLowerCase();
        const action = (st.conditional_action || "").toLowerCase();

        // 1. Fabric shade / resubmission before bulk fabric dying -> blocks bulk dyeing
        const isDyeing = (gated === "bulk_dying" || action.includes("dying") || action.includes("shade")) && target.includes("dying");
        // 2. If size specs are incorrect then need to submit fit sample -> blocks bulk cutting
        const isCutting = (gated === "bulk_cutting" || action.includes("size") || action.includes("spec") || action.includes("fit") || action.includes("cutting")) && (target.includes("cutting") || target.includes("bulk_fabric_cutting"));
        // 3. Embellishment strike-off -> blocks embellishment
        const isEmbellishment = (gated === "embellishment" || action.includes("embellish") || action.includes("strike") || action.includes("printing")) && (target.includes("embellish") || target.includes("printing"));
        // Fallback for legacy washing execution
        const isWashing = (gated === "washing_fabrication" || action.includes("washing")) && (target.includes("washing") || target.includes("fabric_cutting") || target.includes("fabrication"));

        if (isDyeing || isCutting || isEmbellishment || isWashing) {
          return st;
        }
      }
    }
    return null;
  };

  const getClearedConditionForStage = (targetStageName: string) => {
    if (isSampling || !targetStageName) return null;
    const target = targetStageName.toLowerCase();

    for (const st of stages) {
      if (st.approval_status === "conditional_approved" && st.condition_status === "cleared") {
        const gated = (st.gated_stage_name || "").toLowerCase();
        const action = (st.conditional_action || "").toLowerCase();

        const isDyeing = (gated === "bulk_dying" || action.includes("dying") || action.includes("shade")) && target.includes("dying");
        const isCutting = (gated === "bulk_cutting" || action.includes("size") || action.includes("spec") || action.includes("fit") || action.includes("cutting")) && (target.includes("cutting") || target.includes("bulk_fabric_cutting"));
        const isEmbellishment = (gated === "embellishment" || action.includes("embellish") || action.includes("strike") || action.includes("printing")) && (target.includes("embellish") || target.includes("printing"));
        const isWashing = (gated === "washing_fabrication" || action.includes("washing")) && (target.includes("washing") || target.includes("fabric_cutting") || target.includes("fabrication"));

        if (isDyeing || isCutting || isEmbellishment || isWashing) {
          return st;
        }
      }
    }
    return null;
  };

  const upstreamLockStage = currentStage ? getUpstreamGatingCondition(currentStage.stage_name) : null;
  const clearedConditionStage = currentStage ? getClearedConditionForStage(currentStage.stage_name) : null;
  const isStageConditionallyBlocked = Boolean(upstreamLockStage);

  // Ex-factory date crossed check (visual only)
  const today = new Date();
  const exFactoryDate = order?.ex_factory_date ? new Date(order.ex_factory_date) : null;
  const isExFactoryPassed = exFactoryDate && today > exFactoryDate && order?.status !== "completed";

  // Can always update remarks/data if it's not locked and user is not a viewer
  const isSelectable = (idx: number) => idx === 0 || stages[idx - 1].status === "completed";
  const canUpdateCurrent = !isViewer && currentStage && isSelectable(currentIndex);
  // Sample flow: ONLY the QC stage (qc_check) has rejection menu
  const canRejectSampleStage = isSampling && currentStage?.stage_name === "qc_check" && canUpdateCurrent;
  // Bulk flow: ONLY the 4 designated stages have rejection checks:
  // 1. PP Sample Development (3-state approval panel)
  // 2. Small Vet Dying — Shade Band Continuity Approval (Accept / Reject)
  // 3. Full Flag Dying Production (Accept / Reject)
  // 4. Final Random Inspection (Accept / Reject)
  // All other bulk stages are direct completion only.
  const BULK_REJECTION_STAGES = [
    "pp_sample_development",
    "pp_sample",
    "small_vet_dying_shade_band_continuity_approval",
    "small_vet_dying",
    "fabric_shade_approval",
    "fabric_shade_continuity_approval",
    "full_flag_dying_production",
    "full_flag_dying",
    "final_random_inspection",
    "final_qa_audit",
    "final_random_qa_audit",
  ];
  const canRejectBulkStage = !isSampling && Boolean(currentStage && BULK_REJECTION_STAGES.includes(currentStage.stage_name)) && canUpdateCurrent;
  const canRejectCurrentStage = Boolean(canRejectSampleStage || canRejectBulkStage);
  const repeatableStages = canUpdateCurrent
    ? stages.filter((stage) => {
        if (!currentStage) return false;
        // In sampling: can repeat from ANY stage up to current stage
        if (isSampling) return stage.stage_order <= currentStage.stage_order;
        // In bulk: repeat ONLY that particular stage itself
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
      {/* Viewer Notice Banner */}
      {isViewer && (
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 px-6 py-3.5 rounded-2xl">
          <Info className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-xs font-bold text-blue-900">
            <strong>Viewer Mode:</strong> You have company-wide read access to view all orders, stages, logs, and attachments. Edits and phase actions are disabled.
          </p>
        </div>
      )}

      {/* Action & Meta Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <button 
            onClick={() => router.push(getBackUrl())} 
            className="px-5 py-3 text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-600 rounded-2xl transition-all shadow-md shadow-emerald-600/20 group flex items-center gap-2 active:scale-95 text-xs font-black uppercase tracking-wider"
            title={getBackLabel()}
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>{getBackLabel()}</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border border-indigo-200 bg-indigo-50 text-indigo-700">
              {order.track_type}
            </span>
            <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border ${
              order.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              order.status === 'delayed' ? 'bg-red-50 text-red-700 border-red-200' :
              'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {order.status}
            </span>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition shadow-sm"
            >
              History
            </button>
            {/* Move to Bulk button — only for completed sample orders */}
            {canManage && isSampling && order.status === "completed" && (
              <button
                type="button"
                onClick={openMoveToBulkModal}
                className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5 transition"
              >
                <ArrowUpRight className="w-4 h-4" /> Move to Bulk
              </button>
            )}
            {/* Reorder button — only for completed bulk orders */}
            {canManage && !isSampling && order.status === "completed" && (
              <button
                type="button"
                onClick={openReorderModal}
                className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-4 h-4" /> Reorder
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-5 py-2.5 rounded-2xl self-start md:self-auto shadow-sm">
          <div className="text-left md:text-center">
            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Production Start</p>
            <p className="text-slate-950 font-black text-sm uppercase tracking-tight">
              {order.order_placement_date || "---"}
            </p>
          </div>
          <div className="w-px h-8 bg-emerald-200 mx-2"></div>
          <div className="text-left md:text-center">
            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Target Ex-Factory</p>
            <p className="text-emerald-600 font-black text-sm uppercase tracking-tight">{order.ex_factory_date || "TBD"}</p>
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
                  const isGated = Boolean(getUpstreamGatingCondition(s.stage_name));

                  return (
                    <button
                      key={s.id}
                      onClick={() => !isLocked && setSelectedStageId(s.id)}
                      disabled={isLocked}
                      style={isSelected ? { backgroundColor: themeHex, borderColor: themeHex, color: "#ffffff" } : undefined}
                      className={`w-full min-w-0 group relative flex items-center gap-4 p-4 rounded-full border-2 transition-all duration-300 ${isSelected ? "text-white shadow-xl scale-[1.02] z-10" :
                          isLocked ? "bg-slate-950/20 border-slate-900 text-slate-800 opacity-40 cursor-not-allowed" :
                            isGated ? "bg-amber-500/10 border-amber-500/40 text-amber-500 hover:border-amber-500/60" :
                            isExFactoryFail ? "bg-red-500/15 border-red-500/40 text-red-500 hover:border-red-500/60" :
                            isDelayed ? "bg-red-500/10 border-red-500/30 text-red-500 hover:border-red-500/50" :
                              isCompleted ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:border-emerald-500/50" :
                                "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shadow-inner shrink-0 ${isSelected ? "bg-white/25 text-white" : isLocked ? "bg-slate-950 text-slate-600" : isGated ? "bg-amber-500/20 text-amber-500" : isExFactoryFail ? "bg-red-500/20 text-red-500" : isDelayed ? "bg-red-500/20 text-red-500" : isCompleted ? "bg-emerald-500/25 text-emerald-700" : "bg-slate-950 text-slate-400"
                        }`}>
                        {isLocked ? <Lock className="w-4 h-4" /> : isGated ? <Lock className="w-4 h-4 text-amber-500" /> : idx + 1}
                      </div>
                      <div className="min-w-0 text-left flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="break-words text-xs md:text-sm font-black uppercase tracking-wide leading-tight">{stageLabel(s.stage_name)}</p>
                          {isGated && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30 uppercase">
                              Gated
                            </span>
                          )}
                        </div>
                        <p
                          className="text-xs font-black uppercase mt-1 tracking-tight"
                          style={{ color: isSelected ? "#ffffff" : "#000000" }}
                        >
                          {isCompleted ? `Comp: ${compDate?.toLocaleDateString()}` : `Tgt: ${targetDate?.toLocaleDateString() || "---"}`}
                        </p>
                      </div>
                      {isCompleted && !isOverdue && <CheckCircle className="w-5 h-5 shrink-0" />}
                      {isExFactoryFail && <AlertOctagon className="w-5 h-5 shrink-0 animate-pulse" />}
                      {!isExFactoryFail && isDelayed && <AlertCircle className="w-5 h-5 shrink-0 animate-pulse" />}
                      {isCurrent && !isExFactoryFail && <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />}
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
                          const isGated = Boolean(getUpstreamGatingCondition(s.stage_name));

                          return (
                            <button
                              key={s.id}
                              onClick={() => !isLocked && setSelectedStageId(s.id)}
                              disabled={isLocked}
                              style={isSelected ? { backgroundColor: themeHex, borderColor: themeHex, color: "#ffffff" } : undefined}
                              className={`w-full min-w-0 group relative flex items-center gap-3.5 p-3.5 rounded-full border-2 transition-all duration-300 ${isSelected ? "text-white shadow-xl scale-[1.01] z-10" :
                                  isLocked ? "bg-slate-950/20 border-slate-900 text-slate-800 opacity-40 cursor-not-allowed" :
                                    isGated ? "bg-amber-500/10 border-amber-500/40 text-amber-500 hover:border-amber-500/60" :
                                    isDelayed ? "bg-red-500/10 border-red-500/30 text-red-500 hover:border-red-500/50" :
                                      isCompleted ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:border-emerald-500/50" :
                                        "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                                }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-inner shrink-0 ${isSelected ? "bg-white/25 text-white" : isLocked ? "bg-slate-950 text-slate-600" : isGated ? "bg-amber-500/20 text-amber-500" : isDelayed ? "bg-red-500/20 text-red-500" : isCompleted ? "bg-emerald-500/25 text-emerald-700" : "bg-slate-950 text-slate-400"
                                }`}>
                                {isLocked ? <Lock className="w-3.5 h-3.5" /> : isGated ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : idx + 1}
                              </div>
                              <div className="min-w-0 text-left flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="break-words text-xs md:text-sm font-black uppercase tracking-wide leading-tight">{stageLabel(s.stage_name)}</p>
                                  {isGated && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30 uppercase">
                                      Gated
                                    </span>
                                  )}
                                </div>
                                <p
                                  className="text-xs font-black uppercase mt-1 tracking-tight"
                                  style={{ color: isSelected ? "#ffffff" : "#000000" }}
                                >
                                  {isCompleted ? `Comp: ${compDate?.toLocaleDateString()}` : `Tgt: ${targetDate?.toLocaleDateString() || "---"}`}
                                </p>
                                {s.buffer_days > 0 && (
                                  <span className="inline-flex items-center gap-0.5 mt-0.5 text-xs font-black uppercase tracking-wide text-amber-500">
                                    +{s.buffer_days}d buf
                                  </span>
                                )}
                              </div>
                              {isCompleted && !isOverdue && <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />}
                              {isDelayed && <AlertCircle className="w-4 h-4 shrink-0 text-red-500 animate-pulse" />}
                              {isCurrent && <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />}
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
                        disabled={updating || isStageConditionallyBlocked}
                        className={`px-8 py-4 bg-white text-slate-950 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all flex items-center gap-3 ${isStageConditionallyBlocked ? "opacity-30 cursor-not-allowed" : "hover:scale-105 active:scale-95"}`}
                      >
                        <Clock className="w-5 h-5" /> {isStageConditionallyBlocked ? "Phase Locked (Defect Pending)" : "Start Phase"}
                      </button>
                    ) : currentStage.status === "in_progress" ? (
                      <div className="space-y-4">
                        {/* 3-State Approval Panel for QC / approval-gated stages */}
                        {isApprovalGated ? (
                          <div className="grid grid-cols-1 gap-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500 mb-1">QC Decision</p>
                            <button
                              onClick={() => { setApprovalData({ approval: "approved", condition_type: "", reason: "", plan: "", repeat_from_stage_id: "" }); setApprovalDialog({ stageId: currentStage.id, stageName: currentStage.stage_name }); }}
                              disabled={updating}
                              className="w-full px-8 py-4 bg-emerald-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 justify-center"
                            >
                              <ThumbsUp className="w-5 h-5" /> Approved
                            </button>
                            <button
                              onClick={() => { setApprovalData({ approval: "conditional_approved", condition_type: "", reason: "", plan: "", repeat_from_stage_id: "" }); setApprovalDialog({ stageId: currentStage.id, stageName: currentStage.stage_name }); }}
                              disabled={updating}
                              className="w-full px-8 py-4 bg-amber-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-amber-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 justify-center"
                            >
                              <AlertCircle className="w-5 h-5" /> Conditional Approved
                            </button>
                            <button
                              onClick={() => {
                                setApprovalData({
                                  approval: "not_approved",
                                  condition_type: "",
                                  reason: "",
                                  plan: "",
                                  repeat_from_stage_id: isSampling ? (repeatableStages.length > 0 ? repeatableStages[0].id : currentStage.id) : currentStage.id,
                                });
                                setApprovalDialog({ stageId: currentStage.id, stageName: currentStage.stage_name });
                              }}
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
                              disabled={updating || isStageConditionallyBlocked}
                              className={`w-full px-8 py-4 bg-emerald-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all flex items-center gap-3 justify-center ${isStageConditionallyBlocked ? "opacity-30 cursor-not-allowed" : "hover:bg-emerald-400 hover:scale-105 active:scale-95"}`}
                            >
                              <CheckCircle2 className="w-5 h-5" /> {isStageConditionallyBlocked ? "Phase Locked (Defect Pending)" : (!isSampling ? (canRejectBulkStage ? "Accept" : "Complete Stage") : "Confirm Completion")}
                            </button>
                            {canRejectCurrentStage && repeatableStages.length > 0 && (
                              <button
                                onClick={() => setReworkDialog({
                                  stageId: currentStage.id,
                                  repeatFromStageId: isSampling
                                    ? (repeatableStages.length > 1 ? repeatableStages[0].id : currentStage.id)
                                    : currentStage.id,
                                  reason: stageData.remarks || "",
                                  plan: "",
                                })}
                                disabled={updating}
                                className="w-full px-8 py-4 bg-red-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-red-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 justify-center"
                              >
                                <RefreshCcw className="w-5 h-5" /> {!isSampling ? "Reject" : "Reject / Repeat Stage"}
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
                              repeatFromStageId: isSampling
                                ? (repeatableStages.length > 1 ? repeatableStages[0].id : currentStage.id)
                                : currentStage.id,
                              reason: stageData.remarks || "",
                              plan: "",
                            })}
                            disabled={updating}
                            className="text-[9px] font-black text-white bg-red-600 px-4 py-2 rounded-xl hover:bg-red-500 transition-all border border-red-500/40"
                          >
                            {!isSampling ? "Reject" : "Reject / Repeat"}
                          </button>
                        )}
                        <button
                          onClick={() => setPendingStageAction({ stageId: currentStage.id, status: "completed", label: "save this completed phase" })}
                          disabled={updating || isStageConditionallyBlocked}
                          className="ml-4 text-[9px] font-black bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-all border border-emerald-500"
                          style={{ color: "#ffffff" }}
                        >
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!isViewer && !canUpdateCurrent && currentStage.status !== "completed" && (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 flex items-center gap-4 max-w-xs">
                    <Lock className="w-6 h-6 text-slate-700" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed tracking-wider">
                      Stage Locked: Previous phase must be marked as COMPLETED first.
                    </p>
                  </div>
                )}
              </div>

              {/* Conditional Approval Downstream Gate Banner (for locked stages) */}
              {upstreamLockStage && (
                <div className="mt-8 relative z-10 rounded-[2rem] border border-amber-500/40 bg-amber-950/50 p-6 md:p-8 backdrop-blur-md shadow-2xl">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
                        <Lock className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Downstream Stage Locked
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            Required from {stageLabel(upstreamLockStage.stage_name)}
                          </span>
                        </div>
                        <h3 className="text-white font-black text-lg md:text-xl tracking-tight mt-1.5">
                          Defect Requirement: {upstreamLockStage.conditional_action}
                        </h3>
                        <p className="text-xs text-slate-300 mt-1 max-w-2xl font-medium">
                          This stage cannot proceed until the defect condition is resolved. Upload a mandatory proof attachment (swatch photo, test report, or strike-off picture) and submit clearance notes to unlock.
                        </p>
                      </div>
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setClearConditionDialog({
                          stageId: upstreamLockStage.id,
                          stageName: upstreamLockStage.stage_name,
                          conditionAction: upstreamLockStage.conditional_action,
                        })}
                        className="shrink-0 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5"
                      >
                        <Upload className="w-4 h-4" /> Clear Defect & Upload Proof
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Cleared Upstream Defect Banner */}
              {clearedConditionStage && (
                <div className="mt-8 relative z-10 rounded-[2rem] border border-emerald-500/30 bg-emerald-950/30 p-6 backdrop-blur-md shadow-xl">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Condition Cleared & Unlocked
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            Defect: {clearedConditionStage.conditional_action}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium mt-1">
                          Cleared by <strong className="text-white">{clearedConditionStage.condition_cleared_by_name || "QC Manager"}</strong>
                          {clearedConditionStage.condition_cleared_at ? ` on ${new Date(clearedConditionStage.condition_cleared_at).toLocaleDateString()}` : ""}
                          {clearedConditionStage.clearance_notes ? ` — "${clearedConditionStage.clearance_notes}"` : ""}
                        </p>
                      </div>
                    </div>

                    {clearedConditionStage.clearance_attachment_url && (
                      <a
                        href={clearedConditionStage.clearance_attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2"
                      >
                        <Paperclip className="w-3.5 h-3.5" /> View Proof Attachment
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Condition Status Banner on PP Sample Development */}
              {currentStage.approval_status === "conditional_approved" && (
                <div className={`mt-8 relative z-10 rounded-[2rem] border p-6 backdrop-blur-md shadow-xl ${currentStage.condition_status === "cleared" ? "border-emerald-500/30 bg-emerald-950/30" : "border-amber-500/40 bg-amber-950/50"}`}>
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${currentStage.condition_status === "cleared" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-amber-500/20 border-amber-500/40 text-amber-400"}`}>
                        {currentStage.condition_status === "cleared" ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${currentStage.condition_status === "cleared" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                            {currentStage.condition_status === "cleared" ? "Condition Cleared with Proof" : "Conditional Defect Pending Clearance"}
                          </span>
                          {currentStage.gated_stage_name && (
                            <span className="text-[10px] font-bold text-slate-400">
                              Gated Downstream: {currentStage.gated_stage_name.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <h3 className="text-white font-black text-lg tracking-tight mt-1.5">
                          {currentStage.conditional_action}
                        </h3>
                        {currentStage.condition_status === "cleared" ? (
                          <p className="text-xs text-slate-300 font-medium mt-1">
                            Cleared by <strong className="text-white">{currentStage.condition_cleared_by_name || "QC Manager"}</strong>
                            {currentStage.condition_cleared_at ? ` on ${new Date(currentStage.condition_cleared_at).toLocaleDateString()}` : ""}
                            {currentStage.clearance_notes ? ` — "${currentStage.clearance_notes}"` : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-300 mt-1 font-medium">
                            Downstream stages will remain locked until mandatory proof attachment is uploaded to clear this condition.
                          </p>
                        )}
                      </div>
                    </div>

                    {currentStage.condition_status === "cleared" ? (
                      currentStage.clearance_attachment_url && (
                        <a
                          href={currentStage.clearance_attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2"
                        >
                          <Paperclip className="w-3.5 h-3.5" /> View Proof Attachment
                        </a>
                      )
                    ) : (
                      canManage && (
                        <button
                          type="button"
                          onClick={() => setClearConditionDialog({
                            stageId: currentStage.id,
                            stageName: currentStage.stage_name,
                            conditionAction: currentStage.conditional_action,
                          })}
                          className="shrink-0 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5"
                        >
                          <Upload className="w-4 h-4" /> Clear Defect & Upload Proof
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-12 border-t border-slate-800/50 relative z-10">
                <div className="p-6 rounded-[2rem] bg-slate-950/50 border border-slate-800 shadow-inner group hover:border-slate-700 transition-colors">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 block italic">Phase Schedule</span>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-white font-black text-sm md:text-base">
                      <Calendar className="w-5 h-5 text-slate-500" />
                      Target: {currentStage.target_date ? new Date(currentStage.target_date).toLocaleDateString() : "Pending"}
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 font-bold text-xs">
                      <Clock className="w-4 h-4" />
                      Started: {currentStage.start_date ? new Date(currentStage.start_date).toLocaleString() : "---"}
                    </div>
                    {currentStage.buffer_days > 0 && (
                      <div className="flex items-center gap-3 text-amber-400 font-black text-xs mt-1 border-t border-amber-900/30 pt-2">
                        <Timer className="w-4 h-4 text-amber-500" />
                        Buffer: +{currentStage.buffer_days}d contingency
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 rounded-[2rem] bg-slate-950/50 border border-slate-800 shadow-inner group hover:border-slate-700 transition-colors">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 block italic">Phase Duration</span>
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-sm text-white">
                      <Timer className="w-6 h-6 opacity-60 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-white font-black text-sm md:text-base uppercase tracking-tight">
                        {currentStage.status === 'completed' ? "FINALIZED" : "TRACKING"}
                      </p>
                      <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">SLA Enforcement</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-[2rem] bg-slate-950/50 border border-slate-800 shadow-inner group hover:border-slate-700 transition-colors">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 block italic">Phase Status</span>
                  <div className={`flex items-center gap-3 font-black text-sm md:text-base uppercase tracking-wider ${currentStage.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
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
                disabled={isViewer}
              />

              {/* QC Rejection History / CA & PA Log */}
              {order.iteration_history && order.iteration_history.length > 0 && (
                <div className="mt-12 pt-12 border-t border-slate-800/50 relative z-10">
                  <h3 className="text-slate-400 text-xs md:text-sm font-black uppercase tracking-wider mb-6 flex items-center gap-3 italic">
                    <AlertOctagon className="w-5 h-5 text-red-500" /> QC Rejection Log
                    <span
                      className="text-xs font-black px-3 py-1 rounded-full bg-red-600 text-white not-italic shadow-sm"
                      style={{ color: "#ffffff" }}
                    >
                      {order.iteration_history.length} {order.iteration_history.length === 1 ? "rejection" : "rejections"}
                    </span>
                  </h3>

                  <div className="space-y-6">
                    {order.iteration_history.slice().reverse().map((entry: any, i: number) => (
                      <div
                        key={i}
                        className="p-6 md:p-8 rounded-[2.5rem] bg-slate-950/40 border border-slate-800 shadow-inner space-y-6"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-800/30">
                          <span
                            className="text-xs md:text-sm font-black uppercase tracking-wider px-4 py-1.5 rounded-full bg-red-600 text-white shadow-sm flex items-center gap-2"
                            style={{ color: "#ffffff" }}
                          >
                            Iteration {entry.iteration} → {entry.iteration + 1}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 italic">
                            {entry.date}
                          </span>
                        </div>

                        {entry.rejected_stage && (
                          <div className="p-5 rounded-[2rem] bg-slate-950/50 border border-slate-800 shadow-inner flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-red-600 uppercase tracking-wider flex items-center gap-2 italic">
                                <AlertOctagon className="w-4 h-4 text-red-600" /> Rejected At:
                              </span>
                              <span
                                className="text-base font-black text-slate-950 uppercase"
                                style={{ color: "#000000" }}
                              >
                                {entry.rejected_stage?.replace(/_/g, " ")}
                              </span>
                            </div>

                            {entry.repeat_from_stage && (
                              <div className="flex items-center gap-3">
                                <span className="text-slate-400 font-bold text-sm">→</span>
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-wider flex items-center gap-2 italic">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Restart From:
                                </span>
                                <span
                                  className="text-base font-black text-slate-950 uppercase"
                                  style={{ color: "#000000" }}
                                >
                                  {entry.repeat_from_stage?.replace(/_/g, " ")}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* CA & PA Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          {/* Corrective Action (CA) — RED */}
                          <div className="p-5 rounded-2xl bg-white border border-rose-200/80 shadow-sm group hover:border-rose-400 transition-colors">
                            <div className="mb-2.5">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 text-red-600 border border-rose-200">
                                <AlertOctagon className="w-3.5 h-3.5 text-red-600" /> Corrective Action (CA)
                              </span>
                            </div>
                            <p
                              className="text-sm md:text-base font-semibold leading-relaxed break-words text-slate-800"
                              style={{ color: "#000000" }}
                            >
                              {entry.reason || "—"}
                            </p>
                          </div>

                          {/* Preventive Action (PA) — GREEN */}
                          <div className="p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-sm group hover:border-emerald-400 transition-colors">
                            <div className="mb-2.5">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Preventive Action (PA)
                              </span>
                            </div>
                            <p
                              className="text-sm md:text-base font-semibold leading-relaxed break-words text-slate-800"
                              style={{ color: "#000000" }}
                            >
                              {entry.plan || "—"}
                            </p>
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
              {canManage && (
                <label className={`cursor-pointer px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${uploading ? 'opacity-50' : ''}`}>
                  <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Add Phase Data'}
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              )}
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
                <option value="">Select conditional defect requirement...</option>
                <option value="Fabric shade / resubmission before bulk fabric dying">1. Fabric shade / resubmission before bulk fabric dying (Blocks Bulk Dyeing)</option>
                <option value="If size specs are incorrect then need to submit fit sample">2. If size specs are incorrect then need to submit fit sample (Blocks Bulk Cutting)</option>
                <option value="Embellishment printing or embroidery strike off">3. Embellishment printing or embroidery strike off (Blocks Bulk Embellishment)</option>
                <option value="Other — see remarks">Other — see remarks</option>
              </select>
            </div>
          )}
          {approvalData.approval === "not_approved" && (
            <>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {isSampling ? "Repeat From Stage (Go Back To Previous Stage)" : "Repeat Stage"}
                </label>
                <select
                  required
                  value={approvalData.repeat_from_stage_id || (repeatableStages.length > 0 ? repeatableStages[0].id : currentStage?.id || "")}
                  onChange={(e) => setApprovalData({ ...approvalData, repeat_from_stage_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-red-500"
                >
                  {repeatableStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.stage_order}. {stageLabel(stage.stage_name)}
                    </option>
                  ))}
                </select>
              </div>
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
            {approvalData.approval === "conditional_approved" && (
              <div className="space-y-1">
                <p>⚠️ <strong>Conditional Approval:</strong> The selected condition will place a mandatory defect gate on downstream production.</p>
                <p className="text-xs font-normal text-amber-800">The blocked downstream stage cannot be started or completed until an authorized user uploads a proof attachment and submits clearance notes.</p>
              </div>
            )}
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

      {/* Defect Condition Clearance Modal */}
      <Modal
        isOpen={Boolean(clearConditionDialog)}
        onClose={() => !clearingCondition && setClearConditionDialog(null)}
        title={`Clear Defect Condition — ${stageLabel(clearConditionDialog?.stageName)}`}
      >
        <form onSubmit={handleClearCondition} className="space-y-5">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Active Defect Requirement</span>
            </div>
            <p className="mt-1 text-sm font-black text-slate-900">
              {clearConditionDialog?.conditionAction}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Uploading a mandatory proof attachment (swatch picture, test report, or strike-off photo) and providing remarks is required to unlock downstream stages.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Mandatory Proof Attachment <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              required
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setClearProofFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-slate-900 file:text-white hover:file:bg-slate-800"
            />
            {clearProofFile && (
              <p className="mt-1.5 text-xs text-emerald-600 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Selected: {clearProofFile.name} ({(clearProofFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Clearance Notes / Corrective Confirmation <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={clearProofNotes}
              onChange={(e) => setClearProofNotes(e.target.value)}
              placeholder="Describe how the defect was corrected, verified, and approved..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={clearingCondition}
              onClick={() => setClearConditionDialog(null)}
              className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={clearingCondition || !clearProofFile || !clearProofNotes.trim()}
              className="rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-500 shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {clearingCondition ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin" /> Verifying & Uploading...
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4" /> Verify Proof & Unlock Stage
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Move to Bulk Modal */}
      <Modal
        isOpen={moveToBulkDialog}
        onClose={() => !updating && setMoveToBulkDialog(false)}
        title="Move Sample to Bulk Production"
        maxWidth="max-w-4xl"
      >
        {/* noValidate: this form scrolls inside the modal, so a native validation
            bubble can land out of sight. firstMissingField() reports the missing
            field in a dialog instead. */}
        <form noValidate onSubmit={handleMoveToBulk} className="space-y-6 max-h-[78vh] overflow-y-auto px-1 pr-3 custom-scrollbar">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <p className="text-xs font-bold text-emerald-400">
              Launch a full bulk production order directly from this sample prototype. All specifications are pre-populated and can be customized before launch.
            </p>
          </div>

          {/* Bulk Project / Class Selection */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">1. Bulk Project Classification</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Existing Bulk Project</label>
                <select
                  value={moveToBulkData.bulk_class_id}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, bulk_class_id: e.target.value, new_class_name: e.target.value ? "" : moveToBulkData.new_class_name })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                >
                  <option value="">— Select existing project —</option>
                  {bulkClasses.map((bc: any) => (<option key={bc.id} value={bc.id}>{bc.name}</option>))}
                </select>
              </div>
              {!moveToBulkData.bulk_class_id && (
                <div>
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">OR Create New Bulk Project Name</label>
                  <input
                    type="text"
                    value={moveToBulkData.new_class_name}
                    onChange={(e) => setMoveToBulkData({ ...moveToBulkData, new_class_name: e.target.value })}
                    placeholder="e.g. Summer Collection Bulk 2026"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500 placeholder:text-slate-600"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Product Specifications */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">2. Product Specifications (Pre-Populated)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Product Name *</label>
                <input
                  required
                  type="text"
                  value={moveToBulkData.product_name}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, product_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Style Name *</label>
                <input
                  required
                  type="text"
                  value={moveToBulkData.style_name}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, style_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">PO # *</label>
                <input
                  required
                  type="text"
                  value={moveToBulkData.order_no}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, order_no: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Priority</label>
                <select
                  value={moveToBulkData.priority}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, priority: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Fabric</label>
                <input
                  type="text"
                  value={moveToBulkData.fabric}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, fabric: e.target.value })}
                  placeholder="e.g. 100% Combed Cotton 180 GSM"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500 placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Tech Pack #</label>
                <input
                  type="text"
                  value={moveToBulkData.tech_pack_no}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, tech_pack_no: e.target.value })}
                  placeholder="e.g. TP-4019"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500 placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Bulk Quantity & Delivery Schedule */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">3. Bulk Quantity & Delivery Schedule</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Bulk Quantity (Pcs) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="e.g. 5000"
                  value={moveToBulkData.quantity}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, quantity: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500 placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Order Placement Date</label>
                <input
                  type="date"
                  value={moveToBulkData.order_placement_date}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, order_placement_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Ex-Factory Date *</label>
                <input
                  required
                  type="date"
                  value={moveToBulkData.ex_factory_date}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, ex_factory_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Vendor and Line Assignments */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">4. Assigned Vendor & Floor Lines</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Assigned Vendor *</label>
                <select
                  required
                  value={moveToBulkData.vendor_id}
                  onChange={(e) => setMoveToBulkData({ ...moveToBulkData, vendor_id: e.target.value, floor_assignments: [] })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                >
                  <option value="">Select vendor...</option>
                  {vendors.map((v: any) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Floors & Lines</label>
                <VendorFloorLineSelector
                  vendorId={moveToBulkData.vendor_id}
                  value={moveToBulkData.floor_assignments}
                  onChange={(assignments) => setMoveToBulkData({ ...moveToBulkData, floor_assignments: assignments })}
                />
              </div>
            </div>
          </div>

          {/* Requirements / Remarks */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-2">
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Requirements & Production Remarks</label>
            <textarea
              rows={2}
              value={moveToBulkData.requirements}
              onChange={(e) => setMoveToBulkData({ ...moveToBulkData, requirements: e.target.value })}
              placeholder="Bulk production instructions, specs, special wash care, tolerances..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500 resize-none placeholder:text-slate-600"
            />
          </div>

          {/* Reference Pictures */}
          <div className="space-y-2">
            <ReferenceAttachmentButton
              attachments={moveToBulkData.reference_attachments}
              uploading={uploadingBulkReference}
              onUpload={handleMoveToBulkReferenceUpload}
              onRequirementChange={(idx, field, val) => {
                const next = [...moveToBulkData.reference_attachments];
                next[idx] = { ...next[idx], [field]: val };
                setMoveToBulkData({ ...moveToBulkData, reference_attachments: next });
              }}
              onRemove={(idx) => {
                setMoveToBulkData({
                  ...moveToBulkData,
                  reference_attachments: moveToBulkData.reference_attachments.filter((_, i) => i !== idx),
                });
              }}
            />
          </div>

          {/* Predicted Stage Days & SLA Chunks */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h4 className="text-white text-xs font-black uppercase tracking-widest">
                Bulk Stage SLA & Chunks
              </h4>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                Standard 15-stage sequence. Set target/buffer days or select multiple stages to merge them under unified SLA chunks.
              </p>
            </div>
            <StageMergingComponent
              defaultStages={DEFAULT_BULK_STAGES}
              stageDays={moveToBulkStageDays}
              setStageDays={setMoveToBulkStageDays}
              stageBuffers={moveToBulkStageBuffers}
              setStageBuffers={setMoveToBulkStageBuffers}
              chunks={moveToBulkChunks}
              setChunks={setMoveToBulkChunks}
              selectedMergeStages={moveToBulkSelectedStages}
              setSelectedMergeStages={setMoveToBulkSelectedStages}
              themeHex="#10b981"
              themeColor="emerald"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setMoveToBulkDialog(false)}
              disabled={updating}
              className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                updating ||
                (!moveToBulkData.bulk_class_id && !moveToBulkData.new_class_name.trim()) ||
                !moveToBulkData.vendor_id ||
                !moveToBulkData.quantity ||
                !moveToBulkData.ex_factory_date
              }
              className="rounded-xl bg-emerald-600 px-8 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-xl hover:bg-emerald-500 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {updating ? "Launching Bulk..." : "Launch Bulk Production Order →"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Comprehensive Reorder Modal */}
      <Modal isOpen={reorderDialog} onClose={() => !updating && setReorderDialog(false)} title="Create Bulk Reorder">
        {/* noValidate — see the Move to Bulk form above. */}
        <form noValidate onSubmit={handleReorder} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
          <p className="text-xs font-bold text-slate-500">
            Configure the complete reorder specifications, vendor line assignments, SLA pipeline, and reference requirements.
          </p>

          {/* 1. Bulk Project Classification */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700">1. Bulk Project Classification</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Existing Bulk Project</label>
                <select
                  value={reorderData.bulk_class_id}
                  onChange={(e) => setReorderData({ ...reorderData, bulk_class_id: e.target.value, new_class_name: e.target.value ? "" : reorderData.new_class_name })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
                >
                  <option value="">— Select existing project —</option>
                  {bulkClasses.map((bc: any) => (<option key={bc.id} value={bc.id}>{bc.name}</option>))}
                </select>
              </div>
              {!reorderData.bulk_class_id && (
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">OR Create New Bulk Project Name</label>
                  <input
                    type="text"
                    value={reorderData.new_class_name}
                    onChange={(e) => setReorderData({ ...reorderData, new_class_name: e.target.value })}
                    placeholder="e.g. Autumn Reorder 2026"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 placeholder:text-slate-400 shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. Product Specifications */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700">2. Product Specifications</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Product Name *</label>
                <input
                  required
                  type="text"
                  value={reorderData.product_name}
                  onChange={(e) => setReorderData({ ...reorderData, product_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Style Name *</label>
                <input
                  required
                  type="text"
                  value={reorderData.style_name}
                  onChange={(e) => setReorderData({ ...reorderData, style_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">PO # *</label>
                <input
                  required
                  type="text"
                  value={reorderData.order_no}
                  onChange={(e) => setReorderData({ ...reorderData, order_no: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Priority</label>
                <select
                  value={reorderData.priority}
                  onChange={(e) => setReorderData({ ...reorderData, priority: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Fabric</label>
                <input
                  type="text"
                  value={reorderData.fabric}
                  onChange={(e) => setReorderData({ ...reorderData, fabric: e.target.value })}
                  placeholder="e.g. 100% Combed Cotton 180 GSM"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 placeholder:text-slate-400 shadow-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Tech Pack #</label>
                <input
                  type="text"
                  value={reorderData.tech_pack_no}
                  onChange={(e) => setReorderData({ ...reorderData, tech_pack_no: e.target.value })}
                  placeholder="e.g. TP-4019"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 placeholder:text-slate-400 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* 3. Reorder Quantity & Delivery Schedule */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700">3. Reorder Quantity & Delivery Schedule</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Reorder Quantity (Pcs) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="e.g. 5000"
                  value={reorderData.quantity}
                  onChange={(e) => setReorderData({ ...reorderData, quantity: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 placeholder:text-slate-400 shadow-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Order Placement Date</label>
                <input
                  type="date"
                  value={reorderData.order_placement_date}
                  onChange={(e) => setReorderData({ ...reorderData, order_placement_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Ex-Factory Date *</label>
                <input
                  required
                  type="date"
                  value={reorderData.ex_factory_date}
                  onChange={(e) => setReorderData({ ...reorderData, ex_factory_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* 4. Vendor and Line Assignments */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700">4. Assigned Vendor & Floor Lines</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Assigned Vendor *</label>
                <select
                  required
                  value={reorderData.vendor_id}
                  onChange={(e) => setReorderData({ ...reorderData, vendor_id: e.target.value, floor_assignments: [] })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
                >
                  <option value="">Select vendor...</option>
                  {vendors.map((v: any) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Floors & Lines</label>
                <VendorFloorLineSelector
                  vendorId={reorderData.vendor_id}
                  value={reorderData.floor_assignments}
                  onChange={(assignments) => setReorderData({ ...reorderData, floor_assignments: assignments })}
                />
              </div>
            </div>
          </div>

          {/* 5. Requirements / Remarks */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Requirements & Production Remarks</label>
            <textarea
              rows={2}
              value={reorderData.requirements}
              onChange={(e) => setReorderData({ ...reorderData, requirements: e.target.value })}
              placeholder="Reorder instructions, specs, special wash care, tolerances..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 resize-none placeholder:text-slate-400 shadow-sm"
            />
          </div>

          {/* 6. Reference Pictures */}
          <div className="space-y-2">
            <ReferenceAttachmentButton
              attachments={reorderData.reference_attachments}
              uploading={uploadingReorderReference}
              onUpload={handleReorderReferenceUpload}
              onRequirementChange={(index, field, value) => {
                const next = [...reorderData.reference_attachments];
                next[index] = { ...next[index], [field]: value };
                setReorderData({ ...reorderData, reference_attachments: next });
              }}
              onRemove={(index) => {
                const next = reorderData.reference_attachments.filter((_, i) => i !== index);
                setReorderData({ ...reorderData, reference_attachments: next });
              }}
            />
          </div>

          {/* 7. Stage Pipeline & Merged Chunks */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700">5. Stage Pipeline & SLA Schedule</h4>
            <StageMergingComponent
              defaultStages={DEFAULT_BULK_STAGES}
              stageDays={reorderStageDays}
              setStageDays={setReorderStageDays}
              stageBuffers={reorderStageBuffers}
              setStageBuffers={setReorderStageBuffers}
              chunks={reorderChunks}
              setChunks={setReorderChunks}
              selectedMergeStages={reorderSelectedStages}
              setSelectedMergeStages={setReorderSelectedStages}
              themeHex="#10b981"
              themeColor="emerald"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 sticky bottom-0 bg-white/95 backdrop-blur py-3">
            <button
              type="button"
              onClick={() => setReorderDialog(false)}
              disabled={updating}
              className="rounded-xl border border-slate-200 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                updating ||
                !reorderData.vendor_id ||
                !reorderData.quantity ||
                !reorderData.ex_factory_date
              }
              className="rounded-xl bg-emerald-600 px-8 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-xl hover:bg-emerald-500 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {updating ? "Creating Reorder..." : "↻ Create Reorder →"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
