"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon, ArrowUpRightIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/16/solid";
import { MagnifyingGlassCircleIcon } from "@heroicons/react/24/outline";
import { Panel, PanelHeader, StatusPill } from "@/components/admin/kit";

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

  const passed = CHECKS.filter((c) => results[c.path] === "pass").length;
  const done = CHECKS.every((c) => results[c.path] && results[c.path] !== "pending");

  return (
    <Panel className="pb-5">
      <PanelHeader
        icon={MagnifyingGlassCircleIcon}
        title="SEO health"
        actions={
          done ? (
            <StatusPill tone={passed === CHECKS.length ? "brand" : "warn"}>
              {passed} of {CHECKS.length} passing
            </StatusPill>
          ) : undefined
        }
      />
      <ul className="mt-5 space-y-2.5 px-5">
        {CHECKS.map((check) => {
          const state: CheckResult = results[check.path] ?? "pending";
          return (
            <li key={check.path} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{check.label}</span>
              {state === "pending" && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowPathIcon className="size-4 animate-spin" />
                  Checking
                </span>
              )}
              {state === "pass" && (
                <span className="flex items-center gap-1.5 text-brand-ink">
                  <CheckCircleIcon className="size-4" />
                  OK
                </span>
              )}
              {state === "fail" && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <XCircleIcon className="size-4" />
                  Missing
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mx-5 mt-5 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">Validate share previews and structured data:</p>
        <ul className="mt-2 space-y-1.5">
          {TOOLS.map((tool) => (
            <li key={tool.href}>
              <a
                href={tool.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 text-sm text-foreground underline-offset-4 hover:underline"
              >
                {tool.label}
                <ArrowUpRightIcon className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
