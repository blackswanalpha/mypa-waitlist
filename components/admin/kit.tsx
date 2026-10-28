"use client";

import * as React from "react";
import { ChevronUpDownIcon } from "@heroicons/react/16/solid";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The admin console's building blocks. Every view composes these so spacing,
 * type and surfaces stay identical across tabs: panels are 16px-radius cards,
 * headings are Jakarta, figures are tabular, and lime appears only where a
 * view wants the eye to land.
 */

export type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-border bg-card text-card-foreground shadow-panel", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: IconType;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted-foreground">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-heading text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small caps label above a group of fields or a list. */
export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground", className)} {...props} />;
}

/** A headline figure. `value` undefined means its query is still loading. */
export function Metric({
  label,
  value,
  hint,
  icon: Icon,
  footer,
  className,
}: {
  label: string;
  value: React.ReactNode | undefined;
  hint?: React.ReactNode;
  icon?: IconType;
  /** Optional strip under the figure, e.g. a sparkline. */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground/70" />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {value === undefined ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <span className="font-heading text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">{value}</span>
        )}
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </Panel>
  );
}

type SegmentItem<T> = { value: T; label: string; count?: number };

/**
 * One row of mutually exclusive choices. `semantics="tabs"` renders a tablist
 * (filters that swap the list below); "buttons" renders pressed toggles.
 */
export function Segmented<T extends string | undefined>({
  items,
  value,
  onChange,
  label,
  semantics = "buttons",
  className,
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  semantics?: "tabs" | "buttons";
  className?: string;
}) {
  const tabs = semantics === "tabs";
  return (
    <div
      role={tabs ? "tablist" : "group"}
      aria-label={label}
      className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-surface p-0.5", className)}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.label}
            type="button"
            role={tabs ? "tab" : undefined}
            aria-selected={tabs ? active : undefined}
            aria-pressed={tabs ? undefined : active}
            onClick={() => onChange(it.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium transition-[color,background-color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active ? "bg-card text-foreground shadow-panel" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={cn("tabular-nums text-xs", active ? "text-muted-foreground" : "text-muted-foreground/70")}>
                {it.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type Tone = "brand" | "warn" | "neutral" | "danger" | "info";

const TONE: Record<Tone, string> = {
  brand: "bg-brand/12 text-brand-ink ring-brand/25",
  warn: "bg-warn/12 text-warn ring-warn/25",
  neutral: "bg-muted text-muted-foreground ring-border",
  danger: "bg-destructive/10 text-destructive ring-destructive/25",
  info: "bg-viz-views/12 text-viz-views ring-viz-views/25",
};

const DOT: Record<Tone, string> = {
  brand: "bg-brand-ink",
  warn: "bg-warn",
  neutral: "bg-muted-foreground/60",
  danger: "bg-destructive",
  info: "bg-viz-views",
};

/** A state label: tinted pill, leading dot, never colour alone. */
export function StatusPill({ tone, children, className, title }: { tone: Tone; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONE[tone], className)}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[tone])} />
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: IconType;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <span className="grid size-11 place-items-center rounded-xl border border-border bg-surface text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 font-heading text-[15px] font-semibold text-foreground">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Placeholder rows shaped like the table they stand in for. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 px-5 py-5", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Native select (keyboard, mobile pickers and form value for free) in console dress. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        className="h-8 w-full cursor-pointer appearance-none rounded-lg border border-input bg-transparent pl-2.5 pr-7 text-sm text-foreground outline-none transition-[border-color,box-shadow] hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-popover"
        {...props}
      >
        {children}
      </select>
      <ChevronUpDownIcon aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}

/** Inline notice: amber for "this blocks you", neutral for context. */
export function Notice({ tone = "warn", icon: Icon, children, className }: { tone?: "warn" | "neutral"; icon?: IconType; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm",
        tone === "warn" ? "bg-warn/10 text-foreground ring-1 ring-inset ring-warn/25" : "bg-surface text-muted-foreground ring-1 ring-inset ring-border",
        className,
      )}
    >
      {Icon && <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warn" ? "text-warn" : "text-muted-foreground")} />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** First letters of a name, or of an address's local part. */
export function initials(name: string | undefined, email: string): string {
  const src = name?.trim() || email.split("@")[0];
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ name, email, className }: { name?: string; email: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface font-heading text-[11px] font-semibold text-muted-foreground", className)}
    >
      {initials(name, email)}
    </span>
  );
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Scroll an element into view and focus it, without smooth motion when reduced motion is asked for. */
export function reveal(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.focus({ preventScroll: true });
}
