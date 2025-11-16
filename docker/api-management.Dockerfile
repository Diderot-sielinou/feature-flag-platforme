# --- Étape de Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de configuration du monorepo
COPY package.json package-lock.json ./
COPY turbo.json ./
COPY packages ./packages
COPY apps/api-management ./apps/api-management

# Installer les dépendances
RUN npm ci

# Générer Prisma Client dans @repo/database
RUN cd packages/database && npm run db:generate

# Construire les packages partagés
RUN npm --workspace=@repo/shared run build
RUN npm --workspace=@repo/database run build

# Construire l'API de management
RUN npm --workspace=api-management run build

# --- Étape de Production ---
FROM node:20-alpine AS runner

# Installer curl pour healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copier les fichiers nécessaires depuis l'étape de build
COPY --from=builder /app/apps/api-management/dist ./dist
COPY --from=builder /app/apps/api-management/package.json ./

# Copier les dépendances installées
COPY --from=builder /app/node_modules ./node_modules

# Copier les packages partagés compilés + prisma client généré
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production

# Port utilisé par l'API
EXPOSE 3000

# Healthcheck ECS
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Commande pour lancer l'application NestJS
CMD ["node", "dist/main.js"]
