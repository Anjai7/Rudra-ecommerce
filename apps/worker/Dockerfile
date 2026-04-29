# Worker Dockerfile
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile --prod=false

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @ecommerce/database run generate
RUN pnpm --filter @ecommerce/worker run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker
COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/packages/database/node_modules/.prisma ./node_modules/.prisma
USER worker
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=256"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
