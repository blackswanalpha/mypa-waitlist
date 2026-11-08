import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Raw pageview rows only serve short-term drill-down; the durable history is
// the trafficDaily aggregates. Keep 90 days of raw rows.
crons.daily(
  "prune old pageviews",
  { hourUTC: 3, minuteUTC: 17 },
  internal.analytics.prune,
  { keepDays: 90 },
);

// Tracking-quality checks over the last 7 days, kept as history (evals.ts).
crons.daily(
  "tracking evals",
  { hourUTC: 3, minuteUTC: 41 },
  internal.evals.scheduled,
  { days: 7 },
);

export default crons;
