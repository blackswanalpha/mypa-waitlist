"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Cookie, Loader2, X } from "lucide-react";
import { create } from "zustand";

import { peekSessionId } from "@/lib/attribution";
import { beaconSettled, readConsent, type Choice, type Consent } from "@/lib/consent";
import { hasOptOutSignal } from "@/lib/device-cookie";
import { cn } from "@/lib/utils";

/**
 * The cookie card. Shown on the first visit until the visitor accepts or
 * declines; closing it with × is not a choice, so it comes back on the next
 * page. The footer's "Cookie settings" reopens it to change or withdraw the
 * choice. A browser sending Global Privacy Control or Do Not Track never
 * sees it and never gets the cookie.
 *
 * The choice is real: POST /api/consent sets the cookies and logs it in
 * Convex, the middleware clears an unconsented id, and Convex drops one.
 *
 * Below lg it sits at the top of the screen, so the join button at the
 * bottom of the form is never covered; from lg it sits bottom right, over the
 * carousel column.
 */

const useCardStore = create<{ reopened: boolean; reopen: () => void; close: () => void }>((set) => ({
  reopened: false,
  reopen: () => set({ reopened: true }),
  close: () => set({ reopened: false }),
}));

/** Footer link that reopens the card. */
export function CookieSettingsButton() {
  const reopen = useCardStore((s) => s.reopen);
  return (
    <button
      type="button"
      onClick={reopen}
      className="inline-flex min-h-11 items-center px-2 text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
    >
      Cookie settings
    </button>
  );
}

const noop = () => () => {};

const DETAILS: { name: string; what: string; keep: string }[] = [
  {
    name: "mypa_did · cookie",
    what: "A random ID that tells this device apart from others. Set only if you accept.",
    keep: "180 days, then we ask again",
  },
  {
    name: "mypa_consent · cookie",
    what: "Remembers whether you accepted or declined.",
    keep: "180 days",
  },
  {
    name: "Browser storage · not a cookie",
    what: "How you arrived (a campaign link or referring site), saved with your signup if you join, and a visit ID that ends when you close the tab. Used to count visits and signups.",
    keep: "30 days, and until the tab closes",
  },
];

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function CookieCard({ initial, gpc }: { initial: Consent | null; gpc: boolean }) {
  const pathname = usePathname();
  const reopened = useCardStore((s) => s.reopened);
  const closeStore = useCardStore((s) => s.close);
  // The server already saw the header; the browser may also say so in script.
  const optout = useSyncExternalStore(noop, () => gpc || hasOptOutSignal(), () => gpc);

  const [consent, setConsent] = useState<Consent | null>(initial);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const firstButton = useRef<HTMLButtonElement>(null);

  // Reopened from the footer: take focus there, so a keyboard user lands on the card.
  useEffect(() => {
    if (reopened) firstButton.current?.focus();
  }, [reopened]);

  if (pathname?.startsWith("/admin")) return null;
  const visible = reopened || (!optout && !dismissed && consent === null);
  if (!visible) return null;

  const close = () => {
    setError(null);
    if (reopened) closeStore();
    else setDismissed(true);
  };

  const choose = async (choice: Choice) => {
    setBusy(choice);
    setError(null);
    try {
      // The view this visit is on must be stored before its choice settles it.
      await beaconSettled();
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice, sessionId: peekSessionId() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "That didn’t save. Please try again.");
      // Trust the cookie the browser actually kept, not the button pressed.
      const stored = readConsent();
      if (stored?.choice !== choice) throw new Error("Your browser blocked the cookie, so the choice couldn’t be saved.");
      setConsent(stored);
      closeStore();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t save. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const status =
    consent === null
      ? null
      : `You ${consent.choice === "granted" ? "accepted" : "declined"} on ${fmtDate(consent.at)}.`;

  return (
    <section
      data-card="consent"
      aria-labelledby="cookie-card-title"
      className={cn(
        "animate-rise fixed inset-x-2 top-2 z-50 mx-auto max-h-[calc(100svh-1rem)] max-w-xl overflow-y-auto rounded-[8px] border border-border bg-background px-4 pb-3 pt-3 text-left",
        "lg:inset-x-auto lg:top-auto lg:right-4 lg:bottom-4 lg:w-[23rem]",
      )}
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 h-[18px] w-[18px] shrink-0 text-foreground" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="cookie-card-title" className="pr-8 text-[14px] font-semibold text-foreground">
            One cookie, to count visitors
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {optout
              ? "Your browser asks sites not to track you, so this site sets no device cookie. There is nothing to choose."
              : "May we keep a random ID on this device to tell new visitors from returning ones? No ads, nothing shared, nothing that follows you to other sites."}
          </p>
          {status && !optout && <p className="mt-1 text-[13px] font-medium text-foreground">{status}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Close without choosing"
        className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>

      {!optout && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDetails((d) => !d)}
            aria-expanded={details}
            aria-controls="cookie-card-details"
            className="inline-flex min-h-11 shrink-0 items-center px-1 text-[13px] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            Details
          </button>
          <div className="ml-auto grid flex-1 grid-cols-2 gap-2 sm:max-w-[16rem]">
            {(["denied", "granted"] as const).map((c, i) => {
              const current = consent?.choice === c;
              return (
                <button
                  key={c}
                  ref={i === 0 ? firstButton : undefined}
                  type="button"
                  data-choice={c}
                  aria-pressed={consent ? current : undefined}
                  disabled={busy !== null}
                  onClick={() => choose(c)}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-1.5 rounded-[8px] px-3 text-sm font-medium transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.97] disabled:cursor-progress",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                    c === "granted"
                      ? "bg-black text-white"
                      : "border border-input bg-background text-foreground hover:border-foreground/40",
                  )}
                >
                  {busy === c && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {c === "granted" ? "Accept" : "Decline"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[13px] text-destructive">
          {error}
        </p>
      )}

      {details && !optout && (
        <dl id="cookie-card-details" className="mt-2 space-y-2.5 border-t border-border pt-3 text-[12.5px] leading-relaxed">
          {DETAILS.map((d) => (
            <div key={d.name}>
              <dt className="font-medium text-foreground">{d.name}</dt>
              <dd className="text-muted-foreground">{d.what}</dd>
              <dd className="text-muted-foreground">Kept: {d.keep}</dd>
            </div>
          ))}
          <div>
            <dt className="font-medium text-foreground">Changing your mind</dt>
            <dd className="text-muted-foreground">
              “Cookie settings” at the bottom of the page reopens this card. Declining deletes the ID straight away.
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
