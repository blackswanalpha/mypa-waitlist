import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./admin";
import { bump, read } from "./counters";
import {
  limiter,
  MAX_NAME,
  MAX_EMAIL,
  MAX_PHONE,
} from "./rateLimits";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PUBLIC — no auth gate. Called from the landing page via useMutation.
 * Returns { duplicate } so the UI can show a friendly "already on the list".
 */
export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    source: v.optional(v.string()),
    agreed: v.boolean(),
    // Honeypot: hidden in the form, so a non-empty value means a bot filled
    // it. We report success without writing anything.
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.website) {
      return { ok: true as const, duplicate: false as const };
    }

    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const phone = args.phone?.trim() || undefined;

    if (name.length < 2) throw new Error("Please enter your name.");
    if (name.length > MAX_NAME) throw new Error("That name is too long.");
    if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (phone && phone.length > MAX_PHONE) {
      throw new Error("That phone number is too long.");
    }
    if (!args.agreed) {
      throw new Error("Please agree to receive launch updates.");
    }

    await limiter.limit(ctx, "waitlistSubmit", { throws: true });
    await limiter.limit(ctx, "waitlistSubmitPerEmail", {
      key: email,
      throws: true,
    });

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      return { ok: true as const, duplicate: true as const };
    }

    await ctx.db.insert("waitlist", {
      name,
      email,
      phone,
      status: "pending",
      source: args.source ?? "landing",
      createdAt: Date.now(),
      consentAt: Date.now(),
    });
    await bump(ctx, "waitlist:total", 1);
    await bump(ctx, "waitlist:pending", 1);

    // Side-effects run only if this transaction commits.
    await ctx.scheduler.runAfter(0, internal.emails.send.sendWaitlistEmails, {
      name,
      email,
    });

    return { ok: true as const, duplicate: false as const };
  },
});

const STATUS = v.union(
  v.literal("pending"),
  v.literal("invited"),
  v.literal("registered"),
);

/** ADMIN — paginated, newest first, optionally filtered by status. */
export const listForAdmin = query({
  args: { paginationOpts: paginationOptsValidator, status: v.optional(STATUS) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const status = args.status;
    const q = status
      ? ctx.db
          .query("waitlist")
          .withIndex("by_status", (qq) => qq.eq("status", status))
      : ctx.db.query("waitlist").withIndex("by_createdAt");
    return await q.order("desc").paginate(args.paginationOpts);
  },
});

/**
 * ADMIN — bulk status change ("invited" = whitelisted). Flipping to invited
 * stamps whitelistedAt and clears syncedAt so the row is picked up by the
 * next backend sync; leaving invited also clears syncedAt (it only describes
 * the current whitelisted state).
 */
export const setStatus = mutation({
  args: { ids: v.array(v.id("waitlist")), status: STATUS },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.ids.length > 200) {
      throw new Error("At most 200 rows per call — chunk the selection.");
    }
    let updated = 0;
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (!doc || doc.status === args.status) continue;
      await ctx.db.patch(id, {
        status: args.status,
        whitelistedAt:
          args.status === "invited" ? Date.now() : doc.whitelistedAt,
        syncedAt: undefined,
      });
      await bump(ctx, `waitlist:${doc.status}`, -1);
      await bump(ctx, `waitlist:${args.status}`, 1);
      updated++;
    }
    return { updated };
  },
});

/**
 * ADMIN — whitelist every pending signup, one 200-row transaction at a time.
 * The client loops while `remaining` is true, keeping each transaction small.
 */
export const whitelistAllPending = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const batch = await ctx.db
      .query("waitlist")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(200);
    const now = Date.now();
    for (const doc of batch) {
      await ctx.db.patch(doc._id, {
        status: "invited",
        whitelistedAt: now,
        syncedAt: undefined,
      });
    }
    if (batch.length > 0) {
      await bump(ctx, "waitlist:pending", -batch.length);
      await bump(ctx, "waitlist:invited", batch.length);
    }
    const next = await ctx.db
      .query("waitlist")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();
    return { updated: batch.length, remaining: next !== null };
  },
});

/**
 * ADMIN — raw pages for the CSV export. The client loops the cursor until
 * isDone, so no single query has to hold the whole table.
 */
export const exportPage = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    status: v.optional(STATUS),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const status = args.status;
    const q = status
      ? ctx.db
          .query("waitlist")
          .withIndex("by_status", (qq) => qq.eq("status", status))
      : ctx.db.query("waitlist").withIndex("by_createdAt");
    return await q
      .order("desc")
      .paginate({ cursor: args.cursor, numItems: 500 });
  },
});

/** ADMIN — quick total for the dashboard header (counter point-read). */
export const count = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await read(ctx, "waitlist:total");
  },
});

/** ADMIN — per-status totals for the filter chips. */
export const countByStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return {
      total: await read(ctx, "waitlist:total"),
      pending: await read(ctx, "waitlist:pending"),
      invited: await read(ctx, "waitlist:invited"),
      registered: await read(ctx, "waitlist:registered"),
    };
  },
});
