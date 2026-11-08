import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./admin";
import { limiter } from "./rateLimits";
import { bump } from "./counters";

/**
 * First-party traffic analytics. The landing page fires `track` on every
 * client-side navigation (components/analytics.tsx); each accepted view
 * inserts one raw `pageviews` row and bumps the per-day `trafficDaily`
 * aggregates in the same transaction, so the admin charts are index range
 * reads over tiny aggregate docs — never scans of the raw table.
 *
 * Privacy: no IP (mutations can't see it anyway), no full user-agent — the
 * client sends a coarse device class, a referrer reduced to its domain, and,
 * only with the visitor's cookie consent (lib/consent.ts), the device
 * cookie's random id. An id sent without consent is dropped here. Raw rows
 * are pruned after PRUNE_KEEP_DAYS by the daily cron.
 *
 * Devices: each valid id gets one `devices` row. Distinct devices over a
 * window are a range read on its lastSeen index, because daily uniques do not
 * add up (a device seen on five days would count five times).
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
  | "signup_utm"
  | "views_identified"
  | "device_active"
  | "device_new"
  | "consent_granted"
  | "consent_denied";

/** Same shape lib/device-cookie.ts mints. Anything else is "invalid". */
export const DEVICE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const DAY_MS = 24 * 60 * 60 * 1000;

/** ms at 00:00 UTC of the first day of a `days`-long window ending today. */
export function windowStart(days: number): number {
  const startDay = utcDay(Date.now() - (days - 1) * DAY_MS);
  return Date.parse(`${startDay}T00:00:00Z`);
}

/** Days arg clamped to the 1..90 the raw tables can answer. */
export function clampDays(days: number): number {
  return Math.min(Math.max(Math.floor(days), 1), 90);
}

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
    deviceId: v.optional(v.string()),
    optout: v.optional(v.boolean()),
    // The visitor's cookie choice. Absent only from pages built before the
    // consent card, which never get an id kept.
    consent: v.optional(
      v.union(v.literal("granted"), v.literal("denied"), v.literal("pending")),
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
    const rawId = args.deviceId?.trim().toLowerCase().slice(0, 64);
    const granted = args.consent === "granted" && !args.optout;
    const idState = args.optout
      ? ("optout" as const)
      : args.consent === "denied"
        ? ("declined" as const)
        : !granted
          ? ("pending" as const)
          : !rawId
            ? ("none" as const)
            : DEVICE_ID_RE.test(rawId)
              ? ("ok" as const)
              : ("invalid" as const);
    const deviceId = idState === "ok" ? rawId : undefined;
    // Only a client that knows about consent can break it; pages built before
    // the card (consent absent) are dropped without counting.
    const idWithoutConsent =
      args.consent !== undefined && !granted && !!rawId ? true : undefined;

    await ctx.db.insert("pageviews", {
      ts,
      day,
      sessionId,
      newSession: args.newSession,
      path,
      referrerDomain,
      utmSource,
      device: args.device,
      deviceId,
      idState,
      idWithoutConsent,
    });

    if (deviceId) {
      await seeDevice(ctx, deviceId, ts, day, {
        newSession: args.newSession,
        deviceClass: args.device,
        path,
        referrerDomain,
        utmSource,
      });
      await bumpDaily(ctx, day, "views_identified", "");
    }

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

/**
 * PUBLIC — called by POST /api/consent after it has set the cookies. Logs the
 * choice, and settles this visit's page views that were waiting on it: on
 * Accept they become identified views of the new device (so a one-page visit
 * still counts its device), on Decline they are marked declined.
 */
export const recordConsent = mutation({
  args: {
    choice: v.union(v.literal("granted"), v.literal("denied")),
    version: v.number(),
    deviceId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = await limiter.limit(ctx, "consent");
    if (!limit.ok) return { ok: false as const };

    const ts = Date.now();
    const day = utcDay(ts);
    const rawId = args.deviceId?.trim().toLowerCase();
    const deviceId = rawId && DEVICE_ID_RE.test(rawId) ? rawId : undefined;
    const sessionId = args.sessionId?.trim().slice(0, 64) || undefined;

    let viewsUpdated = 0;
    if (sessionId) {
      const views = await ctx.db
        .query("pageviews")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .take(100);
      const waiting = views.filter((v) => v.idState === "pending").sort((a, b) => a.ts - b.ts);
      for (const view of waiting) {
        if (args.choice === "granted" && deviceId) {
          await ctx.db.patch(view._id, { deviceId, idState: "ok" });
          await seeDevice(ctx, deviceId, view.ts, view.day, {
            newSession: view.newSession,
            deviceClass: view.device,
            path: view.path,
            referrerDomain: view.referrerDomain,
            utmSource: view.utmSource,
          });
          await bumpDaily(ctx, view.day, "views_identified", "");
        } else {
          await ctx.db.patch(view._id, { idState: "declined" });
        }
        viewsUpdated++;
      }
    }

    await ctx.db.insert("consents", {
      ts,
      day,
      choice: args.choice,
      version: Math.floor(args.version),
      deviceId,
      sessionId,
      viewsUpdated,
    });
    await bumpDaily(ctx, day, args.choice === "granted" ? "consent_granted" : "consent_denied", "");
    return { ok: true as const, viewsUpdated };
  },
});

/** ADMIN — the consent log, newest first, for the paged table. */
export const consents = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.query("consents").withIndex("by_ts").order("desc").paginate(args.paginationOpts);
  },
});

