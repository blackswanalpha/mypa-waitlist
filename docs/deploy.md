# Production

How the live site is put together, how a change reaches it, and where every setting lives.

## The two halves

| Half | What it is | Where it runs | Updated by |
|---|---|---|---|
| **The site**: pages and the two API routes | the Next.js app | Coolify, at `waitlist.heymypa.ai`, built from `main` with `docker-compose.yml` (only the `web` service) | a Coolify build |
| **The data and server code**: tables, admin actions, emails | the `convex/` folder | Convex Cloud, team `mypa-waitlist-team`, prod deployment `elegant-snake-479` | the GitHub Action **Deploy Convex (prod)** |

`waitlist.mypa.computer` and `mypa.computer` permanently redirect (301) to the `heymypa.ai` addresses, keeping the path.

## Ship a change

1. Open a pull request into `main`. Run `npm run lint` and `npm run build` first.
2. Merge it.
3. If the change touches `convex/`, GitHub Actions runs **Deploy Convex (prod)** and uploads it to `elegant-snake-479` in about a minute. Check it went green under the repo's **Actions** tab.
4. Coolify builds the site from `main`. If it does not start on its own, open the app in Coolify and click **Redeploy**.

The Convex upload usually finishes before the site build. That is the safe order, because new pages never call server code that is not there yet.

To re-run the Convex upload by hand, click **Run workflow** on the Action. From a laptop with access, `npx convex deploy` does the same.

## Settings reference

Settings live in two places. A setting in the wrong place does nothing.

### On Coolify (the site)

Set these in the Coolify app's environment variables. The ones marked *build* are baked into the site when it is built, so changing one needs a **Redeploy**.

| Name | Value in prod | What it is for |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` *build* | `https://elegant-snake-479.convex.cloud` | where the browser reaches the database |
| `CONVEX_SERVER_URL` | same as above | where the site's server reaches the database |
| `NEXT_PUBLIC_SITE_URL` *build* | `https://waitlist.heymypa.ai` (the default if unset) | the canonical address used in search results, link previews, the sitemap and the links the admin builds |
| `BACKEND_URL` | the MyPA backend address | each signup is also copied to the MyPA app's backend, as a user waiting for access |
| `BACKEND_SERVICE_KEY` | shared secret | proves that copy comes from this site. Must equal the backend's `CONVEX_SERVICE_KEY` |

If `BACKEND_URL` is missing, signups still work. They are just not copied to the backend.

### On Convex (the data and server code)

```bash
npx convex env list --prod                 # names only
npx convex env get --prod SITE_URL         # one value
npx convex env set --prod NAME "value"     # change one, takes effect immediately
npx convex env remove --prod NAME
```

| Name | Value in prod | What it is for |
|---|---|---|
| `ADMIN_EMAILS` | comma-separated addresses | who may sign in to `/admin` |
| `ADMIN_NOTIFY_EMAILS` | comma-separated addresses | who gets the "new tester signup" email. Defaults to `ADMIN_EMAILS`. Only list inboxes that receive mail |
| `SITE_URL` | `https://waitlist.heymypa.ai` | the site address the admin login trusts |
| `PUBLIC_SITE_ORIGIN` | `https://waitlist.heymypa.ai` | the address used for links and images inside tester emails |
| `RESEND_API_KEY` | `re_…` | lets the site send email through Resend |
| `RESEND_TEST_MODE` | `false` | when not `false`, email only reaches Resend's `@resend.dev` test inboxes |
| `EMAIL_DOMAIN` | `mypa.computer` | emails come from `hello@<this domain>`. It must be verified in Resend |
| `RESEND_FROM` | unset | a full From line, such as `MyPA <team@heymypa.ai>`. Overrides `EMAIL_DOMAIN` |
| `REPLY_TO_EMAIL` | unset | where replies go. Defaults to the MyPA Gmail inbox |
| `RESEND_WEBHOOK_SECRET` | **unset** | turns on delivered, opened and clicked tracking. See below |
| `UNSUBSCRIBE_SECRET` | set | signs unsubscribe links. Changing it breaks links in emails already sent |
| `JWT_PRIVATE_KEY`, `JWKS` | set | sign admin logins. Changing them signs every admin out |
| `ALLOW_ADMIN_SIGNUP` | unset | `true` lets an allowlisted address create an admin account. Remove it straight after |
| `BACKEND_URL`, `BACKEND_SERVICE_KEY` | **unset** | needed by **Sync to backend** on the Old waitlist page. Until they are set, that button fails |

