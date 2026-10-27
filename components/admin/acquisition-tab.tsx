"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { CheckIcon, ClipboardDocumentIcon } from "@heroicons/react/16/solid";
import { LinkIcon, PresentationChartLineIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, Panel, PanelHeader, SkeletonRows } from "@/components/admin/kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

const UTM_FIELDS = [
  { key: "utm_source", label: "Source", placeholder: "twitter", required: true },
  { key: "utm_medium", label: "Medium", placeholder: "social" },
  { key: "utm_campaign", label: "Campaign", placeholder: "launch-week" },
  { key: "utm_term", label: "Term", placeholder: "(paid keywords)" },
  { key: "utm_content", label: "Content", placeholder: "(ad variant)" },
] as const;

function UtmBuilder() {
  const [url, setUrl] = useState(SITE_URL || "https://");
  const [params, setParams] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const built = useMemo(() => {
    try {
      const u = new URL(url);
      for (const f of UTM_FIELDS) {
        const value = params[f.key]?.trim();
        if (value) u.searchParams.set(f.key, value);
      }
      return u.toString();
    } catch {
      return null;
    }
  }, [url, params]);

  const copy = async () => {
    if (!built) return;
    try {
      await navigator.clipboard.writeText(built);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.success("Campaign link copied.");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  const ready = Boolean(built && params.utm_source?.trim());

  return (
    <Panel className="pb-5">
      <PanelHeader icon={LinkIcon} title="Campaign link builder" description="Tag every link you post. Signups report back under its source below." />
      <div className="mt-5 space-y-4 px-5">
        <div className="space-y-2">
          <Label htmlFor="utm-url">Landing URL</Label>
          <Input id="utm-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {UTM_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key}>
                {f.label}
                {"required" in f && f.required ? "" : <span className="font-normal text-muted-foreground"> (optional)</span>}
              </Label>
              <Input
                id={f.key}
                value={params[f.key] ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-1.5 pl-3">
          <input
            readOnly
            value={built ?? "Enter a valid landing URL above"}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none"
            aria-label="Generated campaign URL"
          />
          <Button type="button" variant={ready ? "brand" : "outline"} size="sm" onClick={copy} disabled={!built} aria-label="Copy campaign URL">
            {copied ? <CheckIcon /> : <ClipboardDocumentIcon />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {!params.utm_source?.trim() && <p className="text-xs text-muted-foreground">Add a source so the signups it brings are credited to it.</p>}
      </div>
    </Panel>
  );
}

function CampaignTable() {
  // 90-day window: campaign performance is judged over the long tail.
  const signupsBySource = useQuery(api.analytics.top, {
    dimension: "signup_utm",
    days: 90,
    limit: 50,
  });
  const sessionsBySource = useQuery(api.analytics.top, {
    dimension: "utm",
    days: 90,
    limit: 50,
  });

  const rows = useMemo(() => {
    if (signupsBySource === undefined || sessionsBySource === undefined) {
      return undefined;
    }
    const sessions = new Map(sessionsBySource.map((s) => [s.value, s.count]));
    const merged = new Map<string, { sessions: number; signups: number }>();
    for (const s of signupsBySource) {
      merged.set(s.value, {
        signups: s.count,
        sessions: sessions.get(s.value) ?? 0,
      });
    }
    for (const [source, count] of sessions) {
      if (!merged.has(source)) merged.set(source, { sessions: count, signups: 0 });
    }
    return [...merged.entries()]
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.signups - a.signups || b.sessions - a.sessions);
  }, [signupsBySource, sessionsBySource]);

  const best = rows?.find((r) => r.sessions > 0 && r.signups > 0 && r.source !== "(direct)");

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        icon={PresentationChartLineIcon}
        title="Signups by source"
        description="Last 90 days. First-touch: a signup credits the utm_source that first brought the visitor. “(direct)” means no tag was seen."
      />
      <div className="mt-4 border-t border-border">
        {rows === undefined ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={LinkIcon} title="No attributed signups yet" body="Share a tagged link from the builder above to start measuring." />
        ) : (
          <Table className="[&_td]:px-3 [&_td]:py-3 [&_th]:h-10 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5">
            <TableHeader className="bg-surface/60">
              <TableRow className="hover:bg-transparent">
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Signups</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.source} className="hover:bg-accent/40">
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {r.source}
                      {best?.source === r.source && (
                        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand-ink ring-1 ring-inset ring-brand/25">Top source</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.sessions.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.signups.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.sessions > 0 ? `${((r.signups / r.sessions) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Panel>
  );
}

export function AcquisitionTab() {
  return (
    <div className="space-y-4">
      <UtmBuilder />
      <CampaignTable />
    </div>
  );
}
