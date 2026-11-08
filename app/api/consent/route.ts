import { NextResponse, type NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, CONSENT_VERSION, consentValue, isChoice, parseConsent } from "@/lib/consent";
import { DEVICE_COOKIE, isDeviceId, isHttps, sendsOptOut } from "@/lib/device-cookie";

/**
 * Records the visitor's cookie choice (components/cookie-card.tsx).
 *
 * Accept sets `mypa_consent` and mints `mypa_did` in this one response, both
 * with the consent's lifetime. Decline sets `mypa_consent` to denied and
 * deletes any device id. Either way the decision is logged in Convex, which
 * also upgrades (or marks declined) the page views this visit made while the
 * card was waiting. Logging is best effort: the cookies are the consent.
 */

const SESSION_RE = /^[0-9a-f-]{8,64}$/i;

export async function POST(req: NextRequest) {
  // Only this site's own card may answer. Another site could otherwise post
  // a hidden form here and accept on the visitor's behalf. Browsers that
  // predate Sec-Fetch-Site send none, and are let through.
  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { choice?: unknown; sessionId?: unknown } | null;
  const choice = body?.choice;
  if (!isChoice(choice)) {
    return NextResponse.json({ error: "Choose accept or decline." }, { status: 400 });
  }
  if (choice === "granted" && sendsOptOut(req.headers)) {
    return NextResponse.json(
      { error: "Your browser asks sites not to track you, so the cookie stays off." },
      { status: 409 },
    );
  }

  const now = Date.now();
  const secure = isHttps(req);
  const options = { maxAge: CONSENT_MAX_AGE, path: "/", sameSite: "lax" as const, secure, httpOnly: false };
  const previousId = req.cookies.get(DEVICE_COOKIE)?.value;
  const hadConsent = parseConsent(req.cookies.get(CONSENT_COOKIE)?.value)?.choice === "granted";

  const res = NextResponse.json({ choice });
  res.cookies.set(CONSENT_COOKIE, consentValue(choice, now), options);

  let deviceId: string | undefined;
  if (choice === "granted") {
    // Re-accepting keeps the device it already counts as.
    deviceId = hadConsent && isDeviceId(previousId) ? previousId : crypto.randomUUID();
    res.cookies.set(DEVICE_COOKIE, deviceId, options);
  } else {
    res.cookies.delete(DEVICE_COOKIE);
    // A withdrawal is logged against the device it withdraws.
    if (isDeviceId(previousId)) deviceId = previousId;
  }

  const sessionId = typeof body?.sessionId === "string" && SESSION_RE.test(body.sessionId) ? body.sessionId : undefined;
  await record(choice, deviceId, sessionId);
  return res;
}

async function record(choice: "granted" | "denied", deviceId: string | undefined, sessionId: string | undefined) {
  const url = process.env.CONVEX_SERVER_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return;
  try {
    await Promise.race([
      new ConvexHttpClient(url).mutation(api.analytics.recordConsent, {
        choice,
        version: CONSENT_VERSION,
        deviceId,
        sessionId,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
  } catch (e) {
    console.error("consent: Convex record failed", e);
  }
}
