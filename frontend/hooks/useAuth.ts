/**
 * useAuth.ts — Custom hook for auth state management.
 * Uses localStorage/sessionStorage — no extra library needed.
 * All components use this hook instead of reading storage directly.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authService, LoginPayload } from "@/services/authService";
import type { AuthUser } from "@/types/auth";

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function userFromToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload?.sub || !payload?.role) return null;
    const roleStr = String(payload.role || "").toLowerCase().trim();
    return {
      id: payload.sub,
      email: payload.email || "",
      full_name: payload.name || (roleStr === "super_admin" ? "Super Admin" : "User"),
      role: roleStr,
      is_active: true,
    } as AuthUser;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // On mount: restore user from sessionStorage, or from the auth cookie.
  useEffect(() => {
    const restoreUser = async () => {
      const stored = sessionStorage.getItem("user");
      if (stored) {
        try {
          setUser(JSON.parse(stored));
          return;
        } catch {
          sessionStorage.clear();
        }
      }

      const userCookie = getCookie("user");
      if (userCookie) {
        try {
          const cookieUser = JSON.parse(userCookie);
          sessionStorage.setItem("user", JSON.stringify(cookieUser));
          setUser(cookieUser as AuthUser);
          return;
        } catch {
          document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
      }

      const cookieToken = getCookie("access_token");
      if (cookieToken) {
        sessionStorage.setItem("access_token", cookieToken);
        const tokenUser = userFromToken(cookieToken);
        if (tokenUser) {
          sessionStorage.setItem("user", JSON.stringify(tokenUser));
          setUser(tokenUser);
          return;
        }
        try {
          const currentUser = await authService.getMe();
          sessionStorage.setItem("user", JSON.stringify(currentUser));
          setUser(currentUser as AuthUser);
        } catch {
          sessionStorage.removeItem("access_token");
        }
      }
    };

    restoreUser().finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setIsLoading(true);
      try {
        const res = await authService.login(payload);
        // Store tokens
        // 1. We use a cookie for access_token so the middleware can see it
        document.cookie = `access_token=${res.access_token}; path=/; max-age=86400; SameSite=Lax`;
        
        // 2. We also keep it in sessionStorage for the api.ts interceptor
        sessionStorage.setItem("access_token", res.access_token);
        
        localStorage.setItem("refresh_token", res.refresh_token);
        sessionStorage.setItem("user", JSON.stringify(res.user));
        setUser(res.user as AuthUser);
        router.push("/dashboard");
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      await authService.logout(refreshToken).catch(() => {});
    }
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    sessionStorage.clear();
    localStorage.removeItem("refresh_token");
    setUser(null);
    router.push("/login");
  }, [router]);

  return {
    user,
    isLoading, // Initial check
    isAuthenticated: !!user,
    login,
    logout,
  };
}
