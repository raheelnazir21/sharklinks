"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Copy,
  Check,
  Download,
  ExternalLink,
  Smartphone,
  Monitor,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  badge: string;
  badgeClass: string;
  subject: string;
  file: string;
  description: string;
}

const TEMPLATES: Template[] = [
  {
    id: "wip_directive",
    name: "WIP CSV & 6 Control Zones Directive",
    badge: "Official Directive",
    badgeClass: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    subject: "📢 [COTTON COLLECTIVE] WIP CSV DOWNLOAD & DAILY NOTIFICATION REMINDERS (CONTROL ZONES 1–6)",
    file: "/email-previews/4_wip_control_zones_directive.html",
    description: "Executive notice mandating weekly WIP CSV exports, live Cut-to-Pack updates, and the 6 Control Zone protocols.",
  },
  {
    id: "partial",
    name: "Zone 2 & Partial Progress Review",
    badge: "Action Required",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    subject: "⏳ [ACTION NEEDED] Partial Order Progress Review: PO #PO-98421 — Heavyweight Fleece Hoodie 420GSM (54% Complete)",
    file: "/email-previews/1_partial_order_reminder.html",
    description: "Sent when production is partially complete or stuck in mid-stages and requires supervisor review.",
  },
  {
    id: "date_delay",
    name: "Zone 1: Ex-Factory Date Passed Alert",
    badge: "Urgent Escalation",
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    subject: "🚨 [CRITICAL DELAY] PO #PO-98421 — Heavyweight Fleece Hoodie 420GSM is 5 Day(s) Behind Ex-Factory Schedule",
    file: "/email-previews/2_date_delay_alert.html",
    description: "Sent when an active PO breaches its committed ex-factory date. Requires Delay Reason + CAPA + Recovery Date.",
  },
  {
    id: "order_complete",
    name: "Zone 4 & 6: QC Passed / Dispatch Ready",
    badge: "100% Complete",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    subject: "✅ [ORDER COMPLETE & DISPATCH READY] PO #PO-98421 — Heavyweight Fleece Hoodie 420GSM (12,500 pcs)",
    file: "/email-previews/3_order_completed.html",
    description: "Released when 100% production and final AQL 1.5 inspection are verified for export shipment.",
  },
];

