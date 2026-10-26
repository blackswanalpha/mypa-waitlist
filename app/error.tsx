"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ErrorState } from "@/components/status-page";

/** Any page or nested layout that throws lands here, inside the root layout. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  // reset() alone re-renders what the client already has; a server error
  // needs the segment fetched again first.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <div className="flex min-h-svh flex-col bg-background font-display selection:bg-slate-200">
      <title>Something went wrong — MyPA</title>
      <Header />
      <main className="flex flex-1 items-center">
        <ErrorState digest={error.digest} onRetry={retry} />
      </main>
      <Footer />
    </div>
  );
}
