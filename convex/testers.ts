import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import { bump, read } from "./counters";
import { bumpDaily, utcDay } from "./analytics";
import { limiter, MAX_EMAIL, MAX_NAME, MAX_PHONE } from "./rateLimits";
import type { SendEmailOptions } from "@convex-dev/resend";
import { resend, FROM, REPLY_TO } from "./emails/send";
import { adminNotifyHtml } from "./emails/templates";
import {
  DEFAULT_PUBLIC_ORIGIN,
  testerGuideHtml,
  testerReceivedHtml,
} from "./emails/testerTemplates";

/**
 * The early-tester program. The landing form calls `apply` (through
 * /api/waitlist); an admin approves rows in the Testers tab, which emails the
 * Firebase App Distribution invite link and the install guide.
 *
 * Counters: testers:total|pending|approved|declined, and testers:seq, the
 * last position handed out (never decremented, so a delete cannot make two
 * rows share a number).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTRIBUTION = 200;
const DEFAULT_SLOTS = 40;
const MAX_SOCIALS = 6;

const DEVICE = v.union(v.literal("samsung"), v.literal("android"), v.literal("iphone"));
const STATUS = v.union(v.literal("pending"), v.literal("approved"), v.literal("declined"));

type Status = Doc<"testers">["status"];
type Settings = Pick<Doc<"programSettings">, "signupsOpen" | "slots" | "inviteLink" | "socials">;

const DEFAULTS: Settings = { signupsOpen: true, slots: DEFAULT_SLOTS, inviteLink: undefined, socials: [] };

const capped = (s: string | undefined) => s?.trim().slice(0, MAX_ATTRIBUTION) || undefined;

/** 7–15 digits, optionally led by +, with spaces, dashes, dots or brackets between. */
const PHONE_RE = /^\+?[\d\s().-]{7,}$/;

function cleanName(raw: string, which: "first" | "last"): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) {
    throw new ConvexError({ code: "invalid", message: `Add your ${which} name.` });
  }
  if (name.length > MAX_NAME) {
    throw new ConvexError({ code: "invalid", message: `That ${which} name is too long.` });
  }
  return name;
}

function cleanPhone(raw: string | undefined): string | undefined {
  const phone = raw?.trim().replace(/\s+/g, " ");
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "").length;
  if (phone.length > MAX_PHONE || !PHONE_RE.test(phone) || digits < 7 || digits > 15) {
    throw new ConvexError({ code: "invalid", message: "That phone number doesn't look right." });
  }
  return phone;
}

/** Public site origin for links and images in mail. Not SITE_URL (that is the auth origin). */
function publicOrigin(): string {
  return process.env.PUBLIC_SITE_ORIGIN ?? DEFAULT_PUBLIC_ORIGIN;
}

async function settingsRow(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("programSettings")
    .withIndex("by_key", (q) => q.eq("key", "tester"))
    .unique();
}

async function loadSettings(ctx: QueryCtx | MutationCtx): Promise<Settings> {
  const row = await settingsRow(ctx);
  return row
    ? { signupsOpen: row.signupsOpen, slots: row.slots, inviteLink: row.inviteLink, socials: row.socials }
    : DEFAULTS;
}

/** Spots are claimed in signup order; declined rows give theirs back. */
async function claimed(ctx: QueryCtx | MutationCtx): Promise<number> {
  return (await read(ctx, "testers:pending")) + (await read(ctx, "testers:approved"));
}

/**
 * Who hears about each signup. ADMIN_NOTIFY_EMAILS when set, else
 * ADMIN_EMAILS. Login-only admin addresses on a domain with no inbound mail
 * (mypa.computer has no MX) would bounce, and bounces hurt the sending
 * domain the tester guides go out on.
 */
