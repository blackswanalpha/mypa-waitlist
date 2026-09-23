"use client";

import { useRef, useState } from "react";
import { CalendarDays, Inbox, NotebookPen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = { lead: string; text: string; tag?: string; struck?: boolean };
type UseCase = {
  key: string;
  label: string;
  icon: LucideIcon;
  time: string;
  said: string;
  reply: string;
  rows: Row[];
};

const CASES: UseCase[] = [
  {
    key: "plan",
    label: "Plan",
    icon: CalendarDays,
    time: "Tue · 09:12",
    said: "Hey MyPA — move my three o’clock to Thursday and remind me to call Mum at six.",
    reply: "Done. Amara confirmed Thursday at 3:00, and I’ll nudge you at 6:00.",
    rows: [
      { lead: "08:30", text: "Deep work — Q4 plan" },
      { lead: "15:00", text: "Amara · design review", tag: "Moved to Thu", struck: true },
      { lead: "18:00", text: "Call Mum", tag: "Reminder set" },
    ],
  },
  {
    key: "inbox",
    label: "Inbox",
    icon: Inbox,
    time: "Wed · 07:48",
    said: "Anything urgent? Tell Wanjiru that Friday works for the site visit.",
    reply: "Two need you today. Your reply to Wanjiru is drafted — shall I send it?",
    rows: [
      { lead: "Wanjiru", text: "Site visit — which day?", tag: "Drafted" },
      { lead: "Bank", text: "Card statement ready", tag: "Urgent" },
      { lead: "Promos", text: "14 newsletters", tag: "Filed away" },
    ],
  },
  {
    key: "journal",
    label: "Journal",
    icon: NotebookPen,
    time: "Thu · 21:40",
    said: "Journal: shipped the beta today. Tired, but proud of the team.",
    reply: "Saved to your private journal. Want a gentle reminder to rest tomorrow?",
    rows: [
      { lead: "Today", text: "Shipped the beta. Tired, but proud.", tag: "Private" },
      { lead: "Mon", text: "Long run before work — clear head." },
      { lead: "Sun", text: "Dinner with the family, no phones." },
    ],
  },
];

const AUTOPLAY_MS = 7000;

/** Engraved type: a dark cut above, a lit edge below. */
const ENGRAVED = "[text-shadow:0_-1px_0_rgb(0_0_0/0.35),0_1px_0_rgb(255_255_255/0.18)]";

/**
 * The page's one illustration: a small sage device that plays three things
 * MyPA does, one per screen. Auto-advances on a groove timer (paused while
 * hovered or focused, off under reduced motion), and responds to its keys,
 * arrow keys and a swipe on the screen.
 */
export function VoicePanel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const swipeX = useRef<number | null>(null);
  const tabs = useRef<HTMLDivElement>(null);

  const go = (next: number) => setActive((next + CASES.length) % CASES.length);

  // Roving focus: arrow keys select the neighbouring key and move focus to it.
  const onKeys = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (active + step + CASES.length) % CASES.length;
    go(n);
    tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[n]?.focus();
  };

  return (
    <div
      className="animate-rise relative mx-auto w-full max-w-md lg:max-w-none"
      style={{ animationDelay: "200ms" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Keyboard focus pauses (WCAG 2.2.2); a mouse click leaves autoplay alone.
      onFocus={(e) => e.target.matches(":focus-visible") && setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="What MyPA does"
    >
      {/* Device body — matte sage shell with a lit top edge and a cast shadow. */}
      <div className="relative rounded-[2.25rem] bg-[linear-gradient(150deg,oklch(0.56_0.05_148),oklch(0.43_0.045_152)_45%,oklch(0.34_0.04_156))] p-3 shadow-[inset_0_1px_0_oklch(1_0_0/0.3),inset_0_-2px_0_oklch(0_0_0/0.25),inset_1px_0_0_oklch(1_0_0/0.08),0_2px_0_oklch(0.26_0.035_158),0_28px_50px_-18px_oklch(0.15_0.03_160/0.65),0_60px_90px_-50px_oklch(0.15_0.03_160/0.5)] sm:p-4">
        <div aria-hidden className="grain pointer-events-none absolute inset-0 rounded-[2.25rem] opacity-[0.18] mix-blend-overlay" />

        {/* Hardware strip: speaker grille, engraved mark, status LED. */}
        <div className="relative flex items-center justify-between px-3 pb-3 pt-1">
          <span
            aria-hidden
            className="h-3 w-16 rounded-full bg-[radial-gradient(circle,oklch(0.2_0.02_160)_1.1px,transparent_1.4px)] bg-[length:6px_6px] shadow-[inset_0_1px_2px_oklch(0_0_0/0.45),0_1px_0_oklch(1_0_0/0.15)]"
          />
          <span className={cn("font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-[oklch(0.3_0.03_156)]", ENGRAVED)}>
            MyPA
          </span>
          <span className="flex items-center gap-2">
            <span className={cn("font-mono text-[9px] uppercase tracking-[0.2em] text-[oklch(0.3_0.03_156)]", ENGRAVED)}>
              Live
            </span>
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-[oklch(0.86_0.16_140)] shadow-[0_0_6px_oklch(0.86_0.16_140/0.9),inset_0_-1px_1px_oklch(0_0_0/0.3)]"
            />
          </span>
        </div>

        {/* Recessed screen. */}
        <div
          className="relative overflow-hidden rounded-[1.6rem] bg-[oklch(0.18_0.018_160)] shadow-[inset_0_3px_10px_oklch(0_0_0/0.7),inset_0_0_0_1px_oklch(0_0_0/0.55),0_1px_0_oklch(1_0_0/0.22)]"
          onPointerDown={(e) => (swipeX.current = e.clientX)}
          onPointerUp={(e) => {
            if (swipeX.current === null) return;
            const dx = e.clientX - swipeX.current;
            swipeX.current = null;
            if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
          }}
        >
          {/* All slides share one grid cell, so the screen is as tall as the tallest. */}
          <div className="grid touch-pan-y select-none text-[oklch(0.93_0.015_130)]">
            {CASES.map((c, i) => {
              const on = i === active;
              // Circular distance: the next slide waits on the right, the
              // previous on the left, so every move — including the wrap from
              // last to first — slides in the direction of travel.
              const d = (i - active + CASES.length) % CASES.length;
              const offset = d === 0 ? 0 : d <= CASES.length / 2 ? 1 : -1;
              return (
                <div
                  key={c.key}
                  id={`usecase-${c.key}`}
                  role="tabpanel"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${CASES.length}: ${c.label}`}
                  aria-hidden={!on}
                  inert={!on}
                  className="col-start-1 row-start-1 p-6 transition-[opacity,transform,filter] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none sm:p-7"
                  style={{
                    opacity: on ? 1 : 0,
                    transform: on ? "none" : `translateX(${offset * 36}px) scale(0.985)`,
                    filter: on ? "none" : "blur(6px)",
                  }}
                >
                  <Slide c={c} on={on} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Keys in a recessed tray, plus the autoplay groove. */}
        <div className="relative mt-3 rounded-[1.4rem] bg-[oklch(0.36_0.04_155)] p-1.5 shadow-[inset_0_2px_4px_oklch(0_0_0/0.4),0_1px_0_oklch(1_0_0/0.18)]">
          <div ref={tabs} role="tablist" aria-label="Use cases" className="grid grid-cols-3 gap-1.5" onKeyDown={onKeys}>
            {CASES.map((c, i) => {
              const on = i === active;
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`usecase-${c.key}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => go(i)}
                  className={cn(
                    "relative flex h-11 items-center justify-center gap-2 rounded-[1rem] text-xs font-medium transition-[transform,box-shadow,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.86_0.12_140)]",
                    on
                      ? "translate-y-px bg-[oklch(0.44_0.045_152)] text-[oklch(0.95_0.03_135)] shadow-[inset_0_2px_5px_oklch(0_0_0/0.45),inset_0_-1px_0_oklch(1_0_0/0.08)]"
                      : "bg-[linear-gradient(to_bottom,oklch(0.6_0.05_148),oklch(0.49_0.047_151))] text-[oklch(0.24_0.03_156)] shadow-[inset_0_1px_0_oklch(1_0_0/0.35),0_2px_0_oklch(0.28_0.035_157),0_3px_6px_-1px_oklch(0_0_0/0.35)] hover:brightness-105 active:translate-y-[2px] active:shadow-[inset_0_2px_4px_oklch(0_0_0/0.35)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-all duration-300",
                      on
                        ? "bg-[oklch(0.86_0.16_140)] shadow-[0_0_6px_oklch(0.86_0.16_140)]"
                        : "bg-[oklch(0.3_0.03_156)] shadow-[inset_0_1px_1px_oklch(0_0_0/0.4)]",
                    )}
                  />
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                </button>
              );
            })}
          </div>
          <div aria-hidden className="mx-3 mt-2 mb-1 h-[3px] overflow-hidden rounded-full bg-[oklch(0.26_0.03_157)] shadow-[inset_0_1px_1px_oklch(0_0_0/0.5)]">
            <span
              key={active}
              className="animate-groove block h-full w-full origin-left rounded-full bg-[oklch(0.8_0.1_142)] motion-reduce:hidden"
              style={{
                animationDuration: `${AUTOPLAY_MS}ms`,
                animationPlayState: paused ? "paused" : "running",
              }}
              onAnimationEnd={() => go(active + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** One screen. Its lines rise in sequence each time it becomes active. */
function Slide({ c, on }: { c: UseCase; on: boolean }) {
  const step = (n: number) => ({
    opacity: on ? 1 : 0,
    transform: on ? "none" : "translateY(8px)",
    transitionDelay: on ? `${180 + n * 110}ms` : "0ms",
  });
  const line = "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none";

  return (
    <>
      <div className={cn("flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[oklch(0.8_0.05_142/0.75)]", line)} style={step(0)}>
        <span className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.85_0.1_145)] opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[oklch(0.85_0.1_145)]" />
          </span>
          Listening
        </span>
        <span>{c.time}</span>
      </div>

      <p className={cn("mt-6 font-serif text-[clamp(1.4rem,2.3vw,1.8rem)] leading-snug", line)} style={step(1)}>
        &ldquo;{c.said}&rdquo;
      </p>

      <div aria-hidden className={cn("mt-5 flex h-7 items-end gap-[3px]", line)} style={step(2)}>
        {[0.35, 0.6, 0.9, 0.5, 1, 0.7, 0.4, 0.85, 0.55, 0.3, 0.75, 0.5, 0.95, 0.6, 0.35].map((h, i) => (
          <span
            key={i}
            className="animate-voicebar w-[3px] rounded-full bg-[oklch(0.84_0.07_140/0.85)]"
            style={{ height: `${h * 100}%`, animationDelay: `${i * 70}ms` }}
          />
        ))}
      </div>

      <div
        className={cn("mt-6 rounded-2xl bg-[oklch(0.225_0.02_160)] p-4 shadow-[0_1px_0_oklch(1_0_0/0.06)_inset,0_1px_2px_oklch(0_0_0/0.4)]", line)}
        style={step(3)}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[oklch(0.84_0.07_145)]">MyPA</p>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-[oklch(0.92_0.015_130)]">{c.reply}</p>
        <ul className="mt-4 divide-y divide-[oklch(0.9_0.04_140/0.08)] border-t border-[oklch(0.9_0.04_140/0.08)]">
          {c.rows.map((r) => (
            <li key={r.lead + r.text} className="flex items-center gap-3 py-2.5 text-[13px]">
              <span className="w-16 shrink-0 truncate font-mono text-[11px] text-[oklch(0.78_0.03_140/0.7)]">{r.lead}</span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  r.struck && "text-[oklch(0.78_0.03_140/0.55)] line-through decoration-[oklch(0.78_0.03_140/0.4)]",
                )}
              >
                {r.text}
              </span>
              {r.tag && (
                <span className="shrink-0 rounded-full bg-[oklch(0.85_0.08_145/0.14)] px-2.5 py-0.5 text-[11px] text-[oklch(0.88_0.08_145)]">
                  {r.tag}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
