"use client";

import { useState } from "react";
import { GlanceBot, type BotMood } from "@/components/glance-bot";
import { WaitlistForm } from "@/components/waitlist-form";
import { ClosedCard, TesterCard, type Program } from "@/components/tester-card";

/**
 * Bot, headline, then either the tester card and the form (signups open) or
 * the amber closed card. `program` is read on the server, so the page never
 * swaps one for the other after it paints; a submit the server refuses as
 * closed swaps it then.
 */
export function Hero({ program }: { program: Program }) {
  const [mood, setMood] = useState<BotMood>("idle");
  const [closed, setClosed] = useState(!program.open);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
      <GlanceBot mood={mood} />

      <h1
        className="animate-rise whitespace-nowrap font-display text-[clamp(1.25rem,6.1vw,2rem)] font-medium leading-tight tracking-[-0.03em] text-foreground"
        style={{ animationDelay: "120ms" }}
      >
        Your day, spoken into order<span className="text-fern">.</span>
      </h1>

      <div className="animate-rise mt-6 w-full max-w-xl" style={{ animationDelay: "220ms" }}>
        {closed ? (
          <ClosedCard slots={program.slots} socials={program.socials} />
        ) : (
          <>
            <TesterCard slots={program.slots} spotsLeft={program.spotsLeft} />
            <div className="mt-5">
              <WaitlistForm onMood={setMood} onClosed={() => setClosed(true)} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
