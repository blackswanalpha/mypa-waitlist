import { internalMutation } from "../_generated/server";
import { vOnEmailEventArgs } from "@convex-dev/resend";
import type { Doc } from "../_generated/dataModel";
import { suppress } from "../unsubscribe";

type Stat = keyof Doc<"campaigns">["stats"];

/**
 * Resend webhook → campaign ledger. Each emailSends row records its own
 * delivery state; the campaign's stats count each recipient at most once per
 * outcome, so repeated opens/clicks or replayed webhooks never inflate them.
 * Hard bounces and spam complaints suppress the address for future sends.
 */
export const handle = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (ctx, { id, event }) => {
    const send = await ctx.db
      .query("emailSends")
      .withIndex("by_emailId", (q) => q.eq("emailId", id))
      .unique();
    if (!send) return; // transactional mail — not part of a campaign

    const patch: Partial<Doc<"emailSends">> = {};
    const bumps: Stat[] = [];
    const now = Date.now();

    switch (event.type) {
      case "email.sent":
        if (!send.status || send.status === "queued") patch.status = "sent";
        break;
      case "email.delivered":
        if (send.status !== "delivered") {
          patch.status = "delivered";
          bumps.push("delivered");
        }
        break;
      case "email.delivery_delayed":
        if (send.status !== "delivered") patch.status = "delivery_delayed";
        break;
      case "email.opened":
        if (!send.openedAt) {
          patch.openedAt = now;
          bumps.push("opened");
        }
        break;
      case "email.clicked":
        if (!send.clickedAt) {
          patch.clickedAt = now;
          bumps.push("clicked");
        }
        break;
      case "email.bounced":
        if (send.status !== "bounced") {
          patch.status = "bounced";
          patch.error = event.data.bounce?.message;
          bumps.push("bounced");
          await suppress(ctx, send.email, "bounced");
        }
        break;
      case "email.complained":
        if (send.status !== "complained") {
          patch.status = "complained";
          bumps.push("complained");
          await suppress(ctx, send.email, "complained");
        }
        break;
      case "email.failed":
        if (send.status !== "failed") {
          patch.status = "failed";
          patch.error = event.data.failed?.reason;
          bumps.push("failed");
        }
        break;
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(send._id, patch);
    if (bumps.length > 0 && send.campaignId) {
      const campaign = await ctx.db.get(send.campaignId);
      if (campaign) {
        const stats = { ...campaign.stats };
        for (const b of bumps) stats[b] += 1;
        await ctx.db.patch(campaign._id, { stats });
      }
    }
  },
});
