"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, Mic } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Button } from "@/components/ui/button";
import { Lottie } from "@/components/lottie";
import { LOTTIE } from "@/lib/lottie-sources";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: "(prefers-reduced-motion: reduce)",
          ok: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          if (ctx.conditions?.reduce) return; // leave everything in place

          gsap
            .timeline({ defaults: { ease: "power3.out", duration: 0.7 } })
            .from(".hero-pill", { y: -12, autoAlpha: 0, duration: 0.5 })
            .from(".hero-title", { y: 24, autoAlpha: 0 }, "-=0.2")
            .from(".hero-sub", { y: 20, autoAlpha: 0 }, "-=0.45")
            .from(".hero-cta", { y: 16, autoAlpha: 0 }, "-=0.45")
            .from(".hero-note", { autoAlpha: 0, duration: 0.5 }, "-=0.35")
            .from(".hero-art", { y: 28, autoAlpha: 0, duration: 0.9 }, "-=0.3");

          // Scroll-scrubbed parallax on the brand glow.
          gsap.to(".hero-glow", {
            yPercent: 40,
            autoAlpha: 0.35,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          });
        },
      );
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24"
    >
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute inset-x-0 -top-32 mx-auto h-72 w-[42rem] max-w-full rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <div className="hero-pill mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fern opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-fern" />
          </span>
          Early access · now accepting signups
        </div>

        <h1 className="hero-title font-serif text-5xl font-light leading-[1.05] tracking-tight text-foreground md:text-7xl">
          Meet MyPA.
          <br />
          Just say{" "}
          <span className="italic text-primary">&ldquo;Hey&nbsp;MyPA.&rdquo;</span>
        </h1>

        <p className="hero-sub mx-auto mt-6 max-w-xl font-poppins text-lg leading-relaxed text-muted-foreground">
          A calm, voice-first personal assistant that plans your day, manages
          email and calendar, keeps a private journal, and keeps you connected —
          all in one place.
        </p>

        <div className="hero-cta mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="group w-full sm:w-auto">
            <Link href="#waitlist">
              Join the waitlist
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="#showcase">
              <Mic />
              See what it does
            </Link>
          </Button>
        </div>

        <p className="hero-note mt-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          No spam · Get whitelisted for launch
        </p>

        <Lottie
          src={LOTTIE.hero}
          lazy={false}
          className="hero-art mx-auto mt-12 aspect-square w-full max-w-xs md:max-w-sm"
        />
      </div>
    </section>
  );
}
