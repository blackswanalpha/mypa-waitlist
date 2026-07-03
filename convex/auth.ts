import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { DataModel } from "./_generated/dataModel";

/**
 * The admin login is invite-only: only emails listed in the ADMIN_EMAILS
 * Convex env var can ever create an account or sign in. This is the first of
 * two gates — every admin query/mutation re-checks the allowlist via
 * `requireAdmin` (see ./admin.ts) as defense in depth.
 */
function isAllowlisted(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        // profile() only runs on the signUp flow, so this gates account
        // creation without touching sign-in. Without it, anyone who learns an
        // ADMIN_EMAILS address could register it (with their own password)
        // before the real admin does — there is no email-ownership check.
        // Bootstrap flow: set ALLOW_ADMIN_SIGNUP=true, create the account,
        // unset it again (see README).
        if (process.env.ALLOW_ADMIN_SIGNUP !== "true") {
          throw new Error("Sign-up is disabled.");
        }
        const email = String(params.email ?? "").toLowerCase();
        if (!isAllowlisted(email)) {
          throw new Error("This deployment is invite-only.");
        }
        return {
          email,
          name: params.name ? String(params.name) : email,
        };
      },
    }),
  ],
});
