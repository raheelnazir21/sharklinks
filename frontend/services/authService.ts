/**
 * authService.ts — All auth API calls in one place.
 * Components never call axios directly — they use these functions.
 */
import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface ForgotPasswordResponse {
  reset_token: string | null;
  reset_url: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active?: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

export const authService = {
  /** Send email + password, get back tokens + user info */
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const { data } = await api.post("/auth/login", payload);
    return data.data;
  },

  /** Create a new viewer account from the public user panel */
  signup: async (payload: SignupPayload): Promise<AuthUser> => {
    const { data } = await api.post("/auth/signup", payload);
    return data.data;
  },

  /** Request a reset link. Local dev returns the link directly. */
  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const { data } = await api.post("/auth/forgot-password", { email });
    return data.data;
  },

  /** Complete password reset with the token from the reset link */
  resetPassword: async (token: string, password: string): Promise<void> => {
    await api.post("/auth/reset-password", { token, password });
  },

  /** Get a new access token using the stored refresh token */
  refresh: async (refreshToken: string): Promise<string> => {
    const { data } = await api.post("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return data.data.access_token;
  },

  /** Logout and invalidate refresh token on server */
  logout: async (refreshToken: string): Promise<void> => {
    await api.post("/auth/logout", { refresh_token: refreshToken });
  },

  /** Get the currently logged-in user's profile */
  getMe: async (): Promise<AuthUser> => {
    const { data } = await api.get("/auth/me");
    return data.data;
  },
};
