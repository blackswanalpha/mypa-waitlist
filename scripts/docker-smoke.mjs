#!/usr/bin/env node
/**
 * Smoke-test the dockerised stack end-to-end against the running backend:
 *
 *   1. public waitlist submit + duplicate detection (consent required)
 *   2. consent is enforced server-side
 *   3. honeypot submissions get a fake success without touching the table
 *   4. per-email rate limit trips under rapid fire
 *   5. admin query rejects anonymous callers
 *   6. Convex Auth password sign-up/sign-in mints working JWTs
 *      (proves JWT_PRIVATE_KEY / JWKS / SITE_ORIGIN wiring). Sign-UP needs
 *      ALLOW_ADMIN_SIGNUP=true on the deployment; with it unset the script
 *      falls back to sign-in (account must already exist).
 *   7. admin whitelist round-trip: setStatus → countByStatus → filtered
 *      exportPage → back to pending; syncToBackend surfaces its config guard
 *   8. sign-up is rejected when disabled or non-allowlisted
 *
 * Usage:  SMOKE_ADMIN_EMAIL=you@example.com SMOKE_ADMIN_PASSWORD=... \
 *           node scripts/docker-smoke.mjs [convexUrl]
 *
 * SMOKE_ADMIN_EMAIL must be in the deployment's ADMIN_EMAILS. Steps 6–7 are
 * skipped if the credentials are not provided. Leaves smoke rows in the
 * waitlist table (fixed emails, so re-runs don't accumulate).
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
const isRateLimit = (e) => /rate ?limit/i.test(e?.message ?? "");

console.log(`Smoke-testing Convex backend at ${url}\n`);
const anon = new ConvexHttpClient(url);

// 1. public waitlist submit + duplicate detection
const smokeEmail = "docker-smoke@example.invalid";
try {
  const first = await anon.mutation("waitlist:submit", {
    name: "Docker Smoke",
    email: smokeEmail,
    source: "docker-smoke",
    agreed: true,
  });
  if (first?.ok) ok(`waitlist:submit accepted (duplicate=${first.duplicate})`);
  else fail("waitlist:submit", JSON.stringify(first));
  const second = await anon.mutation("waitlist:submit", {
    name: "Docker Smoke",
    email: smokeEmail,
    agreed: true,
  });
  if (second?.ok && second.duplicate) ok("waitlist:submit dedupes repeat email");
  else fail("waitlist duplicate detection", JSON.stringify(second));
} catch (e) {
  if (isRateLimit(e)) ok("waitlist:submit rate-limited (expected on rapid re-runs)");
  else fail("waitlist:submit", e.message);
}

// 2. consent is enforced server-side
try {
  await anon.mutation("waitlist:submit", {
    name: "No Consent",
    email: "docker-smoke-nc@example.invalid",
    agreed: false,
  });
  fail("consent enforcement", "submit without consent unexpectedly succeeded");
} catch (e) {
  if (isRateLimit(e)) ok("consent check rate-limited (expected on rapid re-runs)");
  else ok("consent is required server-side");
}

// 3. honeypot: fake success, short-circuits before any db work — even for an
// email that already exists, duplicate comes back false.
try {
  const hp = await anon.mutation("waitlist:submit", {
    name: "Bot",
    email: smokeEmail,
    agreed: true,
    website: "https://spam.example",
  });
  if (hp?.ok && hp.duplicate === false) ok("honeypot returns fake success without touching the table");
  else fail("honeypot", JSON.stringify(hp));
} catch (e) {
  fail("honeypot", e.message);
}

// 4. per-email rate limit trips under rapid fire
try {
  let tripped = false;
  for (let i = 0; i < 6; i++) {
    try {
      await anon.mutation("waitlist:submit", {
        name: "Rate Limit Probe",
        email: "docker-smoke-rl@example.invalid",
        agreed: true,
      });
    } catch (e) {
      if (isRateLimit(e)) {
        tripped = true;
        break;
      }
      throw e;
    }
  }
  if (tripped) ok("per-email rate limit trips under rapid fire");
  else fail("rate limit", "6 rapid submits never tripped the limiter");
} catch (e) {
  fail("rate limit", e.message);
}

// 5. admin query rejects anonymous callers
try {
  await anon.query("waitlist:count", {});
  fail("anonymous admin query", "expected 'Not authenticated', got a result");
} catch (e) {
  if (/Not authenticated/i.test(e.message)) ok("admin query rejects anonymous callers");
  else fail("anonymous admin query", `unexpected error: ${e.message}`);
}

// 6–7. auth sign-up/sign-in + authed admin checks
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
      ok("auth: admin account created (signUp — ALLOW_ADMIN_SIGNUP is on)");
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

    // 7. whitelist round-trip on the smoke row
    const page = await authed.query("waitlist:exportPage", { cursor: null });
    const smokeRow = page.page.find((r) => r.email === smokeEmail);
    if (!smokeRow) throw new Error("smoke row not found via exportPage");
    ok("exportPage returns rows");

    await authed.mutation("waitlist:setStatus", {
      ids: [smokeRow._id],
      status: "invited",
    });
    const counts = await authed.query("waitlist:countByStatus", {});
    if (counts.invited >= 1) ok(`setStatus whitelists (invited=${counts.invited})`);
    else fail("setStatus", `invited count did not increase: ${JSON.stringify(counts)}`);

    const invitedPage = await authed.query("waitlist:exportPage", {
      cursor: null,
      status: "invited",
    });
    if (invitedPage.page.some((r) => r._id === smokeRow._id))
      ok("exportPage status filter works");
    else fail("exportPage filter", "whitelisted smoke row missing from invited page");

    try {
      const sync = await authed.action("sync:syncToBackend", {});
      ok(`syncToBackend ran (synced=${sync.synced}, failed=${sync.failed})`);
    } catch (e) {
      if (/not configured/i.test(e.message))
        ok("syncToBackend surfaces its config guard (BACKEND_URL unset)");
      else fail("syncToBackend", e.message);
    }

    await authed.mutation("waitlist:setStatus", {
      ids: [smokeRow._id],
      status: "pending",
    });
    ok("setStatus reverts to pending");
  } catch (e) {
    fail("auth/whitelist flow", e.message);
  }
} else {
  console.log("  - skipping auth/admin checks (set SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD)");
}

// 8. sign-up is rejected when disabled (ALLOW_ADMIN_SIGNUP unset) or non-allowlisted
try {
  await anon.action("auth:signIn", {
    provider: "password",
    params: { email: "intruder@example.invalid", password: "Sup3r-secret-pw!", flow: "signUp" },
  });
  fail("sign-up gate", "non-allowlisted sign-up unexpectedly succeeded");
} catch {
  ok("sign-up gate rejects (disabled or non-allowlisted)");
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
