"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ScrollRefresher } from "@/components/scroll-refresher";
import { Analytics } from "@/components/analytics";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  // The public pages are white-only. A stored "dark" from the old default
  // would otherwise win, so force light everywhere but the admin console.
  const pathname = usePathname();
  const forcedTheme = pathname?.startsWith("/admin") ? undefined : "light";

  return (
    <ConvexAuthNextjsProvider client={convex}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        forcedTheme={forcedTheme}
      >
        {children}
        <Analytics />
        <ScrollRefresher />
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </ConvexAuthNextjsProvider>
  );
}
