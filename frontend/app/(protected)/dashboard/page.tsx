"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import api from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Factory,
  Layers,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

type Stats = {
  overall_pass_rate: number;
  total_inspections: number;
  total_rejections: number;
  rejection_rate: number;
  dhu_percent: number;
  fpy_percent: number;
  on_time_rate: number;
  pending_approvals: number;
};

type TrackingOrder = {
  order_id: string;
  order_no?: string;
  product_name?: string;
  style_name?: string;
  quantity?: number;
  track_type: "bulk" | "sampling";
  class_name?: string;
  order_status?: string;
  ex_factory_date?: string;
  is_delayed?: boolean;
  delay_days?: number;
  stage_name?: string;
  stage_label?: string;
  stage_status?: string;
  progress_percent?: number;
};

type TrackingLine = {
  line_id?: string | null;
  line_name: string;
  total_orders: number;
  bulk_orders: number;
  sample_orders: number;
  orders: TrackingOrder[];
};

type TrackingFloor = {
  floor_id?: string | null;
  floor_name: string;
  total_orders: number;
  lines: TrackingLine[];
};

type TrackingVendor = {
  vendor_id: string;
  vendor_name: string;
  total_orders: number;
  bulk_orders: number;
  sample_orders: number;
  delayed_orders: number;
  floors: TrackingFloor[];
};

type TrackingPayload = {
  summary: {
    total_orders: number;
    bulk_orders: number;
    sample_orders: number;
    delayed_orders: number;
    completed_orders: number;
    in_progress_orders: number;
  };
  vendors: TrackingVendor[];
};

type DefectDatum = {
  code?: string;
  defect_code?: string;
  defect_name?: string;
  name?: string;
  count?: number;
};

type LineQualityDatum = {
  line_no?: string;
  line_name?: string;
  fpy?: number;
  dhu?: number;
  total_inspections?: number;
};

const DEFAULT_STATS: Stats = {
  overall_pass_rate: 0,
  total_inspections: 0,
  total_rejections: 0,
  rejection_rate: 0,
  dhu_percent: 0,
  fpy_percent: 0,
  on_time_rate: 0,
  pending_approvals: 0,
};

const EMPTY_TRACKING: TrackingPayload = {
  summary: {
    total_orders: 0,
    bulk_orders: 0,
    sample_orders: 0,
    delayed_orders: 0,
    completed_orders: 0,
    in_progress_orders: 0,
  },
  vendors: [],
};

const BULK_STAGES = [
  { id: "customer_order_wrapping_card", label: "Order" },
  { id: "pp_sample_development", label: "PP Dev" },
  { id: "customer_approval", label: "Approval" },
  { id: "fabric_shade_continuity_approval", label: "Shade" },
  { id: "bulk_fabric_cutting", label: "Cutting" },
  { id: "printing_embroidery_embellishment", label: "Print/Emb" },
  { id: "stitching", label: "Stitching" },
  { id: "end_line_qc", label: "End QC" },
  { id: "washing", label: "Washing" },
  { id: "pressing", label: "Pressing" },
  { id: "finishing", label: "Finishing" },
  { id: "packing", label: "Packing" },
  { id: "final_random_inspection", label: "FRI" },
  { id: "shipment_ex_factory", label: "Ship" },
];

const SAMPLE_STAGES = [
  { id: "sample_start", label: "Start" },
  { id: "fabrication", label: "Fabric" },
  { id: "fabric_cutting", label: "Cutting" },
  { id: "embellishment", label: "Emb." },
  { id: "stitching", label: "Stitching" },
  { id: "washing", label: "Washing" },
  { id: "finishing", label: "Finishing" },
  { id: "qc_check", label: "QC" },
  { id: "dispatch", label: "Dispatch" },
  { id: "sample_completed", label: "Done" },
];

const PIE_COLORS = ["#0f766e", "#059669", "#f59e0b", "#dc2626", "#111827"];
const CARD_MOTION = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" as const },
};

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatWeekRange(start: Date) {
  const end = addDays(start, 6);
  const startText = start.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const endText = end.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  return `${startText} - ${endText}`;
}

function weekNumber(date: Date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}

function stageListFor(trackType: "bulk" | "sampling") {
  return trackType === "bulk" ? BULK_STAGES : SAMPLE_STAGES;
}

function stageColumnId(order: TrackingOrder) {
  const stages = stageListFor(order.track_type);
  const exact = stages.find((stage) => stage.id === order.stage_name);
  if (exact) return exact.id;
  const label = order.stage_label?.toLowerCase();
  return stages.find((stage) => stage.label.toLowerCase() === label)?.id || stages[0].id;
}

