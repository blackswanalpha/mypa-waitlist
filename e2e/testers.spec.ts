import { test, expect, type Page } from "@playwright/test";

// The tester program end to end: the cards and the black button, the guide
// page, then the admin side — sign in, find a fresh signup, save the invite
// link, approve and email it, resend, decline, delete, and close/reopen
// signups (which flips the landing to the amber card and makes the API refuse).
//
// Needs an admin account on the server's Convex deployment:
//   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npx playwright test --project testers
// Runs serially and after the landing scenarios, because closing signups
// would fail every submission running beside it.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const INVITE = process.env.E2E_INVITE_LINK ?? "https://appdistribution.firebase.dev/i/e2e-test-link";
const FORM = 'form[aria-label="Join the MyPA waitlist"]';

test.describe.configure({ mode: "serial" });

function uniqueEmail(tag: string) {
  return `delivered+e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@resend.dev`;
}

async function px(page: Page, sel: string, prop: string) {
  return page.locator(sel).first().evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
}

/** A computed colour as sRGB, whatever space the browser reports it in. */
async function rgb(page: Page, sel: string, prop: string): Promise<[number, number, number]> {
  return page.locator(sel).first().evaluate((e, p) => {
    const c = document.createElement("canvas").getContext("2d")!;
    c.fillStyle = getComputedStyle(e).getPropertyValue(p);
    c.fillRect(0, 0, 1, 1);
    const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
    return [r, g, b] as [number, number, number];
  }, prop);
}

async function join(page: Page, email: string, phone: "Samsung" | "Other Android" | "iPhone") {
  await page.goto("/");
  await page.getByRole("radio", { name: phone }).click();
  await page.fill("#email", email);
  await page.locator(`${FORM} button[type=submit]`).click();
  await expect(page.locator('[role="status"]')).toContainText(email, { timeout: 15_000 });
}

async function signIn(page: Page) {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  await page.goto("/admin");
  const email = page.locator("#admin-email");
  const tab = page.getByRole("tab", { name: /Testers/ });
  // The page shows a spinner until Convex Auth settles, then one or the other.
  await expect(email.or(tab)).toBeVisible({ timeout: 20_000 });
  if (await email.isVisible()) {
    await email.fill(ADMIN_EMAIL);
    await page.fill("#admin-password", ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
  }
  await expect(page.getByRole("tab", { name: /Testers/ })).toHaveAttribute("aria-selected", "true", { timeout: 20_000 });
}

function row(page: Page, email: string) {
  return page.locator(`tr[data-email="${email}"]`);
}

test("the tester card is blue, square-ish and says who becomes a tester", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('[data-card="tester"]');
  await expect(card).toContainText("Early tester program");
  await expect(card).toContainText(/spots left|All spots claimed/);
  // Sits between the headline and the form.
  const h1 = (await page.locator("h1").boundingBox())!;
  const box = (await card.boundingBox())!;
  const form = (await page.locator(FORM).boundingBox())!;
  expect(box.y).toBeGreaterThan(h1.y + h1.height);
  expect(box.y + box.height).toBeLessThanOrEqual(form.y);
  expect(parseFloat(await px(page, '[data-card="tester"]', "border-top-left-radius"))).toBeLessThanOrEqual(6);
  // A pale blue background and dark blue text.
  const [br, bgG, bb] = await rgb(page, '[data-card="tester"]', "background-color");
  expect(Math.min(br, bgG, bb)).toBeGreaterThan(220);
  expect(bb).toBeGreaterThan(br);
  const [fr, fg, fb] = await rgb(page, '[data-card="tester"]', "color");
  expect(Math.max(fr, fg)).toBeLessThan(80);
  expect(fb).toBeGreaterThan(fr + 40);
});

test("the join button is pure black with no shadow or gradient, hovered or not", async ({ page }) => {
  await page.goto("/");
  const btn = `${FORM} button[type=submit]`;
  for (const hover of [false, true]) {
    if (hover) await page.locator(btn).hover();
    expect(await px(page, btn, "background-color")).toBe("rgb(0, 0, 0)");
    expect(await px(page, btn, "background-image")).toBe("none");
    expect(await px(page, btn, "box-shadow")).toBe("none");
    expect(await px(page, btn, "color")).toBe("rgb(255, 255, 255)");
  }
});

