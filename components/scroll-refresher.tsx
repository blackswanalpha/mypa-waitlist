"use client";

import { usePathname } from "next/navigation";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";

/**
 * Recomputes ScrollTrigger positions after App Router client navigations, since
 * the new route changes page height and stale trigger offsets would misfire.
 * Rendered once inside the providers tree. Renders nothing.
 */
export function ScrollRefresher() {
  const pathname = usePathname();

  useGSAP(
    () => {
      ScrollTrigger.refresh();
    },
    { dependencies: [pathname] },
  );

  return null;
}
