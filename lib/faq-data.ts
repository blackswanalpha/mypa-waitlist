/**
 * FAQ copy shared by the client accordion (components/faq.tsx) and the
 * server-rendered FAQPage JSON-LD (app/page.tsx). Plain module on purpose —
 * a "use client" file can't be imported for values by a server component.
 */
export const FAQS = [
  {
    q: "What is MyPA?",
    a: "A voice-first AI personal assistant. Say \"Hey MyPA\" to plan your day, manage email and calendar, set reminders, keep a private journal, and stay connected — all in one place.",
  },
  {
    q: "What does joining the waitlist do?",
    a: "You'll be whitelisted for early access. When MyPA launches, your spot is reserved and you'll be among the first invited to register.",
  },
  {
    q: "When does MyPA launch?",
    a: "We're in active build toward launch. Join the waitlist and we'll email you the moment your invite is ready — no spam in between.",
  },
  {
    q: "Is my data private?",
    a: "Privacy is core to MyPA. Your journal and personal context are yours; we're building with encryption and granular permissions from day one.",
  },
  {
    q: "Which platforms will it support?",
    a: "MyPA is mobile-first (Android and iOS) with a companion web experience. Waitlist members get early builds first.",
  },
  {
    q: "How much will it cost?",
    a: "MyPA will offer a free tier with optional premium features. Waitlist members get early-adopter perks.",
  },
];
