import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Transactional stat counters. The submit/admin mutations bump these in the
 * same transaction as their writes, so the dashboard count queries are O(1)
 * point-reads instead of full-table scans (which throw once a table outgrows
 * Convex's per-query read limits).
 *
 * Keys: waitlist:total|pending|invited|registered, feedback:total,
 * contact:total|unhandled.
 */
export async function bump(ctx: MutationCtx, key: string, delta: number) {
  const existing = await ctx.db
    .query("counters")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + delta });
  } else {
    await ctx.db.insert("counters", { key, value: delta });
  }
}

export async function read(
  ctx: QueryCtx | MutationCtx,
  key: string,
): Promise<number> {
  const doc = await ctx.db
    .query("counters")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return doc?.value ?? 0;
}

/**
 * One-time seed from the existing rows — run after deploying this schema:
 *   npx convex run counters:backfill
 * Safe to re-run; it recomputes from scratch. Uses .collect(), so it must run
 * before the tables outgrow query limits (fine at backfill time).
 */
export const backfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    const waitlist = await ctx.db.query("waitlist").collect();
    const feedback = await ctx.db.query("feedback").collect();
    const contact = await ctx.db.query("contactMessages").collect();

    const values: Record<string, number> = {
      "waitlist:total": waitlist.length,
      "waitlist:pending": waitlist.filter((w) => w.status === "pending").length,
      "waitlist:invited": waitlist.filter((w) => w.status === "invited").length,
      "waitlist:registered": waitlist.filter((w) => w.status === "registered")
        .length,
      "feedback:total": feedback.length,
      "contact:total": contact.length,
      "contact:unhandled": contact.filter((m) => !m.handled).length,
    };

    for (const [key, value] of Object.entries(values)) {
      const existing = await ctx.db
        .query("counters")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { value });
      } else {
        await ctx.db.insert("counters", { key, value });
      }
    }
    return values;
  },
});
