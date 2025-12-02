# =============================================================================
# Feature Flags - API Management (Production-Ready)
# Optimisé pour : Sécurité + Performance + Taille réduite
# =============================================================================

# ================================
# Stage 1: Dependencies
# ================================
FROM node:20-alpine AS dependencies

WORKDIR /app

# Configuration npm pour réseau instable
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set maxsockets 10

# Copier les fichiers de lock pour cache Docker optimal
COPY package.json package-lock.json turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
# FIX: Copier typescript-config (requis par les tsconfig.json des packages)
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY apps/api-management/package.json ./apps/api-management/
COPY apps/api-read/package.json ./apps/api-read/

# Copier le schema Prisma (requis avant npm install)
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/tsconfig.json ./packages/database/
COPY packages/database/src ./packages/database/src

# Installer TOUTES les dépendances (dev + prod)
RUN npm install --include-workspace-root --no-audit

RUN npm install -g typescript@5.3.3

# ================================
# Stage 2: Builder
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copier node_modules du stage précédent (réutilise cache)
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json
COPY --from=dependencies /app/package-lock.json ./package-lock.json
COPY --from=dependencies /app/turbo.json ./turbo.json

# Copier le code source
# FIX: Copier typescript-config EN PREMIER (requis par les autres packages)
COPY packages/typescript-config ./packages/typescript-config
COPY packages/database ./packages/database
COPY packages/shared ./packages/shared
COPY apps/api-management ./apps/api-management

# Générer Prisma Client
WORKDIR /app/packages/database
RUN npm run db:generate

# Build via Turbo (optimal pour monorepo)
WORKDIR /app
RUN npx turbo run build --filter=api-management

# Vérification du build
RUN echo "✅ Build verification:" && \
    ls -lh /app/apps/api-management/dist/ && \
    test -f /app/apps/api-management/dist/main.js || (echo "❌ main.js not found!" && exit 1)

# ================================
# Stage 3: Production Runtime
# ================================
FROM node:20-alpine AS production

WORKDIR /app

# Installer outils système nécessaires
RUN apk add --no-cache \
    curl \
    openssl \
    dumb-init

# Créer utilisateur non-root pour sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copier les fichiers buildés avec ownership correct
COPY --from=builder --chown=nestjs:nodejs /app/apps/api-management/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api-management/package.json ./package.json

# Copier node_modules (contient toutes les dépendances runtime)
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copier les packages compilés
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared/package.json ./packages/shared/

COPY --from=builder --chown=nestjs:nodejs /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/package.json ./packages/database/
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/node_modules ./packages/database/node_modules

# Passer à l'utilisateur non-root
USER nestjs

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check optimisé
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Utiliser dumb-init pour gérer les signaux correctement
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Démarrer l'application
CMD ["node", "dist/main.js"]