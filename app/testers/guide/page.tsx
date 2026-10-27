import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Header } from "@/components/header";
import { Footer, CONTACT_EMAIL } from "@/components/footer";
import { SHOTS } from "@/components/guide/shots";
import { guideSteps, SAFETY_POINTS, type TesterDevice } from "@/convex/emails/testerTemplates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Install MyPA as a tester — MyPA",
  description: "Step-by-step: accept your Firebase invite, install App Tester and install MyPA on Android.",
  robots: { index: false },
};

/** **label** → bold label. The step text is shared with the approval email. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default async function TesterGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  const device: TesterDevice = phone === "samsung" ? "samsung" : "android";
  const steps = guideSteps(device, "the email you joined with", "page");

  return (
    <div className="flex min-h-svh flex-col bg-background font-display selection:bg-slate-200">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-6 sm:px-6">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Tester guide</p>
        <h1 className="mt-2 text-[28px] font-medium leading-tight tracking-[-0.03em] text-foreground sm:text-[34px]">
          Install MyPA on your Android phone
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          About five minutes, from your approval email to MyPA on your home screen.
        </p>

        <div className="mt-6 inline-grid grid-cols-2 gap-1 rounded-[6px] border border-border p-1" role="tablist" aria-label="Your phone">
          {(["android", "samsung"] as const).map((d) => (
            <Link
              key={d}
              href={d === "samsung" ? "?phone=samsung" : "?"}
              role="tab"
              aria-selected={device === d}
              scroll={false}
              className={cn(
                "rounded-[4px] px-4 py-2 text-center text-[13px] transition-colors duration-150",
                device === d ? "bg-black font-medium text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d === "samsung" ? "Samsung" : "Other Android"}
            </Link>
          ))}
        </div>

        <section className="mt-6 rounded-[6px] border border-blue-200 bg-blue-50 px-4 py-4 text-blue-900 sm:px-5">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <ShieldCheck className="h-[18px] w-[18px] text-blue-700" aria-hidden />
            Why this is safe
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-blue-800 marker:text-blue-400">
            {SAFETY_POINTS.map((p) => (
              <li key={p}>
                <Rich text={p} />
              </li>
            ))}
          </ul>
        </section>

        <ol className="mt-10 space-y-12">
          {steps.map((s, i) => {
            const Shot = s.image ? SHOTS[s.image] : undefined;
            return (
              <li key={s.id} id={s.id} className="scroll-mt-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-foreground text-[13px] font-semibold text-background">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[18px] font-medium tracking-[-0.01em] text-foreground">{s.title}</h2>
                    <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
                      <Rich text={s.body} />
                    </p>
                  </div>
                </div>
                {Shot && (
                  <div className="mt-4 sm:pl-10">
                    <Shot />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-12 rounded-[6px] border border-border px-4 py-4 text-[14px] leading-relaxed text-muted-foreground sm:px-5">
          New builds show up in App Tester with an <strong className="font-semibold text-foreground">Update</strong>{" "}
          button. Stuck on a step? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>{" "}
          with a screenshot and we’ll walk you through it. The screens above are illustrations, so yours may look a
          little different.
        </div>
      </main>
      <Footer />
    </div>
  );
}
