"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import { cn } from "@/lib/utils";

/** What the bot is doing. Everything but idle is a Glance state. */
export type BotMood = "idle" | "listen" | "think" | "done" | "unsure" | "failed";

type Segment = { start: number; frames: number; loop: boolean };

// Motion Studio's rules for Glance: only the working states loop; every other
// state plays once and holds.
const LOOPS = new Set(["listen", "think"]);

/** Exponential smoothing time constant for the pointer lean, in ms. */
const LEAN_TAU = 160;

/**
 * Glance, the bot from Motion Studio (motionstudio/bot, concept O1), merged
 * into one Lottie by scripts/build-bot.mjs. It arrives once, then follows the
 * form: it listens while you type, thinks while the request is in flight and
 * smiles when you are on the list.
 *
 * Around the character, three layers of motion that never fight each other:
 * a slow float and breath on the compositor, a lean toward the pointer that
 * eases without overshoot, and state marks — contour rings while listening,
 * an orbiting mark while thinking, one sage ring when done. Loops change state
 * only at a loop boundary, so the face never jumps mid-gesture. Reduced motion
 * holds Motion Studio's declared frame for each state and drops the rest.
 */
export function GlanceBot({ mood, className }: { mood: BotMood; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const lean = useRef<HTMLDivElement>(null);
  const anim = useRef<AnimationItem | null>(null);
  const segments = useRef<Record<string, Segment>>({});
  const playing = useRef<string | null>(null);
  const pending = useRef<BotMood | null>(null);
  const reduced = useRef(false);
  const [ready, setReady] = useState(false);
  const [doneBeat, setDoneBeat] = useState(0);

  // Load the player and the merged file once, then play the entrance.
  useEffect(() => {
    let cancelled = false;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      const [{ default: lottie }, data] = await Promise.all([
        import("lottie-web/build/player/lottie_light"),
        fetch("/bot/glance.json").then((r) => r.json()),
      ]);
      if (cancelled || !host.current) return;

      for (const m of data.markers as { tm: number; cm: string; dr: number }[]) {
        segments.current[m.cm] = { start: m.tm, frames: m.dr, loop: LOOPS.has(m.cm) };
      }
      const a = lottie.loadAnimation({
        container: host.current,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: data,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      a.addEventListener("loopComplete", () => {
        const next = pending.current;
        if (next === null) return;
        pending.current = null;
        apply(next);
      });
      anim.current = a;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      anim.current?.destroy();
      anim.current = null;
    };
    // apply only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Play a state now: a once state holds its last frame, a loop repeats. */
  function play(state: string) {
    const a = anim.current;
    const seg = segments.current[state];
    if (!a || !seg) return;
    playing.current = state;
    const end = seg.start + seg.frames;
    if (reduced.current) {
      // Motion Studio's hold frame: the last frame of a once, the middle of a loop.
      a.goToAndStop(seg.loop ? seg.start + Math.floor(seg.frames / 2) : end - 1, true);
      return;
    }
    a.loop = seg.loop;
    a.playSegments([seg.start, end], true);
  }

  function apply(next: BotMood) {
    if (next === "idle") {
      // Idle is the entrance's resting face. Never replay the entrance.
      const arrive = segments.current.arrive;
      if (playing.current === "arrive" || !arrive || !anim.current) return;
      playing.current = "idle";
      anim.current.loop = false;
      anim.current.goToAndStop(arrive.start + arrive.frames - 1, true);
      return;
    }
    if (next === "done") setDoneBeat((n) => n + 1);
    play(next);
  }

  // First paint: the entrance. Afterwards, follow the form.
  useEffect(() => {
    if (!ready) return;
    if (playing.current === null) {
      play("arrive");
      if (mood === "idle") return;
    }
    const current = playing.current;
    if (current === mood) return;
    // A loop finishes its gesture first; anything else cuts straight in.
    if (current && LOOPS.has(current) && !reduced.current) {
      pending.current = mood;
    } else {
      pending.current = null;
      apply(mood);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, ready]);

  // Lean toward a fine pointer. Eased per frame, stops when settled.
  useEffect(() => {
    const el = lean.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const target = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let raf = 0;
    let last = 0;

    const step = (now: number) => {
      const dt = last ? Math.min(now - last, 64) : 16;
      last = now;
      const k = 1 - Math.exp(-dt / LEAN_TAU);
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      el.style.transform = `translate3d(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px, 0) rotate(${(pos.x * 0.9).toFixed(2)}deg)`;
      if (Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.02) {
        raf = requestAnimationFrame(step);
      } else {
        raf = 0;
        last = 0;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      // Soft saturation: far away still leans, never more than a few pixels.
      target.x = 7 * Math.tanh(dx / 420);
      target.y = 5 * Math.tanh(dy / 420);
      if (!raf) raf = requestAnimationFrame(step);
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      if (!raf) raf = requestAnimationFrame(step);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      aria-hidden
      data-mood={mood}
      className={cn("pointer-events-none relative grid h-40 w-44 place-items-center", className)}
    >
      {/* Listening: contour rings in the head's own squircle, rising outward. */}
      <div
        className={cn(
          "absolute inset-0 grid place-items-center transition-opacity duration-500 ease-out motion-reduce:hidden",
          mood === "listen" ? "opacity-100" : "opacity-0",
        )}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bot-contour absolute h-[5.5rem] w-[5.5rem] rounded-[36%] border border-slate-300"
            style={{
              animationDelay: `${i * 0.8}s`,
              animationPlayState: mood === "listen" ? "running" : "paused",
            }}
          />
        ))}
      </div>

      {/* Thinking: one ink mark orbiting on a hairline. Ink only — sage is earned. */}
      <div
        className={cn(
          "absolute h-[9.25rem] w-[9.25rem] rounded-full border border-dashed border-slate-200 transition-[opacity,transform] duration-500 ease-out motion-reduce:hidden",
          mood === "think" ? "scale-100 opacity-100" : "scale-90 opacity-0",
        )}
      >
        <span
          className="bot-orbit absolute inset-0"
          style={{ animationPlayState: mood === "think" ? "running" : "paused" }}
        >
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500" />
        </span>
      </div>

      {/* Done: a single sage ring, once. */}
      {doneBeat > 0 && (
        <span
          key={doneBeat}
          className="bot-done absolute h-[5.5rem] w-[5.5rem] rounded-[36%] border-[1.5px] border-[#22c55e] motion-reduce:hidden"
        />
      )}

      <div ref={lean} className="will-change-transform">
        <div className="bot-float motion-reduce:animate-none">
          <div ref={host} className="bot-breathe h-32 w-32 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
