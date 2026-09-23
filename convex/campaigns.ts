import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import { read } from "./counters";
import { resend, FROM, REPLY_TO, RESEND_TEST_MODE } from "./emails/send";
import { campaignHtml } from "./emails/templates";
import { isSuppressed, unsubscribeUrl } from "./unsubscribe";

/**
 * The admin email pipeline: draft → test → send → track.
 *
 * Sending walks the three source tables (waitlist, feedback, contact) one
 * page per transaction via a self-scheduling internal mutation, so no single
 * transaction reads the whole audience. Each recipient is checked against the
 * suppression list and the emailSends ledger before it is queued, and the
 * ledger row is written in the same transaction as the enqueue — a retried or
 * resumed batch can never double-send. Cancelling flips the status; the next
 * batch sees it and stops.
 */

const STATUS = v.union(
  v.literal("pending"),
  v.literal("invited"),
  v.literal("registered"),
);

const content = {
  name: v.string(),
  subject: v.string(),
  preheader: v.string(),
  heading: v.string(),
  body: v.string(),
  ctaLabel: v.optional(v.string()),
  ctaUrl: v.optional(v.string()),
  audience: v.object({
    waitlist: v.array(STATUS),
    feedback: v.boolean(),
    contact: v.boolean(),
  }),
};

const EMPTY_STATS = {
  queued: 0,
  skipped: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  complained: 0,
  failed: 0,
};

const BATCH = 100;
type Phase = "waitlist" | "feedback" | "contact";
const PHASES: Phase[] = ["waitlist", "feedback", "contact"];

function validate(c: {
  name: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  if (!c.name.trim()) throw new ConvexError("Give the campaign a name.");
  if (c.subject.trim().length < 3) throw new ConvexError("Add a subject line.");
  if (c.subject.length > 200) throw new ConvexError("Keep the subject under 200 characters.");
  if (!c.heading.trim()) throw new ConvexError("Add a heading.");
  if (c.body.trim().length < 10) throw new ConvexError("The body is too short.");
  if (c.body.length > 20000) throw new ConvexError("The body is too long.");
  if (c.ctaUrl && !/^https?:\/\//.test(c.ctaUrl.trim())) {
    throw new ConvexError("The button link must start with http:// or https://");
  }
  if (!!c.ctaLabel?.trim() !== !!c.ctaUrl?.trim()) {
    throw new ConvexError("A button needs both a label and a link.");
  }
}

async function loadDraft(ctx: MutationCtx, id: Id<"campaigns">) {
  const doc = await ctx.db.get(id);
  if (!doc) throw new ConvexError("Campaign not found.");
  if (doc.status !== "draft") {
    throw new ConvexError("Only drafts can be changed — duplicate it instead.");
  }
  return doc;
}

/** ADMIN — sender configuration, so the UI can say why mail isn't arriving. */
export const config = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return {
      from: FROM,
      replyTo: REPLY_TO[0],
      testMode: RESEND_TEST_MODE,
      apiKey: !!process.env.RESEND_API_KEY,
      webhook: !!process.env.RESEND_WEBHOOK_SECRET,
      verifiedSender: !FROM.includes("resend.dev"),
      webhookUrl: `${(process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "")}/resend-webhook`,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("campaigns")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(100);
  },
});

export const get = query({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(id);
  },
});

/**
 * ADMIN — upper bound on the audience from the O(1) counters. Real sends are
 * lower: addresses shared across tables, anonymous feedback and suppressed
 * addresses are skipped.
 */
export const audienceEstimate = query({
  args: { audience: content.audience },
  handler: async (ctx, { audience }) => {
    await requireAdmin(ctx);
    let total = 0;
    for (const s of audience.waitlist) total += await read(ctx, `waitlist:${s}`);
    if (audience.feedback) total += await read(ctx, "feedback:total");
    if (audience.contact) total += await read(ctx, "contact:total");
    return total;
  },
});

