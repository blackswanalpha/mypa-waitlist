"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowPathRoundedSquareIcon,
  CheckBadgeIcon,
  ComputerDesktopIcon,
  FingerPrintIcon,
  SparklesIcon,
  Square3Stack3DIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Metric, Panel, PanelHeader, SkeletonRows, StatusPill, fmtDateTime } from "@/components/admin/kit";
import { DevicesChart, SERIES_COLOR, Sparkline, type SeriesPoint } from "@/components/admin/charts";
import { LiveDataTable } from "@/components/admin/live-data-table";
import { useLiveTable } from "@/components/admin/use-live-table";

/**
 * Distinct devices: each browser that accepted the cookie card holds one
 * random id in the device cookie (lib/device-cookie.ts), so these figures
 * count those browsers, not views, sessions or people. Visitors who decline
 * or never choose still count as views.
 */
export function DeviceMetrics({ days, series }: { days: number; series: SeriesPoint[] | undefined }) {
  const stats = useQuery(api.analytics.deviceStats, { days });
  const identified = series?.reduce((a, d) => a + d.identifiedViews, 0);
  const perDevice =
    stats === undefined || identified === undefined ? undefined : stats.unique === 0 ? "—" : (identified / stats.unique).toFixed(1);
  const plus = stats?.capped ? "+" : "";
  const spark = (key: "devices" | "newDevices") =>
    series ? <Sparkline data={series} dataKey={key} color={SERIES_COLOR[key]} /> : <Skeleton className="h-10" />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={FingerPrintIcon} label="Unique devices" value={stats && `${stats.unique.toLocaleString()}${plus}`} footer={spark("devices")} />
      <Metric icon={SparklesIcon} label="New devices" value={stats?.fresh.toLocaleString()} hint={stats ? "first seen" : undefined} footer={spark("newDevices")} />
      <Metric
        icon={ArrowPathRoundedSquareIcon}
        label="Returning devices"
        value={stats?.returning.toLocaleString()}
        hint={stats && stats.unique > 0 ? `${Math.round((stats.returning / stats.unique) * 100)}%` : undefined}
        footer={<p className="flex h-10 items-end text-xs text-muted-foreground">Came back on another day.</p>}
      />
      <Metric
        icon={Square3Stack3DIcon}
        label="Views per device"
        value={perDevice}
        footer={
          <p className="flex h-10 items-end text-xs text-muted-foreground">
            {stats === undefined ? "" : `${stats.signedUp.toLocaleString()} device${stats.signedUp === 1 ? "" : "s"} signed up.`}
          </p>
        }
      />
    </div>
  );
}

export function DevicesChartPanel({ series }: { series: SeriesPoint[] | undefined }) {
  return (
    <Panel className="pb-5">
      <PanelHeader
        title="Devices per day"
        description="Distinct browsers that accepted the cookie and viewed the site each day. New is a first visit; returning has been here on an earlier day."
      />
      <div className="mt-5 px-5">{series === undefined ? <Skeleton className="h-[248px] rounded-xl" /> : <DevicesChart data={series} />}</div>
    </Panel>
  );
}

type DeviceRow = Doc<"devices">;

function source(d: DeviceRow): string {
  if (d.firstUtm) return `utm: ${d.firstUtm}`;
  if (d.firstReferrer) return d.firstReferrer;
  return "Direct";
}

const COLUMNS: ColumnDef<DeviceRow>[] = [
  {
    id: "device",
    header: "Device",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-mono text-xs text-foreground" title={row.original.deviceId}>
          {row.original.deviceId.slice(0, 8)}
        </p>
        <p className="text-xs capitalize text-muted-foreground">{row.original.deviceClass}</p>
      </div>
    ),
  },
  { id: "firstSeen", header: "First seen", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{fmtDateTime(row.original.firstSeen)}</span> },
  { id: "lastSeen", header: "Last seen", cell: ({ row }) => <span className="whitespace-nowrap text-foreground">{fmtDateTime(row.original.lastSeen)}</span> },
  {
    id: "daysSeen",
    header: "Days",
    meta: { className: "text-right" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.daysSeen.toLocaleString()}</span>,
  },
  {
    id: "views",
    header: "Views",
    meta: { className: "text-right" },
    cell: ({ row }) => <span className="font-heading font-semibold tabular-nums">{row.original.views.toLocaleString()}</span>,
  },
  {
    id: "sessions",
    header: "Visits",
    meta: { className: "text-right" },
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.sessions.toLocaleString()}</span>,
  },
  {
    id: "signups",
    header: "Signed up",
    cell: ({ row }) => {
      const n = row.original.signups ?? 0;
      if (n === 0) return <span className="text-muted-foreground">—</span>;
      return <StatusPill tone={n > 1 ? "warn" : "brand"}>{n > 1 ? `${n} emails` : "Yes"}</StatusPill>;
    },
  },
  { id: "source", header: "Came from", cell: ({ row }) => <span className="block max-w-48 truncate text-muted-foreground">{source(row.original)}</span> },
];

