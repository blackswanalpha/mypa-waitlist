"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      toast.success("Campaign link copied.");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campaign link builder</CardTitle>
        <CardDescription>
          Tag every link you post — signups report back under its source below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="utm-url">Landing URL</Label>
          <Input
            id="utm-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {UTM_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key}>
                {f.label}
                {"required" in f && f.required ? (
                  ""
                ) : (
                  <span className="text-muted-foreground"> (optional)</span>
                )}
              </Label>
              <Input
                id={f.key}
                value={params[f.key] ?? ""}
                onChange={(e) =>
                  setParams((p) => ({ ...p, [f.key]: e.target.value }))
                }
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={built ?? "Enter a valid landing URL above"}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
            aria-label="Generated campaign URL"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copy}
            disabled={!built}
            aria-label="Copy campaign URL"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Signups by source</CardTitle>
        <CardDescription>
          Last 90 days. First-touch attribution — a signup credits the utm_source
          that first brought the visitor; &ldquo;(direct)&rdquo; means no tag was
          seen. Sessions count tagged arrivals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows === undefined ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No attributed signups yet — share a tagged link to start measuring.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Signups</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.source}>
                  <TableCell className="font-medium">{r.source}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.sessions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.signups.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.sessions > 0
                      ? `${((r.signups / r.sessions) * 100).toFixed(1)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function AcquisitionTab() {
  return (
    <div className="space-y-4 p-4">
      <UtmBuilder />
      <CampaignTable />
    </div>
  );
}