export default function EmailPreviewPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [copiedType, setCopiedType] = useState<"html" | "text" | null>(null);

  const copyEmailText = async () => {
    const plainText = `COTTON COLLECTIVE - WIP CSV DOWNLOAD & DAILY NOTIFICATION REMINDERS

I am also adding a CSV DOWNLOAD FUNCTION to the WIP. Please submit the updated CSV report AT THE END OF EVERY WEEK. We are also adding DAILY NOTIFICATION REMINDERS this week.

The notification system will be divided into the following control zones:

ZONE 1 – EX-FACTORY DATE PASSED
POs already beyond the committed ex-factory date. The DELAY REASON + CAPA + RECOVERY DATE must be documented.

ZONE 2 – DEVELOPMENT / PROCESS STAGE DELAYED
POs stuck at any stage beyond the planned completion date for that stage. The ROOT CAUSE, CORRECTIVE/PREVENTIVE ACTION AND REVISED STAGE COMPLETION DATE must be updated.

ZONE 3 – EX-FACTORY DATE APPROACHING
POs within approximately 7 days of ex-factory but not yet completed.

ZONE 4 – COMPLETED / READY FOR FINAL QC
POs completed and presented for final inspection.

ZONE 5 – QC REJECTED / REWORK REQUIRED
POs rejected and currently under corrective action or rework. The REJECTION REASON, REWORK PLAN AND EXPECTED RE-INSPECTION DATE must be recorded.

ZONE 6 – QC PASSED / READY FOR DISPATCH
POs successfully passed Final QC and cleared for shipment.

LIVE WIP UPDATES ARE REQUIRED AS EACH ACTIVITY IS STARTED, COMPLETED OR DELAYED. This will allow us to identify exactly WHERE AND WHY delays occur, measure performance against committed dates, and implement corrective action before the delay impacts final delivery.

I look forward to working closely with the factory to establish the required SOPs, set measurable KPIs, strengthen accountability, and optimize the complete process from CUT TO PACK.

Thanks!`;

    await navigator.clipboard.writeText(plainText);
    setCopiedType("text");
    setTimeout(() => setCopiedType(null), 2500);
  };

  const copyEmailHtml = async () => {
    try {
      const response = await fetch(selectedTemplate.file);
      const html = await response.text();
      await navigator.clipboard.writeText(html);
      setCopiedType("html");
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      alert("Unable to fetch template HTML. Please use the download button.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-white tracking-tight">Cotton Collective Email Hub</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Local Host Preview
                </span>
              </div>
              <p className="text-xs text-slate-400">
                WIP CSV Download &amp; 6 Control Zones Daily Notification Reminders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {/* Viewport Toggles */}
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setViewport("desktop")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                  viewport === "desktop"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Desktop View (680px)"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>
              <button
                onClick={() => setViewport("mobile")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                  viewport === "mobile"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Mobile View (390px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </button>
            </div>

            {/* Copy Actions */}
            <button
              onClick={copyEmailText}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              {copiedType === "text" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedType === "text" ? "Copied Plaintext!" : "Copy Text"}</span>
            </button>

            <button
              onClick={copyEmailHtml}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-700/20 flex items-center gap-1.5 transition-colors"
            >
              {copiedType === "html" ? <Check className="w-3.5 h-3.5 text-white" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{copiedType === "html" ? "Copied Full HTML!" : "Copy HTML"}</span>
            </button>

            <a
              href={selectedTemplate.file}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Tab</span>
            </a>
          </div>
        </div>

        {/* Template Select Tabs */}
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TEMPLATES.map((tmpl) => {
            const isActive = selectedTemplate.id === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-2 transition-all ${
                  isActive
                    ? "bg-teal-500/20 text-teal-200 border border-teal-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <span>{tmpl.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border ${tmpl.badgeClass}`}>
                  {tmpl.badge}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Email Interactive Preview Frame */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div className="w-full bg-slate-900 border border-slate-800 rounded-t-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2 truncate pr-2">
              <span className="font-semibold text-slate-300">Subject:</span>
              <span className="text-teal-400 font-medium truncate">{selectedTemplate.subject}</span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline whitespace-nowrap">
              Simulated Outlook &amp; Gmail Rendering
            </span>
          </div>

          <div
            className={`w-full bg-white rounded-b-xl border border-slate-800 shadow-2xl transition-all duration-300 overflow-hidden ${
              viewport === "mobile" ? "max-w-[390px]" : "max-w-full"
            }`}
          >
            <iframe
              key={selectedTemplate.id}
              src={selectedTemplate.file}
              title={selectedTemplate.name}
              className="w-full h-[750px] border-none block bg-slate-50"
            />
          </div>
        </div>

        {/* Right Side: Key Directives & 6 Control Zones Reference */}
        <div className="lg:col-span-4 space-y-4">
          {/* Executive Overview Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-sm text-white">WIP CSV Export Policy</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              A <strong>CSV DOWNLOAD FUNCTION</strong> is enabled on the WIP Dashboard.
              All production merchandisers must export and submit updated reports:
            </p>
            <div className="p-2.5 rounded-lg bg-teal-950/60 border border-teal-500/30 text-teal-200 text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Mandatory: At the end of every week</span>
            </div>
          </div>

          {/* 6 Control Zones Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>6 Operational Control Zones</span>
              </h2>
              <span className="text-[10px] text-slate-400">Daily Reminders</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Zone 1 */}
              <div className="p-2.5 rounded-lg bg-rose-950/40 border-l-4 border-rose-500 border-t border-r border-b border-rose-900/40">
                <div className="font-bold text-rose-300">ZONE 1 – EX-FACTORY DATE PASSED</div>
                <div className="text-slate-300 mt-0.5">POs already beyond committed ex-factory date.</div>
                <div className="text-[11px] text-rose-200 mt-1 font-semibold">
                  Required: Delay Reason + CAPA + Recovery Date
                </div>
              </div>

              {/* Zone 2 */}
              <div className="p-2.5 rounded-lg bg-orange-950/40 border-l-4 border-orange-500 border-t border-r border-b border-orange-900/40">
                <div className="font-bold text-orange-300">ZONE 2 – PROCESS STAGE DELAYED</div>
                <div className="text-slate-300 mt-0.5">Stuck at any stage beyond planned target date.</div>
                <div className="text-[11px] text-orange-200 mt-1 font-semibold">
                  Required: Root Cause + CAPA + Revised Target Date
                </div>
              </div>

              {/* Zone 3 */}
              <div className="p-2.5 rounded-lg bg-amber-950/40 border-l-4 border-amber-500 border-t border-r border-b border-amber-900/40">
                <div className="font-bold text-amber-300">ZONE 3 – EX-FACTORY APPROACHING</div>
                <div className="text-slate-300 mt-0.5">Within approx. 7 days of ex-factory deadline.</div>
              </div>

              {/* Zone 4 */}
              <div className="p-2.5 rounded-lg bg-sky-950/40 border-l-4 border-sky-500 border-t border-r border-b border-sky-900/40">
                <div className="font-bold text-sky-300">ZONE 4 – READY FOR FINAL QC</div>
                <div className="text-slate-300 mt-0.5">Completed and presented for final inspection.</div>
              </div>

              {/* Zone 5 */}
              <div className="p-2.5 rounded-lg bg-purple-950/40 border-l-4 border-purple-500 border-t border-r border-b border-purple-900/40">
                <div className="font-bold text-purple-300">ZONE 5 – QC REJECTED / REWORK</div>
                <div className="text-slate-300 mt-0.5">Under corrective action or rework loop.</div>
                <div className="text-[11px] text-purple-200 mt-1 font-semibold">
                  Required: Rejection Reason + Rework Plan + Re-inspection Date
                </div>
              </div>

              {/* Zone 6 */}
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border-l-4 border-emerald-500 border-t border-r border-b border-emerald-900/40">
                <div className="font-bold text-emerald-300">ZONE 6 – QC PASSED / DISPATCH</div>
                <div className="text-slate-300 mt-0.5">Cleared Final QC and released for shipment.</div>
              </div>
            </div>
          </div>

          {/* Cut to Pack Standard Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-bold text-xs uppercase text-teal-400 tracking-wider mb-2">
              Live WIP Standard: Cut to Pack
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Live updates are mandatory as each activity is <strong>started, completed, or delayed</strong>.
              This guarantees complete visibility into where and why bottlenecks arise before impacting final delivery.
            </p>
            <div className="flex gap-2">
              <Link
                href="/tracking-dashboard"
                className="flex-1 py-2 text-center text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors"
              >
                Go to WIP Tracker
              </Link>
              <Link
                href="/orders"
                className="flex-1 py-2 text-center text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                View Active POs
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
