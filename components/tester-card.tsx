import { ArrowUpRight, FlaskConical, Hourglass } from "lucide-react";

export type Program = {
  open: boolean;
  slots: number;
  spotsLeft: number;
  socials: { label: string; url: string }[];
};

/** Shown while signups are open: the first `slots` people become testers. */
export function TesterCard({ slots, spotsLeft }: Pick<Program, "slots" | "spotsLeft">) {
  return (
    <div
      data-card="tester"
      className="flex items-start gap-3 rounded-[6px] border border-blue-200 bg-blue-50 px-4 py-3 text-left text-blue-900 sm:py-3.5"
    >
      <FlaskConical className="mt-0.5 h-[18px] w-[18px] shrink-0 text-blue-700" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-[14px] font-semibold text-blue-900">Early tester program</p>
          <p className="rounded-[4px] bg-blue-100 px-2 py-0.5 text-[12px] font-medium tabular-nums text-blue-800">
            {spotsLeft > 0 ? `${spotsLeft} of ${slots} spots left` : "All spots claimed"}
          </p>
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-blue-800">
          {spotsLeft > 0
            ? `The first ${slots} people to join test MyPA on Android before launch. Approved testers get a private install link through Google’s Firebase App Distribution.`
            : `All ${slots} tester spots are claimed. Join anyway and you’re first in line when the next round opens.`}
        </p>
      </div>
    </div>
  );
}

/** Replaces the form when an admin closes signups. */
export function ClosedCard({ slots, socials }: Pick<Program, "slots" | "socials">) {
  return (
    <div
      data-card="closed"
      role="status"
      className="rounded-[6px] border border-amber-200 bg-amber-50 px-4 py-4 text-left text-amber-900 sm:px-5"
    >
      <div className="flex items-start gap-3">
        <Hourglass className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-700" strokeWidth={2} aria-hidden />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-amber-900">All {slots} tester spots are filled</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-amber-800">
            Signups are paused while our first testers settle in.{" "}
            {socials.length > 0
              ? "We’ll announce new spots on our socials first, so follow along."
              : "We’ll announce new spots on our socials first."}
          </p>
        </div>
      </div>
      {socials.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-2 sm:pl-[30px]">
          {socials.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-amber-300 bg-white px-3 text-[13px] font-medium text-amber-900 transition-colors duration-150 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            >
              {s.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
