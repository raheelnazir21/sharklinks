/**
 * app/page.tsx — Root page redirect.
 * When a user visits "/", redirect them to the dashboard.
 * The middleware will then redirect to /login if not authenticated.
 */
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
