import Link from "next/link";
import { MyPALogo } from "@/components/mypa-logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#waitlist", label: "Join waitlist" },
      { href: "/#feedback", label: "Feedback" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "mailto:hello@mypa.app", label: "hello@mypa.app" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-6 py-12 lg:px-12">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-2">
            <MyPALogo showText />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A calm, voice-first personal assistant. Plan, schedule, and get
              things done — just say &ldquo;Hey MyPA.&rdquo;
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MyPA. All rights reserved.
          </p>
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fern opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fern" />
            </span>
            Building toward launch
          </p>
        </div>
      </div>
    </footer>
  );
}
