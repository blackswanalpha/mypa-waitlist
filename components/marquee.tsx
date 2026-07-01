"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const CHIPS = [
  "Voice-first",
  "Hey MyPA",
  "Calendar",
  "Email",
  "Reminders",
  "Private journal",
  "Messaging",
  "Daily brief",
  "Tasks",
  "Hands-free",
];

export function Marquee() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const track = root.current?.querySelector<HTMLElement>(".marquee-track");
      if (!track) return;
      const mm = gsap.matchMedia();
      // Only loop when motion is allowed; reduced-motion shows a static strip.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(track, {
          xPercent: -50,
          ease: "none",
          duration: 26,
          repeat: -1,
        });
      });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="relative overflow-hidden border-y border-border/50 bg-card/30 py-4"
    >
      {/* Duplicated set so the -50% loop is seamless. */}
      <div className="marquee-track flex w-max gap-3 pl-3">
        {[...CHIPS, ...CHIPS].map((chip, i) => (
          <span
            key={i}
            className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-fern/70" />
            {chip}
          </span>
        ))}
      </div>

      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
