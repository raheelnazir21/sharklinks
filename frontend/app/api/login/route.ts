import { NextResponse } from "next/server";

const API_BASE = process.env.SERVER_API_URL || "http://127.0.0.1:8015/api/v1";

function redirectTo(request: Request, pathname: string) {
  const host = request.headers.get("host") || "127.0.0.1:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  return NextResponse.redirect(`${proto}://${host}${pathname}`, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return redirectTo(request, "/login");
  }

  const apiResponse = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!apiResponse.ok) {
    return redirectTo(request, "/login");
  }

  const body = await apiResponse.json();
  const tokens = body?.data;

  if (!tokens?.access_token) {
    return redirectTo(request, "/login");
  }

  const response = redirectTo(request, "/dashboard");
  response.cookies.set("access_token", tokens.access_token, {
    path: "/",
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
  });

  if (tokens.user) {
    response.cookies.set("user", encodeURIComponent(JSON.stringify(tokens.user)), {
      path: "/",
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
    });
  }

  if (tokens.refresh_token) {
    response.cookies.set("refresh_token", tokens.refresh_token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    });
  }

  return response;
}
