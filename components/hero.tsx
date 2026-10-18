"use client";

import { useState } from "react";
import { GlanceBot, type BotMood } from "@/components/glance-bot";
import { WaitlistForm } from "@/components/waitlist-form";
import { VoicePanel } from "@/components/voice-panel";

/** Bot, headline, the input bar and the use-case cards, in one centred column. */
export function Hero() {
  const [mood, setMood] = useState<BotMood>("idle");

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center pt-4 text-center sm:pt-8">
      <GlanceBot mood={mood} />

      <h1
        className="animate-rise whitespace-nowrap font-display text-[clamp(1.25rem,6.1vw,2rem)] font-medium leading-tight tracking-[-0.03em] text-foreground"
        style={{ animationDelay: "120ms" }}
      >
        Your day, spoken into order<span className="text-fern">.</span>
      </h1>

      <div className="animate-rise mt-7 w-full max-w-[27rem]" style={{ animationDelay: "220ms" }}>
        <WaitlistForm onMood={setMood} />
      </div>

      <div className="animate-rise mt-8 w-full text-left sm:mt-10" style={{ animationDelay: "320ms" }}>
        <VoicePanel />
      </div>
    </section>
  );
}
