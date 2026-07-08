"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Hand-rolled chart primitives for the admin analytics tab. Series colors
 * were validated (lightness band, chroma floor, CVD separation, contrast)
 * against both the light and dark card surfaces — don't swap them for raw
 * theme tokens without re-validating (the stock --chart-2 fails the dark
 * lightness band).
 */
const COLOR_VIEWS = "#b05730"; // terracotta (= --chart-1)
const COLOR_SESSIONS = "#8169dd"; // violet, darkened from --chart-2 to pass
const COLOR_SIGNUPS = "#3f842e"; // brand fern

export type SeriesPoint = {
  day: string; // "YYYY-MM-DD"
  views: number;
  sessions: number;
  signups: number;
};

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function fmtDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Clean 0-based axis ticks (1/2/5 × 10ⁿ steps). */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks.length * step);
  return ticks;
}

const PAD = { left: 40, right: 16, top: 10, bottom: 26 };
const TOOLTIP_CLASS =
  "pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md";

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className="inline-block h-0.5 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

/** Collapsible raw-data table so nothing is gated behind hover. */
function SeriesTable({ data }: { data: SeriesPoint[] }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        View data as table
      </summary>
      <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">Day</th>
              <th className="px-3 py-1.5 text-right font-medium">Views</th>
              <th className="px-3 py-1.5 text-right font-medium">Sessions</th>
              <th className="px-3 py-1.5 text-right font-medium">Signups</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-border/50">
                <td className="px-3 py-1">{fmtDay(d.day)}</td>
                <td className="px-3 py-1 text-right tabular-nums">{d.views}</td>
                <td className="px-3 py-1 text-right tabular-nums">
                  {d.sessions}
                </td>
                <td className="px-3 py-1 text-right tabular-nums">
                  {d.signups}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Two-series line chart (views & sessions) with crosshair + tooltip. */
export function TrafficChart({ data }: { data: SeriesPoint[] }) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 200;

  const max = Math.max(1, ...data.map((d) => d.views));
  const ticks = niceTicks(max);
  const yMax = ticks[ticks.length - 1];
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const n = data.length;

  const x = useCallback(
    (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1)),
    [innerW, n],
  );
  const y = useCallback(
    (v: number) => PAD.top + innerH - (v / yMax) * innerH,
    [innerH, yMax],
  );

  const paths = useMemo(() => {
    const line = (key: "views" | "sessions") =>
      data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[key])}`).join("");
    return { views: line("views"), sessions: line("sessions") };
  }, [data, x, y]);

  const indexFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const frac = (px - PAD.left) / Math.max(1, innerW);
    return Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const delta = e.key === "ArrowLeft" ? -1 : 1;
      setHover((h) => Math.max(0, Math.min(n - 1, (h ?? n - 1) + delta)));
    }
    if (e.key === "Escape") setHover(null);
  };

  const hovered = hover !== null ? data[hover] : null;
  // Every step of the x-axis would collide; label ~5 of them.
  const labelEvery = Math.max(1, Math.ceil(n / 5));

  return (
    <div>
      <div className="flex items-center gap-4">
        <LegendKey color={COLOR_VIEWS} label="Views" />
        <LegendKey color={COLOR_SESSIONS} label="Sessions" />
      </div>
      <div ref={ref} className="relative mt-2">
        {width > 0 && n > 0 && (
          <svg
            role="img"
            aria-label="Daily views and sessions"
            width={width}
            height={height}
            tabIndex={0}
            className="block outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onPointerMove={(e) => setHover(indexFromEvent(e))}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  className="stroke-border/60"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(t) + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {t.toLocaleString()}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % labelEvery === 0 ? (
                <text
                  key={d.day}
                  x={x(i)}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {fmtDay(d.day)}
                </text>
              ) : null,
            )}

            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="stroke-muted-foreground/40"
                strokeWidth={1}
              />
            )}

            <path
              d={paths.views}
              fill="none"
              stroke={COLOR_VIEWS}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={paths.sessions}
              fill="none"
              stroke={COLOR_SESSIONS}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* end + hover markers, ringed in the surface color */}
            {([
              ["views", COLOR_VIEWS],
              ["sessions", COLOR_SESSIONS],
            ] as const).map(([key, color]) => {
              const i = hover ?? n - 1;
              return (
                <circle
                  key={key}
                  cx={x(i)}
                  cy={y(data[i][key])}
                  r={4}
                  fill={color}
                  className="stroke-card"
                  strokeWidth={2}
                />
              );
            })}
          </svg>
        )}
        {hovered && hover !== null && width > 0 && (
          <div
            className={TOOLTIP_CLASS}
            style={{
              left: x(hover),
              top: 0,
              transform: hover > n / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
            }}
          >
            <p className="font-medium text-foreground">{fmtDay(hovered.day)}</p>
            <p className="mt-1 flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: COLOR_VIEWS }}
              />
              <span className="font-semibold tabular-nums text-foreground">
                {hovered.views.toLocaleString()}
              </span>
              <span className="text-muted-foreground">views</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: COLOR_SESSIONS }}
              />
              <span className="font-semibold tabular-nums text-foreground">
                {hovered.sessions.toLocaleString()}
              </span>
              <span className="text-muted-foreground">sessions</span>
            </p>
          </div>
        )}
      </div>
      <SeriesTable data={data} />
    </div>
  );
}

/** Single-series signups column chart. */
export function SignupsChart({ data }: { data: SeriesPoint[] }) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 140;

  const max = Math.max(1, ...data.map((d) => d.signups));
  const ticks = niceTicks(max);
  const yMax = ticks[ticks.length - 1];
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const n = data.length;

  const band = n > 0 ? innerW / n : 0;
  const barW = Math.min(24, Math.max(2, band - 2)); // 2px surface gap between bars
  const x = (i: number) => PAD.left + i * band + (band - barW) / 2;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const indexFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    return Math.max(0, Math.min(n - 1, Math.floor((px - PAD.left) / Math.max(1, band))));
  };

  const peak = useMemo(() => {
    let best = -1;
    let bestV = 0;
    data.forEach((d, i) => {
      if (d.signups > bestV) {
        bestV = d.signups;
        best = i;
      }
    });
    return best;
  }, [data]);

  const hovered = hover !== null ? data[hover] : null;
  const labelEvery = Math.max(1, Math.ceil(n / 5));

  return (
    <div ref={ref} className="relative">
      {width > 0 && n > 0 && (
        <svg
          role="img"
          aria-label="Daily waitlist signups"
          width={width}
          height={height}
          className="block"
          onPointerMove={(e) => setHover(indexFromEvent(e))}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-border/60"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {t.toLocaleString()}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            if (d.signups === 0) return null;
            const top = y(d.signups);
            const h = PAD.top + innerH - top;
            const r = Math.min(3, barW / 2, h); // rounded data-end, square baseline
            return (
              <path
                key={d.day}
                d={`M${x(i)},${top + r}
                   a${r},${r} 0 0 1 ${r},-${r}
                   h${barW - 2 * r}
                   a${r},${r} 0 0 1 ${r},${r}
                   v${h - r}
                   h${-barW}Z`}
                fill={COLOR_SIGNUPS}
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
            );
          })}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text
                key={d.day}
                x={x(i) + barW / 2}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {fmtDay(d.day)}
              </text>
            ) : null,
          )}
          {/* selective direct label: the peak day only */}
          {peak >= 0 && data[peak].signups > 0 && hover === null && (
            <text
              x={x(peak) + barW / 2}
              y={y(data[peak].signups) - 5}
              textAnchor="middle"
              className="fill-foreground text-[10px] font-medium tabular-nums"
            >
              {data[peak].signups.toLocaleString()}
            </text>
          )}
        </svg>
      )}
      {hovered && hover !== null && width > 0 && (
        <div
          className={TOOLTIP_CLASS}
          style={{
            left: x(hover) + barW / 2,
            top: 0,
            transform:
              hover > n / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
          }}
        >
          <p className="font-medium text-foreground">{fmtDay(hovered.day)}</p>
          <p className="mt-1">
            <span className="font-semibold tabular-nums text-foreground">
              {hovered.signups.toLocaleString()}
            </span>{" "}
            <span className="text-muted-foreground">
              signup{hovered.signups === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars — sequential (one hue), value at the row end. */
export function RankList({
  items,
  emptyLabel,
  formatLabel,
}: {
  items: { value: string; count: number }[];
  emptyLabel: string;
  formatLabel?: (value: string) => string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const label = formatLabel ? formatLabel(item.value) : item.value;
        return (
          <li key={item.value} className="group">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="truncate text-sm text-foreground"
                title={label}
              >
                {label}
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {item.count.toLocaleString()}
              </span>
            </div>
            <div
              className="mt-1 h-1.5 w-full rounded-full"
              style={{ backgroundColor: `${COLOR_VIEWS}26` }}
            >
              <div
                className="h-1.5 rounded-full transition-[width]"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  backgroundColor: COLOR_VIEWS,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
