# mypa-waitlist

The MyPA launch landing page + early-access waitlist. A standalone Next.js 16
app, visually matched to `mypa-frontend`, backed by its **own dedicated Convex
deployment** (isolated from the product backends).

Pages:

- `/` — landing: hero, features, **waitlist** form (`#waitlist`), **feedback** form (`#feedback`)
- `/contact` — contact form
- `/admin` — admin dashboard (Convex Auth, allowlisted) to view/monitor waitlist, feedback & contact submissions live

Stack: Next.js 16 · React 19 · Tailwind v4 · shadcn/ui (new-york) · Convex ·
Convex Auth (Password) · @convex-dev/resend · react-hook-form + zod · sonner.

> This box has Node + npm (no bun), so commands below use `npm`/`npx`. The repo
> is npm-installed; swap in `bun` if you prefer.

## 1. Install

```bash
cd mypa-waitlist
npm install
```

## 2. Create the dedicated Convex project (interactive — you run this)

```bash
npx convex dev
```

- Logs you in (`npx convex login` if needed) and prompts to **create a new
  project** — name it `mypa-waitlist`. **Do not** point it at the product's
  `mypa-chat-sync` deployment.
- Writes `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOYMENT` to `.env.local`, pushes
  the schema + functions, and generates `convex/_generated/`.
- Leave it running (it watches & redeploys on change).

Then generate the Convex Auth keys (one-time):

```bash
npx @convex-dev/auth
```

This sets `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` on the deployment. (The
`convex/auth.ts`, `auth.config.ts`, and `http.ts` files already exist; the CLI
just adds the keys.)

## 3. Configure deployment env

```bash
npx convex env set ADMIN_EMAILS "you@example.com"     # comma-separated allowlist
npx convex env set RESEND_API_KEY "re_xxxxxxxx"        # from resend.com
# optional in prod (defaults: test mode + onboarding@resend.dev sender):
# npx convex env set RESEND_TEST_MODE "false"
# npx convex env set RESEND_FROM "MyPA <hello@yourdomain.com>"  # must be a verified Resend domain
```

## 4. Run

```bash
npm run dev    # http://localhost:3000  (keep `npx convex dev` running too)
```

## 5. Seed the admin account

Go to `http://localhost:3000/admin` → click **"First time? Create the admin
account"** → sign up with an email that is in `ADMIN_EMAILS` + a password. Only
allowlisted emails can create an account or sign in. After that, use **Sign in**.

## 6. Verify end-to-end

- **Waitlist** (`/#waitlist`): submit name + email → success card + toast.
  Resubmit the same email → "already on the list". Row appears live in the admin
  Waitlist tab. Check Resend for the confirmation + admin-notify emails.
- **Feedback** (`/#feedback`): submit a message (+ optional rating) → appears in
  the Feedback tab.
- **Contact** (`/contact`): submit → appears in the Contact tab; click
  **Mark handled** → flips live.
- **Admin auth**: sign out → `/admin` shows the login. A non-allowlisted account
  can't be created, and admin queries reject non-admins (`Unauthorized`).

> In Resend **test mode** (the default), emails only deliver to your verified
> address — the admin-notify will arrive, an arbitrary signer's confirmation
> won't. That's expected; flip `RESEND_TEST_MODE=false` with a verified domain
> for real delivery.

## 7. Deploy (Vercel)

`convex/_generated/` is gitignored, so let Convex generate it at build time —
set the Vercel **Build Command** to:

```bash
npx convex deploy --cmd 'npm run build'
```

This pushes the prod Convex deployment, injects the prod `NEXT_PUBLIC_CONVEX_URL`
into the Next build, then builds. Also:

- Add `CONVEX_DEPLOY_KEY` (from the Convex dashboard) to Vercel env.
- Set prod Convex env: `ADMIN_EMAILS`, `RESEND_API_KEY`, `SITE_URL` (the Vercel
  URL), `RESEND_TEST_MODE=false`, `RESEND_FROM` (verified domain).

## Architecture notes

- **Public** mutations (`convex/{waitlist,feedback,contact}.ts` → `submit`)
  have no auth gate; they validate server-side and schedule emails via
  `ctx.scheduler.runAfter(0, internal.emails.send.*)` so mail only sends on a
  committed transaction.
- **Admin** access is enforced by `requireAdmin` (`convex/admin.ts`) on every
  admin query/mutation — signed in **and** email in `ADMIN_EMAILS`. The
  middleware only manages the auth cookie; it is not the security boundary.
- Design tokens (`app/globals.css`), `cn()` (`lib/utils.ts`), and the
  `components/ui/*` primitives are mirrored from `mypa-frontend`.
