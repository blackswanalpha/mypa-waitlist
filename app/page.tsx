import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WaitlistForm } from "@/components/waitlist-form";
import { VoicePanel } from "@/components/voice-panel";

const NOTES = ["Android & iOS", "Private by design", "No spam, ever"];

export default function HomePage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip bg-background selection:bg-primary/25">
      {/* Soft sage bloom behind the header and headline. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-56 h-[40rem] w-[40rem] rounded-full bg-sage/15 blur-3xl"
      />
      <Header />

      <main id="waitlist" className="relative flex-1">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-10 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-12 lg:pb-20">
          <div className="max-w-xl">
            <h1
              className="animate-rise font-serif text-[clamp(3rem,7vw,5.75rem)] leading-[0.95] tracking-[-0.02em] text-foreground"
            >
              Your day,
              <br />
              <em className="text-primary">spoken</em> into order.
            </h1>

            <p
              className="animate-rise mt-6 max-w-md text-[17px] leading-relaxed text-muted-foreground"
              style={{ animationDelay: "160ms" }}
            >
              MyPA is a calm, voice-first personal assistant. Say &ldquo;Hey
              MyPA&rdquo; and it plans your day, keeps your calendar and inbox
              in hand, and holds a private journal &mdash; so you can be present
              for the rest.
            </p>

            <div className="animate-rise mt-10" style={{ animationDelay: "240ms" }}>
              <WaitlistForm />
            </div>

            <ul
              className="animate-rise mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
              style={{ animationDelay: "320ms" }}
            >
              {NOTES.map((n) => (
                <li key={n} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {n}
                </li>
              ))}
            </ul>
          </div>

          <VoicePanel />
        </div>
      </main>

      <Footer />
    </div>
  );
}
