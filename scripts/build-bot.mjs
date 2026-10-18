#!/usr/bin/env node
// Merges Motion Studio's per-state Glance Lotties into one file the landing
// page plays with markers, so switching state never reloads or re-parses.
//
//   node scripts/build-bot.mjs ../motionstudio/bot/out/lottie/light
//
// Each state's layer is placed on the shared timeline by its ip/op/st, so no
// keyframe is rewritten. One marker per state names its segment, plus a
// "blink" marker over the tail of arrive, which Motion Studio authored as a
// blink from the resting face back to it.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STATES = ["arrive", "listen", "think", "speak", "done", "unsure", "failed"];
const src = process.argv[2];
const out = process.argv[3] ?? "public/bot/glance.json";
if (!src) {
  console.error("usage: node scripts/build-bot.mjs <motionstudio/bot/out/lottie/light> [out]");
  process.exit(1);
}

let t = 0;
let base;
const layers = [];
const markers = [];
for (const state of STATES) {
  const doc = JSON.parse(readFileSync(join(src, `glance-${state}.json`), "utf8"));
  base ??= doc;
  if (doc.fr !== base.fr || doc.w !== base.w || doc.h !== base.h) {
    throw new Error(`glance-${state}.json does not share the canvas of glance-${STATES[0]}.json`);
  }
  const frames = doc.op - doc.ip;
  for (const layer of doc.layers) {
    layers.push({ ...layer, ind: layers.length + 1, ip: t + layer.ip, op: t + layer.op, st: t + (layer.st ?? 0) });
  }
  markers.push({ tm: t, cm: state, dr: frames });
  if (state === "arrive") markers.push({ tm: t + blinkStart(doc), cm: "blink", dr: doc.op - blinkStart(doc) });
  t += frames;
}

/** Four frames before arrive's last eye close: the open face, then the blink. */
function blinkStart(doc) {
  const eyes = doc.layers[0].shapes.find((g) => g.nm === "eyes");
  const k = eyes.it.find((g) => g.nm === "eye-l").it.find((s) => s.ty === "rc").s.k;
  for (let i = k.length - 2; i >= 0; i--) {
    if (k[i].s[1] > k[i + 1].s[1]) return k[i].t - 4;
  }
  throw new Error("glance-arrive.json has no eye close to blink with");
}

const merged = { ...base, nm: "glance", ip: 0, op: t, layers, markers, assets: [] };
writeFileSync(out, JSON.stringify(merged));
console.log(`${out}: ${STATES.length} states, ${t} frames, ${JSON.stringify(merged).length} bytes`);
