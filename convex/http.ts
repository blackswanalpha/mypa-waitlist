import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { resend } from "./emails/send";
import { handleHttp as unsubscribe } from "./unsubscribe";

const http = httpRouter();

// Registers the Convex Auth HTTP routes (token exchange, etc.).
auth.addHttpRoutes(http);

// Resend delivery events (delivered, opened, bounced, …). Point a Resend
// webhook at {CONVEX_SITE_URL}/resend-webhook and set RESEND_WEBHOOK_SECRET.
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => resend.handleResendEventWebhook(ctx, req)),
});

// Footer link (GET) and List-Unsubscribe one-click (POST).
http.route({ path: "/unsubscribe", method: "GET", handler: unsubscribe });
http.route({ path: "/unsubscribe", method: "POST", handler: unsubscribe });

export default http;
