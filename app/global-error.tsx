"use client";

import { useEffect } from "react";
import { DM_Sans } from "next/font/google";
import { Header } from "@/components/header";
import { ErrorState } from "@/components/status-page";
import "./globals.css";

// This page replaces the root layout, so it brings its own document, styles
// and face.
const dmSans = DM_Sans({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
});

/** The root layout itself threw. */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className={`${dmSans.variable} bg-background font-display antialiased`}>
        <title>Something went wrong — MyPA</title>
        <div className="flex min-h-svh flex-col">
          <Header />
          <main className="flex flex-1 items-center">
            {/* The root layout failed, so nothing below it can be re-rendered in place. */}
            <ErrorState digest={error.digest} onRetry={() => window.location.reload()} />
          </main>
        </div>
      </body>
    </html>
  );
}
