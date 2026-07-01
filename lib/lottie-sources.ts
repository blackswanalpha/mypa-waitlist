/**
 * Lottie animation sources, one per landing-page section.
 *
 * Paste your CDN URLs here (e.g. "https://cdn.example.com/lottie/hero.lottie",
 * or a `.json` URL). Both `.lottie` and `.json` are supported by <Lottie>.
 * While a value is an empty string, that section's <Lottie> renders nothing —
 * so the page stays clean until you wire each URL.
 */
export const LOTTIE = {
  /** Hero — voice-first AI centerpiece. */
  hero: "",
  /** Showcase ("How it works") — automation / things getting done. */
  showcase: "",
  /** Features ("Your whole day") — productivity / AI scene. */
  features: "",
  /** FAQ — chat / question bubbles. */
  faq: "",
  /** Waitlist — rocket / launch / early access. */
  waitlist:
    "https://lottie.host/cd042852-ab46-499f-b5f6-115d78f44a6f/OprvMIJUtd.lottie",
  /** Feedback — stars / rating. */
  feedback: "",
} as const;
