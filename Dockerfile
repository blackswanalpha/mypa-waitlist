# syntax=docker/dockerfile:1
# Next.js standalone build of the mypa-waitlist app.
# Built + run by docker-compose.yml; bootstrap with scripts/docker-init.sh.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
# This must be the URL the BROWSER uses to reach the Convex backend
# (the server-side URL is CONVEX_SERVER_URL, a runtime env — see middleware.ts).
ARG NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
ENV NEXT_TELEMETRY_DISABLED=1
# convex/_generated/ is gitignored, so it has to come from somewhere reachable:
#   - self-hosted local dev (docker-init.sh): already generated on the host
#     against the `backend` container before this build starts.
#   - Convex Cloud (Coolify/CI, no self-hosted backend running yet): generate
#     it here — Convex Cloud is internet-reachable even though a same-compose
#     `backend` container wouldn't be. Needs a deploy key, passed as a
#     BuildKit secret (never baked into image layers/history).
RUN --mount=type=secret,id=CONVEX_DEPLOY_KEY \
    if [ -f convex/_generated/api.js ]; then \
      echo "Using pre-generated convex/_generated/ (self-hosted local build)."; \
    elif [ -s /run/secrets/CONVEX_DEPLOY_KEY ]; then \
      echo "Generating convex/_generated/ from Convex Cloud."; \
      CONVEX_DEPLOY_KEY="$(cat /run/secrets/CONVEX_DEPLOY_KEY)" npx convex deploy -y; \
    else \
      echo "convex/_generated/ missing from build context and no CONVEX_DEPLOY_KEY secret provided."; \
      echo "Self-hosted: run scripts/docker-init.sh first."; \
      echo "Convex Cloud: pass a CONVEX_DEPLOY_KEY build secret."; \
      exit 1; \
    fi
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
ENV HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
