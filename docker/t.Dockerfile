# ================================
# api-management.Dockerfile - VERSION CORRIGÉE
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de configuration du monorepo
COPY package.json package-lock.json turbo.json ./

# Copier tous les workspaces
COPY packages ./packages
COPY apps ./apps

# 1️⃣ Installer TOUTES les dépendances
RUN npm ci

# 2️⃣ Fix : Forcer l'installation des modules manquants
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

# ✅ CORRECTION : Installer curl ET openssl
RUN apk add --no-cache curl openssl

WORKDIR /app

# Copier le build ET les node_modules nécessaires
COPY --from=builder /app/apps/api-management/dist ./dist
COPY --from=builder /app/apps/api-management/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# ✅ CORRECTION : Health check plus robuste
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# ✅ CORRECTION : Commande de démarrage explicite
CMD ["node", "dist/main.js"]

# ================================
# api-read.Dockerfile - VERSION CORRIGÉE
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de configuration
COPY package.json package-lock.json turbo.json ./

# Copier les packages partagés et le code source
COPY packages ./packages
COPY apps/api-read ./apps/api-read

# Installer les dépendances
RUN npm ci

# ✅ CORRECTION : Installer Prisma même pour Read API
WORKDIR /app/packages/database
RUN npm run db:generate

# Build via Turbo
WORKDIR /app
RUN npx turbo run build --filter=api-read

# ================================
# Stage 2: Production Runner
# ================================
FROM node:20-alpine AS runner

# ✅ CORRECTION : Installer curl ET openssl
RUN apk add --no-cache curl openssl

WORKDIR /app

# Copier les artefacts
COPY --from=builder /app/apps/api-read/dist ./dist
COPY --from=builder /app/apps/api-read/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# ✅ CORRECTION : Health check plus robuste
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# ✅ CORRECTION : Commande de démarrage explicite
CMD ["node", "dist/main.js"]