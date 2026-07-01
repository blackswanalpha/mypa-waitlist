import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PUBLIC — submit a contact message. */
export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const subject = args.subject.trim();
    const message = args.message.trim();

    if (name.length < 2) throw new Error("Please enter your name.");
    if (!EMAIL_RE.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (subject.length < 2) throw new Error("Please add a subject.");
    if (message.length < 5) throw new Error("Please add a message.");

    await ctx.db.insert("contactMessages", {
      name,
      email,
      subject,
      message,
      handled: false,
      createdAt: Date.now(),
    });

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
    await ctx.db.patch(args.id, { handled: args.handled });
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("contactMessages").collect();
    return {
      total: all.length,
      unhandled: all.filter((m) => !m.handled).length,
    };
  },
});
