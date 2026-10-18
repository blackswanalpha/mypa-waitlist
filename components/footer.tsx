import Link from "next/link";

const CONTACT_EMAIL = "myexecpersonalassistant@gmail.com";

const LINKS = [
  { href: "/#waitlist", label: "Join the waitlist" },
  { href: "/contact", label: "Contact" },
  { href: "/contact#feedback", label: "Share feedback" },
];

export function Footer() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto max-w-7xl px-6 pt-14 lg:px-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Say hello
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-1 inline-block min-h-11 py-1.5 break-words text-xl font-medium tracking-[-0.02em] text-foreground underline decoration-border underline-offset-[6px] transition-colors hover:decoration-foreground md:text-2xl"
            >
              {/* Wrap at the @ on narrow screens, never mid-word. */}
              {CONTACT_EMAIL.split("@")[0]}@<wbr />
              {CONTACT_EMAIL.split("@")[1]}
            </a>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Explore
            </p>
            <ul className="mt-1">
              {LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-11 items-center text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Status
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm text-foreground/80">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fern opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fern" />
              </span>
              Building toward launch
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Invites go out in waves.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-border/70 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} MyPA. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
