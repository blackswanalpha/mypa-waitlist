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
  MAX_SUBJECT,
  MAX_MESSAGE,
} from "./rateLimits";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PUBLIC — submit a contact message. */
export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    website: v.optional(v.string()), // honeypot — see waitlist.submit
  },
  handler: async (ctx, args) => {
    if (args.website) {
      return { ok: true as const };
    }

    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const subject = args.subject.trim();
    const message = args.message.trim();

    if (name.length < 2) throw new Error("Please enter your name.");
    if (name.length > MAX_NAME) throw new Error("That name is too long.");
    if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (subject.length < 2) throw new Error("Please add a subject.");
    if (subject.length > MAX_SUBJECT) {
      throw new Error("Please shorten the subject.");
    }
    if (message.length < 5) throw new Error("Please add a message.");
    if (message.length > MAX_MESSAGE) {
      throw new Error(`Please keep the message under ${MAX_MESSAGE} characters.`);
    }

    await limiter.limit(ctx, "contactSubmit", { throws: true });
    await limiter.limit(ctx, "contactSubmitPerEmail", {
      key: email,
      throws: true,
    });

    await ctx.db.insert("contactMessages", {
      name,
      email,
      subject,
      message,
      handled: false,
      createdAt: Date.now(),
    });
    await bump(ctx, "contact:total", 1);
    await bump(ctx, "contact:unhandled", 1);

    await ctx.scheduler.runAfter(0, internal.emails.send.sendContactEmails, {
      name,
      email,
      subject,
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
      .query("contactMessages")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** ADMIN — toggle the handled flag. */
export const markHandled = mutation({
  args: { id: v.id("contactMessages"), handled: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.handled === args.handled) return;
    await ctx.db.patch(args.id, { handled: args.handled });
    await bump(ctx, "contact:unhandled", args.handled ? -1 : 1);
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return {
      total: await read(ctx, "contact:total"),
      unhandled: await read(ctx, "contact:unhandled"),
    };
  },
});
