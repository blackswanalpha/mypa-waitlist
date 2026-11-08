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

/**
 * First-party page-view beacon. Renders nothing; fires api.analytics.track on
 * every route change over the Convex client that's already connected. Fire
 * and forget — analytics must never surface an error or block the UI.
 *
 * The device id comes from the cookie the middleware set on this page load.
 * When the browser refused it, no id is sent and the view counts as
 * unidentified; a fresh id per view would count one visitor many times.
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

    convex
      .mutation(api.analytics.track, {
        sessionId,
        newSession,
        path: pathname,
        // Arrival context only matters once per session.
        referrerDomain: newSession ? attribution.referrerDomain : undefined,
        utmSource: newSession ? attribution.utmSource : undefined,
        device: getDeviceClass(),
        deviceId: optout ? undefined : readDeviceCookie(),
        optout: optout || undefined,
      })
      .catch(() => {});
  }, [convex, pathname]);

  return null;
}
