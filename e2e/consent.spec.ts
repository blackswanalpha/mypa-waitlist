import { expect, test, type Page } from "@playwright/test";

/**
 * The cookie card, end to end in a real browser: a phone user agent and
 * navigator.webdriver hidden, so the middleware and the page-view beacon
 * treat the visit as a person's and the choice reaches Convex.
 */

const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CARD = '[data-card="consent"]';
const FORM = 'form[aria-label="Join the MyPA waitlist"]';

test.use({ storageState: { cookies: [], origins: [] }, userAgent: PHONE_UA });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
});

async function cookie(page: Page, name: string) {
  return (await page.context().cookies()).find((c) => c.name === name);
}

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator(FORM)).toBeVisible();
}

test("a first visit shows the card: two equal choices, no shadow, 44px targets", async ({ page }) => {
  await open(page);
  const card = page.locator(CARD);
  await expect(card).toBeVisible();
  await expect(card).toContainText("One cookie, to count visitors");
  const accept = (await card.getByRole("button", { name: "Accept" }).boundingBox())!;
  const decline = (await card.getByRole("button", { name: "Decline" }).boundingBox())!;
  expect(Math.abs(accept.width - decline.width)).toBeLessThan(1);
  expect(accept.height).toBe(decline.height);
  const small = await card.evaluate((c) =>
    Array.from(c.querySelectorAll("button"))
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width < 44 || r.height < 44).length,
  );
  expect(small).toBe(0);
  const shadow = await card.evaluate((c) => getComputedStyle(c).boxShadow);
  expect(shadow === "none" || !/rgba?\([^)]*[^0]\)/.test(shadow.replace(/,\s*0\)/g, ")"))).toBe(true);
  expect(await cookie(page, "mypa_did")).toBeUndefined();

  await card.getByRole("button", { name: "Details" }).click();
  await expect(card.locator("#cookie-card-details")).toContainText("mypa_did");
  await expect(card.locator("#cookie-card-details")).toContainText("180 days");
});

test("Accept stores the choice and an id; settings reopens it; Decline withdraws the id", async ({ page }) => {
  await open(page);
  const card = page.locator(CARD);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/consent")),
    card.getByRole("button", { name: "Accept" }).click(),
  ]);
  expect(res.status()).toBe(200);
  await expect(card).toHaveCount(0);
  const id = (await cookie(page, "mypa_did"))!;
  expect(id.value).toMatch(UUID_V4);
  expect((await cookie(page, "mypa_consent"))!.value).toMatch(/^v1\.granted\.\d+$/);
  const days = (id.expires - Date.now() / 1000) / 86_400;
  expect(days).toBeGreaterThan(179);
  expect(days).toBeLessThanOrEqual(180);
  const session = await page.evaluate(() => sessionStorage.getItem("mypa.sessionId.v1"));
  console.log(`[consent] accepted session=${session} device=${id.value}`);

  // A later page keeps the id and shows no card.
  await page.reload();
  await expect(page.locator(FORM)).toBeVisible();
  await expect(card).toHaveCount(0);
  expect((await cookie(page, "mypa_did"))!.value).toBe(id.value);

  // Cookie settings reopens it with the choice on record.
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(card).toBeVisible();
  await expect(card).toContainText("You accepted on");
  await expect(card.getByRole("button", { name: "Accept" })).toHaveAttribute("aria-pressed", "true");

  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/consent")),
    card.getByRole("button", { name: "Decline" }).click(),
  ]);
  await expect(card).toHaveCount(0);
  expect(await cookie(page, "mypa_did")).toBeUndefined();
  expect((await cookie(page, "mypa_consent"))!.value).toMatch(/^v1\.denied\.\d+$/);
  console.log(`[consent] withdrew device=${id.value}`);
});

test("Decline stores the choice and never an id", async ({ page }) => {
  await open(page);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/consent")),
    page.locator(CARD).getByRole("button", { name: "Decline" }).click(),
  ]);
  await expect(page.locator(CARD)).toHaveCount(0);
  expect((await cookie(page, "mypa_consent"))!.value).toMatch(/^v1\.denied\.\d+$/);
  expect(await cookie(page, "mypa_did")).toBeUndefined();
  const session = await page.evaluate(() => sessionStorage.getItem("mypa.sessionId.v1"));
  console.log(`[consent] declined session=${session}`);
  await page.reload();
  await expect(page.locator(FORM)).toBeVisible();
  await expect(page.locator(CARD)).toHaveCount(0);
  expect(await cookie(page, "mypa_did")).toBeUndefined();
});

test("closing with × is not a choice: the card is back on the next page", async ({ page }) => {
  await open(page);
  await page.locator(CARD).getByRole("button", { name: "Close without choosing" }).click();
  await expect(page.locator(CARD)).toHaveCount(0);
  expect(await cookie(page, "mypa_consent")).toBeUndefined();
  await page.reload();
  await expect(page.locator(CARD)).toBeVisible();
});

test.describe("Global Privacy Control", () => {
  test.use({ extraHTTPHeaders: { "sec-gpc": "1" } });

  test("shows no card, sets nothing, and settings says why", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true }));
    await open(page);
    await expect(page.locator(CARD)).toHaveCount(0);
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await expect(page.locator(CARD)).toContainText("asks sites not to track you");
    await expect(page.locator(CARD).getByRole("button", { name: "Accept" })).toHaveCount(0);
    expect(await cookie(page, "mypa_did")).toBeUndefined();
  });
});

test("the admin console never shows the card", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForTimeout(1500);
  await expect(page.locator(CARD)).toHaveCount(0);
});

for (const [w, h] of [
  [1280, 600],
  [1366, 625],
  [360, 640],
  [375, 667],
]) {
  test(`with the card up at ${w}x${h}, the join button is on screen and uncovered`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    await expect(page.locator(CARD)).toBeVisible();
    const submit = page.locator(`${FORM} button[type=submit]`);
    const box = (await submit.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(h);
    const hit = await submit.evaluate((b) => {
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!el && b.contains(el);
    });
    expect(hit).toBe(true);
  });
}
