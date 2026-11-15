# How it works

A plain walkthrough of the moving parts. To run it, see [Run it locally](run-locally.md). To change the live site, see [Production](deploy.md).

## Why it is its own app

This site is kept apart from the MyPA app and its backend on purpose. It has its own database, its own admin logins and its own settings, so a change to the sign-up page can never touch the app's real users. It looks like MyPA because it copies the same fonts, colours and buttons.

## What happens when someone signs up

1. The visitor fills in the form. The page checks it before sending.
2. The form posts to the site's own route, `app/api/waitlist/route.ts`. The route checks every field again, and quietly drops anything a bot filled in.
3. The route calls `testers.apply` in `convex/testers.ts`. That saves the person in the `testers` table, gives them a place in line, and refuses them if signups are closed.
4. Once the save has gone through, two emails are queued: "you're on the list" to the visitor, and "new tester signup" to the admins. Queuing them after the save means a slow email service never makes the form fail, and nobody is emailed about a signup that did not save.
5. The route then copies the signup to the MyPA backend, so the person also exists there as a user waiting for access. If the backend is down, the visitor still keeps their spot.
6. The admin console is subscribed to the `testers` table, so the new row appears there instantly.

## Approval

When an admin clicks **Approve & email**, `testers.approve` marks the person approved and queues the install guide email for their phone type. The guide's pictures come from `public/guide/` on the live site, and its main button is the Firebase invite link saved in Program settings. The same guide is also a web page at `/testers/guide`.

## Who can use the admin console

Signing in is not enough. Every admin action on the server first checks that the signed-in address is in the `ADMIN_EMAILS` setting (`requireAdmin` in `convex/admin.ts`). So even if someone got past the login page, they would see no data. Creating new admin accounts is switched off unless `ALLOW_ADMIN_SIGNUP` is on.

## Visitor tracking and cookies

- Every visit is counted as a page view, without any cookie.
- A cookie card asks the visitor to accept or decline. Only on **Accept** does the site set a device cookie (`mypa_did`), which lets Analytics count returning visitors. The choice is saved in `mypa_consent`.
- Links tagged with `utm_source` and similar are remembered on first touch, so a signup is credited to the post that first brought the person in.
- The checks on the Evals page run every day (`convex/crons.ts`) and confirm the tracking keeps these promises.

## The tables

All in `convex/schema.ts`.

| Table | Holds |
|---|---|
| `testers` | tester signups: name, email, phone, phone type, status, when the guide was sent |
| `programSettings` | tester slots, Firebase invite link, signups open or closed, social links |
| `waitlist` | the old waitlist from before the tester program, with referral codes |
| `pageviews`, `trafficDaily` | page views, and daily totals for the charts |
| `consents`, `devices` | cookie choices, and browsers that accepted the cookie |
| `evalRuns` | results of the tracking checks |
| `campaigns`, `emailSends`, `suppressions` | email campaigns, each email sent, and addresses never to email again |
| `counters` | running totals, so the dashboard does not recount every row |
| `feedback`, `contactMessages` | left from an earlier version. Nothing writes to them now |

## The pieces it is built from

| Piece | Used for |
|---|---|
| Next.js 16 and React 19 | the pages and the two API routes |
| Convex | the database and all server code. Its live queries are what make the admin update without refreshing |
| Convex Auth (password) | admin sign-in |
| Resend, through `@convex-dev/resend` | sending email and tracking delivery |
| Tailwind and shadcn/ui | styling and the basic buttons and inputs |
| GSAP and Lottie | landing page animation |
| Playwright | browser tests |

## Things that catch people out

- `convex/_generated/` is committed. The production build uses it as it is, so it needs no Convex key. Commit it whenever `npx convex dev` changes it.
- Never run `npx @convex-dev/auth` here. It rewrites `convex/auth.ts` and removes the admin allowlist. Use `node scripts/ensure-auth-keys.mjs` for login keys instead.
- Add shadcn components with `npx shadcn add`, never `npx shadcn init`. Init overwrites the colours in `app/globals.css`.
- If shadcn components suddenly render unstyled, check the `@source "../components/ui"` line in `app/globals.css`. A `ui/` rule in the workspace's root `.gitignore` hides that folder from Tailwind without it.
