#!/usr/bin/env node
/**
 * Smoke-test the dockerised stack end-to-end against the running backend:
 *
 *   1. public waitlist submit + duplicate detection
 *   2. admin query rejects anonymous callers
 *   3. Convex Auth password sign-up/sign-in mints working JWTs
 *      (proves JWT_PRIVATE_KEY / JWKS / SITE_ORIGIN wiring)
 *   4. admin query succeeds with the minted token
 *   5. non-allowlisted sign-up is rejected
 *
 * Usage:  SMOKE_ADMIN_EMAIL=you@example.com SMOKE_ADMIN_PASSWORD=... \
 *           node scripts/docker-smoke.mjs [convexUrl]
 *
 * SMOKE_ADMIN_EMAIL must be in the deployment's ADMIN_EMAILS. Steps 3–4 are
 * skipped if the credentials are not provided. Leaves one smoke row in the
 * waitlist table (fixed email, so re-runs don't accumulate).
 */
import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "node:fs";

const url =
  process.argv[2] ??
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m)?.[1]
    ?.trim() ??
  "http://127.0.0.1:3210";

let failures = 0;
const ok = (name) => console.log(`  ✓ ${name}`);
const fail = (name, detail) => {
  failures++;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
};

console.log(`Smoke-testing Convex backend at ${url}\n`);
const anon = new ConvexHttpClient(url);

// 1. public waitlist submit + duplicate detection
const smokeEmail = "docker-smoke@example.invalid";
try {
  const first = await anon.mutation("waitlist:submit", {
    name: "Docker Smoke",
    email: smokeEmail,
    source: "docker-smoke",
  });
  if (first?.ok) ok(`waitlist:submit accepted (duplicate=${first.duplicate})`);
  else fail("waitlist:submit", JSON.stringify(first));
  const second = await anon.mutation("waitlist:submit", {
    name: "Docker Smoke",
    email: smokeEmail,
  });
  if (second?.ok && second.duplicate) ok("waitlist:submit dedupes repeat email");
  else fail("waitlist duplicate detection", JSON.stringify(second));
} catch (e) {
  fail("waitlist:submit", e.message);
}

// 2. admin query rejects anonymous callers
try {
  await anon.query("waitlist:count", {});
  fail("anonymous admin query", "expected 'Not authenticated', got a result");
} catch (e) {
  if (/Not authenticated/i.test(e.message)) ok("admin query rejects anonymous callers");
  else fail("anonymous admin query", `unexpected error: ${e.message}`);
}

// 3–4. auth sign-up/sign-in + authed admin query
const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  try {
    const params = { email: adminEmail, password: adminPassword };
    let result;
    try {
      result = await anon.action("auth:signIn", {
        provider: "password",
        params: { ...params, flow: "signUp" },
      });
      ok("auth: admin account created (signUp)");
    } catch {
      result = await anon.action("auth:signIn", {
        provider: "password",
        params: { ...params, flow: "signIn" },
      });
      ok("auth: signed in to existing admin account");
    }
    if (!result?.tokens?.token) throw new Error("no tokens in signIn result");
    ok("auth: JWT minted (JWT_PRIVATE_KEY/JWKS wiring works)");

    const authed = new ConvexHttpClient(url);
    authed.setAuth(result.tokens.token);
    const count = await authed.query("waitlist:count", {});
    if (typeof count === "number" && count >= 1) ok(`admin query authorised (waitlist count=${count})`);
    else fail("authed admin query", `unexpected result: ${JSON.stringify(count)}`);
  } catch (e) {
    fail("auth flow", e.message);
  }
} else {
  console.log("  - skipping auth/admin checks (set SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD)");
}

// 5. non-allowlisted sign-up is rejected
try {
  await anon.action("auth:signIn", {
    provider: "password",
    params: { email: "intruder@example.invalid", password: "Sup3r-secret-pw!", flow: "signUp" },
  });
  fail("allowlist", "non-allowlisted sign-up unexpectedly succeeded");
} catch {
  ok("allowlist rejects non-allowlisted sign-up");
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
