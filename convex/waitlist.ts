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

/** ADMIN — paginated, newest first. */
export const listForAdmin = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("waitlist")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(args.paginationOpts);
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
