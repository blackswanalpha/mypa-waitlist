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

  // Early-access signups (name + email → whitelisted/registered at launch).
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
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  // Free-form product feedback (name/email optional, message required).
  feedback: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    rating: v.optional(v.number()), // 1..5
    message: v.string(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

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
