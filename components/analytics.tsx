"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  captureAttribution,
  getAttribution,
  getDeviceClass,
  getSession,
} from "@/lib/attribution";
import { hasOptOutSignal, readDeviceCookie } from "@/lib/device-cookie";
import { readConsent, trackBeacon } from "@/lib/consent";

/**
 * First-party page-view beacon. Renders nothing; fires api.analytics.track on
 * every route change over the Convex client that's already connected. Fire
 * and forget — analytics must never surface an error or block the UI.
 *
 * Every view counts as a view. Only a visitor who accepted the cookie card
 * sends a device id; before a choice the view is "pending" and the card's
 * answer settles it (analytics.recordConsent).
 */
export function Analytics() {
  const convex = useConvex();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    if (typeof navigator !== "undefined" && navigator.webdriver) return;

    captureAttribution();
    const { sessionId, newSession } = getSession();
    const attribution = getAttribution();
    const optout = hasOptOutSignal();
    const consent = readConsent()?.choice ?? "pending";

    trackBeacon(
      convex.mutation(api.analytics.track, {
        sessionId,
        newSession,
        path: pathname,
        // Arrival context only matters once per session.
        referrerDomain: newSession ? attribution.referrerDomain : undefined,
        utmSource: newSession ? attribution.utmSource : undefined,
        device: getDeviceClass(),
        deviceId: !optout && consent === "granted" ? readDeviceCookie() : undefined,
        optout: optout || undefined,
        consent,
      }),
    );
  }, [convex, pathname]);

  return null;
}
