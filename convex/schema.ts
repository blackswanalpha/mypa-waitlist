import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * mypa-waitlist schema — an ISOLATED deployment, separate from the product
 * backend. Holds marketing-site submissions plus the Convex Auth tables that
 * back the admin login.
 */
export default defineSchema({
  // users, authAccounts, authSessions, authVerificationCodes, ...
  ...authTables,

  // Early-access signups. "invited" is the whitelisted state (labelled
  // "Whitelisted" in the admin UI): those rows are synced to the product
  // backend's launch allowlist.
  waitlist: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("invited"),
      v.literal("registered"),
    ),
    source: v.optional(v.string()), // e.g. "landing", "hero"
    createdAt: v.number(),
    consentAt: v.optional(v.number()), // when the signup ticked the consent box
    whitelistedAt: v.optional(v.number()), // when status flipped to "invited"
    syncedAt: v.optional(v.number()), // last successful push to the backend
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"]),

  // Free-form product feedback (name/email optional, message required).
  feedback: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    rating: v.optional(v.number()), // 1..5
    message: v.string(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  // Dashboard stat counters, maintained transactionally by the submit/admin
  // mutations so the count queries never need a full-table scan (which would
  // start throwing once a table outgrows Convex's per-query read limits).
  counters: defineTable({
    key: v.string(), // e.g. "waitlist:total", "contact:unhandled"
    value: v.number(),
  }).index("by_key", ["key"]),

  // One row per (campaign, recipient) — the dedupe ledger for one-off email
  // campaigns (see emails/campaign.ts), so a re-run can never double-send.
  emailSends: defineTable({
    email: v.string(),
    campaign: v.string(),
    source: v.string(), // how we know them: "waitlist" | "feedback" | "contact"
    sentAt: v.number(),
  }).index("by_campaign_email", ["campaign", "email"]),

  // Contact-form messages, with a handled flag for the admin triage view.
  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    handled: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_handled", ["handled"]),
});
