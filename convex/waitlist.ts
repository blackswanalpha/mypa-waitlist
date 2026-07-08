import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./admin";
import { bump, read } from "./counters";
import { bumpDaily, utcDay } from "./analytics";
import {
  limiter,
  MAX_NAME,
  MAX_EMAIL,
  MAX_PHONE,
} from "./rateLimits";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const CODE_LENGTH = 8;
const MAX_ATTRIBUTION = 200;

function randomReferralCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

/** Mint a code that no existing row holds (collision odds are ~36^-8). */
async function mintReferralCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomReferralCode();
    const clash = await ctx.db
      .query("waitlist")
      .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
      .first();
    if (!clash) return code;
  }
  throw new Error("Could not allocate a referral code — please retry.");
}

const capped = (s: string | undefined) =>
  s?.trim().slice(0, MAX_ATTRIBUTION) || undefined;

/**
 * PUBLIC — no auth gate. Called from the landing page via useMutation.
 * Returns { duplicate } so the UI can show a friendly "already on the list",
 * plus the row's referralCode/position so the success card can render the
 * share link (returned for duplicates too — returning users keep their link).
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
    // First-touch attribution captured by lib/attribution.ts.
    referredBy: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    utmTerm: v.optional(v.string()),
    utmContent: v.optional(v.string()),
    gclid: v.optional(v.string()),
    fbclid: v.optional(v.string()),
    referrerDomain: v.optional(v.string()),
    landingPath: v.optional(v.string()),
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
      return {
        ok: true as const,
        duplicate: true as const,
        referralCode: existing.referralCode,
        position: existing.position,
      };
    }

    // Resolve the referrer BEFORE inserting so a self-referral via a
    // just-minted code is impossible and dangling codes are simply dropped.
    const referredBy = capped(args.referredBy)?.toLowerCase();
    const referrer = referredBy
      ? await ctx.db
          .query("waitlist")
          .withIndex("by_referralCode", (q) => q.eq("referralCode", referredBy))
          .first()
      : null;

    const referralCode = await mintReferralCode(ctx);
    const position = (await read(ctx, "waitlist:total")) + 1;
    const now = Date.now();

    await ctx.db.insert("waitlist", {
      name,
      email,
      phone,
      status: "pending",
      source: args.source ?? "landing",
      createdAt: now,
      consentAt: now,
      referralCode,
      referralCount: 0,
      position,
      referredBy: referrer ? referredBy : undefined,
      utmSource: capped(args.utmSource),
      utmMedium: capped(args.utmMedium),
      utmCampaign: capped(args.utmCampaign),
      utmTerm: capped(args.utmTerm),
      utmContent: capped(args.utmContent),
      gclid: capped(args.gclid),
      fbclid: capped(args.fbclid),
      referrerDomain: capped(args.referrerDomain),
      landingPath: capped(args.landingPath),
    });
    await bump(ctx, "waitlist:total", 1);
    await bump(ctx, "waitlist:pending", 1);

    if (referrer && referrer.email !== email) {
      await ctx.db.patch(referrer._id, {
        referralCount: (referrer.referralCount ?? 0) + 1,
      });
      await bump(ctx, "waitlist:referred", 1);
    }

    const day = utcDay(now);
    await bumpDaily(ctx, day, "signup", "");
    await bumpDaily(
      ctx,
      day,
      "signup_utm",
      capped(args.utmSource)?.toLowerCase() ?? "(direct)",
    );

    // Side-effects run only if this transaction commits.
    await ctx.scheduler.runAfter(0, internal.emails.send.sendWaitlistEmails, {
      name,
      email,
    });

    return {
      ok: true as const,
      duplicate: false as const,
      referralCode,
      position,
    };
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

/** ADMIN — top referrers for the Referrals tab. */
export const referralLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("waitlist")
      .withIndex("by_referralCount")
      .order("desc")
      .take(20);
    return {
      totalReferred: await read(ctx, "waitlist:referred"),
      leaders: rows
        .filter((r) => (r.referralCount ?? 0) > 0)
        .map((r) => ({
          _id: r._id,
          name: r.name,
          email: r.email,
          referralCode: r.referralCode,
          referralCount: r.referralCount ?? 0,
          position: r.position,
        })),
    };
  },
});

/**
 * One-time seed after deploying the referral schema — assigns positions (in
 * signup order) and referral codes to rows that predate the feature:
 *   npx convex run waitlist:backfillReferrals
 * Idempotent: rows that already have values are left untouched. Uses
 * .collect(), so run it while the table is still small (same caveat as
 * counters:backfill).
 */
export const backfillReferrals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("waitlist")
      .withIndex("by_createdAt")
      .order("asc")
      .collect();
    const taken = new Set(
      rows.map((r) => r.referralCode).filter((c): c is string => !!c),
    );
    let nextPosition = 1;
    let patched = 0;
    for (const row of rows) {
      const patch: {
        position?: number;
        referralCode?: string;
        referralCount?: number;
      } = {};
      if (row.position === undefined) patch.position = nextPosition;
      nextPosition = Math.max(nextPosition, (row.position ?? nextPosition)) + 1;
      if (!row.referralCode) {
        let code = randomReferralCode();
        while (taken.has(code)) code = randomReferralCode();
        taken.add(code);
        patch.referralCode = code;
      }
      if (row.referralCount === undefined) patch.referralCount = 0;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(row._id, patch);
        patched++;
      }
    }
    return { rows: rows.length, patched };
  },
});
