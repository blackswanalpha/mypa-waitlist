"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

type TipProps = TooltipContentProps<ValueType, NameType>;

/**
 * Admin charts on Recharts. Series colours are tokens (globals.css,
 * `--viz-*`) chosen with the dataviz validator: views/sessions are the
 * validated blue/orange pair in both themes; signups is a single series in
 * the brand lime (lime-700 on light for contrast). Text always wears ink
 * tokens; a coloured key beside it carries identity.
 */

export type SeriesPoint = {
  day: string; // "YYYY-MM-DD"
  views: number;
  sessions: number;
  signups: number;
};

const VIEWS = "var(--viz-views)";
const SESSIONS = "var(--viz-sessions)";
const SIGNUPS = "var(--viz-signups)";

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Charts draw in once unless the reader asked for less motion. */
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

function fmtDay(day: string, long = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: long ? "short" : undefined,
    timeZone: "UTC",
  });
}

function Key({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
      {value !== undefined && <span className="font-medium tabular-nums text-foreground">{value.toLocaleString()}</span>}
    </span>
  );
}

type Row = { name: string; color: string; value: number };

function TooltipCard({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="min-w-36 rounded-xl border border-border bg-popover px-3 py-2.5 text-xs shadow-float">
      <p className="font-medium text-foreground">{title}</p>
      <div className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <p key={r.name} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
              {r.name}
            </span>
            <span className="font-semibold tabular-nums text-foreground">{r.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** Collapsible raw-data table so nothing is gated behind hover. */
function SeriesTable({ data }: { data: SeriesPoint[] }) {
  return (
    <details className="group mt-4">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <span className="transition-transform group-open:rotate-90">›</span> View data as table
      </summary>
      <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-3 py-2 text-right font-medium">Views</th>
              <th className="px-3 py-2 text-right font-medium">Sessions</th>
              <th className="px-3 py-2 text-right font-medium">Signups</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-border">
                <td className="px-3 py-1.5">{fmtDay(d.day)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{d.views}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{d.sessions}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{d.signups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Views and sessions per day: two lines on one axis, a soft wash under each, crosshair + tooltip. */
export function TrafficChart({ data }: { data: SeriesPoint[] }) {
  const id = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const totals = useMemo(
    () => data.reduce((a, d) => ({ views: a.views + d.views, sessions: a.sessions + d.sessions }), { views: 0, sessions: 0 }),
    [data],
  );

  const renderTooltip = ({ active, payload, label }: TipProps) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as SeriesPoint;
    return (
      <TooltipCard
        title={fmtDay(String(label), true)}
        rows={[
          { name: "Views", color: VIEWS, value: p.views },
          { name: "Sessions", color: SESSIONS, value: p.sessions },
        ]}
      />
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Key color={VIEWS} label="Views" value={totals.views} />
        <Key color={SESSIONS} label="Sessions" value={totals.sessions} />
      </div>
      <div className="mt-4 h-[240px]" role="img" aria-label="Daily views and sessions">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id={`${id}-views`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VIEWS} stopOpacity={0.22} />
                <stop offset="100%" stopColor={VIEWS} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`${id}-sessions`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SESSIONS} stopOpacity={0.16} />
                <stop offset="100%" stopColor={SESSIONS} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => fmtDay(d)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tickMargin={10}
            />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4, strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="views"
              name="Views"
              stroke={VIEWS}
              strokeWidth={2}
              fill={`url(#${id}-views)`}
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={!reduced}
              animationDuration={900}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke={SESSIONS}
              strokeWidth={2}
              fill={`url(#${id}-sessions)`}
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={!reduced}
              animationDuration={900}
              animationBegin={120}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <SeriesTable data={data} />
    </div>
  );
}

/** Signups per day as columns, the peak day labelled. */
export function SignupsChart({ data }: { data: SeriesPoint[] }) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const peak = useMemo(() => data.reduce((best, d, i) => (d.signups > (data[best]?.signups ?? 0) ? i : best), 0), [data]);
  const hasAny = data.some((d) => d.signups > 0);

  const renderTooltip = ({ active, payload, label }: TipProps) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as SeriesPoint;
    return <TooltipCard title={fmtDay(String(label), true)} rows={[{ name: "Signups", color: SIGNUPS, value: p.signups }]} />;
  };

  return (
    <div className="h-[180px]" role="img" aria-label="Daily signups">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 18, right: 8, bottom: 0, left: -12 }}
          barCategoryGap="22%"
          onMouseMove={(s) => setHover(typeof s.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)}
          onMouseLeave={() => setHover(null)}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="day" tickFormatter={(d: string) => fmtDay(d)} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={28} tickMargin={10} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={renderTooltip} cursor={{ fill: "var(--accent)", opacity: 0.5 }} isAnimationActive={false} />
          <Bar
            dataKey="signups"
            name="Signups"
            fill={SIGNUPS}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            isAnimationActive={!reduced}
            animationDuration={700}
            animationEasing="ease-out"
          >
            {data.map((d, i) => (
              <Cell key={d.day} fillOpacity={hover === null || hover === i ? 1 : 0.45} />
            ))}
            {hasAny && (
              <LabelList
                dataKey="signups"
                position="top"
                content={(props) => {
                  const { x, y, width, index, value } = props as { x: number; y: number; width: number; index: number; value: number };
                  if (index !== peak || hover !== null || !value) return null;
                  return (
                    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)" className="tabular-nums">
                      {value.toLocaleString()}
                    </text>
                  );
                }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A tiny trend line for a metric tile; decoration for the number above it, so no axes or tooltip. */
export function Sparkline({ data, dataKey, color }: { data: SeriesPoint[]; dataKey: keyof Omit<SeriesPoint, "day">; color: string }) {
  const id = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  return (
    <div className="h-10" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`${id}-spark`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id}-spark)`}
            dot={false}
            isAnimationActive={!reduced}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export const SERIES_COLOR = { views: VIEWS, sessions: SESSIONS, signups: SIGNUPS } as const;

/** Ranked horizontal bars: one hue, value at the row end, bars grow in once. */
export function RankList({
  items,
  emptyLabel,
  formatLabel,
}: {
  items: { value: string; count: number }[];
  emptyLabel: string;
  formatLabel?: (value: string) => string;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.count));
  const total = items.reduce((a, i) => a + i.count, 0);
  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const label = formatLabel ? formatLabel(item.value) : item.value;
        return (
          <li key={item.value}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-foreground" title={label}>
                {label}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-foreground">
                {item.count.toLocaleString()}
                <span className="ml-1.5 text-xs text-muted-foreground">{Math.round((item.count / total) * 100)}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border/70">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out-quint motion-reduce:transition-none"
                style={{
                  width: grown ? `${(item.count / max) * 100}%` : "0%",
                  backgroundColor: VIEWS,
                  transitionDelay: `${i * 40}ms`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
