"use client";

/**
 * NotificationSystem.tsx
 * Two components in one file:
 *   1. NotificationPanel   — dropdown panel from the bell icon
 *   2. NotificationToasts  — bottom-right popup toasts (auto-dismiss 8s)
 * Both are wired to useNotifications hook for shared state.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Bell, BellOff, CheckCheck, X, AlertTriangle,
  Calendar, Clock, CheckCircle2, XCircle, Volume2, VolumeX,
} from "lucide-react";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function notifStyle(type: string) {
  switch (type) {
    case "ex_factory_passed":
    case "stage_overdue":
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        color: "text-rose-400",
        bg: "bg-rose-500/10 border-rose-500/20",
        dot: "bg-rose-500",
        toastBorder: "border-rose-500/30 bg-rose-950/80",
      };
    case "ex_factory_approaching":
      return {
        icon: <Calendar className="w-4 h-4" />,
        color: "text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20",
        dot: "bg-amber-500",
        toastBorder: "border-amber-500/30 bg-amber-950/80",
      };
    case "stage_completed":
      return {
        icon: <CheckCircle2 className="w-4 h-4" />,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        dot: "bg-emerald-500",
        toastBorder: "border-emerald-500/30 bg-emerald-950/80",
      };
    case "qc_alert":
      return {
        icon: <XCircle className="w-4 h-4" />,
        color: "text-purple-400",
        bg: "bg-purple-500/10 border-purple-500/20",
        dot: "bg-purple-500",
        toastBorder: "border-purple-500/30 bg-purple-950/80",
      };
    default:
      return {
        icon: <Clock className="w-4 h-4" />,
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        dot: "bg-blue-500",
        toastBorder: "border-blue-500/30 bg-blue-950/80",
      };
  }
}

// ── NotificationPanel ─────────────────────────────────────────────────────────

export function NotificationBell() {
  const { notifications, unreadCount, soundEnabled, isMounted, markRead, markAllRead, toggleSound } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Ensure SSR and initial client hydration match default
  const effectiveSound = isMounted ? soundEnabled : true;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <div className="flex items-center gap-1">
        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          suppressHydrationWarning
          title={effectiveSound ? "Sound ON — click to mute" : "Sound OFF — click to enable"}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
        >
          {effectiveSound
            ? <Volume2 className="h-3.5 w-3.5" />
            : <VolumeX className="h-3.5 w-3.5 text-slate-400" />}
        </button>

        {/* Bell */}
        <button
          id="notification-bell"
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 md:h-10 md:w-10"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[380px] rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-700" />
              <span className="text-sm font-black text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-600">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-[10px] font-black text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                >
                  <CheckCheck className="w-3 h-3" /> All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <CheckCircle2 className="w-10 h-10 text-emerald-200" />
                <p className="text-sm font-black text-slate-400">All caught up!</p>
                <p className="text-xs font-semibold text-slate-400">No unread notifications.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => {
                  const style = notifStyle(n.type);
                  return (
                    <div
                      key={n.id}
                      className="group relative flex gap-3 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => markRead(n.id)}
                    >
                      {/* Unread dot */}
                      <span className={`absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full ${style.dot}`} />

                      {/* Icon */}
                      <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full border ${style.bg} ${style.color}`}>
                        {style.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-900 leading-tight">{n.title}</p>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5 leading-snug">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{timeAgo(n.created_at)}</span>
                          {n.order_id && (
                            <Link
                              href={`/orders/${n.order_id}`}
                              onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                              className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700"
                            >
                              View Order →
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Close */}
                      <button
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                        className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-5 py-3 text-center">
            <p suppressHydrationWarning className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              {effectiveSound ? "🔔 Sound ON" : "🔕 Sound OFF"} · Auto-refreshes every 60s
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


// ── NotificationToasts ────────────────────────────────────────────────────────

const TOAST_DURATION = 8000; // 8 seconds auto-dismiss

interface ToastItem extends AppNotification {
  visible: boolean;
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (!toast.visible) return;
    const t = setTimeout(() => onDismiss(toast.id), TOAST_DURATION);
    return () => clearTimeout(t);
  }, [toast.id, toast.visible, onDismiss]);

  const style = notifStyle(toast.type);

  return (
    <div
      className={`pointer-events-auto w-[360px] rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-400 ${style.toastBorder} ${
        toast.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {/* Progress bar */}
      <div className="h-0.5 w-full rounded-t-2xl overflow-hidden bg-white/10">
        <div
          className={`h-full ${style.dot} rounded-full`}
          style={{
            animation: `shrink ${TOAST_DURATION}ms linear forwards`,
          }}
        />
      </div>

      <div className="flex gap-3 p-4">
        <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full border ${style.bg} ${style.color}`}>
          {style.icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white leading-tight">{toast.title}</p>
          <p className="text-[11px] font-semibold text-white/70 mt-0.5 leading-snug line-clamp-2">{toast.message}</p>

          <div className="flex items-center gap-3 mt-3">
            {toast.order_id && (
              <Link
                href={`/orders/${toast.order_id}`}
                onClick={() => onDismiss(toast.id)}
                className="text-[10px] font-black uppercase tracking-widest text-white/80 hover:text-white border border-white/20 rounded-lg px-2.5 py-1 hover:border-white/40 transition"
              >
                View Order
              </Link>
            )}
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white/80 transition"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function NotificationToasts() {
  const { notifications, markRead } = useNotifications();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const shownIds = useRef<Set<string>>(new Set());

  // When notifications list updates, push new ones as toasts
  useEffect(() => {
    const newOnes = notifications.filter((n) => !shownIds.current.has(n.id)).slice(0, 3);
    if (newOnes.length === 0) return;

    newOnes.forEach((n) => shownIds.current.add(n.id));
    setToasts((prev) => [
      ...newOnes.map((n) => ({ ...n, visible: true })),
      ...prev,
    ].slice(0, 3)); // max 3 visible at once
  }, [notifications]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
    markRead(id);
  }, [markRead]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
