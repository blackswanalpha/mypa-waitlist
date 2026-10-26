import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlanceBot, type BotMood } from "@/components/glance-bot";
import { CONTACT_EMAIL } from "@/components/footer";
import { cn } from "@/lib/utils";

/** The waitlist button's shape and weight, for the main way out of a status page. */
export const PRIMARY = cn(
  "group inline-flex h-14 items-center justify-center gap-2 rounded-[8px] bg-foreground px-6 text-sm font-medium text-background",
  "transition-[background-color,transform] duration-200 ease-out hover:bg-foreground/85 active:scale-[0.97]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
);

export const SECONDARY = cn(
  "inline-flex h-14 items-center justify-center rounded-[8px] border border-input px-6 text-sm font-medium text-foreground",
  "transition-colors duration-200 hover:border-foreground/40",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
);

/** Bot, a code line, the headline, one sentence and the ways out — the hero's column, for pages that are not the hero. */
export function StatusPage({
  eyebrow,
  title,
  mood,
  children,
  actions,
  footnote,
}: {
  eyebrow: string;
  title: string;
  mood: BotMood;
  children: React.ReactNode;
  actions: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
      <GlanceBot mood={mood} />
      <p
        className="animate-rise font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
        style={{ animationDelay: "80ms" }}
      >
        {eyebrow}
      </p>
      <h1
        className="animate-rise mt-3 font-display text-[clamp(1.5rem,6vw,2rem)] font-medium leading-tight tracking-[-0.03em] text-foreground"
        style={{ animationDelay: "120ms" }}
      >
        {title}
        <span className="text-fern">.</span>
      </h1>
      <p
        className="animate-rise mt-3 max-w-md text-[15px] leading-relaxed text-foreground"
        style={{ animationDelay: "180ms" }}
      >
        {children}
      </p>
      <div
        className="animate-rise mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center"
        style={{ animationDelay: "240ms" }}
      >
        {actions}
      </div>
      {footnote && (
        <p className="mt-6 font-mono text-[11px] text-muted-foreground">{footnote}</p>
      )}
    </section>
  );
}

/** Back to the landing page, with the waitlist button's arrow. */
export function HomeLink({ className }: { className?: string }) {
  return (
    <Link href="/" className={className ?? PRIMARY}>
      Back to the waitlist
      <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * What a crash says, for both error boundaries. `digest` is the server's hash
 * of the error, the one thing a person can send us that finds it in the logs.
 */
export function ErrorState({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  return (
    <StatusPage
      eyebrow="Error"
      title="Something broke on our side"
      mood="failed"
      actions={
        <>
          <button type="button" onClick={onRetry} className={PRIMARY}>
            Try again
          </button>
          <Link href="/" className={SECONDARY}>
            Back to the waitlist
          </Link>
        </>
      }
      footnote={digest ? `Reference ${digest}` : undefined}
    >
      It&rsquo;s not you. Try again, and if it keeps happening, write to{" "}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
      >
        {CONTACT_EMAIL}
      </a>
      .
    </StatusPage>
  );
}
