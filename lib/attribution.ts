/**
 * First-party, cookie-free attribution capture.
 *
 * - First-touch acquisition data (UTM params, click ids, referrer domain,
 *   landing path) is stored once in localStorage with a 30-day TTL — later
 *   visits don't overwrite it, so a signup is credited to the campaign that
 *   first brought the visitor in.
 * - The `?ref=` referral code is the exception: last touch wins, so the most
 *   recent share link gets the credit.
 * - The analytics session id lives in sessionStorage (per-tab, gone on
 *   close). No cookies, no IP, no full user-agent ever leaves the browser.
 */

const ATTRIBUTION_KEY = "mypa.attribution.v1";
const SESSION_KEY = "mypa.sessionId.v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  referrerDomain?: string;
  landingPath?: string;
  referredBy?: string;
};

type Stored = Attribution & { ts: number };

const cap = (s: string | null | undefined) =>
  s ? s.trim().slice(0, 200) || undefined : undefined;

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed.ts || Date.now() - parsed.ts > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Domain of the external referrer, or undefined for same-site/direct. */
function externalReferrerDomain(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const ref = new URL(document.referrer);
    if (ref.hostname === window.location.hostname) return undefined;
    return ref.hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Idempotent — call on every page load. Writes the first-touch record if none
 * exists (or it expired) and always lets a fresh `?ref=` code win.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const existing = readStored();
    const ref = cap(params.get("ref"))?.toLowerCase();

    if (existing) {
      if (ref && ref !== existing.referredBy) {
        window.localStorage.setItem(
          ATTRIBUTION_KEY,
          JSON.stringify({ ...existing, referredBy: ref }),
        );
      }
      return;
    }

    const record: Stored = {
      ts: Date.now(),
      utmSource: cap(params.get("utm_source")),
      utmMedium: cap(params.get("utm_medium")),
      utmCampaign: cap(params.get("utm_campaign")),
      utmTerm: cap(params.get("utm_term")),
      utmContent: cap(params.get("utm_content")),
      gclid: cap(params.get("gclid")),
      fbclid: cap(params.get("fbclid")),
      referrerDomain: externalReferrerDomain(),
      landingPath: window.location.pathname,
      referredBy: ref,
    };
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable (private mode caps, etc.) — attribution is best-effort.
  }
}

/** The stored attribution record, without the internal timestamp. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const stored = readStored();
  if (!stored) return {};
  const { ts, ...attribution } = stored;
  void ts;
  return attribution;
}

/**
 * Per-tab analytics session. `newSession` is true only on the call that
 * minted the id (the first pageview of the tab).
 */
export function getSession(): { sessionId: string; newSession: boolean } {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return { sessionId: existing, newSession: false };
    const sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, sessionId);
    return { sessionId, newSession: true };
  } catch {
    // Storage unavailable — still return an id so the beacon works; every
    // view counts as a new session, which slightly overcounts. Best-effort.
    return { sessionId: crypto.randomUUID(), newSession: true };
  }
}

/** Coarse device class — the only client-environment signal we collect. */
export function getDeviceClass(): "mobile" | "tablet" | "desktop" {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}
