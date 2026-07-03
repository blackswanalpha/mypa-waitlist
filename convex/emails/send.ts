import { internalMutation } from "../_generated/server";
import { components } from "../_generated/api";
import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import {
  waitlistConfirmationHtml,
  feedbackThanksHtml,
  contactThanksHtml,
  adminNotifyHtml,
} from "./templates";

/**
 * Resend component instance. testMode only delivers to verified/test addresses;
 * flip it off in prod by setting RESEND_TEST_MODE=false (and a verified FROM).
 */
export const resend: Resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== "false",
});

// Sender resolution, most specific wins:
//   1. RESEND_FROM — full header, e.g. 'MyPA <hello@mypa.computer>'
//   2. EMAIL_DOMAIN — a Resend-verified domain; sender becomes hello@<domain>
//   3. onboarding@resend.dev — Resend's shared test sender (works without a domain)
export const FROM =
  process.env.RESEND_FROM ??
  (process.env.EMAIL_DOMAIN
    ? `MyPA <hello@${process.env.EMAIL_DOMAIN}>`
    : "MyPA <onboarding@resend.dev>");

// Replies to automated mail should land somewhere a human reads.
export const REPLY_TO = process.env.EMAIL_DOMAIN
  ? [`hello@${process.env.EMAIL_DOMAIN}`]
  : undefined;

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export const sendWaitlistEmails = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await resend.sendEmail(ctx, {
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      subject: "Welcome to MyPA — your spot is saved 🌿",
      html: waitlistConfirmationHtml(name),
    });
    for (const admin of adminEmails()) {
      await resend.sendEmail(ctx, {
        from: FROM,
        to: admin,
        subject: `New waitlist signup: ${email}`,
        html: adminNotifyHtml({
          type: "Waitlist",
          rows: [
            { label: "Name", value: name },
            { label: "Email", value: email },
          ],
        }),
      });
    }
  },
});

export const sendFeedbackEmails = internalMutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    rating: v.optional(v.number()),
    message: v.string(),
  },
  handler: async (ctx, { name, email, rating, message }) => {
    // Confirmation only when the sender left an email.
    if (email) {
      await resend.sendEmail(ctx, {
        from: FROM,
        to: email,
        replyTo: REPLY_TO,
        subject: "Thank you — your feedback just shaped MyPA",
        html: feedbackThanksHtml(name),
      });
    }
    for (const admin of adminEmails()) {
      await resend.sendEmail(ctx, {
        from: FROM,
        to: admin,
        subject: "New MyPA feedback",
        html: adminNotifyHtml({
          type: "Feedback",
          rows: [
            { label: "Name", value: name ?? "—" },
            { label: "Email", value: email ?? "—" },
            { label: "Rating", value: rating ? `${rating}/5` : "—" },
            { label: "Message", value: message },
          ],
        }),
      });
    }
  },
});

export const sendContactEmails = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { name, email, subject, message }) => {
    await resend.sendEmail(ctx, {
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      subject: "We've got your message — MyPA",
      html: contactThanksHtml(name),
    });
    for (const admin of adminEmails()) {
      await resend.sendEmail(ctx, {
        from: FROM,
        to: admin,
        subject: `New contact message: ${subject}`,
        html: adminNotifyHtml({
          type: "Contact",
          rows: [
            { label: "Name", value: name },
            { label: "Email", value: email },
            { label: "Subject", value: subject },
            { label: "Message", value: message },
          ],
        }),
      });
    }
  },
});
