"use client";

import React, { useEffect } from "react";
import { ArrowLeft, Download, Printer, Save } from "lucide-react";
import { useHeader } from "@/hooks/useHeader";
import { IndustrialHeading } from "@/components/ui/PagePrimitives";

type ReportWorkspaceProps = {
  children: React.ReactNode;
  maxWidth?: string;
};

export function ReportWorkspace({ children, maxWidth = "max-w-[1800px]" }: ReportWorkspaceProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 p-4 md:p-8 print:bg-white print:p-0">
      <div className={`${maxWidth} mx-auto space-y-6 print:max-w-none print:space-y-0`}>
        {children}
      </div>
    </div>
  );
}

type ReportToolbarProps = {
  title: string;
  subtitle: string;
  meta?: string;
  saving?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  onSave: () => void;
  onPrint?: () => void;
  onDownload?: () => void;
  children?: React.ReactNode;
};

const blankRows = (count: number, cells: number, rowHeight = 26) => (
  Array.from({ length: count }, (_, index) => (
    `<tr><td class="center">${index + 1}</td>${Array.from({ length: cells - 1 }, () => `<td style="height:${rowHeight}px"></td>`).join("")}</tr>`
  )).join("")
);

const headerGrid = () => `
  <table class="meta">
    <tr>
      <th>Vendor</th><td></td><th>Floor</th><td></td><th>Line</th><td></td>
    </tr>
    <tr>
      <th>Style</th><td></td><th>PO Number</th><td></td><th>Date</th><td></td>
    </tr>
    <tr>
      <th>Article</th><td></td><th>Color</th><td></td><th>QC Name</th><td></td>
    </tr>
    <tr>
      <th>Shift</th><td></td><th>Department</th><td></td><th>Inspection Level</th><td></td>
    </tr>
  </table>
`;

const signatures = () => `
  <table class="signatures">
    <tr>
      <td>Prepared By</td>
      <td>Checked By</td>
      <td>Approved By / Supervisor</td>
    </tr>
    <tr>
      <td class="signature-line"></td>
      <td class="signature-line"></td>
      <td class="signature-line"></td>
    </tr>
  </table>
`;

function inlineTemplate() {
  const hours = ["09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00"];
  return `
    <h1>Inline QC Report</h1>
    <p class="subtitle">Operation-wise hourly feeding manual form</p>
    ${headerGrid()}
    <table>
      <thead>
        <tr>
          <th rowspan="2" class="narrow">#</th>
          <th rowspan="2">Operation</th>
          <th rowspan="2">Operator</th>
          <th rowspan="2">Traffic Light</th>
          <th rowspan="2">Defect Name</th>
          <th rowspan="2">Severity</th>
          ${hours.map((hour) => `<th>${hour}</th>`).join("")}
          <th rowspan="2">Total Checked</th>
          <th rowspan="2">Total Defects</th>
          <th rowspan="2">DHU %</th>
        </tr>
        <tr>${hours.map(() => `<th>D / P</th>`).join("")}</tr>
      </thead>
      <tbody>${blankRows(10, 17, 32)}</tbody>
    </table>
    <table class="summary">
      <tr><th>Total Checked</th><td></td><th>Total Defects</th><td></td><th>Overall DHU %</th><td></td><th>AQL Result</th><td></td></tr>
      <tr><th>Top 1 Defect</th><td></td><th>Top 2 Defect</th><td></td><th>Top 3 Defect</th><td></td><th>Top 4/5 Defect</th><td></td></tr>
    </table>
    ${signatures()}
  `;
}

function hourlyQcTemplate(title: string) {
  const defects = ["Defect 1", "Defect 2", "Defect 3", "Defect 4", "Defect 5"];
  return `
    <h1>${title}</h1>
    <p class="subtitle">Hourly QC inspection and AQL control manual form</p>
    ${headerGrid()}
    <table>
      <thead>
        <tr>
          <th>Hour</th>
          <th>Total Pcs Inspected</th>
          ${defects.map((defect) => `<th>${defect}<br><span class="small">ID / Name</span></th>`).join("")}
          <th>Total Defects</th>
          <th>DHU %</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>${blankRows(10, 10, 30)}</tbody>
      <tfoot>
        <tr><th>Day Total</th><td></td>${defects.map(() => "<td></td>").join("")}<td></td><td></td><td></td></tr>
      </tfoot>
    </table>
    <table class="summary">
      <tr><th>AQL Standard</th><td></td><th>Sample Size</th><td></td><th>Acceptance Qty (AC)</th><td></td><th>Rejection Qty (RE)</th><td></td></tr>
      <tr><th>Observed Defects</th><td></td><th>Total Pcs Inspected</th><td></td><th>Overall DHU %</th><td></td><th>AQL Result</th><td></td></tr>
      <tr><th>Top 5 Defects</th><td colspan="7"></td></tr>
    </table>
    ${signatures()}
  `;
}

