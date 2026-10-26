#!/usr/bin/env node
/**
 * One-off: copy every Convex waitlist signup into the product backend, where
 * each becomes a `users` row with status "waitlist" and keeps its signup date.
 * Idempotent — the backend skips emails it already has, so re-running is safe.
 *
 *   npx convex data waitlist --limit 1000000 --order asc --format jsonl > waitlist.jsonl
 *   BACKEND_URL=https://backend.mypa.computer BACKEND_SERVICE_KEY=... \
 *     node scripts/import-waitlist-to-backend.mjs waitlist.jsonl
 *
 * Add --prod to the `convex data` call to read the production deployment.
 */
import { readFileSync } from "node:fs";

const BATCH = 500; // the backend's per-request cap

const file = process.argv[2];
const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");
const serviceKey = process.env.BACKEND_SERVICE_KEY;
if (!file || !backendUrl || !serviceKey) {
  console.error("usage: BACKEND_URL=... BACKEND_SERVICE_KEY=... node scripts/import-waitlist-to-backend.mjs <waitlist.jsonl>");
  process.exit(1);
}

const ATTRIBUTION_KEYS = [
  "utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent",
  "gclid", "fbclid", "referrerDomain", "landingPath",
];

const entries = readFileSync(file, "utf8")
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line))
  .map((row) => {
    const attribution = Object.fromEntries(
      ATTRIBUTION_KEYS.filter((k) => row[k]).map((k) => [k, row[k]]),
    );
    return {
      email: row.email,
      name: row.name || undefined,
      source: row.source || "landing",
      attribution: Object.keys(attribution).length ? attribution : undefined,
      joined_at: new Date(row.createdAt ?? row._creationTime).toISOString(),
    };
  });

const total = { added: 0, skipped_existing: 0, invalid: [] };
for (let i = 0; i < entries.length; i += BATCH) {
  const res = await fetch(`${backendUrl}/api/v1/waitlist-sync/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Key": serviceKey },
    body: JSON.stringify({ entries: entries.slice(i, i + BATCH) }),
  });
  if (!res.ok) {
    console.error(`batch at ${i} failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const r = await res.json();
  total.added += r.added;
  total.skipped_existing += r.skipped_existing;
  total.invalid.push(...r.invalid);
}

console.log(
  `${entries.length} rows read · ${total.added} added · ${total.skipped_existing} already there · ${total.invalid.length} invalid`,
);
if (total.invalid.length) console.log("invalid:", total.invalid.join(", "));