function notifyEmails(): string[] {
  return (process.env.ADMIN_NOTIFY_EMAILS ?? process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/** PUBLIC — what the landing page shows: the blue tester card or the amber closed card. */
export const program = query({
  args: {},
  handler: async (ctx) => {
    const s = await loadSettings(ctx);
    const taken = await claimed(ctx);
    return {
      open: s.signupsOpen,
      slots: s.slots,
      spotsLeft: Math.max(0, s.slots - taken),
      socials: s.socials,
    };
  },
});

/**
 * PUBLIC — join the tester list. Rejects while signups are closed, so a page
 * loaded before the admin closed them cannot still write. Errors are
 * ConvexErrors so their message survives prod's error redaction.
 */
export const apply = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
    email: v.string(),
    device: DEVICE,
    agreed: v.boolean(),
    // Honeypot: hidden in the form, so a non-empty value means a bot filled it.
    website: v.optional(v.string()),
    source: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    referrerDomain: v.optional(v.string()),
    landingPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await loadSettings(ctx);
    if (args.website) {
      return { duplicate: false, position: 0, slots: s.slots, status: "pending" as Status };
    }

    const firstName = cleanName(args.firstName, "first");
    const lastName = cleanName(args.lastName, "last");
    const phone = cleanPhone(args.phone);
    const email = args.email.trim().toLowerCase();
    if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      throw new ConvexError({ code: "invalid", message: "Please enter a valid email address." });
    }
    if (!args.agreed) {
      throw new ConvexError({ code: "invalid", message: "Tick the box so we can email your invite." });
    }

    const existing = await ctx.db
      .query("testers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      // A returning visitor may correct their details before they are approved.
      if (existing.status === "pending") {
        await ctx.db.patch(existing._id, { device: args.device, firstName, lastName, phone: phone ?? existing.phone });
      }
      return { duplicate: true, position: existing.position, slots: s.slots, status: existing.status };
    }

    if (!s.signupsOpen) {
      throw new ConvexError({
        code: "closed",
        message: "Tester signups are closed right now. Follow us for the next round.",
      });
    }

    const global = await limiter.limit(ctx, "testerApply");
    const perEmail = await limiter.limit(ctx, "testerApplyPerEmail", { key: email });
    if (!global.ok || !perEmail.ok) {
      throw new ConvexError({ code: "busy", message: "Lots of people are joining right now. Try again in a minute." });
    }

    const now = Date.now();
    const position = (await read(ctx, "testers:seq")) + 1;
    await ctx.db.insert("testers", {
      firstName,
      lastName,
      phone,
      email,
      device: args.device,
      status: "pending",
      position,
      source: capped(args.source) ?? "landing",
      createdAt: now,
      utmSource: capped(args.utmSource),
      referrerDomain: capped(args.referrerDomain),
      landingPath: capped(args.landingPath),
    });
    await bump(ctx, "testers:seq", 1);
    await bump(ctx, "testers:total", 1);
    await bump(ctx, "testers:pending", 1);

    const day = utcDay(now);
    await bumpDaily(ctx, day, "signup", "");
    await bumpDaily(ctx, day, "signup_utm", capped(args.utmSource)?.toLowerCase() ?? "(direct)");

    // Queued with this transaction, so mail only goes out if the row commits.
    // A mail that cannot be queued (Resend test mode, bad config) must not
    // cost the visitor their spot: the component call rolls back alone.
    try {
      await resend.sendEmail(ctx, {
        from: FROM,
        to: email,
        replyTo: REPLY_TO,
        subject:
          position <= s.slots
            ? `You're #${position} on the MyPA tester list`
            : "You're on the MyPA waitlist",
        html: testerReceivedHtml({ position, slots: s.slots, device: args.device, firstName }),
      });
    } catch (e) {
      console.error("testers.apply: could not queue the confirmation for", email, e);
    }
    for (const admin of notifyEmails()) {
      try {
        await resend.sendEmail(ctx, {
          from: FROM,
          to: admin,
          subject: `New tester signup #${position}: ${firstName} ${lastName}`,
          html: adminNotifyHtml({
            type: "Tester signup",
            rows: [
              { label: "Name", value: `${firstName} ${lastName}` },
              { label: "Email", value: email },
              { label: "Mobile", value: phone ?? "—" },
              { label: "Phone", value: args.device },
              { label: "Position", value: `#${position} (${s.slots} tester spots)` },
            ],
          }),
        });
      } catch (e) {
        console.error("testers.apply: could not queue the admin notice to", admin, e);
      }
    }

    return { duplicate: false, position, slots: s.slots, status: "pending" as Status };
  },
});

// ─── Admin ──────────────────────────────────────────────────────────────────

