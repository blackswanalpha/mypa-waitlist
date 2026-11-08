import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireAdmin } from "./admin";
import { clampDays, utcDay, windowStart } from "./analytics";

/**
 * Evals: checks that the device tracking is telling the truth. Each run reads
 * the most recent page views in the window, the device rows and the signups,
 * grades eight checks against fixed targets and stores the result in
 * `evalRuns`, so the admin sees today's verdict and how it has moved. The
 * daily cron runs the 7-day window; the admin can run any window by hand.
 *
 * Statuses: pass / warn / fail are graded against a target. info is reported
 * without one. skip means there was nothing to measure yet.
 */

/** Page views one run reads. Past it the run says it sampled. */
const SAMPLE_CAP = 5_000;
const DEVICE_CAP = 10_000;
const SIGNUP_CAP = 5_000;

type Status = "pass" | "warn" | "fail" | "info" | "skip";
type Check = {
  key: string;
  label: string;
  status: Status;
  value: string;
  target: string;
  detail: string;
};

const pct = (n: number, d: number) => (d === 0 ? 0 : (n / d) * 100);
const fmtPct = (x: number) => `${Number.isInteger(x) ? x : x.toFixed(1)}%`;
const n = (x: number) => x.toLocaleString("en-US");

/** Grade a percentage: at or past `pass` passes, at or past `warn` warns. */
function grade(value: number, pass: number, warn: number, higherIsBetter = true): Status {
  if (higherIsBetter) return value >= pass ? "pass" : value >= warn ? "warn" : "fail";
  return value <= pass ? "pass" : value <= warn ? "warn" : "fail";
}

