# How mypa-waitlist works

This is a technical walkthrough of the architecture and the decisions behind
it. For setup/run instructions see `README.md`; for the one-line pitch see
`description.md`.

## Why a separate app

`mypa-waitlist` is a sibling of `moment/`, `mypa-backend/`, and `mypa-convex/`
in the mypa workspace, but it is deliberately **not wired to the product**.
It's a marketing/launch surface (landing page, waitlist signup, feedback,
contact, admin triage) that needs to ship and iterate independently of the
mobile app and its backend. Sharing infrastructure with the product would mean
a landing-page deploy could touch production data paths — so it gets its own
Convex deployment, its own Convex Auth instance, and its own env vars. The
only thing it borrows from the product is presentation: design tokens,
`cn()`, and the shadcn primitives are mirrored from `mypa-frontend` so the
landing page looks like it belongs to the same product.

## Stack and why

- **Next.js 16 / React 19** — App Router, server + client components mixed;
  forms are client components, the admin dashboard is a client component tree
  reading live Convex queries.
- **Convex** — backend-as-a-database with reactive queries, used here for
  three simple write-heavy tables (`waitlist`, `feedback`, `contactMessages`)
  plus Convex Auth's own tables. Chosen for the built-in reactivity (the admin
  dashboard updates live with no polling) and because the rest of the mypa
  workspace already standardizes on it.
- **Convex Auth (Password provider)** — the admin login. No self-serve signup
  flow: `requireAdmin` (`convex/admin.ts`) checks the signed-in user's email
  against the `ADMIN_EMAILS` env var on every admin query/mutation. The
  Next.js `middleware.ts` only manages the auth cookie for routing — it is
  explicitly *not* the security boundary, so a misconfigured middleware can't
  leak admin data.
- **@convex-dev/resend** — transactional email (signup confirmation,
  admin-notify). Public mutations never send mail inline; they
  `ctx.scheduler.runAfter(0, internal.emails.send.*)` so mail only fires after
  the write actually commits, not on every attempt.
- **shadcn/ui (new-york) + Tailwind v4 + GSAP/ScrollTrigger** — the
  landing-page shell. GSAP replaced an earlier `motion`-based approach for the
  scroll-pinned showcase and reveal-on-scroll effects; `lib/gsap.ts`
  registers plugins once and respects `prefers-reduced-motion` via
  `matchMedia`.

## Data model (`convex/schema.ts`)

- `waitlist` — `name`, `email`, optional `phone`, `status` (`pending` /
  `invited` / `registered`), optional `source` (e.g. `"landing"`, `"hero"`),
  `createdAt`. Indexed `by_email` (dedupe — resubmitting the same email is a
  no-op with a friendly message) and `by_createdAt` (admin table ordering).
- `feedback` — optional `name`/`email`, optional 1–5 `rating`, required
  `message`, `createdAt`. Indexed `by_createdAt`.
- `contactMessages` — `name`, `email`, `subject`, `message`, `handled`
  (boolean triage flag), `createdAt`. Indexed `by_createdAt` and `by_handled`
  so the admin can filter open vs. resolved.
- Plus `authTables` (spread from `@convex-dev/auth/server`) for the admin
  login — users, sessions, accounts, verification codes.

## Request flow

1. A visitor submits the waitlist/feedback/contact form (client component,
   `react-hook-form` + `zod` validation).
2. The form calls a **public** Convex mutation (`convex/{waitlist,feedback,
   contact}.ts` → `submit`). These have no auth gate — anyone can call them —
   but they re-validate server-side (never trust the client) and write
   directly to the table.
3. On a committed write, the mutation schedules an email job
   (`ctx.scheduler.runAfter(0, ...)`) rather than awaiting Resend inline, so a
   slow or failing email provider never blocks or fails the user-facing
   submission.
4. The `/admin` dashboard subscribes to admin-only queries (gated by
   `requireAdmin`) and re-renders live as new rows land — no refresh needed,
   because Convex queries are reactive subscriptions, not one-shot fetches.

## Notable decisions / gotchas worth knowing

- **JWT keys for Convex Auth were generated manually with `jose`**, not via
  `npx @convex-dev/auth`. Running that CLI would regenerate `convex/auth.ts`
  and clobber the custom `ADMIN_EMAILS` allowlist logic already written by
  hand — so only run it for the *first-time key generation*, never again
  after `auth.ts` has custom logic.
- **Backend is a local Convex deployment**, not a cloud project — a deliberate
  choice to develop without depending on network/cloud availability. Cloud
  deployment is a separate documented path (`npx convex dev --configure new
  --dev-deployment cloud`) for when this ships to Vercel.
- **`RESEND_API_KEY` is unset locally**, so emails don't actually send in dev
  — this is expected, not a bug. Resend's test mode also restricts delivery
  to the verified sender address regardless.
- **No bun on this box** — despite `mypa-frontend` (the design source of
  truth this app mirrors) using bun, this app is npm-installed. Don't assume
  bun is available when working in this repo.
- **shadcn must be added via `npx shadcn add`, never `npx shadcn init`** —
  init overwrites the hand-tuned `globals.css` design tokens copied from
  `mypa-frontend`.
- **The workspace-root `.gitignore` has an unanchored `ui/` pattern** that
  matches `components/ui/` in any nested app, which breaks Tailwind v4's
  content scanning for shadcn primitives (they render unstyled). This app
  works around it with an explicit `@source "../components/ui"` in the
  Tailwind config — if a shadcn component ever renders invisible/unstyled
  again, check that `@source` directive first.
