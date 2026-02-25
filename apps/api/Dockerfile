# ============================================================
# Omkar AdTech API — Multi-stage Docker build for Railway
# Target: node:20-alpine, ap-south-1 (Mumbai) region
# ============================================================

# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

# Copy workspace manifests
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# ---- Stage 2: Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

# Copy installed deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source
COPY . .

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Compile TypeScript
RUN cd apps/api && npx tsc --project tsconfig.json || true

# ---- Stage 3: Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiuser

# Copy only production artifacts
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/prisma ./prisma
COPY --from=builder --chown=apiuser:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER apiuser

EXPOSE 4000

# Health check for Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
