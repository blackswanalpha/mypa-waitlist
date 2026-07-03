import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";

/**
 * Push whitelisted ("invited") signups to the product backend's launch
 * allowlist: POST {BACKEND_URL}/api/v1/waitlist-sync/import authenticated by
 * the X-Service-Key shared secret (BACKEND_SERVICE_KEY must equal the
 * backend's CONVEX_SERVICE_KEY). The backend upsert is idempotent, so
 * re-syncing (includeSynced) is always safe.
 */

/** Actions have no ctx.db, so the admin check runs through a query. */
export const assertAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
  },
});

export const unsyncedInvited = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    includeSynced: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("waitlist")
      .withIndex("by_status", (q) => q.eq("status", "invited"))
      .order("desc")
      .paginate({ cursor: args.cursor, numItems: 200 });
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      rows: page.page
        .filter((r) => args.includeSynced || r.syncedAt === undefined)
        .map((r) => ({ id: r._id, email: r.email, name: r.name })),
    };
  },
});

export const markSynced = internalMutation({
  args: { ids: v.array(v.id("waitlist")), at: v.number() },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.patch(id, { syncedAt: args.at });
    }
  },
});

export const syncToBackend = action({
  args: { includeSynced: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.sync.assertAdmin, {});

    const backendUrl = process.env.BACKEND_URL;
    const serviceKey = process.env.BACKEND_SERVICE_KEY;
    if (!backendUrl || !serviceKey) {
      throw new Error(
        "Sync is not configured — set BACKEND_URL and BACKEND_SERVICE_KEY " +
          "on the Convex deployment.",
      );
    }
    const endpoint = `${backendUrl.replace(/\/$/, "")}/api/v1/waitlist-sync/import`;

    let cursor: string | null = null;
    let attempted = 0;
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    // Page batches of ≤200 (backend caps at 500); each successful batch is
    // stamped syncedAt before the next one, so a mid-run failure never loses
    // progress.
    for (;;) {
      const page: {
        continueCursor: string;
        isDone: boolean;
        rows: { id: Id<"waitlist">; email: string; name: string }[];
      } = await ctx.runQuery(internal.sync.unsyncedInvited, {
        cursor,
        includeSynced: args.includeSynced,
      });

      if (page.rows.length > 0) {
        attempted += page.rows.length;
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Service-Key": serviceKey,
            },
            body: JSON.stringify({
              entries: page.rows.map((r) => ({ email: r.email, name: r.name })),
            }),
          });
          if (res.ok) {
            await ctx.runMutation(internal.sync.markSynced, {
              ids: page.rows.map((r) => r.id),
              at: Date.now(),
            });
            synced += page.rows.length;
          } else {
            failed += page.rows.length;
            const body = (await res.text()).slice(0, 200);
            errors.push(`HTTP ${res.status}: ${body}`);
          }
        } catch (e) {
          failed += page.rows.length;
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { attempted, synced, failed, errors };
  },
});
