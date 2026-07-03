#!/usr/bin/env bash
# Bootstrap the dockerised mypa-waitlist stack. Idempotent — safe to re-run.
#
#   1. start the self-hosted Convex backend + dashboard
#   2. generate a deployment admin key and wire .env.local for the Convex CLI
#   3. push convex/ functions (also regenerates convex/_generated/)
#   4. ensure Convex Auth JWT keys + SITE_URL (+ ADMIN_EMAILS / RESEND_API_KEY)
#   5. build + start the web container (skip with SKIP_WEB=1)
#
# Overrides (env): CONVEX_PORT, CONVEX_SITE_PORT, CONVEX_DASHBOARD_PORT,
#                  WEB_PORT, ADMIN_EMAILS, RESEND_API_KEY, SKIP_WEB=1
#
# Requires: docker compose v2, node + npm (uses the repo's convex CLI via npx).
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CONVEX_PORT="${CONVEX_PORT:-3210}"
CONVEX_DASHBOARD_PORT="${CONVEX_DASHBOARD_PORT:-6791}"
WEB_PORT="${WEB_PORT:-3000}"
SELF_URL="http://127.0.0.1:${CONVEX_PORT}"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

step "Starting Convex backend + dashboard"
docker compose up -d --wait backend dashboard

step "Generating deployment admin key"
ADMIN_KEY="$(docker compose exec -T backend ./generate_admin_key.sh | tail -n1 | tr -d '\r')"
case "$ADMIN_KEY" in
  *\|*) ;;
  *) echo "Unexpected generate_admin_key.sh output: ${ADMIN_KEY}" >&2; exit 1 ;;
esac

step "Wiring .env.local for the self-hosted deployment"
touch .env.local
# CONVEX_DEPLOYMENT (cloud / anonymous local dev) conflicts with
# CONVEX_SELF_HOSTED_*; comment it out rather than delete so the previous
# anonymous-dev deployment (state in ~/.convex/) stays recoverable.
sed -i -E 's/^(CONVEX_DEPLOYMENT=)/# docker-init: \1/' .env.local
upsert() { # upsert KEY VALUE — delimiter-safe (admin key contains '|')
  local key="$1" value="$2"
  { grep -vE "^${key}=" .env.local || true; } > .env.local.tmp
  printf '%s=%s\n' "$key" "$value" >> .env.local.tmp
  mv .env.local.tmp .env.local
}
upsert CONVEX_SELF_HOSTED_URL "$SELF_URL"
upsert CONVEX_SELF_HOSTED_ADMIN_KEY "'${ADMIN_KEY}'"
upsert NEXT_PUBLIC_CONVEX_URL "$SELF_URL"

step "Pushing Convex functions"
npx convex deploy -y

step "Ensuring Convex Auth keys"
node scripts/ensure-auth-keys.mjs
npx convex env set "SITE_URL=http://127.0.0.1:${WEB_PORT}"

if [[ -n "${ADMIN_EMAILS:-}" ]]; then
  step "Setting ADMIN_EMAILS allowlist"
  npx convex env set "ADMIN_EMAILS=${ADMIN_EMAILS}"
else
  echo "NOTE: ADMIN_EMAILS not set — /admin sign-up will reject everyone."
  echo "      Set it with: npx convex env set ADMIN_EMAILS \"you@example.com\""
fi

if [[ -n "${RESEND_API_KEY:-}" ]]; then
  step "Setting RESEND_API_KEY"
  npx convex env set "RESEND_API_KEY=${RESEND_API_KEY}"
else
  echo "NOTE: RESEND_API_KEY not set — waitlist/contact emails will fail in the"
  echo "      background (submissions themselves still succeed)."
fi

if [[ "${SKIP_WEB:-}" != "1" ]]; then
  step "Building + starting web"
  docker compose up -d --build --wait web
fi

step "Done"
cat <<EOF

  App:               http://127.0.0.1:${WEB_PORT}$( [[ "${SKIP_WEB:-}" == "1" ]] && printf '  (not started — run: npm run dev)' )
  Convex backend:    ${SELF_URL}
  Convex dashboard:  http://127.0.0.1:${CONVEX_DASHBOARD_PORT}
  Admin key (dashboard login; also in .env.local — keep it local):
    ${ADMIN_KEY}

  First admin account: open http://127.0.0.1:${WEB_PORT}/admin and sign up with
  an ADMIN_EMAILS address.
EOF
