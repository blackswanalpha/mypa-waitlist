import { test, expect, type Page } from "@playwright/test";
import { SLIDES } from "../lib/carousel";

// Landing-page scenarios. The submission scenarios write real rows to the
// Convex deployment the server was built against, with Resend test addresses
// (delivered+<label>@resend.dev), and stay under the 30/min submit limiter.

const VIEWPORTS: [number, number][] = [
  [320, 640],
  [375, 812],
  [390, 844],
  [414, 896],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1440, 900],
];

const REMOVED = [
  "calm, voice-first personal assistant",
  "Android & iOS",
  "Private by design",
  "No spam, ever",
  "Calm by default",
];

const FORM = 'form[aria-label="Join the MyPA waitlist"]';
const BOT = "[data-mood]";
const CAROUSEL = 'section[aria-roledescription="carousel"]';
const PANEL = '[aria-label="What MyPA does"]';

/** Load the page and wait for hydration (the bot's player only mounts client-side). */
async function home(page: Page) {
  await page.goto("/");
  await page.locator(`${BOT} svg`).first().waitFor();
}

function uniqueEmail(tag: string) {
  return `delivered+e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@resend.dev`;
}

async function counter(page: Page) {
  return (await page.locator(`${CAROUSEL} p.font-mono`).innerText()).replace(/\s+/g, " ").trim();
}

/** Visible elements whose box crosses the viewport edge, ignoring anything inside a clipping ancestor. */
async function bleeding(page: Page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const bad: string[] = [];
    for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right <= W + 1 && r.left >= -1) continue;
      let p = el.parentElement;
      let clipped = false;
      while (p && p !== document.body) {
        if (/(hidden|clip)/.test(getComputedStyle(p).overflowX)) {
          clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (!clipped) bad.push(`${el.tagName}.${String(el.className).slice(0, 50)} [${Math.round(r.left)}, ${Math.round(r.right)}]`);
    }
    return bad;
  });
}

async function headlineOnOneLine(page: Page) {
  return page.locator("h1").evaluate((e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return {
      oneLine: r.height < parseFloat(cs.lineHeight) * 1.5,
      inside: r.left >= 0 && r.right <= window.innerWidth,
      fontSize: parseFloat(cs.fontSize),
      family: cs.fontFamily,
    };
  });
}