async function runChecks(ctx: MutationCtx, days: number) {
  const start = windowStart(days);
  const startDay = utcDay(start);
  const checks: Check[] = [];

  const recent = await ctx.db
    .query("pageviews")
    .withIndex("by_day", (q) => q.gte("day", startDay))
    .order("desc")
    .take(SAMPLE_CAP + 1);
  const sampled = recent.length > SAMPLE_CAP;
  const views = sampled ? recent.slice(0, SAMPLE_CAP) : recent;
  // Rows from before the device cookie carry no idState; they are not graded.
  const tracked = views.filter((r) => r.idState !== undefined);
  const counted = tracked.filter((r) => r.idState !== "optout");
  const ok = counted.filter((r) => r.idState === "ok").length;
  const none = counted.filter((r) => r.idState === "none").length;
  const invalid = counted.filter((r) => r.idState === "invalid").length;
  const optout = tracked.length - counted.length;

  // 1. Coverage — views that carried a device id.
  if (counted.length === 0) {
    checks.push({
      key: "coverage",
      label: "Views carry a device id",
      status: "skip",
      value: "—",
      target: "≥ 90%",
      detail: "No tracked page views in this window yet.",
    });
  } else {
    const p = pct(ok, counted.length);
    checks.push({
      key: "coverage",
      label: "Views carry a device id",
      status: grade(p, 90, 75),
      value: fmtPct(p),
      target: "≥ 90%",
      detail: `${n(ok)} of ${n(counted.length)} views had a valid device cookie. ${n(none)} had none (cookies blocked or cleared), ${n(invalid)} a malformed one. Low coverage undercounts devices.`,
    });
  }

  // 2. Persistence — one session keeps one device id from view to view.
  const bySession = new Map<string, (string | undefined)[]>();
  for (const r of counted) {
    const list = bySession.get(r.sessionId) ?? [];
    list.push(r.idState === "ok" ? r.deviceId : undefined);
    bySession.set(r.sessionId, list);
  }
  let multi = 0;
  let held = 0;
  for (const ids of bySession.values()) {
    if (ids.length < 2 || ids.every((id) => id === undefined)) continue;
    multi++;
    if (ids.every((id) => id !== undefined && id === ids[0])) held++;
  }
  if (multi === 0) {
    checks.push({
      key: "persistence",
      label: "Cookie survives between pages",
      status: "skip",
      value: "—",
      target: "≥ 98%",
      detail: "No session with two or more identified views yet.",
    });
  } else {
    const p = pct(held, multi);
    checks.push({
      key: "persistence",
      label: "Cookie survives between pages",
      status: grade(p, 98, 90),
      value: fmtPct(p),
      target: "≥ 98%",
      detail: `${n(held)} of ${n(multi)} multi-page sessions kept the same device id on every view. A break means the browser dropped or replaced the cookie mid-visit, which splits one person into two devices.`,
    });
  }

  // 3. Integrity — malformed ids reaching the beacon.
  const sent = ok + invalid;
  if (sent === 0) {
    checks.push({
      key: "integrity",
      label: "Device ids are well formed",
      status: "skip",
      value: "—",
      target: "≤ 0.5%",
      detail: "No device ids were sent in this window yet.",
    });
  } else {
    const p = pct(invalid, sent);
    checks.push({
      key: "integrity",
      label: "Device ids are well formed",
      status: grade(p, 0.5, 2, false),
      value: fmtPct(p),
      target: "≤ 0.5% malformed",
      detail: `${n(invalid)} of ${n(sent)} ids were not a v4 UUID and were dropped. The server replaces bad cookies on the next page load, so a rising rate means something is writing the cookie besides us.`,
    });
  }

  // 4. Opt-outs — reported, not graded.
  checks.push({
    key: "optout",
    label: "Opt-out signals honoured",
    status: tracked.length === 0 ? "skip" : "info",
    value: tracked.length === 0 ? "—" : fmtPct(pct(optout, tracked.length)),
    target: "Reported only",
    detail:
      tracked.length === 0
        ? "No tracked page views in this window yet."
        : `${n(optout)} of ${n(tracked.length)} views came from browsers sending Global Privacy Control or Do Not Track. They count as views and never as devices.`,
  });

  // 5. Returning devices — zero returns on real traffic means cookies are not lasting.
  const active = await ctx.db
    .query("devices")
    .withIndex("by_lastSeen", (q) => q.gte("lastSeen", start))
    .take(DEVICE_CAP);
  const returning = active.filter((d) => d.daysSeen >= 2).length;
  if (active.length === 0) {
    checks.push({
      key: "returning",
      label: "Devices come back on later days",
      status: "skip",
      value: "—",
      target: "> 1% once 50+ devices",
      detail: "No devices seen in this window yet.",
    });
  } else {
    const p = pct(returning, active.length);
    checks.push({
      key: "returning",
      label: "Devices come back on later days",
      status: active.length >= 50 && p < 1 ? "warn" : "info",
      value: fmtPct(p),
      target: "> 1% once 50+ devices",
      detail: `${n(returning)} of ${n(active.length)} devices seen in this window have visited on two or more days. None returning across many devices would mean the cookie does not outlive a visit.`,
    });
  }

  // 6. Reconciliation — the daily aggregates equal the raw rows they summarise.
  const rawByDay = new Map<string, number>();
  for (const r of views) rawByDay.set(r.day, (rawByDay.get(r.day) ?? 0) + 1);
  // A sampled read only covers its oldest day in part, so that day is left out.
  const oldestDay = views.length > 0 ? views[views.length - 1].day : undefined;
  const aggregates = await ctx.db
    .query("trafficDaily")
    .withIndex("by_dim_day", (q) => q.eq("dimension", "views").gte("day", startDay))
    .collect();
  const aggByDay = new Map<string, number>();
  for (const a of aggregates) aggByDay.set(a.day, (aggByDay.get(a.day) ?? 0) + a.count);
  const days_ = new Set([...rawByDay.keys(), ...aggByDay.keys()]);
  const covered = [...days_].filter((d) => !(sampled && oldestDay !== undefined && d <= oldestDay)).sort();
  const mismatched = covered.filter((d) => (rawByDay.get(d) ?? 0) !== (aggByDay.get(d) ?? 0));
  if (covered.length === 0) {
    checks.push({
      key: "reconcile",
      label: "Daily totals match raw views",
      status: "skip",
      value: "—",
      target: "Every day matches",
      detail: "No complete day of page views to compare yet.",
    });
  } else {
    checks.push({
      key: "reconcile",
      label: "Daily totals match raw views",
      status: mismatched.length === 0 ? "pass" : "fail",
      value: `${n(covered.length - mismatched.length)} of ${n(covered.length)} days`,
      target: "Every day matches",
      detail:
        mismatched.length === 0
          ? "The charts' per-day view counts equal the raw page views behind them."
          : `Off on ${mismatched
              .slice(0, 5)
              .map((d) => `${d} (${n(aggByDay.get(d) ?? 0)} charted, ${n(rawByDay.get(d) ?? 0)} raw)`)
              .join(", ")}${mismatched.length > 5 ? ", …" : ""}. The charts are wrong for those days.`,
    });
  }

  // 7. Signups linked to the device they came from.
  const first = await ctx.db.query("devices").withIndex("by_firstSeen").first();
  const since = first ? Math.max(start, first.firstSeen) : undefined;
  const signups =
    since === undefined
      ? []
      : await ctx.db
          .query("testers")
          .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
          .take(SIGNUP_CAP);
  const linked = signups.filter((t) => t.deviceId).length;
  if (signups.length === 0) {
    checks.push({
      key: "signupLink",
      label: "Signups linked to a device",
      status: "skip",
      value: "—",
      target: "≥ 90%",
      detail: "No signups since device tracking started in this window.",
    });
  } else {
    const p = pct(linked, signups.length);
    checks.push({
      key: "signupLink",
      label: "Signups linked to a device",
      status: grade(p, 90, 70),
      value: fmtPct(p),
      target: "≥ 90%",
      detail: `${n(linked)} of ${n(signups.length)} signups since tracking began carry the device they signed up from. Opt-outs and blocked cookies are the expected gap.`,
    });
  }

  // 8. One device, many signups. All time, not windowed.
  const shared = await ctx.db
    .query("devices")
    .withIndex("by_signups", (q) => q.gte("signups", 2))
    .take(100);
  checks.push({
    key: "sharedDevices",
    label: "One device, one signup",
    status: shared.length === 0 ? "pass" : "warn",
    value: shared.length === 0 ? "0 devices" : `${n(shared.length)}${shared.length === 100 ? "+" : ""} device${shared.length === 1 ? "" : "s"}`,
    target: "0 devices",
    detail:
      shared.length === 0
        ? "No device has signed up more than one email."
        : `Most: ${n(Math.max(...shared.map((d) => d.signups ?? 0)))} emails from one device. A couple is a shared phone; many is someone filling the list. All time.`,
  });

  const count = (s: Status) => checks.filter((c) => c.status === s).length;
  return {
    days,
    sample: tracked.length,
    sampled,
    passed: count("pass"),
    warned: count("warn"),
    failed: count("fail"),
    checks,
  };
}

