import { NextResponse } from "next/server";
import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { applyDeviceCookie } from "@/lib/device-cookie";

/**
 * Wraps every request so Convex Auth can manage the session cookie / token
 * refresh during SSR. We intentionally do NOT redirect /admin here: the admin
 * page renders its own login form when unauthenticated, and the real access
 * boundary is `requireAdmin` (server-side, on every admin query/mutation).
 *
 * The handler mints or renews the device cookie on page loads
 * (lib/device-cookie.ts). Convex Auth ports its own cookies onto the response
 * it returns.
 */
export default convexAuthNextjsMiddleware(
  (request) => applyDeviceCookie(request, NextResponse.next({ request: { headers: request.headers } })),
  {
    // In Docker the Next server and the browser reach the Convex backend at
    // different addresses: the middleware's server-side calls use
    // CONVEX_SERVER_URL (e.g. http://backend:3210 on the compose network),
    // while the client bundle keeps the build-time NEXT_PUBLIC_CONVEX_URL.
    // Outside Docker CONVEX_SERVER_URL is unset and behaviour is unchanged.
    convexUrl: process.env.CONVEX_SERVER_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL,
  },
);

export const config = {
  // Run on everything except static files and Next internals.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
