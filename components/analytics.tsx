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

/**
 * First-party page-view beacon. Renders nothing; fires api.analytics.track on
 * every route change over the Convex client that's already connected. Fire
 * and forget — analytics must never surface an error or block the UI.
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

    convex
      .mutation(api.analytics.track, {
        sessionId,
        newSession,
        path: pathname,
        // Arrival context only matters once per session.
        referrerDomain: newSession ? attribution.referrerDomain : undefined,
        utmSource: newSession ? attribution.utmSource : undefined,
        device: getDeviceClass(),
      })
      .catch(() => {});
  }, [convex, pathname]);

  return null;
}