/** Resolve any CSS colour to RGB through a canvas. */
async function rgbOf(page: Page, selector: string, prop: "color" | "backgroundColor") {
  return page.locator(selector).first().evaluate((e, p) => {
    const c = document.createElement("canvas").getContext("2d")!;
    c.fillStyle = getComputedStyle(e)[p];
    c.fillRect(0, 0, 1, 1);
    return Array.from(c.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }, prop);
}

// ---------------------------------------------------------------- A. Layout, copy and theme, per viewport

for (const [w, h] of VIEWPORTS) {
  test.describe(`at ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("headline is the new copy, in DM Sans, on one line, near-black", async ({ page }) => {
      await home(page);
      await expect(page.locator("h1")).toHaveText("Your day, spoken into order.");
      const m = await headlineOnOneLine(page);
      expect(m.oneLine).toBe(true);
      expect(m.inside).toBe(true);
      expect(m.family).toContain("DM Sans");
      expect(m.fontSize).toBeGreaterThanOrEqual(18);
      const [r, g, b] = await rgbOf(page, "h1", "color");
      expect(Math.max(r, g, b)).toBeLessThan(48);
    });

    test("nothing bleeds past the viewport edge", async ({ page }) => {
      await home(page);
      await page.mouse.wheel(0, 4000);
      await page.waitForTimeout(400);
      expect(await bleeding(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test("white page, no dark theme, no shadows, glows or blurs, removed copy is gone", async ({ page }) => {
      await home(page);
      expect(await rgbOf(page, "body", "backgroundColor")).toEqual([255, 255, 255]);
      expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false);
      const effects = await page.evaluate(() => {
        // Tailwind v4 composes box-shadow from transparent ring layers; only a colour that paints counts.
        const paints = (v: string) =>
          v !== "none" &&
          (v.match(/(rgba?|oklch|oklab|lab|lch|color)\([^)]*\)/g) ?? []).some((c) => !/(,|\/)\s*0\)$/.test(c));
        return Array.from(document.body.querySelectorAll<HTMLElement>("*"))
          .filter((el) => {
            const cs = getComputedStyle(el);
            return (
              paints(cs.boxShadow) ||
              paints(cs.textShadow) ||
              cs.filter !== "none" ||
              cs.backdropFilter !== "none" ||
              /gradient/.test(cs.backgroundImage)
            );
          })
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 50)}`);
      });
      expect(effects).toEqual([]);
      const text = await page.locator("body").innerText();
      for (const s of REMOVED) expect(text).not.toContain(s);
    });

    test('"your chief of staff" sits directly under the MyPA wordmark', async ({ page }) => {
      await home(page);
      const mark = page.locator("header").getByText("MyPA", { exact: true });
      const tag = page.locator("header").getByText("your chief of staff");
      await expect(tag).toBeVisible();
      const a = (await mark.boundingBox())!;
      const b = (await tag.boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
      expect(b.y - (a.y + a.height)).toBeLessThan(12);
      expect(Math.abs(b.x - a.x)).toBeLessThan(2);
    });

    test("every touch target is at least 44x44", async ({ page }) => {
      await home(page);
      const small = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            'a, button:not([role="checkbox"]), [role="tab"], input[type="email"], label[for="agreed"]',
          ),
        )
          .filter((el) => !el.closest('[aria-hidden="true"], [inert], .sr-only'))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
          .map(({ el, r }) => `${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`),
      );
      expect(small).toEqual([]);
    });

    test("bot, headline, form, use-case cards and carousel never overlap", async ({ page }) => {
      await home(page);
      const boxes = await Promise.all(
        [BOT, "h1", FORM, PANEL, CAROUSEL].map(async (s) => ({ s, b: (await page.locator(s).first().boundingBox())! })),
      );
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i].b;
          const B = boxes[j].b;
          const ix = Math.max(0, Math.min(A.x + A.width, B.x + B.width) - Math.max(A.x, B.x));
          const iy = Math.max(0, Math.min(A.y + A.height, B.y + B.height) - Math.max(A.y, B.y));
          expect(ix * iy, `${boxes[i].s} overlaps ${boxes[j].s}`).toBe(0);
        }
      }
      // Bot, headline and form run down the hero; the carousel sits beside the
      // hero from lg up and below it otherwise; the use-case cards come after both.
      const [bot, h1, form, panel, carousel] = boxes.map((x) => x.b);
      expect(bot.y).toBeLessThan(h1.y);
      expect(h1.y).toBeLessThan(form.y);
      if (w >= 1024) expect(carousel.x).toBeGreaterThanOrEqual(form.x + form.width);
      else expect(carousel.y).toBeGreaterThanOrEqual(form.y + form.height);
      expect(panel.y).toBeGreaterThanOrEqual(Math.max(form.y + form.height, carousel.y + carousel.height));
    });
  });
}

// ---------------------------------------------------------------- B. Validation (no writes)

