"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Register once at module scope. registerPlugin is idempotent and SSR-safe
// (it does not touch `window`), so importing this from any client component
// guarantees a single registration. All animation components import from here.
gsap.registerPlugin(useGSAP, ScrollTrigger);

export { gsap, ScrollTrigger, useGSAP };
