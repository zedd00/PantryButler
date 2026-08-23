# ─── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build

# Build-time env vars — Vite bakes VITE_* into the JS bundle at compile time.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Install pnpm (matching the project's package manager)
RUN npm install -g pnpm@9

# Copy package manifests
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (needed for Vite build)
RUN pnpm install --no-frozen-lockfile

# Copy frontend source and configs
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.prod.ts postcss.config.js tailwind.config.js index.html ./
COPY public/ public/
COPY src/ src/

# Copy setup data (nutrition seed file needed at runtime)
COPY setup/ setup/

# Build the SPA
RUN pnpm exec vite build --config vite.config.prod.ts

# ─── Stage 2: Build backend ────────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /build

# Copy backend manifest
COPY server/package*.json ./

# Install ALL dependencies (need typescript for build)
RUN npm install

# Copy backend source
COPY server/ ./

# Build TypeScript → JS
RUN npm run build

# Re-install production-only dependencies for smaller final size
RUN rm -rf node_modules && npm install --omit=dev

# ─── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Create required directories
RUN mkdir -p /app/uploads

# Copy built frontend
COPY --from=frontend-builder /build/dist ./public

# Copy setup directory (nutrition seed data, etc.)
COPY --from=frontend-builder /build/setup ./setup

# Copy built backend
COPY --from=backend-builder /build/dist ./dist
COPY --from=backend-builder /build/node_modules ./node_modules
COPY --from=backend-builder /build/package.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
