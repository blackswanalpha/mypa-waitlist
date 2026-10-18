import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { DayCarousel } from "@/components/day-carousel";

export default function HomePage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip bg-background font-display selection:bg-slate-200">
      <Header />

      <main id="waitlist" className="flex-1 px-4 sm:px-6 lg:px-8">
        <Hero />

        <div className="mx-auto mt-20 max-w-5xl pb-20 sm:mt-28 sm:pb-28">
          <p className="mb-6 text-[13px] font-medium text-muted-foreground">A day with MyPA</p>
          <DayCarousel />
        </div>
      </main>

      <Footer />
    </div>
  );
}
