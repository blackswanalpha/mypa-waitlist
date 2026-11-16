# Run it locally

This gets the site and the admin console running on your computer, against your own private copy of the database. Nothing you do here touches the live site.

You need Node 22 and npm, and access to the Convex team `mypa-waitlist-team` (ask an existing admin to invite you).

---

## 1. Install

```bash
cd mypa-waitlist
npm ci
```

## 2. Connect to your dev database

```bash
npx convex dev
```

The first time, this:

1. opens a browser so you can log in to Convex,
2. asks which project to use. Pick **mypa-waitlist** in the team **mypa-waitlist-team**,
3. creates your personal dev database, uploads the server code in `convex/` to it, and writes its address into `.env.local`.

Leave it running. Every time you save a file in `convex/`, it uploads the change.

## 3. Give your dev database its settings

Settings that the server code reads live on the database, not in a file. Set them once in a second terminal:

```bash
node scripts/ensure-auth-keys.mjs                    # the keys that sign admin logins
npx convex env set SITE_URL http://localhost:3000
npx convex env set ADMIN_EMAILS you@example.com      # who may use /admin. Comma-separate several
```

To have emails actually sent, add a Resend key. Leave the next two unset and nothing is emailed, which is fine for most work:

```bash
npx convex env set RESEND_API_KEY re_xxxxxxxx
npx convex env set ADMIN_NOTIFY_EMAILS delivered@resend.dev   # where "new signup" notices go
```

While `RESEND_TEST_MODE` is unset, email only reaches Resend's test inboxes (`delivered@resend.dev`, `bounced@resend.dev`), so you cannot email a real person by accident. Every setting is listed in [Production § Settings reference](deploy.md#settings-reference).

## 4. Start the site

```bash
npm run dev
```

Open http://localhost:3000. Sign up with any name and an address like `delivered+me@resend.dev`.

## 5. Create your admin login

Creating admin accounts is switched off by default, so nobody can claim an admin address before you do. Switch it on, make your account, then switch it off again:

```bash
npx convex env set ALLOW_ADMIN_SIGNUP true
```

1. Open http://localhost:3000/admin.
2. Click **First time? Create the admin account**.
3. Use an address you put in `ADMIN_EMAILS`, and pick a password.

```bash
npx convex env remove ALLOW_ADMIN_SIGNUP
```

You stay able to sign in. The signup you made in step 4 is waiting in the Testers tab. The [Admin guide](admin-guide.md) explains every page.

## 6. Run the tests

The browser tests run against a production build, so performance is measured on the real thing. Start one on port 20301:

```bash
npm run build
npx next start -p 20301
```

Then, in another terminal:

```bash
npx playwright install chromium        # once
E2E_ADMIN_EMAIL=you@example.com E2E_ADMIN_PASSWORD='your-password' npx playwright test
```

There are three groups, run in this order:

| Group | Covers |
|---|---|
| `scenarios` | The landing page at many screen sizes, the form, the cookie card, the device cookie |
| `testers` | The admin console: signups appearing, approve, resend, decline, delete, closing and reopening signups. It deletes its own rows at the end |
| `perf` | Frame rate, layout shift and load time |

Every test signup uses a `@resend.dev` address. Run one group with `--project testers`. If an earlier group fails, add `--no-deps` to run a later one anyway.

Never point the tests at the live site (`E2E_BASE_URL`). They write rows, send email and close signups for a moment.

## 7. Before you open a pull request

```bash
npm run lint
npm run build      # includes the type check
```

If you changed anything in `convex/`, keep `npx convex dev` running until it says the functions are ready, and commit the updated `convex/_generated/` files with your change.

---

## Running everything in Docker instead

`docker-compose.yml` can also run its own Convex database in a container, so you need no Convex account:

```bash
ADMIN_EMAILS=you@example.com ./scripts/docker-init.sh
```

| Address | What |
|---|---|
| http://127.0.0.1:4578 | the site |
| http://127.0.0.1:6791 | the Convex dashboard. Log in with the admin key the script prints |

The script can be re-run safely. It starts the database, uploads `convex/`, creates the login keys and builds the site. To keep hot reload, start only the database with `SKIP_WEB=1 ./scripts/docker-init.sh`, then run `npm run dev`.

This mode writes `CONVEX_SELF_HOSTED_URL` into `.env.local`, which replaces the cloud dev database. Put the `CONVEX_DEPLOYMENT` line back to return to the cloud.
