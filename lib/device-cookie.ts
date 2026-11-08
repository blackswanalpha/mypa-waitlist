import type { NextRequest, NextResponse } from "next/server";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";

/**
 * The device cookie: one random id per browser, so the admin can count
 * distinct devices rather than views or sessions. It exists only with the
 * visitor's consent (lib/consent.ts).
 *
 * - Minted only by POST /api/consent when the visitor accepts, with a
 *   Set-Cookie from our own origin (Safari expires cookies written by
 *   `document.cookie` after 7 days) and the consent's lifetime, not renewed.
 * - Readable by script (not HttpOnly) so the page-view beacon can send it.
 *   It holds nothing but a random UUID.
 * - The middleware never mints it. It CLEARS it whenever there is no granted
 *   consent, the browser sends Global Privacy Control or Do Not Track, or the
 *   value is not a v4 UUID. Convex validates the shape again.
 */

export const DEVICE_COOKIE = "mypa_did";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isDeviceId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

/** Global Privacy Control or Do Not Track on a request. */
export function sendsOptOut(headers: Headers): boolean {
  return headers.get("sec-gpc") === "1" || headers.get("dnt") === "1";
}

/** Behind Coolify's proxy the request URL says http; the forwarded header says what the visitor used. */
export function isHttps(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return (forwarded ?? req.nextUrl.protocol.replace(":", "")) === "https";
}

/** True when the request carries a device id it is not allowed to keep. */
export function mustClearDeviceId(req: NextRequest): boolean {
  if (req.method !== "GET" || req.nextUrl.pathname.startsWith("/api")) return false;
  const id = req.cookies.get(DEVICE_COOKIE)?.value;
  if (id === undefined) return false;
  if (sendsOptOut(req.headers) || !isDeviceId(id)) return true;
  return parseConsent(req.cookies.get(CONSENT_COOKIE)?.value)?.choice !== "granted";
}

export function applyDeviceCookie(req: NextRequest, res: NextResponse): NextResponse {
  if (mustClearDeviceId(req)) res.cookies.delete(DEVICE_COOKIE);
  return res;
}

/** Browser side: the device id the server gave this browser, if it kept it. */
export function readDeviceCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)mypa_did=([^;]*)/);
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]).slice(0, 64);
  } catch {
    return match[1].slice(0, 64);
  }
}

/** Browser side: true when the visitor asked not to be tracked. */
export function hasOptOutSignal(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}
