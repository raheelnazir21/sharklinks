"use client";

/**
 * NotificationSystem.tsx
 * Clean, simple notification center:
 * - Bell dropdown: compact cards — Stage → Status | Order | Company | Date
 * - Toasts: auto-dismiss after 6s, clean format, no manual dismiss required
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Bell, Volume2, VolumeX, X, Check,
  CheckCircle2, AlertTriangle, Clock, Info,
} from "lucide-react";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick an icon based on notification type */
function NotifIcon({ type }: { type: string }) {
  if (type === "ex_factory_passed" || type === "stage_overdue") {
    return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  }
  if (type === "ex_factory_approaching" || type === "stage_approaching") {
    return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  }
  if (type === "order_created" || type === "class_created") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-[#0044E6]" />;
  }
  return <Info className="h-3.5 w-3.5 text-sky-500" />;
}

/** Strip HTML tags to get plain text */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parse a notification into clean structured lines:
 *   Line 1 — stage name → failure type  (e.g. "PP SAMPLE → OVERDUE")
 *   Line 2 — order name
 *   Line 3 — company / vendor name
 *   Line 4 — date
 */
function parseNotifLines(n: AppNotification): {
  tag: string;
  tagColor: string;
  line1: string;
  line2: string;
  line3: string;
  line4: string;
} {
  const extra = n.extra_data || {};
  const plain = stripHtml(n.html_content || n.message || "");

  // Tag label + color by category
  let tag = "INFO";
  let tagColor = "bg-sky-100 text-sky-700";
  if (n.type === "ex_factory_passed") { tag = "ZONE 1 — EX-FACTORY"; tagColor = "bg-red-100 text-red-700"; }
  else if (n.type === "stage_overdue") { tag = "ZONE 2 — STAGE DELAYED"; tagColor = "bg-orange-100 text-orange-700"; }
  else if (n.type === "ex_factory_approaching") { tag = "ZONE 3 — APPROACHING"; tagColor = "bg-amber-100 text-amber-700"; }
  else if (n.type === "order_created") { tag = "NEW ORDER"; tagColor = "bg-[#EBF0FF] text-[#0044E6]"; }
  else if (n.type === "class_created") { tag = "NEW CLASS"; tagColor = "bg-[#dbe8ff] text-[#0044E6]"; }
  else if (n.type === "pre_order_assigned") { tag = "ORDER ASSIGNED"; tagColor = "bg-blue-100 text-blue-700"; }
  else if (n.type === "pre_order_reminder") { tag = "REMINDER"; tagColor = "bg-orange-100 text-orange-700"; }
  else if (n.type === "pre_order_escalation") { tag = "ESCALATION"; tagColor = "bg-red-100 text-red-700"; }

  // Line 1: Stage → failure description
  let line1 = "";
  if (extra.stage_name) {
    const stageName = String(extra.stage_name).toUpperCase();
    if (n.type === "stage_overdue") {
      const days = extra.days_late ? `${extra.days_late}d overdue` : "overdue";
      line1 = `${stageName} → DELAYED (${days})`;
    } else if (n.type === "stage_approaching") {
      line1 = `${stageName} → DUE SOON`;
    } else {
      line1 = stageName;
    }
  } else if (n.type === "ex_factory_passed") {
    const days = extra.days_overdue ? `${extra.days_overdue} day(s) past` : "passed";
    line1 = `EX-FACTORY DATE → ${days.toUpperCase()}`;
  } else if (n.type === "ex_factory_approaching") {
    const left = extra.days_left === 0 ? "DUE TODAY" : extra.days_left === 1 ? "DUE TOMORROW" : `${extra.days_left} DAYS LEFT`;
    line1 = `EX-FACTORY → ${left}`;
  } else {
    // fallback: first meaningful chunk of plain text
    line1 = plain.split(".")[0]?.slice(0, 80) || n.title || "";
  }

  // Line 2: Order name (from title after "ID: " or extra data)
  let line2 = extra.order_no || extra.class_name || "";
  if (!line2 && n.title) {
    // title format: "ID: po15 | PRODUCT NAME"
    const parts = n.title.split("|");
    line2 = parts[1]?.trim() || parts[0]?.replace("ID:", "").trim() || n.title;
  }

  // Line 3: Company / vendor name
  const line3 = extra.vendor_name || extra.assigned_manager_name || "";

  // Line 4: Date
  let line4 = "";
  if (extra.ex_factory_date) line4 = `Ex-Factory: ${extra.ex_factory_date}`;
  else if (extra.target_date) line4 = `Target: ${extra.target_date}`;
  else if (n.formatted_date) line4 = n.formatted_date;

  return { tag, tagColor, line1, line2, line3, line4 };
}

