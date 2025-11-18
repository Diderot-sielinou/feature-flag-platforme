# ================================
# Stage 1: Builder
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de configuration du monorepo
COPY package.json package-lock.json turbo.json ./

# Copier tous les workspaces
COPY packages ./packages
COPY apps ./apps

# 1️⃣ Installer TOUTES les dépendances APRÈS avoir copié les workspaces
RUN npm ci

# 2️⃣ Fix : Forcer l’installation des modules manquants utilisés par Nest CLI
RUN npm install @nestjs/cli @isaacs/brace-expansion --no-save

# 3️⃣ Générer Prisma Client
WORKDIR /app/packages/database
RUN npm run db:generate

# 4️⃣ Build via Turbo
WORKDIR /app
RUN npx turbo run build --filter=api-management

# ================================
# Stage 2: Production Runner
# ================================
FROM node:20-alpine AS runner

RUN apk add --no-cache curl openssl1.1-compat

WORKDIR /app

COPY --from=builder /app/apps/api-management/dist ./dist
COPY --from=builder /app/apps/api-management/package.json ./package.json

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