function cutPanelTemplate() {
  const cutting = ["Missing Parts", "Shaded Components", "Uneven Shape", "Missing Shape", "Wrong Size Panel"];
  const printing = ["Specs Out", "Slanted", "Damage", "Placement Out", "Incorrect", "Stain"];
  const knitting = ["Color Patch", "Knt.Line", "Knt.Hole", "Dead Cotton", "Yarn Variation", "Contamination"];
  const allDefects = [...cutting, ...printing, ...knitting];
  return `
    <h1>Cut Panel Report</h1>
    <p class="subtitle">Lot-wise cut part inspection manual form</p>
    ${headerGrid()}
    <table class="meta">
      <tr><th>Model #</th><td></td><th>Customer</th><td></td><th>STM #</th><td></td><th>Lot #</th><td></td><th>Lot Qty</th><td></td></tr>
    </table>
    <table>
      <thead>
        <tr>
          <th rowspan="2">Bundle #</th><th rowspan="2">Size</th><th rowspan="2">Pcs.</th>
          <th colspan="${cutting.length}">Cutting</th>
          <th colspan="${printing.length}">Printing & Embroidery</th>
          <th colspan="${knitting.length}">Knitting and Dyeing</th>
          <th rowspan="2">T.Defect</th><th rowspan="2">Defects %</th>
        </tr>
        <tr>${allDefects.map((defect) => `<th class="small">${defect}</th>`).join("")}</tr>
      </thead>
      <tbody>${blankRows(10, 22, 28)}</tbody>
      <tfoot><tr><th colspan="3">Total Defects</th>${allDefects.map(() => "<td></td>").join("")}<td></td><td></td></tr></tfoot>
    </table>
    <table class="summary">
      <tr><th>Total Checked</th><td></td><th>Total Defects</th><td></td><th>DHU %</th><td></td><th>AQL Result</th><td></td></tr>
      <tr><th>Top 5 Defects</th><td colspan="7"></td></tr>
    </table>
    ${signatures()}
  `;
}

function batchAuditTemplate() {
  const faults = ["Code / Fault 1", "Code / Fault 2", "Code / Fault 3", "Code / Fault 4", "Code / Fault 5", "Code / Fault 6"];
  return `
    <h1>QA Batch Audit Report</h1>
    <p class="subtitle">Finishing batch audit manual form</p>
    <table class="meta">
      <tr><th>Unit #</th><td></td><th>STM #</th><td></td><th>Style</th><td></td><th>Customer</th><td></td><th>Date</th><td></td></tr>
      <tr><th>Vendor</th><td></td><th>Floor</th><td></td><th>Line</th><td></td><th>Color</th><td></td><th>Product</th><td></td></tr>
      <tr><th>Inspection Level</th><td></td><th>AQL-Critical</th><td></td><th>Zero Tolerance</th><td></td><th>AQL-Major</th><td></td><th>QC Name</th><td></td></tr>
    </table>
    <table>
      <thead>
        <tr>
          <th rowspan="2">Batch #</th>
          <th rowspan="2">Batch Quantity</th>
          <th rowspan="2">Sample Size</th>
          <th colspan="${faults.length}">Faults</th>
          <th rowspan="2">Total Faults</th>
          <th colspan="2">AQL</th>
          <th rowspan="2">Result</th>
          <th rowspan="2">Remarks</th>
        </tr>
        <tr>${faults.map((fault) => `<th class="small">${fault}</th>`).join("")}<th>Acp</th><th>Rej</th></tr>
      </thead>
      <tbody>${blankRows(10, 14, 30)}</tbody>
      <tfoot>
        <tr><th>Grand Total</th><td></td><td></td><td colspan="${faults.length}">Total Faults:</td><td></td><td colspan="2">O.Q.I %:</td><td colspan="2">F.P.Y %:</td></tr>
      </tfoot>
    </table>
    <table class="summary">
      <tr><th>Total QTY</th><td></td><th>Total Faults</th><td></td><th>Sample Qty</th><td></td><th>First Pass QTY</th><td></td><th>Second Pass QTY</th><td></td></tr>
      <tr><th>Top 5 Defects</th><td colspan="9"></td></tr>
    </table>
    ${signatures()}
  `;
}

