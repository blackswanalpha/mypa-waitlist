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
    // Viral loop — minted at insert (backfilled for older rows).
    referralCode: v.optional(v.string()), // 8-char base36 share code
    referredBy: v.optional(v.string()), // referralCode of the referring signup
    referralCount: v.optional(v.number()), // signups attributed to this row
    position: v.optional(v.number()), // 1-based queue position at signup
    // First-touch acquisition attribution, captured client-side at signup.
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    utmTerm: v.optional(v.string()),
    utmContent: v.optional(v.string()),
    gclid: v.optional(v.string()),
    fbclid: v.optional(v.string()),
    referrerDomain: v.optional(v.string()), // e.g. "news.ycombinator.com"
    landingPath: v.optional(v.string()), // first page seen, no query string
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"])
    .index("by_referralCode", ["referralCode"])
    .index("by_referralCount", ["referralCount"]),

  // Raw first-party page views (no cookies, no IP, no full UA — coarse device
  // class only). Pruned to ~90 days by the daily cron; the durable history
  // lives in trafficDaily.
  pageviews: defineTable({
    ts: v.number(),
    day: v.string(), // "YYYY-MM-DD" UTC, server-computed
    sessionId: v.string(), // client-minted uuid, sessionStorage-scoped
    newSession: v.boolean(), // true on the first view of a session
    path: v.string(), // pathname only, query string stripped
    referrerDomain: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    device: v.union(
      v.literal("mobile"),
      v.literal("tablet"),
      v.literal("desktop"),
    ),
  }).index("by_day", ["day"]),

  // Per-day aggregates, bumped in the same transaction as the pageview insert
  // (and by waitlist.submit for signup dims) so admin charts never scan raw
  // rows. dimension: "views" | "sessions" | "path" | "ref" | "utm" | "device"
  // | "signup" | "signup_utm"; value is "" for the scalar dims.
  trafficDaily: defineTable({
    day: v.string(),
    dimension: v.string(),
    value: v.string(),
    count: v.number(),
  })
    .index("by_day_dim_value", ["day", "dimension", "value"])
    .index("by_dim_day", ["dimension", "day"]),

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
