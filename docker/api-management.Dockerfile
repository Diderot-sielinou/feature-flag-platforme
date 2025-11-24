# ================================
# Stage 1: Builder
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# ✅ Configuration npm pour améliorer la fiabilité réseau
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set maxsockets 10


# ✅ ÉTAPE 1 : Copier TOUS les package.json d'abord (pour le cache Docker)
COPY package.json package-lock.json turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api-management/package.json ./apps/api-management/
COPY apps/api-read/package.json ./apps/api-read/

# Copie le schéma Prisma, le tsconfig et les sources du package database
COPY packages/database/prisma/ ./packages/database/prisma/
COPY packages/database/tsconfig.json ./packages/database/
COPY packages/database/src/ ./packages/database/src/

# ✅ ÉTAPE 2 : Installer toutes les dépendances (y compris workspaces)
RUN npm install --include-workspace-root --no-audit

# ✅ CORRECTION : Forcer la version TypeScript compatible
RUN npm install -g typescript@5.3.3

# ✅ ÉTAPE 3 : Maintenant copier tout le code source
COPY packages ./packages
COPY apps/api-management ./apps/api-management

# ✅ ÉTAPE 4 : Générer Prisma Client
WORKDIR /app/packages/database
RUN npm run db:generate

# ✅ ÉTAPE 5 : Build via Turbo depuis la racine
WORKDIR /app
RUN npx turbo run build --filter=api-management

# 🔍 VÉRIFICATION : Afficher la structure du build
RUN echo "=== Structure du build ===" && \
    ls -la /app/apps/api-management/dist/ && \
    echo "=== Contenu détaillé ===" && \
    find /app/apps/api-management/dist -type f

# ================================
# Stage 2: Production Runner
# ================================
FROM node:20-alpine AS runner

# Installer curl et openssl
RUN apk add --no-cache curl openssl

WORKDIR /app

# ✅ Copier le build
# COPY --from=builder /app/apps/api-management/dist/ ./dist/
COPY --from=builder /app/apps/api-management/dist/. ./dist
COPY --from=builder /app/apps/api-management/package.json ./package.json

# ✅ Copier TOUS les node_modules (incluant @nestjs/config)
COPY --from=builder /app/node_modules ./node_modules

# ✅ Copier les packages (pour Prisma Client)
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]