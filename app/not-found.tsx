import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HomeLink, StatusPage } from "@/components/status-page";

export const metadata: Metadata = {
  title: "Page not found — MyPA",
};

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col bg-background font-display selection:bg-slate-200">
      <Header />
      <main className="flex flex-1 items-center">
        <StatusPage eyebrow="404" title="This page isn’t here" mood="unsure" actions={<HomeLink />}>
          The link may be old, or the address mistyped. The waitlist is one click away.
        </StatusPage>
      </main>
      <Footer />
    </div>
  );
}
