"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Eye, MousePointerClick, UserPlus, Percent } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RankList,
  SignupsChart,
  TrafficChart,
} from "@/components/admin/charts";
import { SeoHealthCard } from "@/components/admin/seo-health-card";

const RANGES = [7, 30, 90] as const;

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | undefined;
}) {
  return (
    <Card className="gap-3 py-5">
      <div className="flex items-center justify-between px-6">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="px-6">
        {value === undefined ? (
          <span className="my-1 block h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <span className="text-3xl font-light tabular-nums tracking-tight text-foreground">
            {value}
          </span>
        )}
      </div>
    </Card>
  );
}

function prettyPath(path: string): string {
  return path === "/" ? "/ (home)" : path;
}

const DEVICE_LABEL: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
};

export function AnalyticsTab() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);

  const series = useQuery(api.analytics.series, { days });
  const topPaths = useQuery(api.analytics.top, { dimension: "path", days, limit: 8 });
  const topRefs = useQuery(api.analytics.top, { dimension: "ref", days, limit: 8 });
  const devices = useQuery(api.analytics.top, { dimension: "device", days });

  const totals = series?.reduce(
    (acc, d) => ({
      views: acc.views + d.views,
      sessions: acc.sessions + d.sessions,
      signups: acc.signups + d.signups,
    }),
    { views: 0, sessions: 0, signups: 0 },
  );
  const conversion =
    totals === undefined
      ? undefined
      : totals.sessions === 0
        ? "—"
        : `${((totals.signups / totals.sessions) * 100).toFixed(1)}%`;

  return (
    <div className="space-y-4 p-4">
      {/* One filter row scoping everything below it. */}
      <div className="flex items-center gap-1.5">
        {RANGES.map((r) => (
          <Button
            key={r}
            variant={days === r ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDays(r)}
          >
            Last {r} days
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Eye}
          label="Views"
          value={totals?.views.toLocaleString()}
        />
        <MetricCard
          icon={MousePointerClick}
          label="Sessions"
          value={totals?.sessions.toLocaleString()}
        />
        <MetricCard
          icon={UserPlus}
          label="Signups"
          value={totals?.signups.toLocaleString()}
        />
        <MetricCard icon={Percent} label="Session → signup" value={conversion} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Traffic</CardTitle>
        </CardHeader>
        <CardContent>
          {series === undefined ? (
            <div className="h-[200px] animate-pulse rounded-md bg-muted/40" />
          ) : (
            <TrafficChart data={series} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signups per day</CardTitle>
        </CardHeader>
        <CardContent>
          {series === undefined ? (
            <div className="h-[140px] animate-pulse rounded-md bg-muted/40" />
          ) : (
            <SignupsChart data={series} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top pages</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList
              items={topPaths ?? []}
              emptyLabel={topPaths === undefined ? "Loading…" : "No page views yet."}
              formatLabel={prettyPath}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top referrers</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList
              items={topRefs ?? []}
              emptyLabel={
                topRefs === undefined
                  ? "Loading…"
                  : "No external referrers yet — direct traffic only."
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList
              items={devices ?? []}
              emptyLabel={devices === undefined ? "Loading…" : "No data yet."}
              formatLabel={(v) => DEVICE_LABEL[v] ?? v}
            />
          </CardContent>
        </Card>
        <SeoHealthCard />
      </div>
    </div>
  );
}
