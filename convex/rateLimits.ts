import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

/**
 * Throttles for the PUBLIC mutations. Convex mutations can't see the client
 * IP, so the pragmatic mitigation set is: a global token bucket (caps burst
 * abuse — every accepted submit fans out email to the signer AND every
 * admin), a per-email bucket (caps retry hammering), plus the honeypot field
 * and length caps in the mutations themselves.
 */
export const limiter = new RateLimiter(components.rateLimiter, {
  waitlistSubmit: { kind: "token bucket", rate: 30, period: MINUTE },
  waitlistSubmitPerEmail: { kind: "token bucket", rate: 5, period: HOUR },
  contactSubmit: { kind: "token bucket", rate: 15, period: MINUTE },
  contactSubmitPerEmail: { kind: "token bucket", rate: 5, period: HOUR },
  feedbackSubmit: { kind: "token bucket", rate: 15, period: MINUTE },
});

/** Shared server-side length caps (mirrored by the zod schemas client-side). */
export const MAX_NAME = 100;
export const MAX_EMAIL = 254;
export const MAX_PHONE = 32;
export const MAX_SUBJECT = 200;
export const MAX_MESSAGE = 5000;
