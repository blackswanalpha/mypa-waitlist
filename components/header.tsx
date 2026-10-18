import Link from "next/link";
import { MyPALogo } from "@/components/mypa-logo";

export function Header() {
  return (
    <header className="relative z-50">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="MyPA home">
          <MyPALogo />
          {/* Lockup: wordmark over its descriptor, left edges aligned. */}
          <span className="flex flex-col font-display leading-none">
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">MyPA</span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              your chief of staff
            </span>
          </span>
        </Link>

        <nav className="flex items-center">
          <Link
            href="/contact"
            className="inline-flex h-11 items-center rounded-full px-4 font-display text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}
