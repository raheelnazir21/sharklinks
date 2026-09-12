"use client";

/**
 * useNotifications.ts
 * React hook — polls unread count every 60 seconds.
 * Exposes notifications list, unread count, mark-read functions, and sound toggle.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "stage_overdue" | "ex_factory_approaching" | "ex_factory_passed" | "stage_completed" | "qc_alert" | string;
  order_id: string | null;
  stage_id: string | null;
  is_read: boolean;
  created_at: string;
}

const POLL_INTERVAL = 60_000; // 60 seconds
const SOUND_KEY = "cc_notif_sound_enabled";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef<number>(0);

  // Sync sound preference from localStorage after client hydration
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(SOUND_KEY);
      if (stored !== null) {
        setSoundEnabled(stored === "true");
      }
    } catch {}
  }, []);

  // Pre-load audio
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/sounds/notify.wav");
      audioRef.current.volume = 0.6;
    }
  }, []);

  const playSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {}); // Ignore autoplay policy errors
    }
  }, [soundEnabled]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [notifRes, countRes] = await Promise.all([
        api.get("/notifications/", { params: { include_read: false, limit: 50 } }),
        api.get("/notifications/unread-count"),
      ]);
      const newNotifs: AppNotification[] = notifRes.data.data || [];
      const newCount: number = countRes.data.data?.count || 0;

      setNotifications(newNotifs);

      // Play sound only if count increased since last poll
      if (newCount > prevCountRef.current && prevCountRef.current !== 0) {
        playSound();
      }
      prevCountRef.current = newCount;
      setUnreadCount(newCount);
    } catch {
      // Silently ignore — user may not be logged in
    }
  }, [user, playSound]);

  // Initial fetch + poll
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.post(`/notifications/mark-read/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
      prevCountRef.current = Math.max(0, prevCountRef.current - 1);
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications([]);
      setUnreadCount(0);
      prevCountRef.current = 0;
    } catch {}
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  return {
    notifications,
    unreadCount,
    soundEnabled,
    isMounted,
    markRead,
    markAllRead,
    toggleSound,
    refetch: fetchNotifications,
  };
}
