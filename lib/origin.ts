import { headers } from "next/headers";
import { appUrl } from "@/lib/config";

/** The address the app is being opened from, e.g. http://localhost:3000 or the Vercel domain. */
export async function requestOrigin(): Promise<string> {
  if (process.env.APP_URL?.trim()) return appUrl();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return appUrl();
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
