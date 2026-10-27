import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { DayCarousel } from "@/components/day-carousel";
import type { Program } from "@/components/tester-card";

// Open/closed is read per request, so an admin's toggle shows on the next load.
export const dynamic = "force-dynamic";

const FALLBACK: Program = { open: true, slots: 40, spotsLeft: 40, socials: [] };

/**
 * Never lets Convex take the landing page down: an unreachable deployment, a
 * slow one, or one that does not have testers:program yet all render the open
 * form, and the apply mutation still enforces a close on submit.
 */
async function loadProgram(): Promise<Program> {
  const url = process.env.CONVEX_SERVER_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return FALLBACK;
  try {
    return await Promise.race([
      new ConvexHttpClient(url).query(api.testers.program, {}),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500)),
    ]);
  } catch (e) {
    console.error("landing: testers:program unavailable", e);
    return FALLBACK;
  }
}

export default async function HomePage() {
  const program = await loadProgram();

  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip bg-background font-display selection:bg-slate-200">
      <Header />

      <main id="waitlist" className="flex-1 px-4 sm:px-6 lg:px-8">
        {/* From lg the hero takes 60% and the carousel 40%. */}
        <div className="mx-auto grid max-w-7xl items-center gap-16 pt-4 sm:pt-8 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16 lg:pb-12 lg:pt-0">
          <Hero program={program} />

          <div className="animate-rise w-full" style={{ animationDelay: "300ms" }}>
            <DayCarousel />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
