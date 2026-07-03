"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** vertical travel (px) of the slide-up */
  y?: number;
  /** stagger between direct children (s) */
  stagger?: number;
  /** ScrollTrigger start position */
  start?: string;
  /** play once, or replay on re-enter */
  once?: boolean;
}

/**
 * Reveal-on-scroll wrapper. Animates its DIRECT children with a fade + slide-up
 * stagger as the group scrolls into view. Honors prefers-reduced-motion (shows
 * content instantly). The hidden start state is applied with `gsap.set` inside
 * useGSAP's pre-paint layout effect, so there's no FOUC.
 *
 * Deliberately `set` + `to` — NOT `gsap.from`. A from-tween records the
 * element's live inline style as its destination, so when the effect re-runs
 * (StrictMode remount, Fast Refresh) the second capture happens while the
 * first tween's hidden state is still applied and "hidden" gets baked in as
 * the end state — the content then stays invisible forever. Explicit end
 * values make re-runs idempotent.
 */
export function Reveal({
  children,
  className,
  y = 32,
  stagger = 0.12,
  start = "top 85%",
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const targets = ref.current ? Array.from(ref.current.children) : [];
      if (targets.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: "(prefers-reduced-motion: reduce)",
          ok: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          // Under reduced motion, don't animate at all: the content is only
          // hidden behind a ScrollTrigger when motion is allowed, so a
          // mis-measured trigger can't leave it invisible for these users.
          if (ctx.conditions?.reduce) return;
          gsap.set(targets, { y, autoAlpha: 0 });
          gsap.to(targets, {
            y: 0,
            autoAlpha: 1,
            duration: 0.8,
            ease: "power3.out",
            stagger,
            overwrite: "auto",
            scrollTrigger: { trigger: ref.current, start, once },
          });
        },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