function manualReportBody(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("inline")) return inlineTemplate();
  if (normalized.includes("cut panel")) return cutPanelTemplate();
  if (normalized.includes("batch audit")) return batchAuditTemplate();
  if (normalized.includes("endline") || normalized.includes("end line")) return hourlyQcTemplate("End Line QC Report");
  return hourlyQcTemplate("Finishing QC Report");
}

function downloadReportAsDoc(title: string) {
  const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "qc-report"}-blank-manual-form.doc`;
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 landscape; margin: 9mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; background: #fff; }
    h1 { margin: 0 0 4px; text-align: center; font-size: 22px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; }
    .subtitle { margin: 0 0 12px; text-align: center; color: #475569; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 10px; page-break-inside: avoid; }
    th, td { border: 1px solid #111827; padding: 5px 6px; height: 26px; vertical-align: middle; font-size: 10px; line-height: 1.15; }
    th { background: #eef2f7; font-weight: 800; text-align: center; }
    td { background: #ffffff; }
    tfoot th, tfoot td { background: #f8fafc; font-weight: 800; }
    .meta th { width: 9%; text-align: left; background: #f1f5f9; }
    .meta td { width: 16%; }
    .summary th { text-align: left; background: #f8fafc; }
    .signatures td { border: 0; height: 44px; font-weight: 800; }
    .signature-line { border-bottom: 1px solid #111827 !important; }
    .center { text-align: center; }
    .narrow { width: 34px; }
    .small { font-size: 8px; line-height: 1.1; }
  </style>
</head>
<body>
  ${manualReportBody(title)}
</body>
</html>`;

  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ReportToolbar({
  title,
  subtitle,
  meta,
  saving,
  saveLabel = "Save Report",
  savingLabel = "Saving...",
  onSave,
  onPrint,
  onDownload,
  children,
}: ReportToolbarProps) {
  const { setHeaderConfig } = useHeader();

  useEffect(() => {
    setHeaderConfig({
      eyebrow: meta || "QC Inspection",
      title: title.split(" ").slice(0, -1).join(" ") || title,
      highlight: title.split(" ").slice(-1).join(" "),
      subtitle: subtitle || "Complete this digital QC audit form or print the standardized sheet.",
    });
    return () => {
      setHeaderConfig(null);
    };
  }, [title, subtitle, meta, setHeaderConfig]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { window.location.href = "/qc-reports"; }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" /> Back to QC Center
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {children}
          <button
            type="button"
            onClick={onPrint || (() => window.print())}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            onClick={onDownload || (() => downloadReportAsDoc(title))}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-indigo-700 transition hover:bg-indigo-600 hover:text-white"
          >
            <Download className="h-4 w-4" /> Download Form
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-950/20 transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? savingLabel : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type ReportCanvasProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ReportCanvas({ title, subtitle, children }: ReportCanvasProps) {
  return (
    <div data-report-canvas className="overflow-hidden rounded-2xl bg-white text-gray-950 shadow-sm ring-1 ring-slate-200 print:rounded-none print:shadow-none print:ring-0">
      {title && (
        <div className="bg-white px-4 py-4 text-center text-gray-950 border-b border-gray-300 print:bg-white print:text-gray-950">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.16em]">{title}</h2>
          {subtitle && <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 print:text-gray-600">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

type SummaryMetric = {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
};

const toneClass = {
  default: "text-gray-950",
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-rose-600",
};

export function ReportSummary({
  metrics,
  topTitle = "Top 5 Defects",
  topItems,
}: {
  metrics: SummaryMetric[];
  topTitle?: string;
  topItems?: { id: string; label: string; value: React.ReactNode; meta?: string }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 border-x border-gray-300 bg-gray-50 p-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-gray-300 bg-white p-3">
            <p className="text-[9px] font-black uppercase text-gray-500">{metric.label}</p>
            <p className={`mt-1 text-xl font-black ${toneClass[metric.tone || "default"]}`}>{metric.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-gray-300 bg-white p-3">
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-700">{topTitle}</h3>
        {topItems?.length ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            {topItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 px-3 py-2">
                {item.meta && <p className="text-[9px] font-black uppercase text-gray-500">{item.meta}</p>}
                <p className="truncate text-xs font-black">{item.label}</p>
                <p className="text-lg font-black text-indigo-600">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs font-bold text-gray-500">No defect counts entered yet.</p>
        )}
      </div>
    </div>
  );
}
