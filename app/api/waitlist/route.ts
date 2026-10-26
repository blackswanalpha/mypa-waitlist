import { NextResponse } from "next/server";

/**
 * Waitlist signup, forwarded server-side to the product backend:
 * POST {BACKEND_URL}/api/v1/waitlist-sync/users with the X-Service-Key shared
 * secret (BACKEND_SERVICE_KEY must equal the backend's CONVEX_SERVICE_KEY).
 * The backend stores the signup as a `users` row with status "waitlist". The
 * key never reaches the browser, so the backend route stays off the public
 * allowlist and needs no CORS entry for this site.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_ATTRIBUTION = 200;

const ATTRIBUTION_KEYS = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "gclid",
  "fbclid",
  "referrerDomain",
  "landingPath",
] as const;

type Body = {
  email?: unknown;
  agreed?: unknown;
  source?: unknown;
  website?: unknown;
} & Partial<Record<(typeof ATTRIBUTION_KEYS)[number], unknown>>;

const capped = (s: unknown) =>
  typeof s === "string" ? s.trim().slice(0, MAX_ATTRIBUTION) || undefined : undefined;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return fail(400, "Something went wrong. Please try again.");

  // Honeypot: hidden in the form, so a non-empty value means a bot filled it.
  // Report success without writing anything.
  if (body.website) return NextResponse.json({ duplicate: false });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return fail(400, "Please enter a valid email address.");
  }
  if (body.agreed !== true) return fail(400, "Please agree to receive launch updates.");

  const backendUrl = process.env.BACKEND_URL;
  const serviceKey = process.env.BACKEND_SERVICE_KEY;
  if (!backendUrl || !serviceKey) {
    console.error("waitlist: BACKEND_URL or BACKEND_SERVICE_KEY is not set");
    return fail(503, "We couldn't save your spot right now. Please try again.");
  }

  const attribution: Record<string, string> = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = capped(body[k]);
    if (v) attribution[k] = v;
  }

  // The backend rate-limits by the first X-Forwarded-For entry. Without the
  // visitor's address every signup would share this server's one bucket.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Service-Key": serviceKey,
  };
  const visitor =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip");
  if (visitor) headers["X-Forwarded-For"] = visitor;

  let res: Response;
  try {
    res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/waitlist-sync/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        entries: [
          {
            email,
            source: capped(body.source) ?? "landing",
            attribution: Object.keys(attribution).length ? attribution : undefined,
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (e) {
    console.error("waitlist: backend unreachable", e);
    return fail(503, "We couldn't save your spot right now. Please try again.");
  }

  if (!res.ok) {
    console.error("waitlist: backend returned", res.status, await res.text().catch(() => ""));
    return fail(502, "We couldn't save your spot right now. Please try again.");
  }

  const result = (await res.json()) as { added: number; skipped_existing: number; invalid: string[] };
  if (result.invalid.length) return fail(400, "Please enter a valid email address.");
  return NextResponse.json({ duplicate: result.added === 0 });
}
