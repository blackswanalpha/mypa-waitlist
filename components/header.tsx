import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="relative z-50">
      {/* Phones: lockup left, status right. From sm, three columns so the lockup sits on the page's centre line. */}
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 sm:col-start-2" aria-label="MyPA home">
          {/* The app icon: the lime puzzle emblem on a black rounded square. */}
          <Image src="/lime-puzzle.webp" alt="" width={36} height={36} priority className="h-9 w-9 rounded-[10px]" />
          {/* Lockup: wordmark over its descriptor, left edges aligned. */}
          <span className="flex flex-col font-display leading-none">
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">MyPA</span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              your chief of staff
            </span>
          </span>
        </Link>

        <p className="flex items-start gap-2 justify-self-end font-display text-xs text-foreground sm:items-center sm:text-sm">
          <span className="relative mt-[5px] flex h-1.5 w-1.5 shrink-0 sm:mt-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fern opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fern" />
          </span>
          Building toward launch
        </p>
      </div>
    </header>
  );
}
