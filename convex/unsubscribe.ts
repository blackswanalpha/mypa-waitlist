import { v } from "convex/values";
import { httpAction, internalMutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./admin";

/**
 * One-click unsubscribe for broadcast email. Every campaign mail carries a
 * link (and a List-Unsubscribe header) to {CONVEX_SITE_URL}/unsubscribe with
 * the address and an HMAC of it, so nobody can unsubscribe an address they
 * don't hold a link for. The key is UNSUBSCRIBE_SECRET, falling back to the
 * Resend API key, which every sending deployment already has.
 */

function secret(): string {
  const key = process.env.UNSUBSCRIBE_SECRET ?? process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "Set UNSUBSCRIBE_SECRET (or RESEND_API_KEY) on the Convex deployment.",
    );
  }
  return key;
}

async function sign(email: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(email));
  return [...new Uint8Array(mac)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function unsubscribeUrl(email: string): Promise<string> {
  const base = (process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
  const token = await sign(email);
  return `${base}/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`;
}

export async function isSuppressed(
  ctx: QueryCtx | MutationCtx,
  email: string,
): Promise<boolean> {
  const hit = await ctx.db
    .query("suppressions")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  return hit !== null;
}

export async function suppress(
  ctx: MutationCtx,
  email: string,
  reason: "unsubscribed" | "bounced" | "complained",
) {
  const address = email.trim().toLowerCase();
  if (await isSuppressed(ctx, address)) return;
  await ctx.db.insert("suppressions", {
    email: address,
    reason,
    createdAt: Date.now(),
  });
}

export const record = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await suppress(ctx, email, "unsubscribed");
  },
});

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — MyPA</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#141b17;color:#e3e9df;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<main style="max-width:420px;padding:32px;text-align:center;">
<p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#7fae8b;margin:0 0 16px;">MyPA</p>
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;margin:0 0 12px;">${title}</h1>
<p style="color:#97a699;line-height:1.6;margin:0;">${body}</p>
</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** GET shows the confirmation page; POST is RFC 8058 one-click. */
export const handleHttp = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("t") ?? "";
  if (!email || token !== (await sign(email))) {
    return page(
      "Link not recognised",
      "This unsubscribe link is incomplete or has been altered. Reply to any MyPA email and we'll remove you by hand.",
      400,
    );
  }
  await ctx.runMutation(internal.unsubscribe.record, { email });
  if (req.method === "POST") return new Response(null, { status: 200 });
  return page(
    "You're unsubscribed",
    "We won't send you any more updates. Your waitlist spot, if you have one, is unaffected.",
  );
});

/** ADMIN — the suppression list, newest first. */
export const listForAdmin = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("suppressions")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
