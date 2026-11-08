import { expect, test, type APIResponse } from "@playwright/test";

/**
 * The device cookie only exists with consent (lib/consent.ts,
 * lib/device-cookie.ts): POST /api/consent mints it on Accept with the
 * consent's lifetime and deletes it on Decline; the middleware never mints
 * one and clears any it is not allowed to keep.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PAGE = { "user-agent": PHONE_UA, "sec-fetch-dest": "document", accept: "text/html" };
const ID = "0b7f5f5e-2c1a-4d3b-9e8f-1a2b3c4d5e6f";
const GRANTED = `mypa_consent=v1.granted.${Math.floor(Date.now() / 1000)}`;
const DENIED = `mypa_consent=v1.denied.${Math.floor(Date.now() / 1000)}`;
const CONSENT_MAX_AGE = 180 * 24 * 60 * 60;

function setCookie(res: APIResponse, name: string): string | undefined {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .find((v) => v.startsWith(`${name}=`));
}

const valueOf = (header: string) => header.split(";")[0].split("=")[1];
const deleted = (header: string | undefined) => !!header && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(header);

test.describe("middleware", () => {
  test("a first visit gets no device id", async ({ request }) => {
    const res = await request.get("/", { headers: PAGE });
    expect(setCookie(res, "mypa_did")).toBeUndefined();
    expect(setCookie(res, "mypa_consent")).toBeUndefined();
  });

  test("an id without consent, or with a decline, is cleared", async ({ request }) => {
    for (const cookie of [`mypa_did=${ID}`, `mypa_did=${ID}; ${DENIED}`, `mypa_did=${ID}; mypa_consent=v0.granted.1`]) {
      const res = await request.get("/", { headers: { ...PAGE, cookie } });
      expect(deleted(setCookie(res, "mypa_did")), cookie).toBe(true);
    }
  });

  test("an id with consent is kept and not renewed", async ({ request }) => {
    const res = await request.get("/", { headers: { ...PAGE, cookie: `mypa_did=${ID}; ${GRANTED}` } });
    expect(setCookie(res, "mypa_did")).toBeUndefined();
  });

  test("Global Privacy Control, Do Not Track and a malformed id clear it even with consent", async ({ request }) => {
    for (const [extra, cookie] of [
      [{ "sec-gpc": "1" }, `mypa_did=${ID}; ${GRANTED}`],
      [{ dnt: "1" }, `mypa_did=${ID}; ${GRANTED}`],
      [{}, `mypa_did=not-a-uuid; ${GRANTED}`],
    ] as [Record<string, string>, string][]) {
      const res = await request.get("/", { headers: { ...PAGE, ...extra, cookie } });
      expect(deleted(setCookie(res, "mypa_did")), JSON.stringify(extra) + cookie).toBe(true);
    }
  });

  test("the card is in the first HTML only when a choice is due", async ({ request }) => {
    expect(await (await request.get("/", { headers: PAGE })).text()).toContain('data-card="consent"');
    expect(await (await request.get("/", { headers: { ...PAGE, cookie: DENIED } })).text()).not.toContain('data-card="consent"');
    expect(await (await request.get("/", { headers: { ...PAGE, "sec-gpc": "1" } })).text()).not.toContain('data-card="consent"');
  });
});

test.describe("POST /api/consent", () => {
  test("Accept sets the choice and a fresh id, both for 180 days", async ({ request }) => {
    const res = await request.post("/api/consent", { data: { choice: "granted" }, headers: { "user-agent": PHONE_UA } });
    expect(res.status()).toBe(200);
    const consent = setCookie(res, "mypa_consent")!;
    const id = setCookie(res, "mypa_did")!;
    expect(valueOf(consent)).toMatch(/^v1\.granted\.\d+$/);
    expect(valueOf(id)).toMatch(UUID_V4);
    for (const header of [consent, id]) {
      expect(header).toContain(`Max-Age=${CONSENT_MAX_AGE}`);
      expect(header).toMatch(/SameSite=lax/i);
      expect(header).toContain("Path=/");
      expect(header).not.toMatch(/HttpOnly/i);
    }
  });

  test("re-accepting keeps the device it already counts as", async ({ request }) => {
    const res = await request.post("/api/consent", {
      data: { choice: "granted" },
      headers: { "user-agent": PHONE_UA, cookie: `mypa_did=${ID}; ${GRANTED}` },
    });
    expect(valueOf(setCookie(res, "mypa_did")!)).toBe(ID);
  });

  test("Decline records the choice and deletes the id", async ({ request }) => {
    const res = await request.post("/api/consent", {
      data: { choice: "denied" },
      headers: { "user-agent": PHONE_UA, cookie: `mypa_did=${ID}; ${GRANTED}` },
    });
    expect(res.status()).toBe(200);
    expect(valueOf(setCookie(res, "mypa_consent")!)).toMatch(/^v1\.denied\.\d+$/);
    expect(deleted(setCookie(res, "mypa_did"))).toBe(true);
  });

  test("another site cannot answer for the visitor", async ({ request }) => {
    const res = await request.post("/api/consent", {
      data: { choice: "granted" },
      headers: { "user-agent": PHONE_UA, "sec-fetch-site": "cross-site" },
    });
    expect(res.status()).toBe(403);
    expect(setCookie(res, "mypa_consent")).toBeUndefined();
    expect(setCookie(res, "mypa_did")).toBeUndefined();
  });

  test("Accept is refused under Global Privacy Control, and junk is refused", async ({ request }) => {
    const gpc = await request.post("/api/consent", { data: { choice: "granted" }, headers: { "sec-gpc": "1" } });
    expect(gpc.status()).toBe(409);
    expect(setCookie(gpc, "mypa_did")).toBeUndefined();
    const junk = await request.post("/api/consent", { data: { choice: "yes" } });
    expect(junk.status()).toBe(400);
    expect(setCookie(junk, "mypa_consent")).toBeUndefined();
  });
});
