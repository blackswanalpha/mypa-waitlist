#!/usr/bin/env node
/**
 * Ensure the Convex Auth signing keys (JWT_PRIVATE_KEY + JWKS) exist on the
 * deployment configured in .env.local (CONVEX_SELF_HOSTED_URL /
 * CONVEX_SELF_HOSTED_ADMIN_KEY).
 *
 * Mirrors the key generation of `npx @convex-dev/auth`
 * (@convex-dev/auth/src/cli/generateKeys.ts) without its interactive project
 * rewiring. Idempotent: existing keys are never overwritten — rotating them
 * would invalidate every admin session.
 */
import { execFileSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

function convex(args, opts = {}) {
  return execFileSync("npx", ["convex", ...args], {
    encoding: "utf8",
    ...opts,
  });
}

// `env get` of a missing var can exit 0 with a notice on some CLI versions,
// so detect presence via `env list` instead (output stays in-process; the
// private key is never printed).
let envList = "";
try {
  envList = convex(["env", "list"], { stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  console.error("Could not read deployment env — is the backend up and .env.local wired?");
  throw error;
}

if (/^JWT_PRIVATE_KEY=/m.test(envList)) {
  console.log("JWT_PRIVATE_KEY already set on the deployment — keys left untouched.");
  process.exit(0);
}

// extractable: required by jose v6 (webapi) for exportPKCS8; jose v5 (used by
// @convex-dev/auth's own CLI) exported Node KeyObjects unconditionally.
const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

// KEY=VALUE single-arg form sidesteps the PEM's leading "-----" being parsed
// as a flag; newlines→spaces matches what `npx @convex-dev/auth` stores.
convex(["env", "set", `JWT_PRIVATE_KEY=${privateKey.trimEnd().replace(/\n/g, " ")}`], {
  stdio: ["ignore", "ignore", "inherit"],
});
convex(["env", "set", `JWKS=${jwks}`], { stdio: ["ignore", "ignore", "inherit"] });
console.log("Generated and set JWT_PRIVATE_KEY + JWKS on the deployment.");
