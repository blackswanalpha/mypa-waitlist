"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Disclosure nav for <md screens — below that breakpoint the desktop nav is
 * hidden and, before this, the site had NO navigation at all on mobile.
 * Renders the hamburger in the header row and, when open, a panel fixed
 * under the sticky header with the nav links + waitlist CTA.
 */
export function MobileNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <nav
          id="mobile-nav-panel"
          aria-label="Mobile"
          className="fixed inset-x-0 top-16 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md"
        >
          <div className="container mx-auto flex flex-col gap-1 px-6 py-4">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
            <Button asChild size="sm" className="mt-2">
              <Link href="/#waitlist" onClick={() => setOpen(false)}>
                Join waitlist
              </Link>
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
