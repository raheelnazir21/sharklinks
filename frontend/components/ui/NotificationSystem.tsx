"use client";

/**
 * NotificationSystem.tsx
 * Lead Manager-styled refined notification center:
 * - NotificationBell: Dropdown modal with exact styling matching user reference screenshot
 * - NotificationToasts: Non-intrusive floating toasts
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Bell, Volume2, VolumeX, X, Check,
  CheckCircle2, AlertTriangle, FileText
} from "lucide-react";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";

// ── NotificationBell Component ───────────────────────────────────────────────

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

  const effectiveSound = isMounted ? soundEnabled : true;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button with Badge matching Screenshot */}
      <button
        id="notification-bell-trigger"
        onClick={() => {
          setOpen((v) => {
            if (!v) refetch();
            return !v;
          });
        }}
        title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 md:h-10 md:w-10"
      >
        <Bell className="h-4 w-4 md:h-5 md:w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Modal matching Screenshot 2 */}
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[380px] sm:w-[420px] md:w-[460px] rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-white">
            <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {/* Sound Toggle Pill Button */}
              <button
                type="button"
                onClick={toggleSound}
                suppressHydrationWarning
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300"
              >
                {effectiveSound ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-slate-600" />
                    <span>Sound On</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                    <span>Sound Off</span>
                  </>
                )}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification Items List */}
          <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100 bg-white">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-400">No unread notifications at this time.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const targetUrl = n.order_id
                  ? `/orders/${n.order_id}`
                  : n.class_id
                  ? (n.category === "class_created" && n.extra_data?.is_bulk ? "/bulk-projects" : "/samples")
                  : "/orders";

                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3.5 px-5 py-4 transition hover:bg-slate-50/70"
                  >
                    {/* Left Monogram / Logo Avatar matching Lead Manager */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0a454d] text-white shadow-xs font-bold text-sm select-none">
                      <span className="font-extrabold text-base tracking-tighter">a</span>
                    </div>

                    {/* Middle Content */}
                    <div className="flex-1 min-w-0">
                      {/* Top Row: Title + Relative Time Badge */}
                      <div className="flex flex-wrap items-baseline gap-1.5 leading-snug">
                        <Link
                          href={targetUrl}
                          onClick={() => setOpen(false)}
                          className="font-bold text-slate-900 hover:text-blue-600 text-[13px] md:text-sm underline-offset-2 hover:underline line-clamp-1"
                        >
                          {n.title}
                        </Link>
                        {n.formatted_time && (
                          <span className="inline-flex items-center rounded-full bg-[#258bd2] px-2.5 py-0.5 text-[10px] md:text-[11px] font-semibold text-white shadow-xs whitespace-nowrap">
                            {n.formatted_time}
                          </span>
                        )}
                      </div>

                      {/* Middle Row: HTML Structured Body */}
                      <div
                        className="text-slate-600 text-xs mt-1.5 leading-relaxed [&_b]:font-bold [&_b]:text-slate-900 [&_i]:italic [&_span]:inline"
                        dangerouslySetInnerHTML={{ __html: n.html_content || n.message }}
                      />

                      {/* Bottom Row: Green Timestamp */}
                      {n.formatted_date && (
                        <div className="text-[#16a34a] font-semibold text-xs mt-1.5">
                          {n.formatted_date}
                        </div>
                      )}
                    </div>

                    {/* Far Right: Circular Green Checkmark Action Button */}
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      title="Mark as read"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#22c55e] bg-[#f0fdf4] text-[#22c55e] transition hover:bg-[#dcfce7] active:scale-90 shadow-xs"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer matching Screenshot 2 */}
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 bg-white">
            <span
              className="text-xs md:text-sm font-bold text-[#1d4ed8] hover:underline cursor-pointer"
            >
              You have {unreadCount} notification{unreadCount !== 1 ? "s" : ""}
            </span>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs md:text-sm font-bold text-[#1d4ed8] hover:underline transition"
              >
                Mark All As Read
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NotificationToasts ────────────────────────────────────────────────────────

const TOAST_DURATION = 8000;

interface ToastItem extends AppNotification {
  visible: boolean;
}

export function NotificationToasts() {
  const { notifications, markRead } = useNotifications();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const shownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newOnes = notifications.filter((n) => !shownIds.current.has(n.id)).slice(0, 3);
    if (newOnes.length === 0) return;

    newOnes.forEach((n) => shownIds.current.add(n.id));
    setToasts((prev) => [
      ...newOnes.map((n) => ({ ...n, visible: true })),
      ...prev,
    ].slice(0, 3));
  }, [notifications]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
    markRead(id);
  }, [markRead]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto w-[360px] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-4 shadow-2xl transition-all duration-300 ${
            toast.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a454d] text-white font-bold text-xs">
              a
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 line-clamp-1">{toast.title}</p>
              <div
                className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: toast.html_content || toast.message }}
              />
              <div className="flex items-center gap-2 mt-2">
                {toast.order_id && (
                  <Link
                    href={`/orders/${toast.order_id}`}
                    onClick={() => dismiss(toast.id)}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    View Order →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
