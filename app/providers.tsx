"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ScrollRefresher } from "@/components/scroll-refresher";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        {children}
        <ScrollRefresher />
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </ConvexAuthNextjsProvider>
  );
}
