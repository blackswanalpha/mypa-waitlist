import { defineConfig } from "@playwright/test";

/**
 * The landing-page and tester-program scenarios in e2e/. They run against a
 * server you start (`next build && next start -p 20301`, so CLS is measured
 * on a production build). Submissions write tester rows to that server's
 * Convex deployment. The `testers` project signs in to /admin, so set
 * E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD. Point E2E_BASE_URL elsewhere to
 * retarget.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  fullyParallel: true,
  workers: 4,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:20301",
    browserName: "chromium",
    // The full Chromium build in headless mode; no separate headless shell.
    channel: "chromium",
  },
  projects: [
    { name: "scenarios", testIgnore: /(perf|testers)\.spec\.ts/ },
    // Closes and reopens signups, so it runs alone after the submissions.
    { name: "testers", testMatch: /testers\.spec\.ts/, dependencies: ["scenarios"] },
    // Frame rate, CLS and LCP run last and alone so parallel browsers do not skew them.
    { name: "perf", testMatch: /perf\.spec\.ts/, dependencies: ["testers"] },
  ],
});
