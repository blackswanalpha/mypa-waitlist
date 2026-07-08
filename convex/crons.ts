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

export default crons;
