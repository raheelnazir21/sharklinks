/**
 * middleware.ts — Next.js edge middleware for route protection.
 * Runs BEFORE every page renders. Redirects unauthenticated users to /login.
 * This file must be at the ROOT of the frontend directory (next to package.json).
 */
import { NextRequest, NextResponse } from "next/server";

// Pages that do NOT require login
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for access token in request (set as cookie by login page)
  const token = request.cookies.get("access_token")?.value;

  if (!token) {
    // No token → redirect to login, preserving the intended URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except static files and API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
