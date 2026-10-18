import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { DayCarousel } from "@/components/day-carousel";
import { VoicePanel } from "@/components/voice-panel";

export default function HomePage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip bg-background font-display selection:bg-slate-200">
      <Header />

      <main id="waitlist" className="flex-1 px-4 sm:px-6 lg:px-8">
        {/* The hero on the left, a day with MyPA on the right; stacked below lg. */}
        <div className="mx-auto grid max-w-7xl items-center gap-16 pt-4 sm:pt-8 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:pb-12 lg:pt-0">
          <Hero />

          <div className="animate-rise w-full" style={{ animationDelay: "300ms" }}>
            <DayCarousel />
          </div>
        </div>

        <div className="animate-rise mx-auto mt-20 max-w-5xl pb-20 sm:pb-28 lg:mt-12" style={{ animationDelay: "380ms" }}>
          <VoicePanel />
        </div>
      </main>

      <Footer />
    </div>
  );
}