export function DevicesTable() {
  const total = useQuery(api.analytics.deviceTotal);
  const { results, status, loadMore } = usePaginatedQuery(api.analytics.devices, {}, { initialNumItems: 10 });
  const t = useLiveTable({ tableKey: "devices", data: results, status, loadMore, columns: COLUMNS, total });

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        icon={ComputerDesktopIcon}
        title="Devices"
        description="Every browser that accepted the cookie, most recent first. The id is the first 8 characters of its device cookie."
      />
      <div className="mt-4 border-t border-border">
        {t.isFirstLoad ? (
          <SkeletonRows rows={4} />
        ) : t.isEmpty ? (
          <EmptyState icon={ComputerDesktopIcon} title="No devices yet" body="A device appears after its first page view with the device cookie." />
        ) : (
          <LiveDataTable table={t.table} isPageLoading={t.isPageLoading} />
        )}
      </div>
    </Panel>
  );
}

type ConsentRow = Doc<"consents">;

const CONSENT_COLUMNS: ColumnDef<ConsentRow>[] = [
  { id: "ts", header: "When", cell: ({ row }) => <span className="whitespace-nowrap text-foreground">{fmtDateTime(row.original.ts)}</span> },
  {
    id: "choice",
    header: "Choice",
    cell: ({ row }) =>
      row.original.choice === "granted" ? <StatusPill tone="brand">Accepted</StatusPill> : <StatusPill tone="neutral">Declined</StatusPill>,
  },
  {
    id: "device",
    header: "Device",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground" title={row.original.deviceId}>
        {row.original.deviceId?.slice(0, 8) ?? "—"}
      </span>
    ),
  },
  {
    id: "views",
    header: "Views settled",
    meta: { className: "text-right" },
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.viewsUpdated.toLocaleString()}</span>,
  },
  { id: "version", header: "Version", meta: { className: "text-right" }, cell: ({ row }) => <span className="tabular-nums text-muted-foreground">v{row.original.version}</span> },
];

/** Accept and Decline from the cookie card over the window, and the log behind them. */
export function ConsentPanel({ series }: { series: SeriesPoint[] | undefined }) {
  const { results, status, loadMore } = usePaginatedQuery(api.analytics.consents, {}, { initialNumItems: 10 });
  const t = useLiveTable({ tableKey: "consents", data: results, status, loadMore, columns: CONSENT_COLUMNS });
  const totals = series?.reduce((a, d) => ({ yes: a.yes + d.consentGranted, no: a.no + d.consentDenied }), { yes: 0, no: 0 });
  const rate = totals === undefined ? undefined : totals.yes + totals.no === 0 ? "—" : `${Math.round((totals.yes / (totals.yes + totals.no)) * 100)}%`;
  const figures = [
    { label: "Accepted", value: totals?.yes.toLocaleString() },
    { label: "Declined", value: totals?.no.toLocaleString() },
    { label: "Acceptance", value: rate },
  ];

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        icon={CheckBadgeIcon}
        title="Cookie consent"
        description="Choices made on the cookie card in this window, and every choice logged. A device is only counted after Accept."
      />
      <dl className="mt-5 grid grid-cols-3 gap-4 px-5">
        {figures.map((f) => (
          <div key={f.label}>
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd className="mt-1.5 font-heading text-2xl font-semibold tabular-nums tracking-[-0.02em] text-foreground">
              {f.value === undefined ? <Skeleton className="h-7 w-14" /> : f.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t border-border">
        {t.isFirstLoad ? (
          <SkeletonRows rows={3} />
        ) : t.isEmpty ? (
          <EmptyState icon={CheckBadgeIcon} title="No choices yet" body="Each Accept or Decline on the cookie card is logged here." />
        ) : (
          <LiveDataTable table={t.table} isPageLoading={t.isPageLoading} />
        )}
      </div>
    </Panel>
  );
}
