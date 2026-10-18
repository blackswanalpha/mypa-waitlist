"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SLIDES } from "@/lib/carousel";
import { cn } from "@/lib/utils";

const DWELL_MS = 6500;
const TURN_MS = 1100;
/** In-out for the wipe so it starts and lands softly, like a page turned by hand. */
const TURN_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const SETTLE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Four illustrations of a day with MyPA. The incoming slide is uncovered over
 * the outgoing one along a hairline edge while the drawing settles into place,
 * so a turn reads as a sketchbook page rather than a slider.
 *
 * The progress line is the timer: autoplay advances when it fills and pauses
 * with it — on hover, keyboard focus, a press, a hidden tab or when the
 * carousel is off screen. Reduced motion turns autoplay off and swaps slides
 * with a short fade. Images mount as they are reached (plus the next one), so
 * the first load fetches two.
 */
export function DayCarousel() {
  const count = SLIDES.length;
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [turn, setTurn] = useState(0);
  const [mounted, setMounted] = useState(() => new Set([0, 1 % count]));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [userDriven, setUserDriven] = useState(false);
  const root = useRef<HTMLElement>(null);
  const swipeX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);

    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);

    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    if (root.current) io.observe(root.current);

    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
  }, []);

  const go = (next: number, by: "user" | "auto" = "user") => {
    const n = (next + count) % count;
    if (n === active) return;
    // Direction of travel; a wrap from last to first still moves forward.
    const forward = (n - active + count) % count <= count / 2;
    setDir(forward ? 1 : -1);
    setPrev(active);
    setActive(n);
    setTurn((t) => t + 1);
    setMounted((m) => new Set(m).add(n).add((n + 1) % count));
    if (by === "user") setUserDriven(true);
  };

  const paused = hovered || focused || pressed || tabHidden || !visible;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(active + 1);
    else if (e.key === "ArrowLeft") go(active - 1);
    else return;
    e.preventDefault();
  };

  const slide = SLIDES[active];

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label="A day with MyPA"
      className="mx-auto w-full max-w-5xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => e.target.matches(":focus-visible") && setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocused(false)}
      onKeyDown={onKey}
    >
      <div
        className="relative aspect-[16/9] w-full touch-pan-y select-none overflow-hidden"
        onPointerDown={(e) => {
          swipeX.current = e.clientX;
          setPressed(true);
        }}
        onPointerUp={(e) => {
          setPressed(false);
          if (swipeX.current === null) return;
          const dx = e.clientX - swipeX.current;
          swipeX.current = null;
          if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => {
          swipeX.current = null;
          setPressed(false);
        }}
      >
        {SLIDES.map((s, i) => {
          if (!mounted.has(i)) return null;
          const on = i === active;
          const under = i === prev;
          return (
            <div
              key={s.src}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!on}
              className="absolute inset-0 bg-background"
              style={{
                zIndex: on ? 2 : under ? 1 : 0,
                opacity: on || under ? 1 : 0,
                ...(on && prev !== null
                  ? reduced
                    ? { animation: "rise-fade 240ms ease-out both" }
                    : { animation: `${dir > 0 ? "slide-reveal" : "slide-reveal-back"} ${TURN_MS}ms ${TURN_EASE} both` }
                  : null),
              }}
              onAnimationEnd={(e) => {
                if (on && e.target === e.currentTarget) setPrev(null);
              }}
            >
              <div
                className="absolute inset-0"
                style={
                  // Keyed to the turn, not to prev: the settle outlasts the wipe.
                  on && turn > 0 && !reduced
                    ? { animation: `${dir > 0 ? "slide-settle" : "slide-settle-back"} ${TURN_MS + 500}ms ${SETTLE_EASE} both` }
                    : undefined
                }
              >
                <Image
                  src={s.src}
                  alt={s.alt}
                  fill
                  sizes="(min-width: 1056px) 1024px, calc(100vw - 32px)"
                  className="object-contain"
                  draggable={false}
                />
              </div>
            </div>
          );
        })}

        {/* The page edge: a hairline that rides the wipe. */}
        {prev !== null && !reduced && (
          <span
            key={`${active}-${dir}`}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[3]"
            style={{ animation: `${dir > 0 ? "edge-forward" : "edge-back"} ${TURN_MS}ms ${TURN_EASE} both` }}
          >
            <span className={cn("absolute inset-y-[6%] w-px bg-slate-300", dir > 0 ? "left-0" : "right-0")} />
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-5 border-t border-border pt-5 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-10">
        <div aria-live={userDriven || reduced ? "polite" : "off"} className="min-h-[7.5rem] sm:min-h-[6rem]">
          <p className="font-mono text-[11px] tabular-nums tracking-[0.08em] text-muted-foreground">
            {pad(active + 1)} <span className="text-slate-300">/</span> {pad(count)}
          </p>
          <h3 key={`t${active}`} className="animate-rise mt-2 text-[17px] font-medium tracking-[-0.015em] text-foreground" style={{ animationDelay: reduced ? "0ms" : "260ms" }}>
            {slide.title}
          </h3>
          <p key={`b${active}`} className="animate-rise mt-1 max-w-md text-[14px] leading-relaxed text-muted-foreground" style={{ animationDelay: reduced ? "0ms" : "360ms" }}>
            {slide.body}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="flex items-center" role="group" aria-label="Choose a slide">
            {SLIDES.map((s, i) => {
              const on = i === active;
              return (
                <button
                  key={s.src}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show slide ${i + 1}: ${s.title}`}
                  aria-current={on ? "true" : undefined}
                  className="group flex h-11 w-11 items-center justify-center"
                >
                  <span className="relative h-[2px] w-7 overflow-hidden rounded-full bg-border transition-colors duration-300 group-hover:bg-slate-300">
                    {on && (
                      <span
                        key={`p${active}`}
                        className="absolute inset-0 origin-left rounded-full bg-foreground"
                        style={
                          reduced
                            ? undefined
                            : {
                                animation: `progress-fill ${DWELL_MS}ms linear both`,
                                animationPlayState: paused ? "paused" : "running",
                              }
                        }
                        onAnimationEnd={() => go(active + 1, "auto")}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="Previous slide"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-[border-color,transform] duration-200 ease-out hover:border-foreground/40 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="Next slide"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-[border-color,transform] duration-200 ease-out hover:border-foreground/40 active:scale-95"
            >
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
