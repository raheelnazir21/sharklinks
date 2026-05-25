/**
 * api.ts — Shared Axios instance for all API calls.
 * - Automatically attaches the access token to every request
 * - Automatically refreshes the access token when it expires (401)
 * - All frontend services import from this single file — no duplication
 */
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Request interceptor: attach access token ──────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("access_token") || getCookie("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token") || getCookie("refresh_token");
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const newToken = data.data.access_token;
        sessionStorage.setItem("access_token", newToken);
        document.cookie = `access_token=${newToken}; path=/; max-age=86400; SameSite=Lax`;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Refresh failed → force logout
        sessionStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
