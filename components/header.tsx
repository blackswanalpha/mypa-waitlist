import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { MyPALogo } from "@/components/mypa-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/#showcase", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-6 lg:px-12">
        <Link href="/" className="flex items-center" aria-label="MyPA home">
          <MyPALogo showText />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/#waitlist">Join waitlist</Link>
          </Button>
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