function flattenOrders(tracking: TrackingPayload) {
  return asArray(tracking.vendors).flatMap((vendor) =>
    asArray(vendor.floors).flatMap((floor) =>
      asArray(floor.lines).flatMap((line) =>
        asArray(line.orders).map((order) => ({
          ...order,
          vendor_name: vendor.vendor_name,
          floor_name: floor.floor_name,
          line_name: line.line_name,
        }))
      )
    )
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
  note,
  trend = "Stable",
  critical = false,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone: string;
  note?: React.ReactNode;
  trend?: string;
  critical?: boolean;
}) {
  return (
    <motion.div
      {...CARD_MOTION}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.04] transition hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-950/[0.08]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-transparent opacity-70" />
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className={`mt-2 text-[10px] font-black uppercase tracking-wider ${critical ? "text-red-600" : "text-emerald-700"}`}>
            {trend}
          </p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tone}`}>{icon}</div>
      </div>
      <p className="font-mono text-4xl font-black tracking-tight text-slate-950">{value}</p>
      {note && <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">{note}</div>}
    </motion.div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section
      {...CARD_MOTION}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.04]"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-950">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            {icon}
          </span>
          {title}
        </h3>
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
      </div>
      {children}
    </motion.section>
  );
}

type FourWeekTrendDatum = {
  week: string;
  range: string;
  production: number;
  dhu: number;
  fpy: number;
  delayed: number;
  orders: ReturnType<typeof flattenOrders>;
};

type TrendMode = "production" | "fpy" | "dhu" | "delay" | "efficiency";

const TREND_TABS: Array<{ key: TrendMode; label: string }> = [
  { key: "production", label: "Production" },
  { key: "fpy", label: "Quality (FPY)" },
  { key: "dhu", label: "DHU %" },
  { key: "delay", label: "Delay Trend" },
  { key: "efficiency", label: "Efficiency" },
];

function FourWeekProductionTrend({
  data,
}: {
  data: FourWeekTrendDatum[];
}) {
  const trendData = useMemo(() => asArray(data).map((item) => ({ ...item, orders: asArray(item.orders) })), [data]);
  const [mode, setMode] = useState<TrendMode>("production");
  const [selectedWeek, setSelectedWeek] = useState(trendData.at(-1)?.week || "");
  const activeWeek = trendData.some((item) => item.week === selectedWeek) ? selectedWeek : trendData.at(-1)?.week || "";

  const totals = trendData.reduce(
    (acc, item) => ({
      production: acc.production + item.production,
      dhu: acc.dhu + item.dhu,
      fpy: acc.fpy + item.fpy,
      delayed: acc.delayed + item.delayed,
    }),
    { production: 0, dhu: 0, fpy: 0, delayed: 0 }
  );
  const weeksWithDhu = trendData.filter((item) => item.dhu > 0);
  const weeksWithFpy = trendData.filter((item) => item.fpy > 0);
  const avgDhu = weeksWithDhu.length ? (weeksWithDhu.reduce((sum, item) => sum + item.dhu, 0) / weeksWithDhu.length).toFixed(1) : "0.0";
  const avgFpy = weeksWithFpy.length ? (weeksWithFpy.reduce((sum, item) => sum + item.fpy, 0) / weeksWithFpy.length).toFixed(1) : "0.0";
  const selectedDatum = trendData.find((item) => item.week === activeWeek) || trendData.at(-1);

  const exportTrend = () => {
    const header = ["Week", "Range", "Production Pcs", "DHU %", "FPY %", "Delayed Orders", "Order Count"];
    const rows = trendData.map((item) => [
      item.week,
      item.range,
      item.production,
      item.dhu,
      item.fpy,
      item.delayed,
      item.orders.length,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "production-trend.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const showProduction = mode === "production" || mode === "efficiency";
  const showFpy = mode === "fpy" || mode === "efficiency";
  const showDhu = mode === "dhu" || mode === "efficiency";
  const showDelay = mode === "delay" || mode === "efficiency";

  return (
    <motion.section
      {...CARD_MOTION}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.04]"
    >
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight text-slate-950">Four Week Production Trend</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">Live order quantities, stage delays, and available QC yield in one frame.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TREND_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMode(tab.key)}
              className={`rounded-xl border px-4 py-2 text-xs font-black transition ${
                mode === tab.key
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/15"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700">
            <CalendarDays className="h-4 w-4" /> 4 Weeks
          </button>
          <button type="button" onClick={exportTrend} className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={trendData}
            margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
            onClick={(state) => {
              const payload = (state as { activePayload?: Array<{ payload?: FourWeekTrendDatum }> } | undefined)?.activePayload?.[0]?.payload;
              if (payload?.week) setSelectedWeek(payload.week);
            }}
          >
            <defs>
              <linearGradient id="productionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickFormatter={(_, index) => `${trendData[index]?.week || ""}`}
            />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={11} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ borderRadius: 16, borderColor: "#e2e8f0", boxShadow: "0 18px 45px rgba(15,23,42,.12)" }}
              labelFormatter={(_, items) => {
                const item = items?.[0]?.payload as FourWeekTrendDatum | undefined;
                return item ? `${item.week} (${item.range})` : "";
              }}
            />
            {showProduction && <Area yAxisId="left" type="monotone" dataKey="production" stroke="#059669" fill="url(#productionFill)" strokeWidth={3} name="Production (Pcs)" />}
            {showDhu && <Line yAxisId="right" type="monotone" dataKey="dhu" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} name="DHU (%)" />}
            {showFpy && <Line yAxisId="right" type="monotone" dataKey="fpy" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} name="FPY (%)" />}
            {showDelay && <Line yAxisId="left" type="monotone" dataKey="delayed" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} name="Delayed Orders" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50 md:grid-cols-4">
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Production</p>
          <p className="mt-2 text-xl font-black text-slate-950">{totals.production.toLocaleString()} Pcs</p>
          <p className="mt-1 text-xs font-black text-emerald-700">↑ live from orders</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avg DHU%</p>
          <p className="mt-2 text-xl font-black text-slate-950">{avgDhu}%</p>
          <p className="mt-1 text-xs font-black text-emerald-700">{weeksWithDhu.length ? "live from QC" : "no QC data yet"}</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avg FPY%</p>
          <p className="mt-2 text-xl font-black text-slate-950">{avgFpy}%</p>
          <p className="mt-1 text-xs font-black text-emerald-700">{weeksWithFpy.length ? "live from QC" : "no QC data yet"}</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Delayed</p>
          <p className="mt-2 text-xl font-black text-slate-950">{totals.delayed} Orders</p>
          <p className="mt-1 text-xs font-black text-red-600">stage targets crossed</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Drilldown</p>
            <h4 className="mt-1 text-lg font-black text-slate-950">
              {selectedDatum ? `${selectedDatum.week} orders behind graph` : "No week selected"}
            </h4>
          </div>
          {selectedDatum && <p className="text-xs font-bold text-slate-500">{selectedDatum.range} · {selectedDatum.orders.length} orders</p>}
        </div>
        <div className="max-h-72 overflow-auto">
          {selectedDatum?.orders.length ? (
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product / PO</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Floor / Line</th>
                  <th className="px-4 py-3">Track</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Delay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedDatum.orders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-950">
                      <Link href={`/orders/${order.order_id}`} className="hover:text-emerald-700">
                        {order.product_name || order.style_name || "Unnamed Order"}
                      </Link>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">{order.order_no || order.class_name || "No PO"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{order.vendor_name}</td>
                    <td className="px-4 py-3 text-slate-600">{order.floor_name} / {order.line_name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700">{order.track_type}</span>
                    </td>
                    <td className="px-4 py-3 font-black text-slate-950">{toNumber(order.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{order.stage_label || order.stage_name || "Start"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${order.is_delayed ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {order.is_delayed ? `${order.delay_days || 0} days late` : "On track"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-sm font-bold text-slate-500">No orders found behind this week.</div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-white to-slate-50 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        <Factory className="h-4 w-4" />
      </div>
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-xs text-slate-400">Data will appear once reports or production orders are available.</p>
    </div>
  );
}

function SparkBars({ status }: { status: "pass" | "warning" | "fail" }) {
  const heights = status === "fail" ? [28, 22, 16, 10, 6] : [8, 14, 18, 26, 24];
  const color = status === "fail" ? "bg-red-600" : status === "warning" ? "bg-yellow-500" : "bg-emerald-600";
  return (
    <div className="flex h-8 items-end gap-1">
      {heights.map((height, index) => (
        <motion.span
          key={index}
          initial={{ height: 2, opacity: 0.4 }}
          animate={{ height, opacity: 1 }}
          transition={{ duration: 0.3, delay: index * 0.04 }}
          className={`w-4 rounded-t-sm ${color}`}
        />
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: "pass" | "warning" | "fail" }) {
  const styles = {
    pass: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    warning: "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200",
    fail: "bg-red-50 text-red-700 ring-1 ring-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  );
}

function PhaseStatus({ orders }: { orders: ReturnType<typeof flattenOrders> }) {
  const total = Math.max(orders.length, 1);
  const prep = orders.filter((order) => ["customer_order_wrapping_card", "pp_sample_development", "customer_approval", "fabric_shade_continuity_approval", "bulk_start", "sample_start", "fabrication", "fabric_cutting", "bulk_cutting", "bulk_fabric_cutting"].includes(stageColumnId(order))).length;
  const production = orders.filter((order) => ["printing_embroidery_embellishment", "embellishment", "stitching", "washing"].includes(stageColumnId(order))).length;
  const qc = orders.filter((order) => ["end_line_qc", "top_sample_picked_from_bulk", "finishing", "qc_check", "final_random_qa_audit", "final_random_inspection"].includes(stageColumnId(order))).length;
  const delayed = orders.filter((order) => order.is_delayed).length;
  const ship = Math.max(orders.length - prep - production - qc, 0);
  const segments = [
    { label: "Prep", value: prep, color: "bg-teal-500" },
    { label: "Production", value: production, color: "bg-emerald-600" },
    { label: "QC", value: qc, color: "bg-cyan-500" },
    { label: "Delayed", value: delayed, color: "bg-red-600" },
    { label: "Ship", value: ship, color: "bg-slate-900" },
  ].filter((segment) => segment.value > 0 || orders.length === 0);

  return (
    <motion.section
      {...CARD_MOTION}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.04]"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-950">Production Phase Status</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Current load across preparation, production, QC and shipment.</p>
        </div>
        <div className="hidden flex-wrap items-center gap-4 text-[11px] font-black text-slate-700 md:flex">
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-teal-500" /> Prep</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-emerald-600" /> Production</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-cyan-500" /> QC</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-red-600" /> Delayed</span>
        </div>
      </div>
      <div className="flex h-5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
        {segments.map((segment) => (
          <motion.div
            key={segment.label}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max((segment.value / total) * 100, orders.length ? 4 : 20)}%` }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className={segment.color}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <span>Prep</span>
        <span className="text-center">Stitching</span>
        <span className="text-center">QC</span>
        <span className="text-right">Ship</span>
      </div>
    </motion.section>
  );
}

function ActiveLineTable({
  lines,
}: {
  lines: Array<{
    vendor: string;
    floor: string;
    line: string;
    total: number;
    bulk: number;
    sample: number;
    delayed: number;
    dhu: number;
    fpy: number;
    risk: string;
  }>;
}) {
  const rows = lines.slice(0, 5);
  return (
    <motion.section
      {...CARD_MOTION}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.04]"
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-5">
        <div>
          <h3 className="text-lg font-black text-slate-950">Active Production Lines</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Line, floor, vendor, quality risk and workload in one scan.</p>
        </div>
        <Link href="/tracking-dashboard" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
          View Flow
        </Link>
      </div>
      <div className="max-h-[430px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-[1] !bg-black text-[11px] font-black uppercase tracking-wider !text-white">
            <tr>
              <th className="px-5 py-3">Line</th>
              <th className="px-5 py-3">Floor</th>
              <th className="px-5 py-3">Vendor</th>
              <th className="px-5 py-3">Trend</th>
              <th className="px-5 py-3">Orders</th>
              <th className="px-5 py-3">DHU%</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length ? rows.map((line) => {
              const status = line.risk === "bad" ? "fail" : line.risk === "warn" ? "warning" : "pass";
              return (
                <tr key={`${line.vendor}-${line.floor}-${line.line}`} className="transition hover:bg-emerald-50/50">
                  <td className="px-5 py-4 font-mono font-black text-slate-950">{line.line}</td>
                  <td className="px-5 py-4 text-slate-700">{line.floor}</td>
                  <td className="px-5 py-4 text-slate-700">{line.vendor}</td>
                  <td className="px-5 py-4"><SparkBars status={status} /></td>
                  <td className="px-5 py-4">
                    <div className="font-mono text-slate-950">{line.total} <span className="text-slate-400">/ B{line.bulk} S{line.sample}</span></div>
                    <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(Math.min(line.fpy, 100), 6)}%` }} />
                    </div>
                  </td>
                  <td className={`px-5 py-4 font-mono font-black ${status === "fail" ? "text-red-700" : status === "warning" ? "text-yellow-700" : "text-emerald-700"}`}>{line.dhu}%</td>
                  <td className="px-5 py-4"><StatusPill status={status} /></td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm font-bold text-slate-400">No active line data yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}

function DefectDistribution({ defects }: { defects: Array<{ name: string; code: string; count: number }> }) {
  const fallback = [
    { name: "Skip Stitch", code: "ST-01", count: 0 },
    { name: "Open Seam", code: "ST-02", count: 0 },
    { name: "Broken Thread", code: "ST-03", count: 0 },
    { name: "Dirty Spot", code: "FN-01", count: 0 },
  ];
  const items = (defects.length ? defects : fallback).slice(0, 4);
  return (
    <motion.section
      {...CARD_MOTION}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.04]"
    >
      <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-950">
        <BarChart3 className="h-5 w-5 text-emerald-700" /> Defect Type Distribution
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <motion.div
            key={`${item.code}-${index}`}
            whileHover={{ y: -3 }}
            className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-center shadow-sm"
          >
            <p className="truncate text-[11px] font-black text-slate-700" title={item.name}>{item.name}</p>
            <p className={`mt-2 font-mono text-3xl font-black ${index === 0 ? "text-emerald-700" : index === 1 ? "text-teal-700" : index === 2 ? "text-slate-950" : "text-yellow-700"}`}>{item.count}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function CriticalAlerts({ orders }: { orders: ReturnType<typeof flattenOrders> }) {
  const delayed = orders.filter((order) => order.is_delayed).slice(0, 3);
  return (
    <motion.section
      {...CARD_MOTION}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.04]"
    >
      <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-950">
        <AlertTriangle className="h-5 w-5 text-red-600" /> Critical Alerts
      </h3>
      {delayed.length ? (
        <div className="space-y-3">
          {delayed.map((order) => (
            <motion.div
              key={order.order_id}
              animate={{ boxShadow: ["0 0 0 rgba(220,38,38,0)", "0 0 0 4px rgba(220,38,38,0.08)", "0 0 0 rgba(220,38,38,0)"] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            >
            <Link href={`/orders/${order.order_id}`} className="block rounded-xl border border-red-100 border-l-4 border-l-red-600 bg-red-50 p-3 transition hover:bg-red-100">
              <p className="text-sm font-black text-slate-950">{order.product_name || order.style_name || order.order_no}</p>
              <p className="mt-1 text-xs text-slate-600">
                {order.stage_label || "Current stage"} delayed by {order.delay_days || 0} days.
              </p>
            </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-md bg-emerald-50 p-4 text-sm font-bold text-emerald-800">No critical stage delays right now.</div>
      )}
      <Link href="/tracking-dashboard" className="mt-4 block text-center text-xs font-black uppercase tracking-wider text-emerald-700">
        View all alerts
      </Link>
    </motion.section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [topDefects, setTopDefects] = useState<DefectDatum[]>([]);
  const [lineQuality, setLineQuality] = useState<LineQualityDatum[]>([]);
  const [tracking, setTracking] = useState<TrackingPayload>(EMPTY_TRACKING);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, defectsRes, lineRes, trackingRes] = await Promise.allSettled([
        api.get("/analytics/dashboard-summary"),
        api.get("/analytics/top-defects"),
        api.get("/analytics/line-quality"),
        api.get("/analytics/order-tracking", { params: { track_type: "all" } }),
      ]);

      if (statsRes.status === "fulfilled") setStats(statsRes.value.data.data || DEFAULT_STATS);
      if (defectsRes.status === "fulfilled") setTopDefects(defectsRes.value.data.data || []);
      if (lineRes.status === "fulfilled") setLineQuality(lineRes.value.data.data || []);
      if (trackingRes.status === "fulfilled") setTracking(trackingRes.value.data.data || EMPTY_TRACKING);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial client-side dashboard load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const orders = useMemo(() => flattenOrders(tracking), [tracking]);

  const stageLoad = useMemo(() => {
    const map = new Map<string, { stage: string; bulk: number; sample: number; delayed: number }>();
    orders.forEach((order) => {
      const stage = order.stage_label || stageListFor(order.track_type).find((item) => item.id === stageColumnId(order))?.label || "Start";
      if (!map.has(stage)) map.set(stage, { stage, bulk: 0, sample: 0, delayed: 0 });
      const row = map.get(stage)!;
      if (order.track_type === "bulk") row.bulk += 1;
      else row.sample += 1;
      if (order.is_delayed) row.delayed += 1;
    });
    return Array.from(map.values());
  }, [orders]);

  const vendorPerformance = useMemo(() => {
    return tracking.vendors.slice(0, 8).map((vendor) => ({
      vendor: vendor.vendor_name,
      orders: vendor.total_orders,
      bulk: vendor.bulk_orders,
      sample: vendor.sample_orders,
      delayed: vendor.delayed_orders,
      healthy: Math.max(vendor.total_orders - vendor.delayed_orders, 0),
    }));
  }, [tracking.vendors]);

  const lineHeatmap = useMemo(() => {
    const qualityByLine = new Map(
      lineQuality.map((line) => [String(line.line_no || line.line_name || "").toLowerCase(), line])
    );

    return tracking.vendors.flatMap((vendor) =>
      vendor.floors.flatMap((floor) =>
        floor.lines.map((line) => {
          const matched = qualityByLine.get(line.line_name.toLowerCase());
          const delayed = line.orders.filter((order) => order.is_delayed).length;
          const dhu = toNumber(matched?.dhu);
          const hasFpy = matched?.fpy !== undefined;
          const fpy = hasFpy ? toNumber(matched?.fpy) : 0;
          const risk = delayed > 0 || dhu > 7 ? "bad" : dhu > 3 || (hasFpy && fpy < 90) ? "warn" : "good";
          return {
            vendor: vendor.vendor_name,
            floor: floor.floor_name,
            line: line.line_name,
            total: line.total_orders,
            bulk: line.bulk_orders,
            sample: line.sample_orders,
            delayed,
            dhu,
            fpy,
            risk,
          };
        })
      )
    ).slice(0, 12);
  }, [tracking.vendors, lineQuality]);

  const defectChart = useMemo(() => {
    return topDefects.slice(0, 5).map((item) => ({
      name: item.defect_name || item.name || item.code || item.defect_code || "Defect",
      code: item.code || item.defect_code || item.defect_name || item.name || "N/A",
      count: toNumber(item.count),
    }));
  }, [topDefects]);

  const fourWeekTrend = useMemo<FourWeekTrendDatum[]>(() => {
    const currentWeekStart = startOfWeek(new Date());
    const weeks = Array.from({ length: 4 }, (_, index) => addDays(currentWeekStart, (index - 3) * 7));

    return weeks.map((weekStart, index) => {
      const nextWeek = addDays(weekStart, 7);
      const weekOrders = orders.filter((order) => {
        const sourceDate = order.ex_factory_date ? new Date(order.ex_factory_date) : new Date();
        return sourceDate >= weekStart && sourceDate < nextWeek;
      });
      const isCurrentWeek = index === weeks.length - 1;

      return {
        week: `Week ${weekNumber(weekStart)}`,
        range: formatWeekRange(weekStart),
        production: weekOrders.reduce((sum, order) => sum + toNumber(order.quantity), 0),
        dhu: isCurrentWeek ? toNumber(stats.dhu_percent) : 0,
        fpy: isCurrentWeek ? toNumber(stats.fpy_percent) : 0,
        delayed: weekOrders.filter((order) => order.is_delayed).length,
        orders: weekOrders,
      };
    });
  }, [orders, stats.dhu_percent, stats.fpy_percent]);

  const flowTrend = useMemo(() => {
    return fourWeekTrend.map((item) => ({
      period: item.week,
      dhu: item.dhu,
      fpy: item.fpy,
      output: item.production,
    }));
  }, [fourWeekTrend]);

  const splitData = [
    { name: "Bulk", value: tracking.summary.bulk_orders },
    { name: "Sample", value: tracking.summary.sample_orders },
    { name: "Delayed", value: tracking.summary.delayed_orders },
    { name: "Completed", value: tracking.summary.completed_orders },
  ].filter((item) => item.value > 0);

  const delayedOrders = orders.filter((order) => order.is_delayed).slice(0, 5);
  const aqlPass = Math.max(0, Math.min(100, stats.overall_pass_rate || (stats.total_inspections ? 100 - stats.rejection_rate : 0)));
  const displayName = user?.full_name?.split(" ")[0] || "Team";
  const quickActions = [
    {
      label: "Bulk Order",
      href: "/bulk-projects",
      icon: <Layers className="h-5 w-5" />,
      className: "border-emerald-100 bg-emerald-50 text-emerald-700",
    },
    {
      label: "QC Entry",
      href: "/qc-reports",
      icon: <CheckCircle2 className="h-5 w-5" />,
      className: "border-blue-100 bg-blue-50 text-blue-700",
    },
    {
      label: "Sample Order",
      href: "/samples",
      icon: <BarChart3 className="h-5 w-5" />,
      className: "border-slate-200 bg-white text-slate-700",
    },
    {
      label: "Alerts",
      href: "/approvals",
      icon: <AlertTriangle className="h-5 w-5" />,
      className: "border-red-100 bg-red-50 text-red-700",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-10"
    >
      <motion.section
        {...CARD_MOTION}
        className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-950/[0.06]"
      >
        <div className="grid gap-0 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="relative border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(135deg,#ffffff,#fbfefd)] p-7 xl:border-b-0 xl:border-r">
            <div className="mb-7 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
                <Factory className="h-3.5 w-3.5" /> Live factory command
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-700 ring-1 ring-slate-200">
                <CalendarDays className="h-3.5 w-3.5" /> Today&apos;s control view
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_0.72fr] lg:items-start">
              <div>
                <p className="text-sm font-bold text-slate-500">Welcome back, {displayName}</p>
                <p className="mt-3 max-w-3xl text-xl font-semibold leading-9 text-slate-700">
                  Track bulk and sample orders by vendor, floor, line, current stage, quality risk, DHU, and delay status from one opening screen.
                </p>

                <div className="mt-7 flex max-w-3xl flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search style, PO, product, vendor or line..."
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                  <Link
                    href="/tracking-dashboard"
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-xl !bg-emerald-600 px-5 text-sm font-black uppercase tracking-wide !text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:!bg-emerald-700"
                  >
                    Open Tracking <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((actionItem) => (
                  <Link
                    key={actionItem.label}
                    href={actionItem.href}
                    className={`group rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${actionItem.className}`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm">
                      {actionItem.icon}
                    </span>
                    <p className="mt-4 text-sm font-black">{actionItem.label}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="!bg-black bg-gradient-to-br from-black via-black to-emerald-950 p-7 !text-white">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Today&apos;s factory pulse</p>
                <p className="mt-1 text-sm !text-white/70">Fast signals for supervisor review</p>
              </div>
              <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase text-white transition hover:bg-emerald-500">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest !text-white/70">Orders in flow</p>
                <p className="mt-3 font-mono text-4xl font-black !text-white">{tracking.summary.total_orders}</p>
              </div>
              <div className="rounded-xl border border-red-300/30 bg-red-500/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-100">Delayed</p>
                <p className="mt-3 font-mono text-4xl font-black text-red-100">{tracking.summary.delayed_orders}</p>
              </div>
              <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">FPY rate</p>
                <p className="mt-3 font-mono text-3xl font-black text-emerald-100">{stats.fpy_percent}%</p>
              </div>
              <div className="rounded-xl border border-yellow-300/30 bg-yellow-500/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-100">DHU risk</p>
                <p className="mt-3 font-mono text-3xl font-black text-yellow-100">{stats.dhu_percent}%</p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total Active Lines" value={lineHeatmap.length || 0} icon={<Factory className="h-5 w-5" />} tone="bg-emerald-50 text-emerald-700 ring-emerald-100" trend="+ live line map" note={`${tracking.summary.total_orders} orders in flow`} />
        <MetricCard label="Overall DHU%" value={`${stats.dhu_percent}%`} icon={<AlertTriangle className="h-5 w-5" />} tone={stats.dhu_percent > 5 ? "bg-yellow-50 text-yellow-800 ring-yellow-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"} trend={stats.dhu_percent > 5 ? "Needs review" : "Within control"} critical={stats.dhu_percent > 5} note={stats.dhu_percent > 5 ? "Above threshold" : "Within control"} />
        <MetricCard label="Bulk / Sample" value={`${tracking.summary.bulk_orders}/${tracking.summary.sample_orders}`} icon={<Layers className="h-5 w-5" />} tone="bg-teal-50 text-teal-700 ring-teal-100" trend="Workload split" note="Bulk and sampling workload" />
        <MetricCard label="Delayed Orders" value={tracking.summary.delayed_orders} icon={<Clock className="h-5 w-5" />} tone="bg-red-50 text-red-700 ring-red-100" trend={tracking.summary.delayed_orders ? "Critical queue" : "No delay"} critical={Boolean(tracking.summary.delayed_orders)} note="Stage targets crossed" />
      </div>

      <PhaseStatus orders={orders} />

      <FourWeekProductionTrend data={fourWeekTrend} />

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.45fr_0.55fr]">
        <ActiveLineTable lines={lineHeatmap} />
        <CriticalAlerts orders={orders} />
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.35fr_0.65fr]">
        <DefectDistribution defects={defectChart} />

        <ChartCard title="Bulk / Sample / Risk Split" icon={<Target className="h-4 w-4 text-emerald-600" />}>
          {splitData.length ? (
            <div className="grid grid-cols-[160px_1fr] items-center gap-4">
              <div className="h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={splitData} dataKey="value" innerRadius={46} outerRadius={72} paddingAngle={4}>
                      {splitData.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {splitData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="flex items-center gap-2 text-xs font-black text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      {item.name}
                    </span>
                    <span className="text-sm font-black text-slate-950">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState label="No bulk/sample orders yet" />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title="Stage Load: Where Products Are Sitting" icon={<Layers className="h-4 w-4 text-emerald-600" />}>
          {stageLoad.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageLoad}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="stage" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="bulk" stackId="a" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sample" stackId="a" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delayed" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState label="No stage load data yet" />
          )}
        </ChartCard>

        <ChartCard title="Vendor Performance: Healthy vs Delayed" icon={<Users className="h-4 w-4 text-emerald-600" />}>
          {vendorPerformance.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorPerformance} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="vendor" type="category" width={90} fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="healthy" stackId="a" fill="#059669" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="delayed" stackId="a" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState label="No vendor performance data yet" />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr_0.9fr]">
        <ChartCard title="Top 5 Defects" icon={<AlertTriangle className="h-4 w-4 text-red-600" />}>
          {defectChart.length ? (
            <div className="h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={defectChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="code" type="category" width={70} fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f766e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState label="No defect data yet" />
          )}
        </ChartCard>

        <ChartCard title="DHU / FPY Trend" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}>
          <div className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flowTrend}>
                <defs>
                  <linearGradient id="dhu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="period" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="dhu" stroke="#f59e0b" fill="url(#dhu)" strokeWidth={2} />
                <Line type="monotone" dataKey="fpy" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="AQL / Pass Gauge" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ name: "Pass", value: aqlPass }]} startAngle={180} endAngle={0}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" fill={aqlPass >= 90 ? "#059669" : aqlPass >= 75 ? "#f59e0b" : "#dc2626"} background cornerRadius={12} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="-mt-12 text-center">
            <p className="text-4xl font-black text-slate-950">{aqlPass}%</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Overall quality pass</p>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <ChartCard title="Line Quality Heatmap" icon={<Factory className="h-4 w-4 text-emerald-600" />}>
          {lineHeatmap.length ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {lineHeatmap.map((line) => (
                <div
                  key={`${line.vendor}-${line.floor}-${line.line}`}
                  className={`rounded-xl border p-3 ${
                    line.risk === "bad"
                      ? "border-red-200 bg-red-50"
                      : line.risk === "warn"
                        ? "border-yellow-200 bg-yellow-50"
                        : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black uppercase text-slate-950">{line.line}</p>
                      <p className="mt-1 truncate text-[9px] font-bold uppercase text-slate-500">{line.vendor} / {line.floor}</p>
                    </div>
                    <span className="text-lg font-black text-slate-950">{line.total}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div><p className="text-sm font-black text-emerald-700">{line.bulk}</p><p className="text-[8px] font-black uppercase text-slate-500">Bulk</p></div>
                    <div><p className="text-sm font-black text-teal-700">{line.sample}</p><p className="text-[8px] font-black uppercase text-slate-500">Sample</p></div>
                    <div><p className="text-sm font-black text-red-700">{line.delayed}</p><p className="text-[8px] font-black uppercase text-slate-500">Late</p></div>
                    <div><p className="text-sm font-black text-slate-900">{line.fpy}%</p><p className="text-[8px] font-black uppercase text-slate-500">FPY</p></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No line placement data yet" />
          )}
        </ChartCard>

        <ChartCard title="Delay Risk & Action Queue" icon={<Clock className="h-4 w-4 text-red-600" />}>
          {delayedOrders.length ? (
            <div className="space-y-2">
              {delayedOrders.map((order) => (
                <Link key={order.order_id} href={`/orders/${order.order_id}`} className="block rounded-xl border border-red-100 bg-red-50 p-3 hover:border-red-300">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black uppercase text-slate-950">{order.product_name || order.style_name || order.order_no}</p>
                      <p className="mt-1 text-[9px] font-bold uppercase text-slate-500">{order.vendor_name} / {order.line_name}</p>
                    </div>
                    <span className="rounded-lg bg-red-100 px-2 py-1 text-[9px] font-black text-red-800">{order.delay_days || 0}d</span>
                  </div>
                  <p className="mt-2 text-[10px] font-black uppercase text-red-800">{order.stage_label || "Current Stage"}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState label="No delayed orders right now" />
          )}
        </ChartCard>
      </div>
    </motion.div>
  );
}
