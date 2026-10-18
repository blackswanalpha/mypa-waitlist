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

/**
 * Three things MyPA does, one per screen, chosen with a row of radio cards.
 * Auto-advances on the groove timer (paused while hovered or focused, off
 * under reduced motion), and responds to its cards, arrow keys and a swipe on
 * the screen. Flat on white: hairlines and fills only, no shadows or glows.
 */
export function VoicePanel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const swipeX = useRef<number | null>(null);
  const tabs = useRef<HTMLDivElement>(null);

  const go = (next: number) => setActive((next + CASES.length) % CASES.length);

  // Roving focus: arrow keys select the neighbouring card and move focus to it.
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
      className="relative mx-auto w-full max-w-[34rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Keyboard focus pauses (WCAG 2.2.2); a mouse click leaves autoplay alone.
      onFocus={(e) => e.target.matches(":focus-visible") && setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="What MyPA does"
    >
      <div className="rounded-[1.75rem] border border-border bg-background p-2">
        {/* Screen. */}
        <div
          className="relative overflow-hidden rounded-[1.35rem] bg-muted"
          onPointerDown={(e) => (swipeX.current = e.clientX)}
          onPointerUp={(e) => {
            if (swipeX.current === null) return;
            const dx = e.clientX - swipeX.current;
            swipeX.current = null;
            if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
          }}
        >
          {/* All slides share one grid cell, so the screen is as tall as the tallest. */}
          <div className="grid grid-cols-[minmax(0,1fr)] touch-pan-y select-none text-foreground">
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
                  className="col-start-1 row-start-1 p-5 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:p-6"
                  style={{
                    opacity: on ? 1 : 0,
                    transform: on ? "none" : `translateX(${offset * 28}px)`,
                  }}
                >
                  <Slide c={c} on={on} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Radio cards, plus the autoplay groove. */}
        <div ref={tabs} role="tablist" aria-label="Use cases" className="mt-2 grid grid-cols-3 gap-2" onKeyDown={onKeys}>
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
                  "relative flex h-12 items-center justify-center gap-2 rounded-2xl border text-[13px] font-medium transition-[border-color,background-color,color] duration-200 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                  on
                    ? "border-foreground bg-background text-foreground"
                    : "border-transparent bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors duration-300 max-[399px]:hidden",
                    on ? "bg-fern" : "bg-slate-300",
                  )}
                />
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {c.label}
              </button>
            );
          })}
        </div>
        <div aria-hidden className="mx-4 mb-1 mt-2.5 h-px overflow-hidden bg-border">
          <span
            key={active}
            className="animate-groove block h-full w-full origin-left bg-foreground/70 motion-reduce:hidden"
            style={{
              animationDuration: `${AUTOPLAY_MS}ms`,
              animationPlayState: paused ? "paused" : "running",
            }}
            onAnimationEnd={() => go(active + 1)}
          />
        </div>
      </div>
    </div>
  );
}

/** One screen. Its lines rise in sequence each time it becomes active. */
function Slide({ c, on }: { c: UseCase; on: boolean }) {
  const step = (n: number) => ({
    opacity: on ? 1 : 0,
    transform: on ? "none" : "translateY(6px)",
    transitionDelay: on ? `${160 + n * 100}ms` : "0ms",
  });
  const line = "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

  return (
    <>
      <div className={cn("flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground", line)} style={step(0)}>
        <span className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fern opacity-50 motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fern" />
          </span>
          Listening
        </span>
        <span className="tabular-nums">{c.time}</span>
      </div>

      <p className={cn("mt-5 text-[clamp(1.05rem,2.6vw,1.25rem)] font-medium leading-snug tracking-[-0.015em]", line)} style={step(1)}>
        &ldquo;{c.said}&rdquo;
      </p>

      <div aria-hidden className={cn("mt-4 flex h-6 items-end gap-[3px]", line)} style={step(2)}>
        {[0.35, 0.6, 0.9, 0.5, 1, 0.7, 0.4, 0.85, 0.55, 0.3, 0.75, 0.5, 0.95, 0.6, 0.35].map((h, i) => (
          <span
            key={i}
            className="animate-voicebar w-[3px] rounded-full bg-slate-300"
            style={{ height: `${h * 100}%`, animationDelay: `${i * 70}ms` }}
          />
        ))}
      </div>

      <div className={cn("mt-5 rounded-2xl border border-border bg-background p-4", line)} style={step(3)}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fern">MyPA</p>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-foreground">{c.reply}</p>
        <ul className="mt-3.5 divide-y divide-border border-t border-border">
          {c.rows.map((r) => (
            <li key={r.lead + r.text} className="flex items-center gap-3 py-2.5 text-[13px]">
              <span className="w-14 shrink-0 truncate font-mono text-[11px] text-muted-foreground sm:w-16">{r.lead}</span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  r.struck && "text-muted-foreground line-through decoration-slate-300",
                )}
              >
                {r.text}
              </span>
              {r.tag && (
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-secondary-foreground">
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