/** ADMIN — paginated in signup order, optionally by status. Joins each row's guide-email state. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator, status: v.optional(STATUS) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const status = args.status;
    const q = status
      ? ctx.db.query("testers").withIndex("by_status", (qq) => qq.eq("status", status))
      : ctx.db.query("testers").withIndex("by_createdAt");
    const result = await q.order("asc").paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (row) => {
        const mail = row.guideEmailId
          ? await resend.status(ctx, row.guideEmailId as Parameters<typeof resend.status>[1])
          : null;
        return { ...row, guideStatus: mail?.status ?? null, guideError: mail?.errorMessage ?? null };
      }),
    );
    return { ...result, page };
  },
});

/** ADMIN — counts plus settings for the header cards and the settings panel. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await loadSettings(ctx);
    return {
      settings,
      testMode: process.env.RESEND_TEST_MODE !== "false",
      counts: {
        total: await read(ctx, "testers:total"),
        pending: await read(ctx, "testers:pending"),
        approved: await read(ctx, "testers:approved"),
        declined: await read(ctx, "testers:declined"),
      },
    };
  },
});

/** ADMIN — every approved address, for pasting into the Firebase console. */
export const approvedEmails = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("testers")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(1000);
    return rows.map((r) => r.email);
  },
});

function cleanLink(raw: string): string {
  const link = raw.trim();
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new ConvexError({ code: "invalid", message: "That doesn't look like a link." });
  }
  if (url.protocol !== "https:") {
    throw new ConvexError({ code: "invalid", message: "Links must start with https://" });
  }
  return url.toString();
}

/** ADMIN — change any subset of the program settings. */
export const updateSettings = mutation({
  args: {
    signupsOpen: v.optional(v.boolean()),
    slots: v.optional(v.number()),
    inviteLink: v.optional(v.string()),
    socials: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
  },
  handler: async (ctx, args) => {
    const { email } = await requireAdmin(ctx);
    const patch: Partial<Doc<"programSettings">> = { updatedAt: Date.now(), updatedBy: email };
    if (args.signupsOpen !== undefined) patch.signupsOpen = args.signupsOpen;
    if (args.slots !== undefined) {
      if (!Number.isInteger(args.slots) || args.slots < 1 || args.slots > 10_000) {
        throw new ConvexError({ code: "invalid", message: "Slots must be a whole number from 1 to 10,000." });
      }
      patch.slots = args.slots;
    }
    if (args.inviteLink !== undefined) {
      patch.inviteLink = args.inviteLink.trim() ? cleanLink(args.inviteLink) : undefined;
    }
    if (args.socials !== undefined) {
      if (args.socials.length > MAX_SOCIALS) {
        throw new ConvexError({ code: "invalid", message: `At most ${MAX_SOCIALS} links.` });
      }
      patch.socials = args.socials
        .map((s) => ({ label: s.label.trim().slice(0, 40), url: s.url.trim() }))
        .filter((s) => s.label && s.url)
        .map((s) => ({ label: s.label, url: cleanLink(s.url) }));
    }
    const row = await settingsRow(ctx);
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("programSettings", { key: "tester", ...DEFAULTS, ...patch, updatedAt: Date.now() });
    return null;
  },
});

/** Queue a mail or fail the whole mutation with a message the admin can act on. */
async function queueMail(ctx: MutationCtx, mail: SendEmailOptions & { to: string }) {
  try {
    return await resend.sendEmail(ctx, mail);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new ConvexError({ code: "mail", message: `Couldn't queue the email to ${mail.to}: ${why}` });
  }
}

async function sendGuide(ctx: MutationCtx, row: Doc<"testers">, inviteLink: string) {
  const emailId = await queueMail(ctx, {
    from: FROM,
    to: row.email,
    replyTo: REPLY_TO,
    subject: "You're in: your MyPA tester invite and install guide",
    html: testerGuideHtml({ device: row.device, inviteLink, email: row.email, firstName: row.firstName, origin: publicOrigin() }),
  });
  await ctx.db.patch(row._id, {
    guideEmailId: emailId,
    guideSentAt: Date.now(),
    guideSends: (row.guideSends ?? 0) + 1,
  });
}

async function requireInviteLink(ctx: MutationCtx): Promise<string> {
  const { inviteLink } = await loadSettings(ctx);
  if (!inviteLink) {
    throw new ConvexError({
      code: "setup",
      message: "Add the Firebase invite link in Program settings before approving anyone.",
    });
  }
  return inviteLink;
}

