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
  // The public pages are white-only, so force light everywhere but the admin
  // console, which opens light and carries its own dark toggle.
  const pathname = usePathname();
  const forcedTheme = pathname?.startsWith("/admin") ? undefined : "light";

  return (
    <ConvexAuthNextjsProvider client={convex}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
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
