import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./admin";

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
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();

    if (name.length < 2) throw new Error("Please enter your name.");
    if (!EMAIL_RE.test(email)) {
      throw new Error("Please enter a valid email address.");
    }

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
      phone: args.phone?.trim() || undefined,
      status: "pending",
      source: args.source ?? "landing",
      createdAt: Date.now(),
    });

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

/** ADMIN — quick total for the dashboard header. */
export const count = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("waitlist").collect();
    return all.length;
  },
});
