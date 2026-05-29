"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Download,
  ExternalLink,
  Filter,
  History,
  Search,
  UserRound,
  Zap,
} from "lucide-react";
import api from "@/services/api";
import { EmptyState, StatusBadge, formControlClass } from "@/components/ui/PagePrimitives";

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: string;
  created_at?: string;
  ip_address?: string | null;
  payload?: Record<string, unknown>;
  user?: {
    id: string;
    full_name: string;
    email: string;
    role?: string;
  } | null;
}

const ACTIONS = [
  "",
  "USER_LOGIN",
  "USER_LOGOUT",
  "USER_CREATED",
  "USER_UPDATED",
  "VENDOR_CREATED",
  "VENDOR_UPDATED",
  "VENDOR_DEACTIVATED",
  "ORDER_UPDATED",
  "ORDER_STAGE_UPDATED",
  "ORDER_STAGE_REWORK",
  "ORDER_CANCELLED",
  "QC_REPORT_CREATED",
  "QC_REPORT_APPROVED",
  "QC_REPORT_REJECTED",
];

const ENTITY_TYPES = ["", "User", "Vendor", "Order", "Stage", "QCReport"];

import { formatLocalDateTime, formatRelativeTime } from "@/services/dateUtils";

function formatDate(value?: string) {
  return formatLocalDateTime(value);
}

function relativeTime(value?: string) {
  return formatRelativeTime(value);
}

function actionTone(action: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (action.includes("LOGIN") || action.includes("CREATED")) return "success";
  if (action.includes("UPDATED") || action.includes("STAGE")) return "info";
  if (action.includes("DEACTIVATED") || action.includes("REJECT")) return "danger";
  if (action.includes("RESET")) return "warning";
  return "neutral";
}

function actionIconClass(action: string) {
  if (action.includes("LOGIN")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (action.includes("UPDATED")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (action.includes("DEACTIVATED") || action.includes("REJECT")) return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function entityHref(log: ActivityLog) {
  if (log.entity_type === "Vendor") return `/vendors/${log.entity_id}`;
  if (log.entity_type === "Order") return `/orders/${log.entity_id}`;
  if (log.entity_type === "QCReport") return `/qc-reports/${log.entity_id}`;
  if (log.entity_type === "User") return "/users";
  return "";
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params = useMemo(() => ({
    limit: 100,
    search,
    action,
    entity_type: entityType,
    date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    date_to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
  }), [action, dateFrom, dateTo, entityType, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoading(true);
      api.get("/activity-logs/", { params })
        .then((res) => {
          setLogs(res.data.data?.items || []);
          setTotal(res.data.data?.total || 0);
        })
        .catch(() => {
          setLogs([]);
          setTotal(0);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [params]);

  const exportCsv = async () => {
    const res = await api.get("/activity-logs/export.csv", { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity-logs.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.04]">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
              <History className="h-3.5 w-3.5" /> Factory Historian
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-950">Activity Logs</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Trace every important production, quality and system management event.
            </p>
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <label className="lg:col-span-2">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <Search className="h-4 w-4" /> Search
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action, entity, user or details..."
              className={formControlClass}
            />
          </label>

          <label>
            <span className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <Zap className="h-4 w-4" /> Action
            </span>
            <select value={action} onChange={(event) => setAction(event.target.value)} className={formControlClass}>
              {ACTIONS.map((item) => <option key={item} value={item}>{item || "All Actions"}</option>)}
            </select>
          </label>

          <label>
            <span className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <Filter className="h-4 w-4" /> Entity
            </span>
            <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className={formControlClass}>
              {ENTITY_TYPES.map((item) => <option key={item} value={item}>{item || "All Types"}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <CalendarDays className="h-4 w-4" /> From
              </span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={formControlClass} />
            </label>
            <label>
              <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-500">To</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={formControlClass} />
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-sm font-black text-slate-700">Showing {logs.length} of {total} activities</p>
          <p className="text-xs font-bold text-slate-500">Latest events first</p>
        </div>
      </section>

      <section className="space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />
          ))
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="No activity found"
            message="Try widening your filters, or create/update a record to generate a historian event."
          />
        ) : logs.map((log) => {
          const href = entityHref(log);
          return (
            <article
              key={log.id}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-950/[0.07]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${actionIconClass(log.action)}`}>
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black uppercase tracking-tight text-slate-950">
                        {log.action.replaceAll("_", " ")}
                      </h3>
                      <StatusBadge tone={actionTone(log.action)}>{log.entity_type}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {log.details || "Activity recorded."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        {log.user?.full_name || "System"}
                      </span>
                      <span>{log.user?.email || "No email"}</span>
                      <span>Entity ID: {log.entity_id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 lg:text-right">
                  <div>
                    <p className="text-sm font-black text-slate-700">{relativeTime(log.created_at)}</p>
                    <p className="text-xs font-semibold text-slate-500">{formatDate(log.created_at)}</p>
                  </div>
                  {href && (
                    <Link
                      href={href}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      View <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
