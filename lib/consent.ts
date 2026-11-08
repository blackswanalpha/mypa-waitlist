/**
 * Cookie consent: the visitor's choice about the device cookie.
 *
 * - `mypa_consent` holds "v<version>.<granted|denied>.<unix seconds>". It is
 *   set only by POST /api/consent, lasts CONSENT_MAX_AGE and is not renewed,
 *   so the question comes back once it expires. A value from another version
 *   counts as no choice, which re-asks everyone when the wording changes.
 * - `mypa_did` (lib/device-cookie.ts) is minted only by that same request on
 *   Accept, with the same lifetime, so it can never outlive the consent.
 * - Without a granted consent the middleware clears any device id it sees,
 *   and Convex drops an id sent without one.
 *
 * Edge-safe: imported by the middleware, the route and the browser.
 */

export const CONSENT_COOKIE = "mypa_consent";
export const CONSENT_VERSION = 1;

/** 180 days: long enough not to nag, short enough that consent is re-asked. */
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60;

export type Choice = "granted" | "denied";
export type Consent = { choice: Choice; at: number };

export function isChoice(value: unknown): value is Choice {
  return value === "granted" || value === "denied";
}

export function consentValue(choice: Choice, atMs: number): string {
  return `v${CONSENT_VERSION}.${choice}.${Math.floor(atMs / 1000)}`;
}

/** The choice a cookie value records, or null for none, a stale version or junk. */
export function parseConsent(value: string | undefined | null): Consent | null {
  if (!value) return null;
  const match = /^v(\d+)\.(granted|denied)\.(\d{1,12})$/.exec(value);
  if (!match || Number(match[1]) !== CONSENT_VERSION) return null;
  return { choice: match[2] as Choice, at: Number(match[3]) * 1000 };
}

/** Browser side: the choice stored in this browser. */
export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)mypa_consent=([^;]*)/);
  return parseConsent(match?.[1]);
}

/**
 * The page-view beacon registers its request here so a choice made in the
 * first second waits for it: the view it upgrades must exist first.
 */
let beacon: Promise<unknown> = Promise.resolve();

export function trackBeacon(p: Promise<unknown>): void {
  beacon = p.catch(() => {});
}

export function beaconSettled(timeoutMs = 2500): Promise<unknown> {
  return Promise.race([beacon, new Promise((r) => setTimeout(r, timeoutMs))]);
}