## Add or remove an admin

1. Add the address to the list:

   ```bash
   npx convex env get --prod ADMIN_EMAILS
   npx convex env set --prod ADMIN_EMAILS "first@example.com,new@example.com"
   ```

2. Let them create a password, then lock it again:

   ```bash
   npx convex env set --prod ALLOW_ADMIN_SIGNUP true
   # they open /admin → "First time? Create the admin account"
   npx convex env remove --prod ALLOW_ADMIN_SIGNUP
   ```

To remove someone, take them out of `ADMIN_EMAILS`. Their next request is refused.

## Email settings

### Move the sender to heymypa.ai

Emails come from `hello@mypa.computer` today, because that is the only domain verified in Resend. `heymypa.ai` has no Resend DNS records yet, so switching first would make every email fail.

1. In Resend, open **Domains → Add domain** and enter `heymypa.ai`.
2. Resend shows three or four DNS records: a DKIM `TXT` on `resend._domainkey`, and an `MX` plus an SPF `TXT` on `send`. Add them exactly at the DNS host for `heymypa.ai`.
3. Wait until Resend shows the domain as **Verified**.
4. Switch the sender:

   ```bash
   npx convex env set --prod EMAIL_DOMAIN heymypa.ai
   ```

5. In the admin, on the Testers page, use **Send Android test** to your own address, and check it arrives from `hello@heymypa.ai`.

`heymypa.ai` already publishes a DMARC policy of `p=quarantine`, so mail that fails these checks goes to spam. Do not skip step 3.

### Turn on delivery tracking

Without this, campaign recipients show as sent but never as delivered, opened or clicked, and bounces are not added to the skip list.

1. In Resend, open **Webhooks → Add endpoint**.
2. URL: `https://elegant-snake-479.convex.site/resend-webhook`. Select all `email.*` events.
3. Copy the signing secret (`whsec_…`) and set it:

   ```bash
   npx convex env set --prod RESEND_WEBHOOK_SECRET "whsec_…"
   ```

The amber notice on the admin Email page disappears.

## Moving to a new domain: checklist

What the move to `heymypa.ai` needed, in order:

1. Point the new domain at Coolify and add it to the app's domains.
2. Redirect the old domain to the new one with a 301 that keeps the path.
3. Set `NEXT_PUBLIC_SITE_URL` (build) and redeploy. Without it, the canonical address, link previews and sitemap point at `localhost:3000`.
4. Set `SITE_URL` and `PUBLIC_SITE_ORIGIN` on Convex.
5. Move the email sender ([above](#move-the-sender-to-heymypaai)).
6. Update `DEFAULT_PUBLIC_ORIGIN` and the footer line in `convex/emails/testerTemplates.ts`.

## Check the live site

```bash
curl -s https://waitlist.heymypa.ai/robots.txt              # last line must name heymypa.ai, not localhost
curl -s https://waitlist.heymypa.ai/ | grep -o 'canonical" href="[^"]*'
curl -sI https://waitlist.mypa.computer/admin | grep -i location   # → https://waitlist.heymypa.ai/admin
```

Then sign in to `/admin` and open every page. None should show "Server Error".

## When something breaks

| Symptom | Cause | Fix |
|---|---|---|
| "Server Error" in the admin or on the form | an error in the server code | `npx convex logs --prod` shows the real message |
| `Could not find public function` in the logs | the site is newer than the server code | re-run **Deploy Convex (prod)** |
| Link previews or the sitemap show `localhost:3000` | `NEXT_PUBLIC_SITE_URL` missing at build | set it in Coolify and redeploy |
| Tester emails link to the old domain | `PUBLIC_SITE_ORIGIN` unset | set it on Convex |
| No emails arrive at all | sender domain not verified, or `RESEND_TEST_MODE` is not `false` | check the amber badge on the admin Email page |