test("the API refuses a missing phone and accepts the honeypot silently", async ({ request }) => {
  const bad = await request.post("/api/waitlist", { data: { email: uniqueEmail("api"), agreed: true } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toContain("Pick your phone");
  const bot = await request.post("/api/waitlist", {
    data: { email: uniqueEmail("bot"), device: "android", agreed: true, website: "spam" },
  });
  expect(bot.status()).toBe(200);
});

test("the guide page has five steps on Android and seven on Samsung, with every image", async ({ page, request }) => {
  await page.goto("/testers/guide");
  await expect(page.locator("main ol > li")).toHaveCount(5);
  await expect(page.getByText("Why this is safe")).toBeVisible();
  await page.goto("/testers/guide?phone=samsung");
  await expect(page.locator("main ol > li")).toHaveCount(7);
  await expect(page.locator("main ol")).toContainText("Auto Blocker");
  for (const f of ["1-invite", "2-accept", "samsung-auto-blocker", "3-app-tester", "4-download", "5-install"]) {
    const r = await request.get(`/guide/${f}.png`);
    expect(r.status(), f).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
});

test.describe("admin", () => {
  const samsung = uniqueEmail("samsung");
  const android = uniqueEmail("android");
  const iphone = uniqueEmail("iphone");

  test("signups land in the Testers tab with their phone", async ({ page, browser }) => {
    const visitor = await browser.newPage();
    await join(visitor, samsung, "Samsung");
    await join(visitor, android, "Other Android");
    await join(visitor, iphone, "iPhone");
    await visitor.close();

    await signIn(page);
    await page.getByRole("tab", { name: /Pending/ }).click();
    for (const [email, phone] of [
      [samsung, "samsung"],
      [android, "android"],
      [iphone, "iphone"],
    ]) {
      await expect(row(page, email)).toBeVisible({ timeout: 15_000 });
      await expect(row(page, email).locator("select")).toHaveValue(phone);
      await expect(row(page, email)).toContainText("Pending");
    }
  });

  test("approving needs the invite link, and an iPhone can't be approved", async ({ page }) => {
    await signIn(page);
    const invite = page.locator("#invite");
    await invite.fill("not a link");
    await invite.press("Enter");
    await expect(page.getByText("That doesn't look like a link.")).toBeVisible();
    await invite.fill(INVITE);
    // Already saved by an earlier run: Save stays disabled and there is nothing to do.
    if (await page.locator("form:has(#invite) button[type=submit]").isEnabled()) {
      await invite.press("Enter");
      await expect(page.getByText("Invite link saved.")).toBeVisible();
    }
    await expect(page.getByText("Approving is off until")).toHaveCount(0);
    await page.getByRole("tab", { name: /Pending/ }).click();
    await expect(row(page, iphone).getByRole("button", { name: /Approve/ })).toBeDisabled();
  });

  test("approve emails the guide; resend sends it again; the row shows both", async ({ page }) => {
    await signIn(page);
    await page.getByRole("tab", { name: /Pending/ }).click();
    for (const email of [samsung, android]) {
      await row(page, email).getByRole("button", { name: /Approve/ }).click();
      await expect(page.getByText(`Approved ${email}. Guide email queued.`)).toBeVisible();
    }
    await page.getByRole("tab", { name: /Approved/ }).click();
    const r = row(page, samsung);
    await expect(r).toContainText("Approved");
    // Resend accepted it; a missing key or a rejected address would read Failed.
    await expect(r.locator("td").nth(6)).toContainText(/Sent to Resend|Delivered/, { timeout: 45_000 });
    await r.getByRole("button", { name: "Resend guide" }).click();
    await expect(page.getByText(`Guide sent again to ${samsung}.`)).toBeVisible();
    await expect(r).toContainText("2 sends");
  });

  test("decline, back to pending, delete", async ({ page }) => {
    await signIn(page);
    await page.getByRole("tab", { name: "All" }).click();
    const r = row(page, iphone);
    await r.getByRole("button", { name: "Decline" }).click();
    await expect(r).toContainText("Declined");
    await r.getByRole("button", { name: "Pending" }).click();
    await expect(r).toContainText("Pending");
    await r.getByRole("button", { name: `Delete ${iphone}` }).click();
    await r.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.getByText(`Deleted ${iphone}.`)).toBeVisible();
    await expect(row(page, iphone)).toHaveCount(0);
  });

  test("closing signups swaps the form for the amber card and the API refuses", async ({ page, browser, request }) => {
    await signIn(page);
    // A social link so the closed card has somewhere to send people.
    const socials = page.locator("section", { hasText: "Social links" });
    if ((await socials.getByLabel("URL").count()) === 0) {
      await socials.getByRole("button", { name: "Add link" }).click();
      await socials.getByLabel("Label").last().fill("Instagram");
      await socials.getByLabel("URL").last().fill("https://www.instagram.com/mypa.e2e");
      await socials.getByRole("button", { name: "Save links" }).click();
      await expect(page.getByText("Social links saved.")).toBeVisible();
    }

    await page.locator('[data-action="toggle-signups"]').click();
    await expect(page.getByText("Signups closed.")).toBeVisible();
    try {
      const visitor = await browser.newPage();
      const card = visitor.locator('[data-card="closed"]');
      // The landing caches the program for 15s, so the card can take that long.
      await expect(async () => {
        await visitor.goto("/");
        await expect(card).toContainText("tester spots are filled", { timeout: 1_000 });
      }).toPass({ timeout: 40_000, intervals: [2_000] });
      await expect(visitor.locator(FORM)).toHaveCount(0);
      await expect(visitor.locator('[data-card="tester"]')).toHaveCount(0);
      await expect(card.getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
      expect(parseFloat(await px(visitor, '[data-card="closed"]', "border-top-left-radius"))).toBeLessThanOrEqual(6);
      // A pale amber background and dark amber text.
      const [ar, ag, ab] = await rgb(visitor, '[data-card="closed"]', "background-color");
      expect(Math.min(ar, ag)).toBeGreaterThan(230);
      expect(ar).toBeGreaterThan(ab + 10);
      const [tr, , tb] = await rgb(visitor, '[data-card="closed"]', "color");
      expect(tr).toBeGreaterThan(tb + 40);
      await visitor.close();

      const res = await request.post("/api/waitlist", {
        data: { email: uniqueEmail("closed"), device: "android", agreed: true },
      });
      expect(res.status()).toBe(409);
      expect((await res.json()).code).toBe("closed");
    } finally {
      await page.locator('[data-action="toggle-signups"]').click();
      await expect(page.getByText("Signups open.")).toBeVisible();
    }
  });

  test("clean up: the e2e rows are deleted", async ({ page }) => {
    await signIn(page);
    await page.getByRole("tab", { name: "All" }).click();
    for (const email of [samsung, android]) {
      const r = row(page, email);
      if ((await r.count()) === 0) continue;
      await r.getByRole("button", { name: `Delete ${email}` }).click();
      await r.getByRole("button", { name: "Confirm delete" }).click();
      await expect(row(page, email)).toHaveCount(0);
    }
  });
});
