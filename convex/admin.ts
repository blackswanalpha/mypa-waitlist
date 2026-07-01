import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The real access boundary for everything admin. Throws unless the caller is
 * signed in AND their email is in the ADMIN_EMAILS allowlist. Call this at the
 * top of every admin query/mutation.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  const email = (user?.email ?? "").toLowerCase();
  if (!email || !adminEmails().includes(email)) {
    throw new Error("Unauthorized");
  }
  return { userId, email };
}

/** Lets the admin UI branch on auth state without throwing. */
export const whoAmI = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { authed: false, isAdmin: false, email: null as string | null };
    const user = await ctx.db.get(userId);
    const email = (user?.email ?? "").toLowerCase();
    return { authed: true, isAdmin: adminEmails().includes(email), email };
  },
});
