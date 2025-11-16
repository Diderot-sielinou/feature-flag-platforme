# --- Étape de Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de configuration de base du monorepo
COPY package.json npm-workspace.yaml package-lock.json ./
COPY turbo.json ./

# Copier les packages partagés et le code source de l'API de lecture
COPY packages ./packages
COPY apps/api-read ./apps/api-read

# Installer les dépendances (verrouillées par package-lock.json)
RUN npm ci # <--- CHANGEMENT: npm ci au lieu de pnpm install --frozen-lockfile

# Construire les packages partagés nécessaires
RUN npm exec -- turbo run build --filter @repo/shared # <--- CHANGEMENT: npm exec -- turbo run build

# Construire l'API de lecture
RUN npm exec -- turbo run build --filter api-read # <--- CHANGEMENT: npm exec -- turbo run build

# --- Étape de Production ---
FROM node:20-alpine AS runner

# Installer curl pour les health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copier les fichiers nécessaires depuis l'étape de build
COPY --from=builder /app/apps/api-read/dist ./dist
COPY --from=builder /app/apps/api-read/package.json ./
# Copier les dépendances installées
COPY --from=builder /app/node_modules ./node_modules
# Copier les packages partagés compilés
COPY --from=builder /app/packages ./packages

# Définir l'environnement sur production
ENV NODE_ENV=production

# Exposer le port sur lequel l'API écoutera
EXPOSE 3001

# Définir une commande de health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Commande pour démarrer l'application
CMD ["node", "dist/main.js"]