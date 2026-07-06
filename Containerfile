# Rollwatch app image. Multi-stage: install → build → slim runtime.
# Build args let CI stamp the Clerk publishable key (public by design) into
# the client bundle; the secret key arrives at runtime via the pod env.

FROM docker.io/library/node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM docker.io/library/node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# prisma.config.ts resolves env("DATABASE_URL") at load time — give the build
# a dummy; nothing connects during generate/build (all pages are dynamic).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate && npm run build

FROM docker.io/library/node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone server + static assets.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migration toolchain: prisma CLI + schema/migrations, run at container start
# so the pod needs no manual migrate step. The CLI drags a wide transitive
# tree, so ship the full install — image size is a non-issue on the homelab
# and it ends the missing-module whack-a-mole.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=deps /app/node_modules ./node_modules

COPY infra/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
USER node
ENTRYPOINT ["./entrypoint.sh"]
