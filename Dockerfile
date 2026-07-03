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
# convex/_generated/ is gitignored but part of the build context; `npx convex
# codegen` needs a reachable deployment, so it cannot run in here.
RUN test -f convex/_generated/api.js || { \
      echo "convex/_generated/ missing from build context."; \
      echo "Run scripts/docker-init.sh (or 'npx convex dev --once') first."; \
      exit 1; }
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
