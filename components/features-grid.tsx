"use client";

import { useRef, type MouseEvent } from "react";
import {
  Mic,
  CalendarCheck,
  NotebookPen,
  MessagesSquare,
  Check,
  Clock,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Lottie } from "@/components/lottie";
import { LOTTIE } from "@/lib/lottie-sources";
import { cn } from "@/lib/utils";

type Feature = {
  icon: LucideIcon;
  index: string;
  title: string;
  body: string;
  tag: string;
  /** lg-only column span — the grid is a mirrored 7/5 · 5/7 bento */
  span: string;
  visual: "voice" | "actions" | "journal" | "presence";
};

const FEATURES: Feature[] = [
  {
    icon: Mic,
    index: "01",
    title: "Voice-first",
    body: 'Say "Hey MyPA" and it listens. Tap-to-speak or hands-free — natural language in, things done out.',
    tag: "Hands-free · always listening",
    span: "lg:col-span-7",
    visual: "voice",
  },
  {
    icon: CalendarCheck,
    index: "02",
    title: "Gets things done",
    body: "Email, calendar, reminders and multi-step tasks — MyPA plans and executes, not just answers.",
    tag: "Email · Calendar · Tasks",
    span: "lg:col-span-5",
    visual: "actions",
  },
  {
    icon: NotebookPen,
    index: "03",
    title: "Private journal",
    body: "Capture thoughts by voice. Transcribed, timestamped, and kept private — yours alone.",
    tag: "Encrypted · yours alone",
    span: "lg:col-span-5",
    visual: "journal",
  },
  {
    icon: MessagesSquare,
    index: "04",
    title: "Stay connected",
    body: "Messaging and presence built in, so the people and conversations that matter stay close.",
    tag: "Messaging · Presence",
    span: "lg:col-span-7",
    visual: "presence",
  },
];

/** Live equalizer — resting heights pulse around their base via scaleY. */
const BARS = [
  0.35, 0.6, 0.45, 0.85, 0.55, 1, 0.4, 0.7, 0.3, 0.65, 0.5, 0.9, 0.45, 0.75,
  0.35, 0.8, 0.55, 0.95, 0.4, 0.65, 0.5, 0.85, 0.6, 0.35, 0.7, 0.45, 0.9,
  0.55, 0.75, 0.4, 0.6, 0.8, 0.5, 0.65, 0.35, 0.7,
];

/** Shared artifact chrome — the quiet inset panel each card's visual sits in. */
const PANEL =
  "rounded-2xl border border-border/50 bg-background/40 backdrop-blur-sm";

function VoiceVisual() {
  return (
    <div className={cn(PANEL, "mt-6 flex items-center gap-4 px-4 py-4")}>
      <span className="flex flex-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-fern">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fern opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fern" />
        </span>
        Listening
      </span>
      <div className="flex h-10 flex-1 items-end justify-between gap-[3px]">
        {BARS.map((h, i) => (
          <span
            key={i}
            className="w-[3px] flex-none rounded-full bg-gradient-to-t from-primary/70 to-primary/40 animate-voicebar motion-reduce:animate-none"
            style={{
              height: `${Math.round(h * 100)}%`,
              animationDelay: `${(i % 7) * 130}ms`,
            }}
          />
        ))}
      </div>
      <span className="flex-none font-mono text-[10px] tracking-widest text-muted-foreground/60">
        00:04
      </span>
    </div>
  );
}

const ACTIONS = [
  { icon: Check, text: "Rescheduled standup", meta: "9:30 AM", done: true },
  { icon: Check, text: "Drafted reply to Sam", meta: "Inbox", done: true },
  { icon: Clock, text: "Call mom", meta: "6:00 PM", done: false },
];

function ActionsVisual() {
  return (
    <div className="mt-6 space-y-2">
      {ACTIONS.map((a) => (
        <div
          key={a.text}
          className={cn(PANEL, "flex items-center justify-between px-3.5 py-2.5")}
        >
          <span className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-5 w-5 flex-none items-center justify-center rounded-full",
                a.done ? "bg-fern/15 text-fern" : "bg-primary/15 text-primary",
              )}
            >
              <a.icon className="h-3 w-3" />
            </span>
            <span className="font-poppins text-xs text-foreground/85">
              {a.text}
            </span>
          </span>
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground/60">
            {a.meta}
          </span>
        </div>
      ))}
    </div>
  );
}

