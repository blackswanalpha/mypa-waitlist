"use client";

import { CalendarCheck, Mail, Bell, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Lottie } from "@/components/lottie";
import { LOTTIE } from "@/lib/lottie-sources";
import { cn } from "@/lib/utils";

type Moment = {
  num: string;
  cmd: string;
  action: string;
  result: string;
  icon: LucideIcon;
};

const MOMENTS: Moment[] = [
  {
    num: "01",
    cmd: "Hey MyPA, clear my morning.",
    action: "Rescheduled 3 meetings.",
    result: "Your morning is free until 12:30. Everyone's been notified.",
    icon: CalendarCheck,
  },
  {
    num: "02",
    cmd: "Summarize my unread email.",
    action: "Scanned 24 messages.",
    result: "3 need a reply, 1 is urgent from Sam — the rest are newsletters.",
    icon: Mail,
  },
  {
    num: "03",
    cmd: "Remind me to call mom at 6.",
    action: "Reminder set.",
    result: "I'll nudge you at 6:00 PM today. Want me to dial when it's time?",
    icon: Bell,
  },
];

function EyebrowDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fern opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fern" />
    </span>
  );
}

function MomentCell({
  moment,
  featured = false,
  className,
}: {
  moment: Moment;
  featured?: boolean;
  className?: string;
}) {
  const Icon = moment.icon;
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fern">
          <EyebrowDot />
          Voice command
        </span>
        <span className="font-mono text-xs tracking-widest text-muted-foreground/70">
          {moment.num}
        </span>
      </div>

      <p
        className={cn(
          "font-serif font-light text-foreground",
          featured
            ? "mt-6 text-3xl leading-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]"
            : "mt-3 text-xl leading-snug sm:text-2xl",
        )}
      >
        &ldquo;{moment.cmd}&rdquo;
      </p>

      <div className={cn("flex items-start", featured ? "mt-8 gap-3" : "mt-3 gap-2.5")}>
        <Icon
          className={cn(
            "flex-none text-primary",
            featured ? "mt-1 h-5 w-5" : "mt-0.5 h-3.5 w-3.5",
          )}
        />
        <p
          className={cn(
            "font-poppins leading-relaxed text-muted-foreground",
            featured ? "text-base" : "text-xs sm:text-sm",
          )}
        >
          <span className="text-foreground/90">{moment.action}</span>{" "}
          {moment.result}
        </p>
      </div>
    </div>
  );
}

export function Showcase() {
  return (
    <section
      id="showcase"
      className="relative scroll-mt-20 overflow-hidden py-16 md:py-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/4 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fern/[0.07] blur-3xl"
      />

      <div className="container relative mx-auto px-6 lg:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Lottie
            src={LOTTIE.showcase}
            className="mx-auto mb-4 h-28 w-auto md:h-32"
          />
          <p className="font-mono text-xs uppercase tracking-widest text-fern">
            How it works
          </p>
          <h2 className="mt-3 font-serif text-3xl font-light tracking-tight text-foreground md:text-4xl">
            Ask. MyPA handles the rest.
          </h2>
        </Reveal>

        <Reveal
          className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-y-12 lg:grid-cols-2 lg:grid-rows-2 lg:gap-x-0 lg:gap-y-0"
          stagger={0.15}
          y={24}
        >
          <MomentCell
            moment={MOMENTS[0]}
            featured
            className="lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:border-r lg:border-border/50 lg:pr-12"
          />
          <MomentCell
            moment={MOMENTS[1]}
            className="lg:col-start-2 lg:row-start-1 lg:border-b lg:border-border/50 lg:pb-10 lg:pl-12"
          />
          <MomentCell
            moment={MOMENTS[2]}
            className="lg:col-start-2 lg:row-start-2 lg:pl-12 lg:pt-10"
          />
        </Reveal>
      </div>
    </section>
  );
}