export const create = mutation({
  args: content,
  handler: async (ctx, args) => {
    const { email } = await requireAdmin(ctx);
    validate(args);
    const now = Date.now();
    return await ctx.db.insert("campaigns", {
      ...args,
      status: "draft",
      stats: EMPTY_STATS,
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: { id: v.id("campaigns"), ...content },
  handler: async (ctx, { id, ...args }) => {
    await requireAdmin(ctx);
    await loadDraft(ctx, id);
    validate(args);
    await ctx.db.patch(id, { ...args, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await loadDraft(ctx, id);
    await ctx.db.delete(id);
  },
});

export const duplicate = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }) => {
    const { email } = await requireAdmin(ctx);
    const doc = await ctx.db.get(id);
    if (!doc) throw new ConvexError("Campaign not found.");
    const now = Date.now();
    return await ctx.db.insert("campaigns", {
      name: `${doc.name} (copy)`,
      subject: doc.subject,
      preheader: doc.preheader,
      heading: doc.heading,
      body: doc.body,
      ctaLabel: doc.ctaLabel,
      ctaUrl: doc.ctaUrl,
      audience: doc.audience,
      status: "draft",
      stats: EMPTY_STATS,
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Resend throws synchronously without an API key, and in test mode for any
 * address outside @resend.dev — so both are checked before a send starts
 * rather than discovered one failed batch at a time.
 */
function assertCanSend(to?: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new ConvexError("RESEND_API_KEY is not set on the Convex deployment.");
  }
  if (RESEND_TEST_MODE && (to === undefined || !to.endsWith("@resend.dev"))) {
    throw new ConvexError(
      to === undefined
        ? "Resend test mode is on, so real addresses can't receive mail. Set RESEND_TEST_MODE=false with a verified sender."
        : "Resend test mode is on — only @resend.dev test addresses (e.g. delivered@resend.dev) can receive mail.",
    );
  }
}

async function enqueue(
  ctx: MutationCtx,
  campaign: Doc<"campaigns">,
  to: string,
  name: string | undefined,
  subjectPrefix = "",
) {
  const unsub = await unsubscribeUrl(to);
  return await resend.sendEmail(ctx, {
    from: FROM,
    to,
    replyTo: REPLY_TO,
    subject: subjectPrefix + campaign.subject,
    html: campaignHtml(campaign, { name, unsubscribeUrl: unsub }),
    headers: [
      { name: "List-Unsubscribe", value: `<${unsub}>` },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ],
  });
}

/** ADMIN — one copy to one address, subject marked [Test]. Not recorded. */
export const sendTest = mutation({
  args: { id: v.id("campaigns"), to: v.string() },
  handler: async (ctx, { id, to }) => {
    await requireAdmin(ctx);
    const campaign = await ctx.db.get(id);
    if (!campaign) throw new ConvexError("Campaign not found.");
    const address = to.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      throw new ConvexError("Enter a valid email address.");
    }
    assertCanSend(address);
    await enqueue(ctx, campaign, address, undefined, "[Test] ");
    return { to: address };
  },
});

/** ADMIN — start sending a draft to its audience. */
export const start = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const campaign = await loadDraft(ctx, id);
    const a = campaign.audience;
    if (a.waitlist.length === 0 && !a.feedback && !a.contact) {
      throw new ConvexError("Pick at least one audience.");
    }
    assertCanSend();
    await ctx.db.patch(id, {
      status: "sending",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.campaigns.sendBatch, {
      id,
      phase: "waitlist",
      cursor: null,
    });
  },
});

/** ADMIN — stop a send in progress. Already-queued mail still goes out. */
export const cancel = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.status !== "sending") return;
    await ctx.db.patch(id, {
      status: "cancelled",
      finishedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

function inPhase(audience: Doc<"campaigns">["audience"], phase: Phase) {
  if (phase === "waitlist") return audience.waitlist.length > 0;
  return audience[phase];
}

async function pageOf(
  ctx: MutationCtx,
  phase: Phase,
  cursor: string | null,
): Promise<{
  rows: { email?: string; name?: string; status?: string }[];
  isDone: boolean;
  continueCursor: string;
}> {
  const opts = { cursor, numItems: BATCH };
  const res =
    phase === "waitlist"
      ? await ctx.db.query("waitlist").withIndex("by_createdAt").paginate(opts)
      : phase === "feedback"
        ? await ctx.db.query("feedback").withIndex("by_createdAt").paginate(opts)
        : await ctx.db
            .query("contactMessages")
            .withIndex("by_createdAt")
            .paginate(opts);
  return {
    rows: res.page.map((r) => ({
      email: r.email,
      name: r.name,
      status: "status" in r ? r.status : undefined,
    })),
    isDone: res.isDone,
    continueCursor: res.continueCursor,
  };
}

export const sendBatch = internalMutation({
  args: {
    id: v.id("campaigns"),
    phase: v.union(v.literal("waitlist"), v.literal("feedback"), v.literal("contact")),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { id, phase, cursor }) => {
    const campaign = await ctx.db.get(id);
    if (!campaign || campaign.status !== "sending") return;

    let queued = 0;
    let skipped = 0;
    let failed = 0;
    let next: { phase: Phase; cursor: string | null } | null = null;

    if (inPhase(campaign.audience, phase)) {
      const page = await pageOf(ctx, phase, cursor);
      for (const row of page.rows) {
        const email = row.email?.trim().toLowerCase();
        if (!email) continue;
        if (
          phase === "waitlist" &&
          !campaign.audience.waitlist.includes(row.status as Doc<"waitlist">["status"])
        ) {
          continue;
        }
        const already = await ctx.db
          .query("emailSends")
          .withIndex("by_campaign_email", (q) => q.eq("campaign", id).eq("email", email))
          .first();
        if (already || (await isSuppressed(ctx, email))) {
          skipped++;
          continue;
        }
        // A rejected enqueue (bad address, config changed mid-send) rolls
        // back only the component call; it is recorded and the batch goes on.
        try {
          const emailId = await enqueue(ctx, campaign, email, row.name);
          await ctx.db.insert("emailSends", {
            email,
            campaign: id,
            campaignId: id,
            source: phase,
            sentAt: Date.now(),
            emailId,
            status: "queued",
          });
          queued++;
        } catch (e) {
          await ctx.db.insert("emailSends", {
            email,
            campaign: id,
            campaignId: id,
            source: phase,
            sentAt: Date.now(),
            status: "failed",
            error: e instanceof Error ? e.message.slice(0, 300) : String(e),
          });
          failed++;
        }
      }
      if (!page.isDone) next = { phase, cursor: page.continueCursor };
    }

    if (!next) {
      const i = PHASES.indexOf(phase);
      if (i < PHASES.length - 1) next = { phase: PHASES[i + 1], cursor: null };
    }

    const stats = {
      ...campaign.stats,
      queued: campaign.stats.queued + queued,
      skipped: campaign.stats.skipped + skipped,
      failed: campaign.stats.failed + failed,
    };
    if (next) {
      await ctx.db.patch(id, { stats });
      await ctx.scheduler.runAfter(0, internal.campaigns.sendBatch, { id, ...next });
    } else {
      await ctx.db.patch(id, {
        stats,
        status: "sent",
        finishedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/** ADMIN — per-recipient delivery ledger for one campaign, newest first. */
export const recipients = query({
  args: { id: v.id("campaigns"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { id, paginationOpts }) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("emailSends")
      .withIndex("by_campaign_sentAt", (q) => q.eq("campaign", id))
      .order("desc")
      .paginate(paginationOpts);
  },
});
