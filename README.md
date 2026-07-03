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

Account creation is **disabled by default** (`ALLOW_ADMIN_SIGNUP` unset) so
nobody can register an allowlisted address before you do. Bootstrap once:

```bash
npx convex env set ALLOW_ADMIN_SIGNUP "true"
```

Go to `http://localhost:3000/admin` → click **"First time? Create the admin
account"** → sign up with an email that is in `ADMIN_EMAILS` + a password. Then
lock sign-up again:

```bash
npx convex env remove ALLOW_ADMIN_SIGNUP
```

Sign-in keeps working with the flag unset. Only allowlisted emails can ever
create an account or sign in.

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

## 6b. Whitelisting & backend sync

The admin **Waitlist** tab manages launch access ("invited" status = shown as
**Whitelisted**):

- Select rows → **Whitelist selected** (or **Whitelist all pending** — loops
  200 rows per transaction until done). **Mark pending** reverses.
- **CSV** exports the current status filter (all columns, RFC-4180 quoted).
- **Sync to backend** pushes whitelisted rows to the product backend's
  `POST /api/v1/waitlist-sync/import` in 200-row batches; successful batches
  are stamped `syncedAt` (green check in the table), so a mid-run failure never
  loses progress. Configure once:

```bash
npx convex env set BACKEND_URL "https://backend.mypa.computer"
npx convex env set BACKEND_SERVICE_KEY "<same value as the backend's CONVEX_SERVICE_KEY>"
```

At launch, flip `SIGNUP_WHITELIST_REQUIRED=true` on the backend — signup then
only accepts whitelisted emails, and each signup marks its whitelist row
claimed.

One-time after upgrading to the counters schema (seeds the dashboard stats):

```bash
npx convex run counters:backfill
```

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

## 8. Docker (self-hosted, no Convex cloud)

The repo also runs fully locally under docker-compose — a **self-hosted Convex
backend** (official `ghcr.io/get-convex/convex-backend` image) + the Convex
dashboard + the Next.js app, with data persisted in a named volume
(`convex-data`). No Convex account needed.

```bash
ADMIN_EMAILS="you@example.com" ./scripts/docker-init.sh
```

The script is idempotent: it starts `backend` + `dashboard`, generates the
deployment admin key, wires `.env.local` (`CONVEX_SELF_HOSTED_URL` /
`CONVEX_SELF_HOSTED_ADMIN_KEY`, commenting out any `CONVEX_DEPLOYMENT`), pushes
`convex/` functions, generates the Convex Auth `JWT_PRIVATE_KEY`/`JWKS` if
missing, sets `SITE_URL` (+ `ADMIN_EMAILS` / `RESEND_API_KEY` if exported), and
builds + starts `web`.

| URL | What |
|---|---|
| http://127.0.0.1:3000 | the app (`WEB_PORT`) |
| http://127.0.0.1:3210 | Convex API (`CONVEX_PORT`) |
| http://127.0.0.1:3211 | Convex HTTP actions (`CONVEX_SITE_PORT`) |
| http://127.0.0.1:6791 | Convex dashboard — log in with the admin key the script prints (`CONVEX_DASHBOARD_PORT`) |

Day-to-day dev with hot reload — containerised backend, host app:

```bash
SKIP_WEB=1 ./scripts/docker-init.sh   # or: docker compose up -d backend dashboard
npm run dev
```

Notes:

- `npx convex ...` CLI commands (env set, logs, dashboard data) work as usual —
  they target the docker backend via the `CONVEX_SELF_HOSTED_*` vars in
  `.env.local`.
- After changing `convex/` functions with the `web` container in use, re-push
  with `npx convex deploy -y` (or just re-run the init script). Rebuild `web`
  (`docker compose up -d --build web`) only when app code changes.
- `NEXT_PUBLIC_CONVEX_URL` is baked into the client bundle at image build time
  (browser-facing URL); the Next server reaches the backend via
  `CONVEX_SERVER_URL=http://backend:3210` (runtime env, see `middleware.ts`).
- Switching from the previous `npx convex dev` anonymous-local setup starts
  with a **fresh database** — the old state stays in
  `~/.convex/anonymous-convex-backend-state/` (restore the commented
  `CONVEX_DEPLOYMENT` line in `.env.local` to boot it again).
- Pin images with `CONVEX_TAG=<rev>` (backend + dashboard publish matching
  tags); default is `latest`.

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
