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
 * content instantly). `gsap.from` sets the hidden start state inside useGSAP's
 * pre-paint layout effect, so there's no FOUC; useGSAP auto-reverts on unmount.
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
          // Under reduced motion, don't animate at all: a from-tween (even a
          // near-instant one) starts the content hidden behind a ScrollTrigger,
          // so a mis-measured trigger could leave it invisible forever.
          if (ctx.conditions?.reduce) return;
          gsap.from(targets, {
            y,
            autoAlpha: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger,
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