test.describe("validation", () => {
  test("empty submit asks for an email and the bot is unsure", async ({ page }) => {
    await home(page);
    await page.locator(`${FORM} button[type=submit]`).click();
    await expect(page.locator("#waitlist-message")).toHaveText("Add your email to join.");
    await expect(page.locator(BOT)).toHaveAttribute("data-mood", "unsure");
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  });

  const INVALID = [
    "ada",
    "ada@",
    "@mypa.computer",
    "ada@mypa",
    "ada mypa@mypa.computer",
    "ada@@mypa.computer",
    "ada.mypa.computer",
    "ada@mypa..computer",
    "ada@.computer",
    "<script>@mypa.computer",
  ];
  for (const bad of INVALID) {
    test(`rejects "${bad}" client-side`, async ({ page }) => {
      await home(page);
      await page.fill("#email", bad);
      await page.locator(`${FORM} button[type=submit]`).click();
      await expect(page.locator("#waitlist-message")).toHaveText("That email doesn’t look right.");
      await expect(page.locator(BOT)).toHaveAttribute("data-mood", "unsure");
      await expect(page.locator('[role="status"]')).toHaveCount(0);
    });
  }

  test("consent is ticked by default, in green", async ({ page }) => {
    await home(page);
    const box = page.locator("#agreed");
    await expect(box).toHaveAttribute("data-state", "checked");
    const [r, g, b] = await rgbOf(page, "#agreed", "backgroundColor");
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  test("a valid email without consent is held back", async ({ page }) => {
    await home(page);
    await page.locator('label[for="agreed"]').click();
    await page.fill("#email", uniqueEmail("noconsent"));
    await page.locator(`${FORM} button[type=submit]`).click();
    await expect(page.locator("#waitlist-message")).toHaveText("Tick the box so we can email your invite.");
    await expect(page.locator('[role="status"]')).toHaveCount(0);
  });

  test("focusing the bar makes the bot listen; leaving it returns to idle", async ({ page }) => {
    await home(page);
    await page.locator("#email").focus();
    await expect(page.locator(BOT)).toHaveAttribute("data-mood", "listen");
    await page.locator("h1").click();
    await expect(page.locator(BOT)).toHaveAttribute("data-mood", "idle");
  });

  test("the honeypot is out of the tab order and hidden from assistive tech", async ({ page }) => {
    await home(page);
    const hp = page.locator("#website");
    await expect(hp).toHaveAttribute("tabindex", "-1");
    expect(await hp.evaluate((e) => !!e.closest('[aria-hidden="true"]'))).toBe(true);
  });

  test("Enter in the bar submits", async ({ page }) => {
    await home(page);
    await page.fill("#email", "nope");
    await page.locator("#email").press("Enter");
    await expect(page.locator("#waitlist-message")).toHaveText("That email doesn’t look right.");
  });
});

// ---------------------------------------------------------------- C. Submissions (writes to Convex)

test.describe("submission", () => {
  for (const [w, h] of VIEWPORTS) {
    test(`valid email joins the list at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await home(page);
      await page.fill("#email", uniqueEmail(`v${w}`));
      await page.locator(`${FORM} button[type=submit]`).click();
      const done = page.locator('[role="status"]');
      await expect(done).toContainText("on the list", { timeout: 15_000 });
      await expect(done).toContainText("Your place is saved");
      await expect(page.locator(BOT)).toHaveAttribute("data-mood", "done");
      await expect(page.getByLabel("Your referral link")).toHaveValue(/\?ref=[a-z0-9]{8}$/);
      expect(await bleeding(page)).toEqual([]);
    });
  }

  test("an email with capitals and spaces is normalised and accepted", async ({ page }) => {
    await home(page);
    const email = uniqueEmail("norm").toUpperCase();
    await page.fill("#email", `  ${email}  `);
    await page.locator(`${FORM} button[type=submit]`).click();
    await expect(page.locator('[role="status"]')).toContainText("on the list", { timeout: 15_000 });
    // A first visit has no stored theme; the toast must still be light on the white page.
    await expect(page.locator("[data-sonner-toaster]")).toHaveAttribute("data-sonner-theme", "light");
    const [r, g, b] = await rgbOf(page, "[data-sonner-toast]", "backgroundColor");
    expect(Math.min(r, g, b)).toBeGreaterThan(200);
  });

  test("joining twice is a duplicate, not an error", async ({ page }) => {
    const email = uniqueEmail("dup");
    for (const pass of [1, 2]) {
      await home(page);
      await page.fill("#email", email);
      await page.locator(`${FORM} button[type=submit]`).click();
      await expect(page.locator('[role="status"]')).toContainText("on the list", { timeout: 15_000 });
      if (pass === 2) await expect(page.getByText("You're already on the list")).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------- D. Carousel

test.describe("carousel", () => {
  for (const [w, h] of [
    [1440, 900],
    [375, 812],
  ] as const) {
    test(`next walks every slide and wraps at ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await home(page);
      const next = page.getByRole("button", { name: "Next slide" });
      for (let i = 2; i <= SLIDES.length; i++) {
        await next.click();
        expect(await counter(page)).toBe(`0${i} / 0${SLIDES.length}`);
        await expect(page.locator(`${CAROUSEL} h3`)).toHaveText(SLIDES[i - 1].title);
      }
      await next.click();
      expect(await counter(page)).toBe(`01 / 0${SLIDES.length}`);
    });

    test(`previous from the first slide goes to the last at ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await home(page);
      await page.getByRole("button", { name: "Previous slide" }).click();
      expect(await counter(page)).toBe(`0${SLIDES.length} / 0${SLIDES.length}`);
    });
  }

  for (let i = 0; i < SLIDES.length; i++) {
    test(`progress mark ${i + 1} jumps to its slide`, async ({ page }) => {
      await home(page);
      await page.getByRole("button", { name: `Show slide ${i + 1}:` }).click();
      expect(await counter(page)).toBe(`0${i + 1} / 0${SLIDES.length}`);
      await expect(page.getByRole("button", { name: `Show slide ${i + 1}:` })).toHaveAttribute("aria-current", "true");
    });
  }

  for (const key of ["ArrowRight", "ArrowLeft"] as const) {
    test(`${key} moves the carousel`, async ({ page }) => {
      await home(page);
      await page.getByRole("button", { name: "Next slide" }).focus();
      await page.keyboard.press(key);
      expect(await counter(page)).toBe(key === "ArrowRight" ? "02 / 04" : "04 / 04");
    });
  }

  for (const [label, from, to, expected] of [
    ["left", 300, 80, "02 / 04"],
    ["right", 80, 300, "04 / 04"],
  ] as const) {
    test(`a touch swipe ${label} turns the page on mobile`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      await home(page);
      const frame = page.locator(`${CAROUSEL} > div`).first();
      await frame.scrollIntoViewIfNeeded();
      const box = (await frame.boundingBox())!;
      const y = box.y + box.height / 2;
      await frame.dispatchEvent("pointerdown", { clientX: from, clientY: y, pointerType: "touch", isPrimary: true });
      await frame.dispatchEvent("pointerup", { clientX: to, clientY: y, pointerType: "touch", isPrimary: true });
      expect(await counter(page)).toBe(expected);
      await ctx.close();
    });
  }

  const progressState = (page: Page) =>
    page.evaluate(() => {
      const a = document.getAnimations().find((x) => (x as CSSAnimation).animationName === "progress-fill");
      return a ? a.playState : "none";
    });

  test("autoplay advances when the progress line fills", async ({ page }) => {
    await home(page);
    await page.locator(CAROUSEL).scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await expect.poll(() => progressState(page)).toBe("running");
    await page.evaluate(() =>
      document.getAnimations().find((x) => (x as CSSAnimation).animationName === "progress-fill")!.finish(),
    );
    await expect.poll(() => counter(page)).toBe("02 / 04");
  });

  test("autoplay pauses on hover", async ({ page }) => {
    await home(page);
    await page.locator(CAROUSEL).scrollIntoViewIfNeeded();
    await page.locator(`${CAROUSEL} > div`).first().hover();
    await expect.poll(() => progressState(page)).toBe("paused");
  });

  test("autoplay waits while the carousel is off screen", async ({ page }) => {
    // Stacked layout on a short phone: the carousel starts below the fold.
    await page.setViewportSize({ width: 375, height: 560 });
    await home(page);
    await expect.poll(() => progressState(page)).toBe("paused");
  });

  test("autoplay pauses in a hidden tab", async ({ page }) => {
    await home(page);
    await page.locator(CAROUSEL).scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await expect.poll(() => progressState(page)).toBe("running");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => progressState(page)).toBe("paused");
  });

  test("reduced motion: no autoplay and no wipe", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await home(page);
    await page.locator(CAROUSEL).scrollIntoViewIfNeeded();
    expect(await progressState(page)).toBe("none");
    await page.getByRole("button", { name: "Next slide" }).click();
    const names = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName));
    expect(names.some((n) => /^slide-|^edge-/.test(n))).toBe(false);
    expect(await counter(page)).toBe("02 / 04");
  });

  test("first load fetches at most two slide images", async ({ page }) => {
    const seen = new Set<string>();
    page.on("request", (r) => {
      const m = decodeURIComponent(r.url()).match(/carousel\/([a-z-]+)\.webp/);
      if (m) seen.add(m[1]);
    });
    await home(page);
    await page.locator(CAROUSEL).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    expect(seen.size).toBeGreaterThan(0);
    expect(seen.size).toBeLessThanOrEqual(2);
  });

  test("turning pages causes no layout shift", async ({ page }) => {
    await home(page);
    await page.locator(CAROUSEL).scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as unknown as { value: number }[]) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: "layout-shift" });
    });
    for (let i = 0; i < SLIDES.length; i++) {
      await page.getByRole("button", { name: "Next slide" }).click();
      await page.waitForTimeout(350);
    }
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.01);
  });

  test("every slide has its alt text once reached", async ({ page }) => {
    await home(page);
    for (let i = 1; i < SLIDES.length; i++) await page.getByRole("button", { name: "Next slide" }).click();
    for (const s of SLIDES) await expect(page.locator(`${CAROUSEL} img[alt="${s.alt}"]`)).toHaveCount(1);
  });
});

// ---------------------------------------------------------------- E. Bot

test.describe("bot", () => {
  for (const [w, h] of [
    [1440, 900],
    [375, 812],
  ] as const) {
    test(`renders Glance at ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await home(page);
      const box = (await page.locator(`${BOT} svg`).first().boundingBox())!;
      expect(box.width).toBeGreaterThan(100);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(w);
    });

  }

  test("reduced motion holds a still frame and drops the float", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await home(page);
    await page.waitForTimeout(300);
    const svg = page.locator(`${BOT} svg`).first();
    const a = await svg.innerHTML();
    await page.waitForTimeout(700);
    expect(await svg.innerHTML()).toBe(a);
    expect(await page.locator(".bot-float").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  });

  test("listening shows the contour rings", async ({ page }) => {
    await home(page);
    await page.locator("#email").focus();
    const rings = page.locator(`${BOT} .bot-contour`).first();
    await expect.poll(() => rings.evaluate((e) => getComputedStyle(e.parentElement!).opacity)).toBe("1");
  });

  test("leans toward a mouse pointer", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await home(page);
    await page.mouse.move(1400, 150);
    const lean = page.locator(`${BOT} .will-change-transform`);
    await expect.poll(() => lean.evaluate((e) => e.style.transform)).toMatch(/translate3d\([1-9]/);
  });

  test("does not lean on a touch device", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await home(page);
    await page.touchscreen.tap(360, 120);
    await page.waitForTimeout(500);
    expect(await page.locator(`${BOT} .will-change-transform`).evaluate((e) => e.style.transform)).toBe("");
    await ctx.close();
  });
});

