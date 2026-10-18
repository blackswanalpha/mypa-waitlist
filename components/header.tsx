import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="relative z-50">
      {/* Three columns so the lockup sits on the page's centre line, not between its neighbours. */}
      <div className="mx-auto grid h-20 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" className="col-start-2 flex min-h-11 items-center gap-2.5" aria-label="MyPA home">
          {/* The app icon: lime mark on a black rounded square. */}
          <Image src="/favicon/favicon.svg" alt="" width={36} height={36} priority className="h-9 w-9" />
          {/* Lockup: wordmark over its descriptor, left edges aligned. */}
          <span className="flex flex-col font-display leading-none">
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">MyPA</span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              your chief of staff
            </span>
          </span>
        </Link>

        <nav className="flex items-center justify-self-end">
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
