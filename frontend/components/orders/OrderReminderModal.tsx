"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Copy,
  Check,
  Send,
  Eye,
  Code2,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
  RefreshCw,
  Building,
  User,
  Info,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import api from "@/services/api";

export type ReminderTemplateType = "partial" | "date_delay" | "order_complete";

export interface OrderReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  orderData?: {
    id?: string;
    order_no?: string;
    style_name?: string;
    customer?: string;
    vendor_name?: string;
    quantity?: number;
    completed_quantity?: number;
    ex_factory_date?: string;
    current_stage?: string;
    days_delayed?: number;
    delay_reason?: string;
    delay_capa?: string;
    status?: string;
  };
}

export default function OrderReminderModal({
  isOpen,
  onClose,
  orderId,
  orderData: propOrderData,
}: OrderReminderModalProps) {
  const [activeTab, setActiveTab] = useState<ReminderTemplateType>("partial");
  const [viewMode, setViewMode] = useState<"visual" | "html" | "text">("visual");

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [recipients, setRecipients] = useState<string>("");
  const [ccEmails, setCcEmails] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [subjectOverride, setSubjectOverride] = useState<string>("");

  // Loaded Templates Data
  const [loadedTemplates, setLoadedTemplates] = useState<Record<string, any>>({});
  const [currentOrder, setCurrentOrder] = useState<any>(propOrderData || null);

  useEffect(() => {
    if (!isOpen) return;

    if (orderId) {
      fetchTemplates(orderId);
    } else if (propOrderData) {
      setCurrentOrder(propOrderData);
      buildLocalTemplates(propOrderData);
    } else {
      // Fallback demo order for instant preview
      const demo = {
        id: "demo-ord-1",
        order_no: "PO-98421",
        style_name: "Heavyweight Fleece Hoodie 420GSM",
        customer: "Urban Trendwear NYC",
        vendor_name: "Apex Knitwear Facility #3",
        quantity: 12500,
        completed_quantity: 6800,
        ex_factory_date: "2026-10-18",
        current_stage: "Sewing & Assembly (Line 4)",
        days_delayed: 5,
        delay_reason: "Rib collar dye batch variation - re-dyed 2 days ago",
        delay_capa: "Parallel sewing lines activated + 2-hour daily overtime",
        status: "in_progress",
      };
      setCurrentOrder(demo);
      buildLocalTemplates(demo);
    }
  }, [isOpen, orderId, propOrderData]);

  const fetchTemplates = async (oid: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${oid}/reminder-templates`);
      const data = res.data?.data;
      if (data) {
        setLoadedTemplates(data.templates || {});
        setCurrentOrder(data.order);
        if (data.suggested_recipients?.length) {
          setRecipients(data.suggested_recipients.join(", "));
        }
      }
    } catch (err: any) {
      console.warn("Could not fetch remote templates, fallback to local generation", err);
      if (currentOrder) buildLocalTemplates(currentOrder);
    } finally {
      setLoading(false);
    }
  };

  const buildLocalTemplates = (ord: any) => {
    const total = ord.quantity || 10000;
    const done = ord.completed_quantity || Math.floor(total * 0.5);
    const pending = total - done;
    const pct = total > 0 ? Math.round((done / total) * 100) : 50;

    setLoadedTemplates({
      partial: {
        key: "partial",
        title: "Partial Order Attention",
        badge: "⏳ Partial In-Progress",
        badge_color: "#d97706",
        description: "Sent when production has finished partial units and needs active follow-up.",
        subject: `⏳ [ACTION NEEDED] Partial Order Progress: PO #${ord.order_no || "PO-001"} — ${ord.style_name || "Style"} (${pct}% Complete)`,
        html: generateSimulatedHtml("partial", ord, pct, done, pending),
      },
      date_delay: {
        key: "date_delay",
        title: "Date Delay Escalation",
        badge: `🚨 ${ord.days_delayed || 4} Days Overdue`,
        badge_color: "#dc2626",
        description: "Urgent escalation when target ex-factory milestone is breached.",
        subject: `🚨 [CRITICAL DELAY] PO #${ord.order_no || "PO-001"} — ${ord.style_name || "Style"} is ${ord.days_delayed || 4} Days Behind Schedule`,
        html: generateSimulatedHtml("date_delay", ord, pct, done, pending),
      },
      order_complete: {
        key: "order_complete",
        title: "Order Completed & Dispatch",
        badge: "✅ 100% Completed",
        badge_color: "#16a34a",
        description: "Final milestone sign-off confirming 100% completion & QC clearance.",
        subject: `✅ [ORDER COMPLETE & DISPATCH READY] PO #${ord.order_no || "PO-001"} — ${ord.style_name || "Style"} (${total.toLocaleString()} pcs)`,
        html: generateSimulatedHtml("order_complete", ord, 100, total, 0),
      },
    });
  };

  function generateSimulatedHtml(type: ReminderTemplateType, ord: any, pct: number, done: number, pending: number) {
    const color = type === "partial" ? "#d97706" : type === "date_delay" ? "#dc2626" : "#16a34a";
    const title = type === "partial" ? "Partial Order Review" : type === "date_delay" ? "Schedule Delay Escalation" : "Order 100% Completed";
    const badge = type === "partial" ? "⏳ Partial Progress" : type === "date_delay" ? "🚨 Date Delay Warning" : "✅ Passed Final QC & Staged";

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 0;background:#f8fafc;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
        <!-- Header -->
        <tr>
          <td style="background:${color};padding:24px 32px;">
            <table width="100%">
              <tr>
                <td>
                  <div style="font-size:11px;color:rgba(255,255,255,0.85);letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Textile Production &amp; QC System</div>
                  <div style="font-size:20px;font-weight:800;color:#ffffff;margin-top:4px;">${title} — ${ord.order_no || "PO"}</div>
                </td>
                <td align="right">
                  <span style="background:rgba(255,255,255,0.22);color:#ffffff;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;">
                    ${badge}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="font-size:15px;color:#1e293b;margin:0 0 16px;line-height:1.5;">
              Dear <strong>Operations &amp; Merchandising Team</strong>,
            </p>
            <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.6;">
              ${type === "partial" ? `The production for <strong>PO #${ord.order_no}</strong> is currently at <strong>${pct}% completion</strong>. Action is required to clear pending units.` : ""}
              ${type === "date_delay" ? `Order <strong>PO #${ord.order_no}</strong> has exceeded its ex-factory target by <strong>${ord.days_delayed || 4} days</strong>. Please implement the recovery action plan immediately.` : ""}
              ${type === "order_complete" ? `We are pleased to report that <strong>PO #${ord.order_no}</strong> (${ord.style_name}) has finished all production stages and cleared final QC inspection.` : ""}
            </p>
            
            <!-- Metrics Table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;font-size:13px;">
              <tr style="background:#f8fafc;">
                <td style="padding:10px 14px;color:#64748b;font-weight:600;width:35%;border-bottom:1px solid #e2e8f0;">Order PO</td>
                <td style="padding:10px 14px;color:#0f172a;font-weight:700;border-bottom:1px solid #e2e8f0;">${ord.order_no}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Style / Product</td>
                <td style="padding:10px 14px;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0;">${ord.style_name}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Client / Brand</td>
                <td style="padding:10px 14px;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0;">${ord.customer}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Total Quantity</td>
                <td style="padding:10px 14px;color:#0f172a;font-weight:700;border-bottom:1px solid #e2e8f0;">${(ord.quantity || 0).toLocaleString()} pcs</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:10px 14px;color:#64748b;font-weight:600;">Ex-Factory Target</td>
                <td style="padding:10px 14px;color:#0f172a;font-weight:700;">${ord.ex_factory_date || "TBD"}</td>
              </tr>
            </table>

            <div style="text-align:center;margin:30px 0 10px;">
              <a href="#" style="background:${color};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">
                View Order in Production Dashboard &rarr;
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
            Automated dispatch from Textile Production &amp; QC System. Confidential to registered stakeholders.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  const activeTemplate = loadedTemplates[activeTab] || {
    title: "Loading...",
    subject: "Loading subject...",
    badge: "Pending",
    badge_color: "#64748b",
    html: "<p>Loading template...</p>",
  };

  const getPlainText = () => {
    if (!currentOrder) return "";
    const ord = currentOrder;
    if (activeTab === "partial") {
      return `[ACTION NEEDED] Partial Order Progress Review
PO Number: ${ord.order_no}
Style: ${ord.style_name}
Customer: ${ord.customer}
Total Ordered: ${ord.quantity} pcs
Ex-Factory Date: ${ord.ex_factory_date}
Current Stage: ${ord.current_stage || "Stitching Line"}

Notes: ${customNote || "Please review remaining units to expedite dispatch."}

Open Order: https://textileapperal.com/orders/${ord.id || ""}`;
    }
    if (activeTab === "date_delay") {
      return `[CRITICAL DELAY ALERT] Ex-Factory Schedule Breach
PO Number: ${ord.order_no}
Style: ${ord.style_name}
Customer: ${ord.customer}
Overdue: ${ord.days_delayed || 4} Days Behind Schedule
Ex-Factory Deadline: ${ord.ex_factory_date}
Bottleneck: ${ord.current_stage || "Production line"}
Reason: ${ord.delay_reason || "Reported delay"}

Action Plan: ${customNote || "Immediate overtime and line re-balancing required."}

Open Order: https://textileapperal.com/orders/${ord.id || ""}`;
    }
    return `[ORDER COMPLETED & DISPATCH READY]
PO Number: ${ord.order_no}
Style: ${ord.style_name}
Customer: ${ord.customer}
Total Produced: ${ord.quantity} pcs (100% Completed)
Inspection: PASSED (AQL 1.5)
Completion Date: ${new Date().toISOString().split("T")[0]}

Closing Note: ${customNote || "All QC and packing specifications cleared."}

Open Order: https://textileapperal.com/orders/${ord.id || ""}`;
  };

  const copyToClipboard = async (content: string, type: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // fallback
    }
  };

  const handleSendEmail = async () => {
    if (!recipients.trim()) {
      setFeedback({ type: "error", message: "Please enter at least one recipient email address." });
      return;
    }

    if (!orderId && !currentOrder?.id) {
      setFeedback({ type: "error", message: "No active order ID linked to dispatch." });
      return;
    }

    try {
      setSending(true);
      setFeedback(null);
      const recipientList = recipients.split(",").map((s) => s.trim()).filter(Boolean);
      const ccList = ccEmails.split(",").map((s) => s.trim()).filter(Boolean);

      const targetId = orderId || currentOrder.id;
      const res = await api.post(`/orders/${targetId}/send-reminder`, {
        template_type: activeTab,
        recipients: recipientList,
        cc: ccList,
        custom_note: customNote,
        subject_override: subjectOverride || undefined,
      });

      setFeedback({
        type: "success",
        message: res.data?.message || `Reminder email for '${activeTemplate.title}' sent successfully!`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.response?.data?.detail || "Failed to dispatch reminder email.",
      });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0044E6]/20 border border-[#0044E6]/40 flex items-center justify-center text-[#0044E6]">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Order Reminder &amp; Notification Center</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0044E6]/20 text-[#4477FF] border border-[#0044E6]/30">
                  3-in-1 Suite
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentOrder?.order_no ? `PO #${currentOrder.order_no}` : "Order"} • {currentOrder?.style_name || "Textile Manufacturing"} • {currentOrder?.customer || "Client"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Unified Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 pt-3 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex gap-2 shrink-0">
            {/* Tab 1: Partial */}
            <button
              onClick={() => setActiveTab("partial")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs tracking-wide transition-all border-t border-x whitespace-nowrap shrink-0 ${
                activeTab === "partial"
                  ? "bg-white text-amber-700 border-slate-200 shadow-sm -mb-px"
                  : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70"
              }`}
            >
              <Clock className={`w-4 h-4 ${activeTab === "partial" ? "text-amber-600" : "text-slate-400"}`} />
              <span>1. Partial Order Notice</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                Action
              </span>
            </button>

            {/* Tab 2: Date Delay */}
            <button
              onClick={() => setActiveTab("date_delay")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs tracking-wide transition-all border-t border-x whitespace-nowrap shrink-0 ${
                activeTab === "date_delay"
                  ? "bg-white text-rose-700 border-slate-200 shadow-sm -mb-px"
                  : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70"
              }`}
            >
              <AlertTriangle className={`w-4 h-4 ${activeTab === "date_delay" ? "text-rose-600" : "text-slate-400"}`} />
              <span>2. Date Delay Escalation</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800">
                Urgent
              </span>
            </button>

            {/* Tab 3: Complete */}
            <button
              onClick={() => setActiveTab("order_complete")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs tracking-wide transition-all border-t border-x whitespace-nowrap shrink-0 ${
                activeTab === "order_complete"
                  ? "bg-white text-[#0044E6] border-slate-200 shadow-sm -mb-px"
                  : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70"
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${activeTab === "order_complete" ? "text-[#0044E6]" : "text-slate-400"}`} />
              <span>3. Order Completed</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[#EBF0FF] text-[#0044E6]">
                Sign-off
              </span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-semibold text-slate-600 mb-2 shrink-0 min-w-fit">
            <button
              type="button"
              onClick={() => setViewMode("visual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 text-xs font-bold transition-all ${
                viewMode === "visual"
                  ? "bg-white text-[#0044E6] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#0044E6]" />
              <span className="whitespace-nowrap">Visual</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("html")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 text-xs font-bold transition-all ${
                viewMode === "html"
                  ? "bg-white text-[#0044E6] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-[#0044E6]" />
              <span className="whitespace-nowrap">HTML</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("text")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 text-xs font-bold transition-all ${
                viewMode === "text"
                  ? "bg-white text-[#0044E6] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#0044E6]" />
              <span className="whitespace-nowrap">Plain Text</span>
            </button>
          </div>
        </div>

        {/* Modal Main Body (2 Columns on large screens) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-100/50">
          
          {/* Left Column: Preview Box (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: activeTemplate.badge_color || "#3b82f6" }}
                />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {activeTemplate.title}
                </span>
                <span className="text-[11px] text-slate-500">
                  ({activeTemplate.badge})
                </span>
              </div>

              {/* Copy Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(activeTemplate.html || "", "html")}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 px-2.5 py-1 rounded-md shadow-2xs hover:bg-slate-50 transition-all"
                  title="Copy full HTML code to clipboard"
                >
                  {copiedType === "html" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">HTML Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy HTML</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => copyToClipboard(getPlainText(), "text")}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 px-2.5 py-1 rounded-md shadow-2xs hover:bg-slate-50 transition-all"
                  title="Copy plain text to clipboard"
                >
                  {copiedType === "text" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Text Copied!</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Email Meta Simulation Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2 text-slate-500">
                <span className="font-bold text-slate-700 w-16">Subject:</span>
                <span className="font-semibold text-slate-900 truncate">
                  {subjectOverride || activeTemplate.subject}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <span className="font-bold text-slate-700 w-16">To:</span>
                <span className="text-slate-800 font-mono text-[11px]">
                  {recipients || "production-team@company.com, merchant@company.com"}
                </span>
              </div>
              {ccEmails && (
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="font-bold text-slate-700 w-16">CC:</span>
                  <span className="text-slate-800 font-mono text-[11px]">{ccEmails}</span>
                </div>
              )}
            </div>

            {/* Rendered Container */}
            <div className="bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden flex-1 min-h-[440px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-72 text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#0044E6]" />
                  <span className="text-xs font-semibold">Generating customized template...</span>
                </div>
              ) : viewMode === "visual" ? (
                <div className="p-1 h-[480px] overflow-y-auto">
                  <iframe
                    title="Template Preview"
                    srcDoc={activeTemplate.html}
                    className="w-full h-full border-0 rounded-lg"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : viewMode === "html" ? (
                <pre className="p-4 text-[11px] font-mono text-slate-800 h-[480px] overflow-auto bg-slate-900 text-slate-100 whitespace-pre-wrap leading-relaxed select-all">
                  {activeTemplate.html}
                </pre>
              ) : (
                <pre className="p-4 text-xs font-mono text-slate-800 h-[480px] overflow-auto bg-white whitespace-pre-wrap leading-relaxed select-all">
                  {getPlainText()}
                </pre>
              )}
            </div>
          </div>

          {/* Right Column: Dispatch & Customization Form (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Quick Context Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-[#0044E6]" />
                <span>Template Objective</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeTemplate.description}
              </p>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Customer</div>
                  <div className="font-semibold text-slate-800 truncate">{currentOrder?.customer || "—"}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Ex-Factory</div>
                  <div className="font-semibold text-slate-800">{currentOrder?.ex_factory_date || "TBD"}</div>
                </div>
              </div>
            </div>

            {/* Email Dispatch Controls */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4 text-[#0044E6]" />
                <span>Direct Email Dispatch</span>
              </h3>

              {feedback && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2 ${
                    feedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Recipients Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Recipient Emails <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="e.g. manager@factory.com, client@brand.com"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0044E6] focus:border-[#0044E6] focus:bg-white transition-all font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Separate multiple addresses with commas.
                </span>
              </div>

              {/* CC Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  CC Emails (Optional)
                </label>
                <input
                  type="text"
                  value={ccEmails}
                  onChange={(e) => setCcEmails(e.target.value)}
                  placeholder="e.g. head_qc@company.com, admin@textile.com"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0044E6] focus:border-[#0044E6] focus:bg-white transition-all font-mono"
                />
              </div>

              {/* Custom Note Injection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Manager Directive / Custom Note
                </label>
                <textarea
                  rows={3}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Add specific instructions for this order (injected into email body)..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0044E6] focus:border-[#0044E6] focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Subject Override */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Subject Override (Optional)
                </label>
                <input
                  type="text"
                  value={subjectOverride}
                  onChange={(e) => setSubjectOverride(e.target.value)}
                  placeholder={activeTemplate.subject}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0044E6] focus:border-[#0044E6] focus:bg-white transition-all"
                />
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="w-full py-2.5 px-4 bg-[#0044E6] hover:bg-[#0036B8] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatching Reminder...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send {activeTemplate.title} Email</span>
                  </>
                )}
              </button>

              <div className="text-[11px] text-slate-400 text-center leading-relaxed">
                Supports SMTP server delivery or local test outbox logging.
              </div>
            </div>

          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0044E6] animate-pulse" />
            <span>All 3 templates ready for deployment &amp; client communication.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
