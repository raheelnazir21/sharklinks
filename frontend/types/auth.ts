/**
 * types/auth.ts — Shared TypeScript types for auth.
 * Import these anywhere instead of redefining the same shape.
 */

export type UserRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "qc_officer"
  | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
