import { Check } from "lucide-react";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Marquee } from "@/components/marquee";
import { Showcase } from "@/components/showcase";
import { FeaturesGrid } from "@/components/features-grid";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { Reveal } from "@/components/reveal";
import { WaitlistForm } from "@/components/waitlist-form";
import { FeedbackForm } from "@/components/feedback-form";
import { Lottie } from "@/components/lottie";
import { LOTTIE } from "@/lib/lottie-sources";

const BENEFITS = [
  "Be first in line when MyPA launches",
  "Get whitelisted — your spot is reserved",
  "Help shape what we build, directly",
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-fern/20">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-6 lg:px-12">
          <Hero />
        </div>

        <Marquee />

        <Showcase />

        <div className="container mx-auto px-6 lg:px-12">
          <FeaturesGrid />
        </div>

        <Faq />

        {/* Waitlist */}
        <section
          id="waitlist"
          className="scroll-mt-20 border-t border-border/50 bg-card/40 py-16 md:py-24"
        >
          <div className="container mx-auto grid items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16 lg:px-12">
            <Reveal>
              <Lottie
                src={LOTTIE.waitlist}
                className="mb-4 h-36 w-36 md:h-44 md:w-44"
              />
              <p className="font-mono text-xs uppercase tracking-widest text-fern">
                Early access
              </p>
              <h2 className="mt-3 font-serif text-3xl font-light tracking-tight text-foreground md:text-5xl">
                Join the waitlist.
              </h2>
              <p className="mt-4 max-w-md font-poppins text-muted-foreground">
                Add your name and email and we&rsquo;ll whitelist you for launch.
                You&rsquo;ll be registered and ready the day MyPA goes live.
              </p>
              <ul className="mt-8 space-y-3">
                {BENEFITS.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-3 font-poppins text-sm text-foreground/90"
                  >
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-fern/15 text-fern">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal y={24}>
              <WaitlistForm />
            </Reveal>
          </div>
        </section>

        {/* Feedback */}
        <section id="feedback" className="scroll-mt-20 py-16 md:py-24">
          <div className="container mx-auto max-w-2xl px-6 lg:px-12">
            <Reveal className="text-center">
              <Lottie
                src={LOTTIE.feedback}
                className="mx-auto mb-4 h-32 w-auto md:h-36"
              />
              <p className="font-mono text-xs uppercase tracking-widest text-fern">
                Tell us what you think
              </p>
              <h2 className="mt-3 font-serif text-3xl font-light tracking-tight text-foreground md:text-4xl">
                Shape MyPA with your feedback.
              </h2>
              <p className="mt-4 text-muted-foreground">
                What would make this a no-brainer for you? We read every note.
              </p>
            </Reveal>

            <Reveal className="mt-10 text-left" y={24}>
              <FeedbackForm />
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
