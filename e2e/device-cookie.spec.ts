import { expect, test, type APIResponse } from "@playwright/test";

/**
 * The device cookie (lib/device-cookie.ts): minted by the server on page
 * loads, rolling for 400 days, readable by the beacon, and never set for
 * bots, prefetches, admin or API requests, or a browser sending an opt-out
 * signal.
 */

const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PAGE = { "user-agent": PHONE_UA, "sec-fetch-dest": "document", accept: "text/html" };

function deviceSetCookie(res: APIResponse): string | undefined {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .find((v) => v.startsWith("mypa_did="));
}

const idOf = (setCookie: string) => setCookie.split(";")[0].split("=")[1];

test.describe("device cookie", () => {
  test.use({ userAgent: PHONE_UA });

  test("a first visit gets a 400-day id the page can read, and a reload keeps it", async ({ page, context }) => {
    await page.goto("/");
    const first = (await context.cookies()).find((c) => c.name === "mypa_did");
    expect(first).toBeDefined();
    expect(first!.value).toMatch(UUID_V4);
    expect(first!.path).toBe("/");
    expect(first!.sameSite).toBe("Lax");
    expect(first!.httpOnly).toBe(false);
    const days = (first!.expires - Date.now() / 1000) / 86_400;
    expect(days).toBeGreaterThan(399);
    expect(days).toBeLessThanOrEqual(400);
    expect(await page.evaluate(() => document.cookie)).toContain(`mypa_did=${first!.value}`);

    await page.reload();
    const again = (await context.cookies()).find((c) => c.name === "mypa_did");
    expect(again!.value).toBe(first!.value);
    expect(again!.expires).toBeGreaterThanOrEqual(first!.expires);
  });

  test("a malformed cookie is replaced with a fresh id", async ({ request }) => {
    const res = await request.get("/", { headers: { ...PAGE, cookie: "mypa_did=not-a-uuid" } });
    const set = deviceSetCookie(res);
    expect(set).toBeDefined();
    expect(idOf(set!)).toMatch(UUID_V4);
  });

  test("Global Privacy Control and Do Not Track get no cookie and clear an old one", async ({ request }) => {
    const signals: Record<string, string>[] = [{ "sec-gpc": "1" }, { dnt: "1" }];
    for (const signal of signals) {
      expect(deviceSetCookie(await request.get("/", { headers: { ...PAGE, ...signal } }))).toBeUndefined();
      const cleared = deviceSetCookie(
        await request.get("/", { headers: { ...PAGE, ...signal, cookie: "mypa_did=0b7f5f5e-2c1a-4d3b-9e8f-1a2b3c4d5e6f" } }),
      );
      expect(cleared).toBeDefined();
      expect(cleared!).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    }
  });

  test("bots and link previews get no cookie", async ({ request }) => {
    for (const ua of [
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "WhatsApp/2.24.10.85 A",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36",
      "curl/8.5.0",
    ]) {
      const res = await request.get("/", { headers: { ...PAGE, "user-agent": ua } });
      expect(deviceSetCookie(res), ua).toBeUndefined();
    }
    // A Cubot phone and an in-app browser are people.
    for (const ua of [PHONE_UA.replace("SM-A546E", "CUBOT P80"), `${PHONE_UA} [Pinterest/Android]`]) {
      const res = await request.get("/", { headers: { ...PAGE, "user-agent": ua } });
      expect(deviceSetCookie(res), ua).toBeDefined();
    }
  });

  test("prefetches, admin and API requests get no cookie", async ({ request }) => {
    expect(deviceSetCookie(await request.get("/", { headers: { ...PAGE, "sec-purpose": "prefetch" } }))).toBeUndefined();
    // A client-side navigation's RSC fetch.
    expect(
      deviceSetCookie(await request.get("/", { headers: { ...PAGE, "sec-fetch-dest": "empty", accept: "*/*" } })),
    ).toBeUndefined();
    expect(deviceSetCookie(await request.get("/admin", { headers: PAGE }))).toBeUndefined();
    expect(deviceSetCookie(await request.get("/api/waitlist", { headers: PAGE }))).toBeUndefined();
  });
});
