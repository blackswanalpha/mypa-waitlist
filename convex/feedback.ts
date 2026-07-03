import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./admin";
import { bump, read } from "./counters";
import { limiter, MAX_NAME, MAX_EMAIL, MAX_MESSAGE } from "./rateLimits";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PUBLIC — submit product feedback. name/email optional, message required. */
export const submit = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    rating: v.optional(v.number()),
    message: v.string(),
    website: v.optional(v.string()), // honeypot — see waitlist.submit
  },
  handler: async (ctx, args) => {
    if (args.website) {
      return { ok: true as const };
    }

    const message = args.message.trim();
    if (message.length < 5) {
      throw new Error("Please share a little more detail.");
    }
    if (message.length > MAX_MESSAGE) {
      throw new Error(`Please keep the message under ${MAX_MESSAGE} characters.`);
    }

    const email = args.email?.trim().toLowerCase() || undefined;
    if (email && (email.length > MAX_EMAIL || !EMAIL_RE.test(email))) {
      throw new Error("Please enter a valid email address.");
    }

    const rating =
      args.rating != null ? Math.max(1, Math.min(5, Math.round(args.rating))) : undefined;

    const name = args.name?.trim() || undefined;
    if (name && name.length > MAX_NAME) {
      throw new Error("That name is too long.");
    }

    // Feedback can be anonymous, so key the per-sender bucket on email when
    // present and fall back to the global bucket alone otherwise.
    await limiter.limit(ctx, "feedbackSubmit", { throws: true });

    await ctx.db.insert("feedback", {
      name,
      email,
      rating,
      message,
      createdAt: Date.now(),
    });
    await bump(ctx, "feedback:total", 1);

    await ctx.scheduler.runAfter(0, internal.emails.send.sendFeedbackEmails, {
      name,
      email,
      rating,
      message,
    });

    return { ok: true as const };
  },
});

/** ADMIN — paginated, newest first. */
export const listForAdmin = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("feedback")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await read(ctx, "feedback:total");
  },
});
