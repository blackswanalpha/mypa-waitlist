"use client";

import { useRef, type MouseEvent } from "react";
import {
  Mic,
  CalendarCheck,
  NotebookPen,
  MessagesSquare,
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
  /** lg-only column span — wide tiles carry a bespoke visual */
  span?: string;
  visual?: "voice" | "presence";
};

const FEATURES: Feature[] = [
  {
    icon: Mic,
    index: "01",
    title: "Voice-first",
    body: 'Say "Hey MyPA" and it listens. Tap-to-speak or hands-free — natural language in, things done out.',
    tag: "Hands-free · always listening",
    span: "lg:col-span-2",
    visual: "voice",
  },
  {
    icon: CalendarCheck,
    index: "02",
    title: "Gets things done",
    body: "Email, calendar, reminders and multi-step tasks — MyPA plans and executes, not just answers.",
    tag: "Email · Calendar · Tasks",
  },
  {
    icon: NotebookPen,
    index: "03",
    title: "Private journal",
    body: "Capture thoughts by voice. Transcribed, timestamped, and kept private — yours alone.",
    tag: "Encrypted · yours alone",
  },
  {
    icon: MessagesSquare,
    index: "04",
    title: "Stay connected",
    body: "Messaging and presence built in, so the people and conversations that matter stay close.",
    tag: "Messaging · Presence",
    span: "lg:col-span-2",
    visual: "presence",
  },
];

/** Live equalizer — resting heights pulse around their base via scaleY. */
const BARS = [
  0.4, 0.7, 0.5, 0.95, 0.6, 1, 0.45, 0.8, 0.35, 0.7, 0.55, 0.9, 0.5, 0.75,
  0.4, 0.85, 0.6, 0.95, 0.45, 0.7, 0.55, 0.8,
];

function Waveform() {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-xl border border-border/50 bg-muted/40 px-4 py-3">
      <span className="flex flex-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-fern">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fern opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fern" />
        </span>
        Listening
      </span>
      <div className="flex h-7 flex-1 items-end gap-[3px]">
        {BARS.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-full bg-primary/55 animate-voicebar motion-reduce:animate-none"
            style={{ height: `${Math.round(h * 100)}%`, animationDelay: `${(i % 6) * 110}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

const PEOPLE = [
  { initials: "SA", tone: "bg-primary/15 text-primary" },
  { initials: "JM", tone: "bg-fern/20 text-fern" },
  { initials: "RK", tone: "bg-ocean/20 text-ocean" },
];

function Presence() {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/40 px-4 py-3">
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
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted font-mono text-[10px] text-muted-foreground">
          +9
        </span>
      </div>
      <span className="flex flex-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-fern">
        <span className="h-1.5 w-1.5 rounded-full bg-fern" />
        3 online
      </span>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = feature.icon;

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
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-popover/60 p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg sm:p-7",
        feature.span,
      )}
    >
      {/* cursor-tracking spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--mx, 50%) var(--my, 0%), color-mix(in oklch, var(--primary) 14%, transparent), transparent 60%)",
        }}
      />
      {/* top hairline accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm">
            <Icon className="h-5 w-5" />
          </span>
          <span className="font-mono text-xs tracking-widest text-muted-foreground/40">
            {feature.index}
          </span>
        </div>

        <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
          {feature.title}
        </h3>
        <p className="mt-2 max-w-md font-poppins text-sm leading-relaxed text-muted-foreground">
          {feature.body}
        </p>

        {feature.visual === "voice" && <Waveform />}
        {feature.visual === "presence" && <Presence />}

        <div className="mt-auto flex items-center gap-3 pt-6">
          <span className="h-px flex-1 bg-border/60" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
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
      className="relative scroll-mt-20 overflow-hidden py-16 md:py-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.06] blur-3xl"
      />

      <div className="relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-fern">
            What MyPA does
          </p>
          <h2 className="mt-3 font-serif text-3xl font-light tracking-tight text-foreground md:text-4xl">
            One assistant. Your whole day.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Built to feel calm and capable — the assistant the spec promised,
            finally in one place.
          </p>
          <Lottie
            src={LOTTIE.features}
            className="mx-auto mt-8 aspect-[1000/949] w-full max-w-md"
          />
        </Reveal>

        <Reveal
          className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
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
