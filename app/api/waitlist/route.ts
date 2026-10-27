import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";

/**
 * Tester-list signup. The row is written to this site's Convex `testers`
 * table, which the admin Testers tab reads and approves from. The signup is
 * then forwarded, best effort, to the product backend
 * (POST {BACKEND_URL}/api/v1/waitlist-sync/users with the X-Service-Key shared
 * secret) so it also exists there as a users row with status "waitlist". A
 * backend failure is logged and never costs the visitor their spot.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_ATTRIBUTION = 200;
const MAX_NAME = 100;
const MAX_PHONE = 32;
const DEVICES = ["samsung", "android", "iphone"] as const;
type Device = (typeof DEVICES)[number];

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
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  email?: unknown;
  device?: unknown;
  agreed?: unknown;
  source?: unknown;
  website?: unknown;
} & Partial<Record<(typeof ATTRIBUTION_KEYS)[number], unknown>>;

const capped = (s: unknown) =>
  typeof s === "string" ? s.trim().slice(0, MAX_ATTRIBUTION) || undefined : undefined;

const fail = (status: number, error: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

const STATUS_FOR: Record<string, number> = { invalid: 400, closed: 409, busy: 429 };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return fail(400, "Something went wrong. Please try again.");

  // Honeypot: hidden in the form, so a non-empty value means a bot filled it.
  // Report success without writing anything.
  if (body.website) return NextResponse.json({ duplicate: false, position: 0, slots: 0 });

  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const phone = text(body.phone);
  if (!firstName || firstName.length > MAX_NAME) return fail(400, "Add your first name.");
  if (!lastName || lastName.length > MAX_NAME) return fail(400, "Add your last name.");
  if (phone.length > MAX_PHONE) return fail(400, "That phone number doesn't look right.");
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return fail(400, "Please enter a valid email address.");
  }
  if (!DEVICES.includes(body.device as Device)) {
    return fail(400, "Pick your phone so we send the right install steps.");
  }
  if (body.agreed !== true) return fail(400, "Tick the box so we can email your invite.");

  const convexUrl = process.env.CONVEX_SERVER_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("waitlist: no Convex URL configured");
    return fail(503, "We couldn't save your spot right now. Please try again.");
  }

  const attribution: Record<string, string> = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = capped(body[k]);
    if (v) attribution[k] = v;
  }

  let result: { duplicate: boolean; position: number; slots: number; status: string } | undefined;
  const client = new ConvexHttpClient(convexUrl);
  const args = {
    firstName,
    lastName,
    phone: phone || undefined,
    email,
    device: body.device as Device,
    agreed: true,
    source: capped(body.source) ?? "landing",
    utmSource: attribution.utmSource,
    referrerDomain: attribution.referrerDomain,
    landingPath: attribution.landingPath,
  };
  // One retry on a network failure. If the first attempt did commit, the
  // retry finds the row and comes back as a duplicate, which is still a save.
  for (let attempt = 1; !result; attempt++) {
    try {
      result = await client.mutation(api.testers.apply, args);
    } catch (e) {
      if (e instanceof ConvexError) {
        const data = e.data as { code?: string; message?: string };
        return fail(STATUS_FOR[data.code ?? ""] ?? 400, data.message ?? "Please try again.", {
          code: data.code,
        });
      }
      console.error(`waitlist: Convex apply failed (attempt ${attempt})`, e);
      if (attempt >= 2) return fail(503, "We couldn't save your spot right now. Please try again.");
    }
  }

  if (!result.duplicate) await forwardToBackend(req, email, body, attribution);
  return NextResponse.json(result);
}

/** Mirror the signup into the product backend. Logged on failure, never thrown. */
async function forwardToBackend(
  req: Request,
  email: string,
  body: Body,
  attribution: Record<string, string>,
) {
  const backendUrl = process.env.BACKEND_URL;
  const serviceKey = process.env.BACKEND_SERVICE_KEY;
  if (!backendUrl || !serviceKey) return;

  // The backend rate-limits by the first X-Forwarded-For entry. Without the
  // visitor's address every signup would share this server's one bucket.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Service-Key": serviceKey,
  };
  const visitor =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip");
  if (visitor) headers["X-Forwarded-For"] = visitor;

  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/waitlist-sync/users`, {
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
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("waitlist: backend returned", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("waitlist: backend unreachable", e);
  }
}
