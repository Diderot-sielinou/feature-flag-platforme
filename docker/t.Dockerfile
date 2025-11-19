# ================================
# api-management.Dockerfile - AVEC CACHE HÔTE
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Configuration DNS et réseau améliorée
RUN echo "nameserver 8.8.8.8" > /etc/resolv.conf && \
    echo "nameserver 8.8.4.4" >> /etc/resolv.conf

# ✅ Copier TOUS les fichiers nécessaires D'ABORD
COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY apps/api-management ./apps/api-management
COPY apps/api-read/package.json ./apps/api-read/

# ✅ SOLUTION : Copier node_modules depuis l'hôte (déjà installé)
# Cela évite complètement npm ci dans Docker
COPY node_modules ./node_modules

# ✅ Générer Prisma Client
WORKDIR /app/packages/database
RUN npm run db:generate

# ✅ Build via Turbo
WORKDIR /app
RUN npx turbo run build --filter=api-management

# Vérification
RUN ls -la /app/apps/api-management/dist/

# ================================
# Stage 2: Production Runner
# ================================
FROM node:20-alpine AS runner

RUN apk add --no-cache curl openssl

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