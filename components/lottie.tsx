"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** Subscribe to the OS reduced-motion preference without setState-in-effect. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCE_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false, // server snapshot — assume motion-OK, hydrates to the real value
  );
}

/**
 * dotLottie renders to a <canvas> and pulls a WASM runtime, so it is strictly
 * client-side. Loading it through next/dynamic with `ssr: false` keeps the
 * player (and its WASM) out of the server render and the initial bundle — it's
 * fetched on demand the first time a <Lottie> actually mounts. `ssr: false` is
 * allowed here because this module is itself a client component.
 */
const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact),
  { ssr: false },
);

interface LottieProps {
  /**
   * URL of a `.lottie`/`.json` animation. Accepts an absolute CDN URL
   * (e.g. "https://cdn.example.com/lottie/hero.lottie") or a local /public path.
   * When empty/undefined the component renders nothing — so unset sources are
   * a no-op rather than a broken request.
   */
  src?: string;
  /** Sizing/positioning classes for the wrapper (give it a height or aspect). */
  className?: string;
  /** Loop the animation. Forced off under reduced-motion. */
  loop?: boolean;
  /** Playback speed. */
  speed?: number;
  /** Only mount/play once scrolled near the viewport. Default true. */
  lazy?: boolean;
  /**
   * Accessible label. When provided the wrapper is exposed as role="img";
   * otherwise the animation is treated as decorative (aria-hidden).
   */
  ariaLabel?: string;
}

/**
 * Reusable Lottie player. Mirrors the house motion conventions (see `lib/gsap.ts`
 * and `reveal.tsx`):
 *  - viewport-gated via IntersectionObserver so the page can host several
 *    animations without all of them rendering/painting at once;
 *  - reduced-motion aware — when the user prefers reduced motion the animation
 *    is not autoplayed/looped, so dotLottie holds on its first frame (a static
 *    poster) instead of moving.
 */
export function Lottie({
  src,
  className,
  loop = true,
  speed = 1,
  lazy = true,
  ariaLabel,
}: LottieProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!lazy);
  const reduce = usePrefersReducedMotion();

  // Mount the player only when it scrolls near view.
  useEffect(() => {
    if (!lazy || inView || !src) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, inView, src]);

  // No source wired yet (e.g. CDN URL not set) → render nothing.
  if (!src) return null;

  return (
    <div
      ref={ref}
      className={cn("pointer-events-none select-none", className)}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {inView && (
        <DotLottieReact
          src={src}
          loop={loop && !reduce}
          autoplay={!reduce}
          speed={speed}
          className="h-full w-full"
        />
      )}
    </div>
  );
}
