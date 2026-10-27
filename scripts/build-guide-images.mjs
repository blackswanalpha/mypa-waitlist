#!/usr/bin/env node
/**
 * Screenshots the illustrated phone screens on /testers/guide into
 * public/guide/*.png, the images the approval email embeds. Re-run after
 * changing components/guide/shots.tsx:
 *
 *   npm run dev            # or any server serving this app
 *   node scripts/build-guide-images.mjs [http://127.0.0.1:3000]
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "guide");
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 2 });
// The Samsung variant renders every shot, the Auto Blocker one included.
await page.goto(`${base}/testers/guide?phone=samsung`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

const files = await page.$$eval("[data-shot]", (els) => els.map((e) => e.getAttribute("data-shot")));
for (const file of files) {
  await page.locator(`[data-shot="${file}"]`).screenshot({ path: path.join(out, file), animations: "disabled" });
  console.log("wrote", path.join("public/guide", file));
}
await browser.close();
if (files.length === 0) {
  console.error("no [data-shot] elements found");
  process.exit(1);
}