// ── NotificationBell ──────────────────────────────────────────────────────────

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    soundEnabled,
    isMounted,
    markRead,
    markAllRead,
    toggleSound,
    refetch,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const effectiveSound = isMounted ? soundEnabled : true;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-trigger"
        onClick={() => { setOpen((v) => { if (!v) refetch(); return !v; }); }}
        title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 md:h-10 md:w-10"
      >
        <Bell className="h-4 w-4 md:h-5 md:w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 flex min-w-[20px] h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white ring-2 ring-white leading-none whitespace-nowrap"
          >
            {unreadCount > 999 ? "999+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[480px] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/60">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Notifications</h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{unreadCount} unread alerts</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                suppressHydrationWarning
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 shadow-sm"
              >
                {effectiveSound
                  ? <><Volume2 className="h-3.5 w-3.5" /><span>Sound On</span></>
                  : <><VolumeX className="h-3.5 w-3.5 text-slate-400" /><span>Sound Off</span></>}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-lg border border-[#C7D6FF] bg-[#EBF0FF] px-3 py-1.5 text-[11px] font-bold text-[#0044E6] hover:bg-[#dbe8ff] shadow-sm"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF0FF] text-[#0044E6]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-400">No unread notifications.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const targetUrl = n.order_id
                  ? `/orders/${n.order_id}`
                  : n.class_id
                    ? (n.category === "class_created" && n.extra_data?.is_bulk ? "/bulk-projects" : "/samples")
                    : "/orders";
                const { tag, tagColor, line1, line2, line3, line4 } = parseNotifLines(n);

                return (
                  <div key={n.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors">
                    {/* Icon */}
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                      <NotifIcon type={n.type} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Zone tag */}
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${tagColor} mb-1.5`}>
                        {tag}
                      </span>

                      {/* Line 1: Stage → failure */}
                      {line1 && (
                        <p className="text-sm font-black text-slate-900 leading-snug">
                          {line1}
                        </p>
                      )}

                      {/* Line 2: Order name */}
                      {line2 && (
                        <Link
                          href={targetUrl}
                          onClick={() => { setOpen(false); markRead(n.id); }}
                          className="block text-xs text-slate-500 hover:text-blue-600 hover:underline font-semibold mt-1 truncate"
                        >
                          {line2}
                        </Link>
                      )}

                      {/* Line 3: Company */}
                      {line3 && <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{line3}</p>}

                      {/* Line 4: Date */}
                      {line4 && <p className="text-[11px] text-[#0044E6] font-bold mt-1">{line4}</p>}
                    </div>

                    {/* Mark read */}
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      title="Mark as read"
                      className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-[#EBF0FF] text-[#0044E6] hover:bg-emerald-100 transition"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NotificationToasts — Auto-dismiss after 6s ─────────────────────────────────

const TOAST_DURATION = 6000;  // 6 seconds auto-dismiss
const FADE_OUT_MS   = 400;    // fade-out animation duration

interface ToastItem extends AppNotification {
  visible: boolean;
}

export function NotificationToasts() {
  const { notifications, markRead } = useNotifications();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const shownIds = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Start fade-out
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
    // Remove from DOM after animation
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, FADE_OUT_MS);
    timers.current.set(id + "_remove", t);
    markRead(id);
  }, [markRead]);

  // Add new toasts + auto-dismiss timer
  useEffect(() => {
    const newOnes = notifications.filter((n) => !shownIds.current.has(n.id)).slice(0, 3);
    if (newOnes.length === 0) return;

    newOnes.forEach((n) => {
      shownIds.current.add(n.id);
      // Auto-dismiss after TOAST_DURATION
      const timer = setTimeout(() => dismiss(n.id), TOAST_DURATION);
      timers.current.set(n.id, timer);
    });

    setToasts((prev) => [
      ...newOnes.map((n) => ({ ...n, visible: true })),
      ...prev,
    ].slice(0, 3));
  }, [notifications, dismiss]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-[96px] right-6 z-40 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((toast) => {
        const { tag, tagColor, line1, line2, line3, line4 } = parseNotifLines(toast);
        const targetUrl = toast.order_id ? `/orders/${toast.order_id}` : "/orders";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto w-[300px] rounded-xl border border-slate-200 bg-white shadow-lg transition-all duration-[400ms] ${
              toast.visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            {/* Auto-dismiss progress bar */}
            <div className="h-0.5 w-full overflow-hidden rounded-t-xl bg-slate-100">
              <div
                className="h-full bg-[#0044E6] origin-left"
                style={{
                  animation: toast.visible ? `shrink ${TOAST_DURATION}ms linear forwards` : "none",
                }}
              />
            </div>

            <div className="flex items-start gap-2.5 p-3">
              {/* Icon */}
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <NotifIcon type={toast.type} />
              </div>

              {/* Content — clean structured lines */}
              <div className="flex-1 min-w-0">
                <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${tagColor}`}>
                  {tag}
                </span>
                {line1 && <p className="mt-0.5 text-xs font-bold text-slate-900 leading-snug">{line1}</p>}
                {line2 && (
                  <Link
                    href={targetUrl}
                    className="block text-[11px] text-slate-600 hover:text-blue-600 font-medium mt-0.5 truncate"
                  >
                    {line2}
                  </Link>
                )}
                {line3 && <p className="text-[10px] text-slate-400 mt-0.5">{line3}</p>}
                {line4 && <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{line4}</p>}
              </div>

              {/* Manual dismiss (X) — just in case */}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}

      {/* CSS keyframe for progress bar shrink */}
      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}
