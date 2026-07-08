"use client";

import Link from "next/link";
import {
  ChevronDown,
  MessageCircleQuestion,
  ArrowUpRight,
} from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { Reveal } from "@/components/reveal";
import { Lottie } from "@/components/lottie";
import { LOTTIE } from "@/lib/lottie-sources";
import { FAQS } from "@/lib/faq-data";

export function Faq() {
  return (
    <section
      id="faq"
      className="relative scroll-mt-20 overflow-hidden py-16 md:py-24"
    >
      {/* ambient depth glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/4 h-[26rem] w-[26rem] translate-x-1/3 rounded-full bg-primary/[0.06] blur-3xl"
      />

      <div className="container relative mx-auto grid grid-cols-1 gap-10 px-6 lg:grid-cols-5 lg:items-start lg:gap-16 lg:px-12">
        {/* Left rail — sticky heading + contact CTA */}
        <Reveal className="lg:col-span-2 lg:sticky lg:top-24 lg:self-start">
          <Lottie src={LOTTIE.faq} className="mb-4 h-28 w-auto md:h-32" />
          <p className="font-mono text-xs uppercase tracking-widest text-fern">
            FAQ
          </p>
          <h2 className="mt-3 font-serif text-3xl font-light tracking-tight text-foreground md:text-4xl">
            Questions, answered.
          </h2>
          <p className="mt-4 max-w-sm text-muted-foreground">
            Everything worth knowing before you join the waitlist.
          </p>

          <div className="mt-10 border-t border-border/50 pt-6">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MessageCircleQuestion className="h-4 w-4 text-primary" />
              Still have questions?
            </p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Can&rsquo;t find what you&rsquo;re looking for? We&rsquo;re happy
              to help.
            </p>
            <Link
              href="/contact"
              className="group mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Contact us
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </Reveal>

        {/* Right column — divider-row accordion (no cards) */}
        <Reveal className="lg:col-span-3" stagger={0.08} y={24}>
          <AccordionPrimitive.Root
            type="single"
            collapsible
            defaultValue="item-0"
            className="border-t border-border/50"
          >
            {FAQS.map((f, i) => (
              <AccordionPrimitive.Item
                key={i}
                value={`item-${i}`}
                className="group border-b border-border/50"
              >
                <AccordionPrimitive.Header className="flex">
                  <AccordionPrimitive.Trigger className="flex flex-1 items-center gap-4 rounded-md py-5 text-left outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <span className="font-mono text-xs tracking-widest text-muted-foreground/70 transition-colors group-data-[state=open]:text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[15px] font-medium tracking-tight text-foreground transition-colors group-data-[state=open]:text-primary md:text-base">
                      {f.q}
                    </span>
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border/70 bg-muted/30 text-muted-foreground transition-all duration-300 group-data-[state=open]:rotate-180 group-data-[state=open]:border-primary/40 group-data-[state=open]:bg-primary/10 group-data-[state=open]:text-primary">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>

                <AccordionPrimitive.Content className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="pb-5 pl-9">
                    <p className="border-l-2 border-primary/30 pl-4 text-sm leading-relaxed text-muted-foreground">
                      {f.a}
                    </p>
                  </div>
                </AccordionPrimitive.Content>
              </AccordionPrimitive.Item>
            ))}
          </AccordionPrimitive.Root>
        </Reveal>
      </div>
    </section>
  );
}