async function moveStatus(ctx: MutationCtx, row: Doc<"testers">, to: Status) {
  await bump(ctx, `testers:${row.status}`, -1);
  await bump(ctx, `testers:${to}`, 1);
}

/**
 * ADMIN — approve one tester and email their invite + install guide in the
 * same transaction. One row per call, so a bad address fails alone.
 */
export const approve = mutation({
  args: { id: v.id("testers") },
  handler: async (ctx, { id }) => {
    const { email } = await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError({ code: "missing", message: "That tester no longer exists." });
    if (row.status === "approved") return { email: row.email, alreadyApproved: true };
    if (row.device === "iphone") {
      throw new ConvexError({
        code: "iphone",
        message: `${row.email} uses an iPhone. The test build is Android-only. Change their phone first if that's wrong.`,
      });
    }
    const inviteLink = await requireInviteLink(ctx);
    await moveStatus(ctx, row, "approved");
    await ctx.db.patch(id, { status: "approved", approvedAt: Date.now(), approvedBy: email });
    await sendGuide(ctx, { ...row, status: "approved" }, inviteLink);
    return { email: row.email, alreadyApproved: false };
  },
});

/** ADMIN — send the guide again (lost email, changed phone, new invite link). */
export const resendGuide = mutation({
  args: { id: v.id("testers") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.status !== "approved") {
      throw new ConvexError({ code: "invalid", message: "Only approved testers get the guide." });
    }
    await sendGuide(ctx, row, await requireInviteLink(ctx));
    return { email: row.email };
  },
});

/** ADMIN — decline, or put back to pending. Neither sends mail. */
export const setStatus = mutation({
  args: { id: v.id("testers"), status: v.union(v.literal("pending"), v.literal("declined")) },
  handler: async (ctx, { id, status }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.status === status) return null;
    await moveStatus(ctx, row, status);
    await ctx.db.patch(id, { status, approvedAt: undefined, approvedBy: undefined });
    return null;
  },
});

/** ADMIN — correct the phone a tester picked (it decides which guide they get). */
export const setDevice = mutation({
  args: { id: v.id("testers"), device: DEVICE },
  handler: async (ctx, { id, device }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError({ code: "missing", message: "That tester no longer exists." });
    await ctx.db.patch(id, { device });
    return null;
  },
});

/** ADMIN — delete a row (spam, test signups). Gives its spot back. */
export const remove = mutation({
  args: { id: v.id("testers") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) return null;
    await ctx.db.delete(id);
    await bump(ctx, "testers:total", -1);
    await bump(ctx, `testers:${row.status}`, -1);
    return null;
  },
});

/** ADMIN — mail the guide to yourself (or a colleague's phone) to check it for real. */
export const sendTestGuide = mutation({
  args: { device: DEVICE, to: v.optional(v.string()) },
  handler: async (ctx, { device, to }) => {
    const { email } = await requireAdmin(ctx);
    const target = (to?.trim() || email).toLowerCase();
    if (target.length > MAX_EMAIL || !EMAIL_RE.test(target)) {
      throw new ConvexError({ code: "invalid", message: "Enter a valid email to send the test to." });
    }
    const inviteLink = await requireInviteLink(ctx);
    await queueMail(ctx, {
      from: FROM,
      to: target,
      replyTo: REPLY_TO,
      subject: `[Test] You're in: your MyPA tester invite and install guide (${device})`,
      html: testerGuideHtml({ device, inviteLink, email: target, origin: publicOrigin() }),
    });
    return { to: target };
  },
});

/**
 * Repair tool: recompute every testers counter from the rows. testers:seq
 * becomes the highest position held, so clearing test rows out of an empty
 * program restarts numbering at #1.
 *   npx convex run testers:recount
 */
export const recount = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("testers").take(10_000);
    const want: Record<string, number> = {
      "testers:total": rows.length,
      "testers:pending": 0,
      "testers:approved": 0,
      "testers:declined": 0,
      "testers:seq": rows.reduce((m, r) => Math.max(m, r.position), 0),
    };
    for (const r of rows) want[`testers:${r.status}`] += 1;
    for (const [key, value] of Object.entries(want)) {
      await bump(ctx, key, value - (await read(ctx, key)));
    }
    return want;
  },
});

export type TesterRow = Doc<"testers"> & { guideStatus: string | null; guideError: string | null };
export type TesterId = Id<"testers">;
