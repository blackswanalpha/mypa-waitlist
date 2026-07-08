"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CheckResult = "pending" | "pass" | "fail";

const CHECKS: { label: string; path: string }[] = [
  { label: "Sitemap (/sitemap.xml)", path: "/sitemap.xml" },
  { label: "Robots rules (/robots.txt)", path: "/robots.txt" },
  { label: "Social share image (/og.png)", path: "/og.png" },
  { label: "Web app manifest", path: "/favicon/site.webmanifest" },
];

const TOOLS = [
  {
    label: "Google Rich Results test",
    href: "https://search.google.com/test/rich-results",
  },
  {
    label: "Facebook Sharing Debugger",
    href: "https://developers.facebook.com/tools/debug/",
  },
  {
    label: "LinkedIn Post Inspector",
    href: "https://www.linkedin.com/post-inspector/",
  },
];

/**
 * Live pass/fail sweep over the SEO surface — same-origin fetches only, so it
 * reports on whatever deployment the admin is looking at.
 */
export function SeoHealthCard() {
  const [results, setResults] = useState<Record<string, CheckResult>>({});

  useEffect(() => {
    let cancelled = false;
    for (const check of CHECKS) {
      fetch(check.path, { method: "GET", cache: "no-store" })
        .then((res) => {
          if (!cancelled) {
            setResults((r) => ({ ...r, [check.path]: res.ok ? "pass" : "fail" }));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults((r) => ({ ...r, [check.path]: "fail" }));
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SEO health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {CHECKS.map((check) => {
            const state: CheckResult = results[check.path] ?? "pending";
            return (
              <li
                key={check.path}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-foreground">{check.label}</span>
                {state === "pending" && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking
                  </span>
                )}
                {state === "pass" && (
                  <span className="flex items-center gap-1.5 text-fern">
                    <CheckCircle2 className="h-4 w-4" />
                    OK
                  </span>
                )}
                {state === "fail" && (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <XCircle className="h-4 w-4" />
                    Missing
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border/50 pt-3">
          <p className="text-xs text-muted-foreground">
            Validate share previews &amp; structured data:
          </p>
          <ul className="mt-2 space-y-1.5">
            {TOOLS.map((tool) => (
              <li key={tool.href}>
                <a
                  href={tool.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                >
                  {tool.label}
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
