import type { NextRequest, NextResponse } from "next/server";

/**
 * The device cookie: one random id per browser, so the admin can count
 * distinct devices rather than views or sessions.
 *
 * - Minted and renewed by the SERVER (middleware) on page loads only. Safari
 *   expires cookies written by `document.cookie` after 7 days; a Set-Cookie
 *   from our own origin keeps its full lifetime, so an iPhone is not counted
 *   as a new device every week.
 * - Rolling: every page load re-sends it with a fresh Max-Age of 400 days,
 *   the most Chrome accepts.
 * - Readable by script (not HttpOnly) so the page-view beacon can send it.
 *   It holds nothing but a random UUID.
 * - Never set for bots and link-preview fetchers, prefetches, /admin or /api,
 *   and never set (and cleared if present) when the browser sends an opt-out
 *   signal: Global Privacy Control or Do Not Track.
 * - Anything that is not a v4 UUID is replaced, so a corrupted or hand-edited
 *   value cannot reach the counts. Convex validates the same shape again.
 */

export const DEVICE_COOKIE = "mypa_did";

/** Chrome clamps cookie lifetime to 400 days; asking for more gains nothing. */
export const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isDeviceId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

/**
 * Crawlers, link unfurlers (a link shared on WhatsApp or Slack is fetched by
 * the app, not a person), uptime monitors, HTTP libraries and automation.
 * Named by their fetcher, not their app: a person in Pinterest's or
 * Telegram's in-app browser is a person. "Cubot" is a phone brand.
 */
const BOT_UA =
  /(?<!cu)bot\b|(?<!cu)bot\/|crawl|spider|slurp|archiver|facebookexternalhit|facebookcatalog|whatsapp\/|telegrambot|slackbot|slack-imgproxy|discordbot|embedly|vkshare|quora link preview|pinterestbot|skypeuripreview|bitlybot|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|statuscake|curl\/|wget|httpie|python-requests|python-urllib|aiohttp|go-http-client|java\/|okhttp|axios|node-fetch|undici|postman|insomnia|scrapy|phantomjs|playwright|puppeteer|selenium/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

export type CookieAction =
  | { kind: "skip" }
  | { kind: "clear" }
  | { kind: "set"; id: string; fresh: boolean };

/** What the middleware should do with the device cookie for this request. */
export function deviceCookieAction(req: NextRequest): CookieAction {
  const skip = { kind: "skip" } as const;
  if (req.method !== "GET") return skip;

  const path = req.nextUrl.pathname;
  if (path.startsWith("/admin") || path.startsWith("/api")) return skip;

  const h = req.headers;
  // Top-level page loads only. Client-side RSC fetches arrive as
  // Sec-Fetch-Dest "empty" (Next strips their RSC headers before middleware).
  const dest = h.get("sec-fetch-dest");
  if (dest ? dest !== "document" : !(h.get("accept") ?? "").includes("text/html")) return skip;
  if (/prefetch|prerender/i.test(`${h.get("sec-purpose") ?? ""} ${h.get("purpose") ?? ""}`)) return skip;

  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  if (h.get("sec-gpc") === "1" || h.get("dnt") === "1") {
    return existing === undefined ? skip : { kind: "clear" };
  }
  if (isBot(h.get("user-agent"))) return skip;

  if (isDeviceId(existing)) return { kind: "set", id: existing, fresh: false };
  return { kind: "set", id: crypto.randomUUID(), fresh: true };
}

/** Behind Coolify's proxy the request URL says http; the forwarded header says what the visitor used. */
function isHttps(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return (forwarded ?? req.nextUrl.protocol.replace(":", "")) === "https";
}

export function applyDeviceCookie(req: NextRequest, res: NextResponse): NextResponse {
  const action = deviceCookieAction(req);
  if (action.kind === "clear") {
    res.cookies.delete(DEVICE_COOKIE);
  } else if (action.kind === "set") {
    res.cookies.set(DEVICE_COOKIE, action.id, {
      maxAge: DEVICE_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: isHttps(req),
      httpOnly: false,
    });
  }
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