/** Create or update the device's row; bump the per-day device dims. */
async function seeDevice(
  ctx: MutationCtx,
  deviceId: string,
  ts: number,
  day: string,
  view: {
    newSession: boolean;
    deviceClass: string;
    path: string;
    referrerDomain?: string;
    utmSource?: string;
  },
) {
  const device = await ctx.db
    .query("devices")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
  if (!device) {
    await ctx.db.insert("devices", {
      deviceId,
      firstSeen: ts,
      lastSeen: ts,
      daysSeen: 1,
      views: 1,
      sessions: view.newSession ? 1 : 0,
      deviceClass: view.deviceClass,
      firstPath: view.path,
      firstReferrer: view.referrerDomain,
      firstUtm: view.utmSource,
    });
    await bump(ctx, "devices:total", 1);
    await bumpDaily(ctx, day, "device_active", "");
    await bumpDaily(ctx, day, "device_new", "");
    return;
  }
  const firstViewToday = utcDay(device.lastSeen) !== day;
  await ctx.db.patch(device._id, {
    lastSeen: ts,
    daysSeen: device.daysSeen + (firstViewToday ? 1 : 0),
    views: device.views + 1,
    sessions: device.sessions + (view.newSession ? 1 : 0),
    deviceClass: view.deviceClass,
  });
  if (firstViewToday) await bumpDaily(ctx, day, "device_active", "");
}

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

/** ADMIN — per-day views/sessions/signups/devices for the time-series charts. */
export const series = query({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const days = clampDays(args.days);
    const dayList = lastDays(days);
    const startDay = dayList[0];
    const [views, sessions, signups, identified, active, fresh, granted, denied] = await Promise.all([
      sumByDay(ctx, "views", startDay),
      sumByDay(ctx, "sessions", startDay),
      sumByDay(ctx, "signup", startDay),
      sumByDay(ctx, "views_identified", startDay),
      sumByDay(ctx, "device_active", startDay),
      sumByDay(ctx, "device_new", startDay),
      sumByDay(ctx, "consent_granted", startDay),
      sumByDay(ctx, "consent_denied", startDay),
    ]);
    return dayList.map((day) => ({
      day,
      views: views.get(day) ?? 0,
      sessions: sessions.get(day) ?? 0,
      signups: signups.get(day) ?? 0,
      identifiedViews: identified.get(day) ?? 0,
      devices: active.get(day) ?? 0,
      newDevices: fresh.get(day) ?? 0,
      consentGranted: granted.get(day) ?? 0,
      consentDenied: denied.get(day) ?? 0,
    }));
  },
});

/** Cap on device rows one stats read touches; past it the count says "N+". */
const DEVICE_SCAN_CAP = 10_000;

/**
 * ADMIN — distinct devices over the window: how many viewed the site, how
 * many were first seen in it, how many have come back on another day, and
 * how many signed up.
 */
export const deviceStats = query({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const start = windowStart(clampDays(args.days));
    const active = await ctx.db
      .query("devices")
      .withIndex("by_lastSeen", (q) => q.gte("lastSeen", start))
      .take(DEVICE_SCAN_CAP + 1);
    const capped = active.length > DEVICE_SCAN_CAP;
    const rows = capped ? active.slice(0, DEVICE_SCAN_CAP) : active;
    let fresh = 0;
    let returning = 0;
    let signedUp = 0;
    for (const d of rows) {
      if (d.firstSeen >= start) fresh++;
      if (d.daysSeen >= 2) returning++;
      if ((d.signups ?? 0) > 0) signedUp++;
    }
    return { unique: rows.length, fresh, returning, signedUp, capped };
  },
});

/** ADMIN — devices, most recently seen first, for the paged table. */
export const devices = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("devices")
      .withIndex("by_lastSeen")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** ADMIN — how many devices have ever been seen (the table's page count). */
export const deviceTotal = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", "devices:total"))
      .unique();
    return row?.value ?? 0;
  },
});

/** A signup older than this is not linked: the cookie may no longer be theirs. */
const LINK_WINDOW_MS = 15 * 60 * 1000;

/**
 * PUBLIC — called by /api/waitlist right after a new signup with the device
 * cookie it arrived with. Ties the tester row to its device so the admin can
 * see which devices signed up and spot one device signing up many emails.
 * Best effort: anything that does not line up is dropped without an error.
 */
export const linkSignup = mutation({
  args: { deviceId: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const deviceId = args.deviceId.trim().toLowerCase();
    const email = args.email.trim().toLowerCase().slice(0, 254);
    if (!DEVICE_ID_RE.test(deviceId) || !email) return { ok: false as const };

    const limit = await limiter.limit(ctx, "linkSignup");
    if (!limit.ok) return { ok: false as const };

    const tester = await ctx.db
      .query("testers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!tester || tester.deviceId || Date.now() - tester.createdAt > LINK_WINDOW_MS) {
      return { ok: false as const };
    }
    await ctx.db.patch(tester._id, { deviceId });

    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (device) await ctx.db.patch(device._id, { signups: (device.signups ?? 0) + 1 });
    return { ok: true as const };
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
    const days = clampDays(args.days);
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
