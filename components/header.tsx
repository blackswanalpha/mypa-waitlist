import Link from "next/link";
import { MyPALogo } from "@/components/mypa-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="relative z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-12">
        <Link href="/" className="flex items-center" aria-label="MyPA home">
          <MyPALogo showText />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/contact"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Contact
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
