import { test, expect, type Page } from "@playwright/test";

// Timing-sensitive checks. The perf project runs them after every other
// scenario has finished, one at a time, so parallel browsers do not skew them.
test.describe.configure({ mode: "serial" });

const BOT = "[data-mood]";

async function home(page: Page) {
  await page.goto("/");
  await page.locator(`${BOT} svg`).first().waitFor();
}

for (const [w, h] of [
  [1440, 900],
  [375, 812],
] as const) {
  test.describe(`at ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("the bot stays near 60fps while listening", async ({ page }) => {
      await home(page);
      await page.locator("#email").focus();
      await page.keyboard.type("ada");
      const frames = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let n = 0;
            const start = performance.now();
            const tick = (t: number) => {
              n++;
              if (t - start < 1000) requestAnimationFrame(tick);
              else resolve(n);
            };
            requestAnimationFrame(tick);
          }),
      );
      expect(frames).toBeGreaterThanOrEqual(50);
    });

    test("CLS stays under 0.1 on load", async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await home(page);
      await page.waitForTimeout(2500);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
    });

    test("largest contentful paint under 2.5s", async ({ page }) => {
      await home(page);
      const lcp = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            new PerformanceObserver((l) => {
              const e = l.getEntries();
              resolve(e[e.length - 1].startTime);
            }).observe({ type: "largest-contentful-paint", buffered: true });
          }),
      );
      expect(lcp).toBeLessThan(2500);
    });
  });
}
