"use client";

/**
 * useNotifications.ts
 * React hook — polls unread notifications every 45 seconds.
 * Exposes notifications list, unread count, mark-read, mark-all-read, sound toggle,
 * and Zone 1 / Zone 2 CAPA documentation actions.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

export interface AppNotification {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  html_content?: string;
  category?: "zone_1_ex_factory_passed" | "zone_2_stage_delayed" | "order_created" | "class_created" | "general" | string;
  type: "stage_overdue" | "ex_factory_approaching" | "ex_factory_passed" | "stage_completed" | "qc_alert" | "order_created" | "class_created" | string;
  order_id: string | null;
  stage_id: string | null;
  class_id?: string | null;
  extra_data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
  formatted_time?: string;
  formatted_date?: string;
}

const POLL_INTERVAL = 45_000; // 45 seconds
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
        api.get("/notifications", { params: { include_read: false, limit: 60 } }),
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
      // Silently ignore if unauthenticated or network error
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

