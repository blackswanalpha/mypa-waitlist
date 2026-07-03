import { internalMutation, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { resend, FROM, REPLY_TO } from "./send";
import { appreciationHtml } from "./templates";

const SUBJECT = "A heartfelt thank-you from the MyPA team";

type Source = "waitlist" | "feedback" | "contact";
type Recipient = { email: string; name?: string; source: Source };

/**
 * Everyone who has ever touched the early-access page, deduped by email.
 * Priority when the same address appears in several tables:
 * waitlist > feedback > contact (the opener line matches how we know them).
 *
 * Uses .collect() — fine at pre-launch table sizes; revisit pagination if any
 * table approaches Convex's 16k-docs-per-transaction read limit.
 */
async function collectRecipients(ctx: QueryCtx): Promise<Recipient[]> {
  const byEmail = new Map<string, Recipient>();
  for (const row of await ctx.db.query("waitlist").collect()) {
    const email = row.email.trim().toLowerCase();
    if (email && !byEmail.has(email)) {
      byEmail.set(email, { email, name: row.name, source: "waitlist" });
    }
  }
  for (const row of await ctx.db.query("feedback").collect()) {
    const email = row.email?.trim().toLowerCase();
    if (email && !byEmail.has(email)) {
      byEmail.set(email, { email, name: row.name, source: "feedback" });
    }
  }
  for (const row of await ctx.db.query("contactMessages").collect()) {
    const email = row.email.trim().toLowerCase();
    if (email && !byEmail.has(email)) {
      byEmail.set(email, { email, name: row.name, source: "contact" });
    }
  }
  return [...byEmail.values()];
}

async function alreadySent(
  ctx: QueryCtx,
  campaign: string,
  email: string,
): Promise<boolean> {
  const hit = await ctx.db
    .query("emailSends")
    .withIndex("by_campaign_email", (q) =>
      q.eq("campaign", campaign).eq("email", email),
    )
    .first();
  return hit !== null;
}

/** Dry-run: who would receive this campaign, without sending anything. */
export const preview = internalQuery({
  args: { campaign: v.string() },
  handler: async (ctx, { campaign }) => {
    const recipients = await collectRecipients(ctx);
    const pending: Recipient[] = [];
    let sent = 0;
    for (const r of recipients) {
      if (await alreadySent(ctx, campaign, r.email)) sent++;
      else pending.push(r);
    }
    const bySource = { waitlist: 0, feedback: 0, contact: 0 };
    for (const r of pending) bySource[r.source]++;
    return {
      campaign,
      totalUnique: recipients.length,
      alreadySent: sent,
      toSend: pending.length,
      bySource,
      sample: pending.slice(0, 25),
    };
  },
});

/**
 * Queue the appreciation email for every recipient not yet recorded under
 * this campaign. Sends at most `limit` per call (default 200) to keep the
 * transaction small — loop while `remaining > 0`. Idempotent: the emailSends
 * row is written in the same transaction that enqueues the email.
 */
export const send = internalMutation({
  args: { campaign: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { campaign, limit }) => {
    const max = Math.min(limit ?? 200, 500);
    const recipients = await collectRecipients(ctx);
    let queued = 0;
    let skipped = 0;
    for (const r of recipients) {
      if (await alreadySent(ctx, campaign, r.email)) {
        skipped++;
        continue;
      }
      if (queued >= max) break;
      await resend.sendEmail(ctx, {
        from: FROM,
        to: r.email,
        replyTo: REPLY_TO,
        subject: SUBJECT,
        html: appreciationHtml(r.name, r.source),
      });
      await ctx.db.insert("emailSends", {
        email: r.email,
        campaign,
        source: r.source,
        sentAt: Date.now(),
      });
      queued++;
    }
    return {
      campaign,
      queued,
      skippedAlreadySent: skipped,
      remaining: recipients.length - skipped - queued,
    };
  },
});

/** Send a single test copy (waitlist variant) to one address. Not recorded. */
export const sendTest = internalMutation({
  args: { to: v.string(), source: v.optional(v.string()) },
  handler: async (ctx, { to, source }) => {
    const variant: Source =
      source === "feedback" || source === "contact" ? source : "waitlist";
    await resend.sendEmail(ctx, {
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: SUBJECT,
      html: appreciationHtml(undefined, variant),
    });
    return { queued: to, variant };
  },
});