// ---------------------------------------------------------------- F. Load performance

test.describe("load", () => {
  for (const [w, h] of [
    [375, 812],
    [1440, 900],
  ] as const) {
    test(`no console errors on load at ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      await home(page);
      await page.waitForTimeout(1500);
      expect(errors).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------- G. Resize and orientation

test.describe("resize", () => {
  const STEPS: [string, [number, number], [number, number]][] = [
    ["desktop to phone", [1440, 900], [375, 812]],
    ["phone portrait to landscape", [390, 844], [844, 390]],
    ["landscape to tablet", [844, 390], [768, 1024]],
    ["phone to desktop", [390, 844], [1440, 900]],
  ];
  for (const [name, [w1, h1], [w2, h2]] of STEPS) {
    test(name, async ({ page }) => {
      await page.setViewportSize({ width: w1, height: h1 });
      await home(page);
      await page.setViewportSize({ width: w2, height: h2 });
      await page.waitForTimeout(400);
      const m = await headlineOnOneLine(page);
      expect(m.oneLine).toBe(true);
      expect(m.inside).toBe(true);
      expect(await bleeding(page)).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------- H. Reduced motion, page level

test.describe("reduced motion", () => {
  test("entrance content is visible immediately", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await home(page);
    const opacities = await page.locator(".animate-rise").evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
    expect(opacities.every((o) => o === "1")).toBe(true);
  });

  test("the use-case timer is hidden and does not advance", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await home(page);
    await expect(page.locator(`${PANEL} .animate-groove`)).toBeHidden();
    await page.waitForTimeout(800);
    await expect(page.getByRole("tab", { name: "Plan" })).toHaveAttribute("aria-selected", "true");
  });
});