function JournalVisual() {
  return (
    <div className={cn(PANEL, "mt-6 p-4")}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          Today · 9:41 PM
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-fern/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-fern">
          <Lock className="h-3 w-3" />
          Encrypted
        </span>
      </div>
      <p className="mt-3 font-serif text-sm italic leading-relaxed text-foreground/80">
        &ldquo;Shipped the beta today. Note to self — celebrate the small
        wins.&rdquo;
        <span className="ml-1 inline-block h-3.5 w-px animate-pulse bg-primary/80 align-middle motion-reduce:animate-none" />
      </p>
    </div>
  );
}

const PEOPLE = [
  { initials: "SA", tone: "bg-primary/15 text-primary" },
  { initials: "JM", tone: "bg-fern/20 text-fern" },
  { initials: "RK", tone: "bg-ocean/20 text-ocean" },
];

function PresenceVisual() {
  return (
    <div className={cn(PANEL, "mt-6 flex items-center justify-between gap-4 px-4 py-3.5")}>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {PEOPLE.map((p) => (
            <span
              key={p.initials}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 border-card font-mono text-[10px] font-medium",
                p.tone,
              )}
            >
              {p.initials}
            </span>
          ))}
        </div>
        <span className="hidden items-center gap-2 rounded-2xl rounded-bl-sm bg-primary/10 px-3 py-1.5 sm:flex">
          <span className="font-poppins text-xs text-foreground/85">
            Lunch at 1?
          </span>
          <span className="flex items-center gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-1 animate-pulse rounded-full bg-primary/70 motion-reduce:animate-none"
                style={{ animationDelay: `${i * 220}ms` }}
              />
            ))}
          </span>
        </span>
      </div>
      <span className="flex flex-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-fern">
        <span className="h-1.5 w-1.5 rounded-full bg-fern" />
        3 online
      </span>
    </div>
  );
}

const VISUALS = {
  voice: VoiceVisual,
  actions: ActionsVisual,
  journal: JournalVisual,
  presence: PresenceVisual,
} as const;

function FeatureCard({ feature }: { feature: Feature }) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = feature.icon;
  const Visual = VISUALS[feature.visual];

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-popover/80 to-popover/30 p-7 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl sm:p-8",
        feature.span,
      )}
    >
      {/* cursor-tracking spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(480px circle at var(--mx, 50%) var(--my, 0%), color-mix(in oklch, var(--primary) 10%, transparent), transparent 65%)",
        }}
      />
      {/* top hairline accent — resting whisper, brightens on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent transition-opacity duration-500 group-hover:via-primary/50"
      />
      {/* ghost index numeral */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-3 right-5 select-none font-serif text-8xl font-light leading-none text-foreground/[0.05] transition-colors duration-500 group-hover:text-primary/10"
      >
        {feature.index}
      </span>

      <div className="relative flex h-full flex-col">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent text-primary transition-shadow duration-500 group-hover:shadow-[0_0_28px_-6px] group-hover:shadow-primary/40">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>

        <h3 className="mt-6 font-serif text-2xl font-light tracking-tight text-foreground">
          {feature.title}
        </h3>
        <p className="mt-2.5 max-w-md font-poppins text-sm leading-relaxed text-muted-foreground">
          {feature.body}
        </p>

        <Visual />

        <div className="mt-auto flex items-center gap-3 pt-7">
          <span className="h-px flex-1 bg-gradient-to-r from-border/70 to-transparent" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
            {feature.tag}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FeaturesGrid() {
  return (
    <section
      id="features"
      className="relative scroll-mt-20 overflow-hidden py-20 md:py-28"
    >
      {/* ambient corner glows, deliberately faint */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-fern/[0.05] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-1/4 h-96 w-96 translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl"
      />

      <div className="relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-4">
            <span
              aria-hidden
              className="h-px w-10 bg-gradient-to-r from-transparent to-fern/50"
            />
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-fern">
              What MyPA does
            </p>
            <span
              aria-hidden
              className="h-px w-10 bg-gradient-to-l from-transparent to-fern/50"
            />
          </div>
          <h2 className="mt-4 font-serif text-3xl font-light tracking-tight text-foreground md:text-5xl">
            One assistant. <em className="italic">Your whole day.</em>
          </h2>
          <p className="mt-5 font-poppins text-balance text-muted-foreground">
            Built to feel calm and capable — the assistant the spec promised,
            finally in one place.
          </p>
          <Lottie
            src={LOTTIE.features}
            className="mx-auto mt-8 aspect-[1000/949] w-full max-w-md"
          />
        </Reveal>

        <Reveal
          className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-12"
          stagger={0.1}
          y={28}
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
