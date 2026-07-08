import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin";
import { limiter } from "./rateLimits";

/**
 * First-party traffic analytics. The landing page fires `track` on every
 * client-side navigation (components/analytics.tsx); each accepted view
 * inserts one raw `pageviews` row and bumps the per-day `trafficDaily`
 * aggregates in the same transaction, so the admin charts are index range
 * reads over tiny aggregate docs — never scans of the raw table.
 *
 * Privacy: no cookies, no IP (mutations can't see it anyway), no full
 * user-agent — the client sends a coarse device class and a referrer reduced
 * to its domain. Raw rows are pruned after PRUNE_KEEP_DAYS by the daily cron.
 */

const MAX_FIELD = 200;

/** Dimensions whose per-value daily totals the admin dashboard reads. */
export type Dimension =
  | "views"
  | "sessions"
  | "path"
  | "ref"
  | "utm"
  | "device"
  | "signup"
  | "signup_utm";

/** "YYYY-MM-DD" in UTC for a ms timestamp. */
export function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Bump one (day, dimension, value) aggregate — mirror of counters.bump. */
export async function bumpDaily(
  ctx: MutationCtx,
  day: string,
  dimension: Dimension,
  value: string,
  delta = 1,
) {
  const existing = await ctx.db
    .query("trafficDaily")
    .withIndex("by_day_dim_value", (q) =>
      q.eq("day", day).eq("dimension", dimension).eq("value", value),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { count: existing.count + delta });
  } else {
    await ctx.db.insert("trafficDaily", { day, dimension, value, count: delta });
  }
}

const clean = (s: string | undefined, max = MAX_FIELD) =>
  s?.trim().slice(0, max).toLowerCase() || undefined;

/**
 * PUBLIC — the page-view beacon. Never throws: bad input and rate-limit hits
 * are silently dropped so a hammered endpoint can't surface errors in the UI.
 */
export const track = mutation({
  args: {
    sessionId: v.string(),
    newSession: v.boolean(),
    path: v.string(),
    referrerDomain: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    device: v.union(
      v.literal("mobile"),
      v.literal("tablet"),
      v.literal("desktop"),
    ),
  },
  handler: async (ctx, args) => {
    const path = args.path.trim().slice(0, MAX_FIELD);
    const sessionId = args.sessionId.trim().slice(0, 64);
    if (!path.startsWith("/") || path.startsWith("/admin") || !sessionId) {
      return { ok: false as const };
    }

    const global = await limiter.limit(ctx, "pageview");
    if (!global.ok) return { ok: false as const };
    const perSession = await limiter.limit(ctx, "pageviewPerSession", {
      key: sessionId,
    });
    if (!perSession.ok) return { ok: false as const };

    const ts = Date.now();
    const day = utcDay(ts);
    const referrerDomain = clean(args.referrerDomain);
    const utmSource = clean(args.utmSource);

    await ctx.db.insert("pageviews", {
      ts,
      day,
      sessionId,
      newSession: args.newSession,
      path,
      referrerDomain,
      utmSource,
      device: args.device,
    });

    await bumpDaily(ctx, day, "views", "");
    await bumpDaily(ctx, day, "path", path);
    await bumpDaily(ctx, day, "device", args.device);
    if (args.newSession) {
      await bumpDaily(ctx, day, "sessions", "");
      // Referrer/UTM describe how a session arrived — count them once per
      // session, not on every navigation.
      if (referrerDomain) await bumpDaily(ctx, day, "ref", referrerDomain);
      if (utmSource) await bumpDaily(ctx, day, "utm", utmSource);
    }
    return { ok: true as const };
  },
});

/** Zero-filled list of the last `days` UTC day strings, oldest first. */
function lastDays(days: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    out.push(utcDay(now - i * 24 * 60 * 60 * 1000));
  }
  return out;
}

async function sumByDay(ctx: QueryCtx, dimension: Dimension, startDay: string) {
  const rows = await ctx.db
    .query("trafficDaily")
    .withIndex("by_dim_day", (q) =>
      q.eq("dimension", dimension).gte("day", startDay),
    )
    .collect();
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.count);
  return byDay;
}

/** ADMIN — per-day views/sessions/signups for the time-series chart. */
export const series = query({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const days = Math.min(Math.max(Math.floor(args.days), 1), 90);
    const dayList = lastDays(days);
    const startDay = dayList[0];
    const [views, sessions, signups] = await Promise.all([
      sumByDay(ctx, "views", startDay),
      sumByDay(ctx, "sessions", startDay),
      sumByDay(ctx, "signup", startDay),
    ]);
    return dayList.map((day) => ({
      day,
      views: views.get(day) ?? 0,
      sessions: sessions.get(day) ?? 0,
      signups: signups.get(day) ?? 0,
    }));
  },
});

/** ADMIN — top values of one dimension over the window (ranked lists). */
export const top = query({
  args: {
    dimension: v.union(
      v.literal("path"),
      v.literal("ref"),
      v.literal("utm"),
      v.literal("device"),
      v.literal("signup_utm"),
    ),
    days: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const days = Math.min(Math.max(Math.floor(args.days), 1), 90);
    const startDay = lastDays(days)[0];
    const rows = await ctx.db
      .query("trafficDaily")
      .withIndex("by_dim_day", (q) =>
        q.eq("dimension", args.dimension).gte("day", startDay),
      )
      .collect();
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(r.value, (totals.get(r.value) ?? 0) + r.count);
    return [...totals.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, Math.min(args.limit ?? 10, 50));
  },
});

const PRUNE_BATCH = 500;

/**
 * Delete raw pageviews older than `keepDays`, 500 per transaction,
 * rescheduling itself until the backlog is drained. Aggregates are kept.
 */
export const prune = internalMutation({
  args: { keepDays: v.number() },
  handler: async (ctx, args) => {
    const cutoff = utcDay(Date.now() - args.keepDays * 24 * 60 * 60 * 1000);
    const batch = await ctx.db
      .query("pageviews")
      .withIndex("by_day", (q) => q.lt("day", cutoff))
      .take(PRUNE_BATCH);
    for (const row of batch) {
      await ctx.db.delete(row._id);
    }
    if (batch.length === PRUNE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.analytics.prune, {
        keepDays: args.keepDays,
      });
    }
    return { deleted: batch.length };
  },
});
