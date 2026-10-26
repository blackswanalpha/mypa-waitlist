import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { DayCarousel } from "@/components/day-carousel";

export default function HomePage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip bg-background font-display selection:bg-slate-200">
      <Header />

      <main id="waitlist" className="flex-1 px-4 sm:px-6 lg:px-8">
        {/* From lg the hero takes 60% and the carousel 40%. */}
        <div className="mx-auto grid max-w-7xl items-center gap-16 pt-4 sm:pt-8 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16 lg:pb-12 lg:pt-0">
          <Hero />

          <div className="animate-rise w-full" style={{ animationDelay: "300ms" }}>
            <DayCarousel />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