/** ADMIN — run the checks now over a 1..90 day window and keep the result. */
export const run = mutation({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    const { email } = await requireAdmin(ctx);
    const result = await runChecks(ctx, clampDays(args.days));
    const id = await ctx.db.insert("evalRuns", {
      createdAt: Date.now(),
      trigger: "manual",
      by: email,
      ...result,
    });
    return id;
  },
});

/** Daily cron: the 7-day window. */
export const scheduled = internalMutation({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    const result = await runChecks(ctx, clampDays(args.days));
    await ctx.db.insert("evalRuns", { createdAt: Date.now(), trigger: "cron", ...result });
  },
});

/** ADMIN — the most recent run, or null before the first. */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("evalRuns").withIndex("by_createdAt").order("desc").first();
  },
});

/** ADMIN — the last `limit` runs, oldest first, for the trend chart. */
export const trend = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("evalRuns")
      .withIndex("by_createdAt")
      .order("desc")
      .take(Math.min(Math.max(Math.floor(args.limit ?? 30), 1), 90));
    return rows.reverse().map((r) => ({
      _id: r._id,
      createdAt: r.createdAt,
      passed: r.passed,
      warned: r.warned,
      failed: r.failed,
    }));
  },
});

/** ADMIN — every run, newest first, for the paged history table. */
export const history = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("evalRuns")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
