"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import {
  ArrowTrendingUpIcon,
  CursorArrowRaysIcon,
  DocumentTextIcon,
  DeviceTabletIcon,
  EyeIcon,
  GlobeAltIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Metric, Panel, PanelHeader, Segmented } from "@/components/admin/kit";
import { RankList, SERIES_COLOR, SignupsChart, Sparkline, TrafficChart } from "@/components/admin/charts";
import { SeoHealthCard } from "@/components/admin/seo-health-card";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

function prettyPath(path: string): string {
  return path === "/" ? "/ (home)" : path;
}

const DEVICE_LABEL: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
};

export function AnalyticsTab() {
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("30");
  const days = Number(range);

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
  // Signups can arrive without a tracked session (blocked script, direct API
  // posts), so the ratio can pass 100%; that says "untracked", not "great".
  const untracked = totals !== undefined && totals.signups > totals.sessions;
  const conversion =
    totals === undefined
      ? undefined
      : totals.sessions === 0 || untracked
        ? "—"
        : `${((totals.signups / totals.sessions) * 100).toFixed(1)}%`;

  return (
    <div className="space-y-4">
      {/* One filter row scoping everything below it. */}
      <div className="flex items-center justify-between gap-3">
        <Segmented label="Date range" value={range} onChange={setRange} items={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
        <span className="hidden text-xs text-muted-foreground sm:inline">Last {days} days, UTC</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={EyeIcon}
          label="Views"
          value={totals?.views.toLocaleString()}
          footer={series ? <Sparkline data={series} dataKey="views" color={SERIES_COLOR.views} /> : <Skeleton className="h-10" />}
        />
        <Metric
          icon={CursorArrowRaysIcon}
          label="Sessions"
          value={totals?.sessions.toLocaleString()}
          footer={series ? <Sparkline data={series} dataKey="sessions" color={SERIES_COLOR.sessions} /> : <Skeleton className="h-10" />}
        />
        <Metric
          icon={UserPlusIcon}
          label="Signups"
          value={totals?.signups.toLocaleString()}
          footer={series ? <Sparkline data={series} dataKey="signups" color={SERIES_COLOR.signups} /> : <Skeleton className="h-10" />}
        />
        <Metric
          icon={ArrowTrendingUpIcon}
          label="Session → signup"
          value={conversion}
          footer={
            <p className="flex h-10 items-end text-xs text-muted-foreground">
              {totals === undefined
                ? ""
                : untracked
                  ? `${(totals.signups - totals.sessions).toLocaleString()} more signups than tracked sessions.`
                  : totals.sessions > 0
                    ? `${totals.signups.toLocaleString()} of ${totals.sessions.toLocaleString()} sessions signed up.`
                    : "Waiting for the first session."}
            </p>
          }
        />
      </div>

      <Panel className="pb-5">
        <PanelHeader title="Traffic" description="Page views and unique sessions per day." />
        <div className="mt-5 px-5">{series === undefined ? <Skeleton className="h-[272px] rounded-xl" /> : <TrafficChart data={series} />}</div>
      </Panel>

      <Panel className="pb-5">
        <PanelHeader title="Signups per day" description="The peak day is labelled. Hover a column for its count." />
        <div className="mt-5 px-5">{series === undefined ? <Skeleton className="h-[180px] rounded-xl" /> : <SignupsChart data={series} />}</div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="pb-5">
          <PanelHeader icon={DocumentTextIcon} title="Top pages" />
          <div className="mt-5 px-5">
            <RankList items={topPaths ?? []} emptyLabel={topPaths === undefined ? "Loading…" : "No page views yet."} formatLabel={prettyPath} />
          </div>
        </Panel>
        <Panel className="pb-5">
          <PanelHeader icon={GlobeAltIcon} title="Top referrers" />
          <div className="mt-5 px-5">
            <RankList
              items={topRefs ?? []}
              emptyLabel={topRefs === undefined ? "Loading…" : "No external referrers yet. Direct traffic only."}
            />
          </div>
        </Panel>
        <Panel className="pb-5">
          <PanelHeader icon={DeviceTabletIcon} title="Devices" />
          <div className="mt-5 px-5">
            <RankList items={devices ?? []} emptyLabel={devices === undefined ? "Loading…" : "No data yet."} formatLabel={(v) => DEVICE_LABEL[v] ?? v} />
          </div>
        </Panel>
        <SeoHealthCard />
      </div>
    </div>
  );
}
