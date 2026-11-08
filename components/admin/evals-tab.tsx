"use client";

import { useMemo, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  BeakerIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FingerPrintIcon,
  PlayIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Metric, Panel, PanelHeader, Segmented, SkeletonRows, StatusPill, fmtDateTime, type Tone } from "@/components/admin/kit";
import { EvalTrendChart } from "@/components/admin/charts";
import { LiveDataTable } from "@/components/admin/live-data-table";
import { useLiveTable } from "@/components/admin/use-live-table";
import { hasOptOutSignal, isDeviceId, readDeviceCookie } from "@/lib/device-cookie";
import { cn } from "@/lib/utils";

/**
 * Evals: the tracking-quality checks in convex/evals.ts. A run grades eight
 * checks over a window and is kept, so this view shows the selected run's
 * verdict, how runs have moved, and every run before it. The daily cron
 * covers the last 7 days; "Run checks" covers whichever window is picked.
 */

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

type Run = Doc<"evalRuns">;
type Status = Run["checks"][number]["status"];

const STATUS: Record<Status, { tone: Tone; label: string }> = {
  pass: { tone: "brand", label: "Pass" },
  warn: { tone: "warn", label: "Warn" },
  fail: { tone: "danger", label: "Fail" },
  info: { tone: "info", label: "Info" },
  skip: { tone: "neutral", label: "No data" },
};

function trigger(run: Run): string {
  return run.trigger === "cron" ? "Daily" : run.by ? `By ${run.by.split("@")[0]}` : "Manual";
}

function Verdict({ run }: { run: Run }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusPill tone="brand">{run.passed} pass</StatusPill>
      {run.warned > 0 && <StatusPill tone="warn">{run.warned} warn</StatusPill>}
      {run.failed > 0 && <StatusPill tone="danger">{run.failed} fail</StatusPill>}
    </span>
  );
}

