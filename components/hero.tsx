"use client";

import { useState } from "react";
import { GlanceBot, type BotMood } from "@/components/glance-bot";
import { WaitlistForm } from "@/components/waitlist-form";

/** Bot, headline and the input bar, centred in their column. */
export function Hero() {
  const [mood, setMood] = useState<BotMood>("idle");

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
      <GlanceBot mood={mood} />

      <h1
        className="animate-rise whitespace-nowrap font-display text-[clamp(1.25rem,6.1vw,2rem)] font-medium leading-tight tracking-[-0.03em] text-foreground"
        style={{ animationDelay: "120ms" }}
      >
        Your day, spoken into order<span className="text-fern">.</span>
      </h1>

      <div className="animate-rise mt-7 w-full max-w-xl" style={{ animationDelay: "220ms" }}>
        <WaitlistForm onMood={setMood} />
      </div>
    </section>
  );
}
