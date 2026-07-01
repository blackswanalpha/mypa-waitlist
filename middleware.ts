import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

/**
 * Wraps every request so Convex Auth can manage the session cookie / token
 * refresh during SSR. We intentionally do NOT redirect /admin here: the admin
 * page renders its own login form when unauthenticated, and the real access
 * boundary is `requireAdmin` (server-side, on every admin query/mutation).
 */
export default convexAuthNextjsMiddleware();

export const config = {
  // Run on everything except static files and Next internals.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