function ChecksPanel({ run, isLatest }: { run: Run; isLatest: boolean }) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        icon={BeakerIcon}
        title="Checks"
        description={`${isLatest ? "Latest run" : "Selected run"}: ${fmtDateTime(run.createdAt)} · ${trigger(run)} · last ${run.days} days`}
        actions={<Verdict run={run} />}
      />
      <ul className="mt-4 divide-y divide-border border-t border-border">
        {run.checks.map((c) => (
          <li key={c.key} className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</StatusPill>
                <p className="font-medium text-foreground">{c.label}</p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
            </div>
            <div className="sm:text-right">
              <p
                className={cn(
                  "font-heading text-xl font-semibold tabular-nums tracking-[-0.02em]",
                  c.status === "fail" ? "text-destructive" : c.status === "warn" ? "text-warn" : "text-foreground",
                )}
              >
                {c.value}
              </p>
              <p className="text-xs text-muted-foreground">Target {c.target}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

type Probe = { cookies: boolean; id?: string; valid: boolean; optout: boolean };

function readProbe(): Probe | null {
  if (typeof window === "undefined") return null;
  const id = readDeviceCookie();
  return { cookies: navigator.cookieEnabled, id, valid: isDeviceId(id), optout: hasOptOutSignal() };
}

/**
 * What the device cookie looks like in the browser reading this page. The
 * dashboard only mounts on the client, so the first render can read it.
 */
function BrowserProbe() {
  const [probe] = useState(readProbe);

  const rows: { label: string; ok: boolean; value: string }[] = probe
    ? [
        { label: "Cookies enabled", ok: probe.cookies, value: probe.cookies ? "Yes" : "No" },
        {
          label: "Device cookie",
          ok: probe.valid,
          value: probe.id ? (probe.valid ? probe.id.slice(0, 8) : "Malformed") : "None yet",
        },
        { label: "Opt-out signal", ok: !probe.optout, value: probe.optout ? "Sent, not tracked" : "None" },
      ]
    : [];

  return (
    <Panel className="pb-5">
      <PanelHeader
        icon={FingerPrintIcon}
        title="This browser"
        description="The device cookie as this browser holds it. Admin pages never set one; visit the landing page once to get it."
      />
      <div className="mt-4 space-y-2.5 px-5">
        {probe === null ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : (
          rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                {r.ok ? <CheckCircleIcon className="size-4 text-brand-ink" /> : <ExclamationTriangleIcon className="size-4 text-warn" />}
                {r.label}
              </span>
              <span className="font-mono text-xs text-foreground">{r.value}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

export function EvalsTab() {
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("7");
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"evalRuns"> | null>(null);
  const run = useMutation(api.evals.run);
  const latest = useQuery(api.evals.latest);
  const trend = useQuery(api.evals.trend, { limit: 30 });
  const { results, status, loadMore } = usePaginatedQuery(api.evals.history, {}, { initialNumItems: 10 });

  const selected = useMemo(
    () => (selectedId ? results.find((r) => r._id === selectedId) : undefined) ?? latest ?? undefined,
    [selectedId, results, latest],
  );

  const columns = useMemo<ColumnDef<Run>[]>(
    () => [
      { id: "at", header: "Run at", cell: ({ row }) => <span className="whitespace-nowrap text-foreground">{fmtDateTime(row.original.createdAt)}</span> },
      { id: "trigger", header: "Trigger", cell: ({ row }) => <span className="text-muted-foreground">{trigger(row.original)}</span> },
      { id: "window", header: "Window", cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.days} days</span> },
      { id: "result", header: "Result", cell: ({ row }) => <Verdict run={row.original} /> },
      {
        id: "sample",
        header: "Views checked",
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.sample.toLocaleString()}
            {row.original.sampled && <span className="ml-1 text-xs text-muted-foreground">sampled</span>}
          </span>
        ),
      },
      {
        id: "open",
        header: "",
        meta: { className: "text-right" },
        cell: ({ row }) => {
          const on = selected?._id === row.original._id;
          return (
            <Button variant={on ? "secondary" : "ghost"} size="sm" onClick={() => setSelectedId(row.original._id)} aria-pressed={on}>
              {on ? "Showing" : "View"}
            </Button>
          );
        },
      },
    ],
    [selected?._id],
  );
  const t = useLiveTable({ tableKey: "evals", data: results, status, loadMore, columns });

  const runNow = async () => {
    setRunning(true);
    try {
      await run({ days: Number(range) });
      setSelectedId(null);
      toast.success("Checks ran.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't run the checks.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Window to check" value={range} onChange={setRange} items={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
        <Button onClick={runNow} disabled={running}>
          <PlayIcon className="size-4" />
          {running ? "Running…" : "Run checks"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CheckCircleIcon} label="Passing" value={latest === undefined ? undefined : (selected?.passed ?? 0).toLocaleString()} />
        <Metric icon={ExclamationTriangleIcon} label="Warnings" value={latest === undefined ? undefined : (selected?.warned ?? 0).toLocaleString()} />
        <Metric icon={XCircleIcon} label="Failing" value={latest === undefined ? undefined : (selected?.failed ?? 0).toLocaleString()} />
        <Metric
          icon={ClockIcon}
          label="Views checked"
          value={latest === undefined ? undefined : (selected?.sample ?? 0).toLocaleString()}
          hint={selected?.sampled ? "most recent" : undefined}
        />
      </div>

      {latest === undefined ? (
        <Panel>
          <SkeletonRows rows={5} />
        </Panel>
      ) : selected === undefined ? (
        <Panel>
          <EmptyState icon={BeakerIcon} title="No runs yet" body="Run the checks for a first verdict. After that they run every day at 03:41 UTC." />
        </Panel>
      ) : (
        <ChecksPanel run={selected} isLatest={selected._id === latest?._id} />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel className="pb-5">
          <PanelHeader title="Trend" description="Checks passed, warned and failed in each of the last 30 runs." />
          <div className="mt-5 px-5">
            {trend === undefined ? (
              <Skeleton className="h-[208px] rounded-xl" />
            ) : trend.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              <EvalTrendChart data={trend} />
            )}
          </div>
        </Panel>
        <BrowserProbe />
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader icon={ClockIcon} title="Run history" description="Every run, newest first. View one to see its checks above." />
        <div className="mt-4 border-t border-border">
          {t.isFirstLoad ? (
            <SkeletonRows rows={4} />
          ) : t.isEmpty ? (
            <EmptyState icon={ClockIcon} title="No runs yet" body="Runs land here as the cron or you start them." />
          ) : (
            <LiveDataTable table={t.table} isPageLoading={t.isPageLoading} />
          )}
        </div>
      </Panel>
    </div>
  );
}
