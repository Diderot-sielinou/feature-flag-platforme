#!/bin/sh
set -e

echo "========================================"
echo "🚀 Database Migration Script"
echo "========================================"
echo ""

# Construction de DATABASE_URL à partir des secrets injectés par ECS
if [ -z "$DATABASE_URL" ]; then
  if [ -n "$DB_HOST" ]; then
    export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
    
    echo "✅ DATABASE_URL construite depuis les secrets ECS"
    echo "   Host: $DB_HOST"
    echo "   Port: $DB_PORT"
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USERNAME"
    echo ""
  else
    echo "❌ Erreur: DB_HOST n'est pas défini"
    echo ""
    echo "Variables d'environnement disponibles:"
    env | grep -E '^(DB_|DATABASE_|NODE_)' || echo "   Aucune variable DB_ trouvée"
    echo ""
    exit 1
  fi
else
  echo "✅ DATABASE_URL déjà définie"
  echo ""
fi

# Vérifier que nous sommes dans le bon répertoire
CURRENT_DIR=$(pwd)
echo "📂 Répertoire actuel: $CURRENT_DIR"

# Si nous ne sommes pas dans packages/database, y aller
if [ ! -f "prisma/schema.prisma" ]; then
  echo "⚠️  schema.prisma non trouvé, changement de répertoire..."
  
  if [ -d "/app/packages/database" ]; then
    cd /app/packages/database
    echo "✅ Changé vers: /app/packages/database"
  elif [ -d "packages/database" ]; then
    cd packages/database
    echo "✅ Changé vers: packages/database"
  else
    echo "❌ Impossible de trouver le répertoire packages/database"
    echo "   Contenu de /app:"
    ls -la /app 2>/dev/null || ls -la
    exit 1
  fi
fi

# Vérifier que le schéma Prisma existe
if [ ! -f "prisma/schema.prisma" ]; then
  echo "❌ Erreur: prisma/schema.prisma introuvable"
  echo "   Répertoire actuel: $(pwd)"
  echo "   Contenu:"
  ls -la
  exit 1
fi

echo "✅ Schema Prisma trouvé: prisma/schema.prisma"
echo ""

# Afficher la version de Prisma
echo "🔧 Prisma CLI Version:"
npx prisma --version
echo ""

# Exécuter les migrations
echo "🚀 Exécution des migrations Prisma..."
echo "   Commande: npx prisma migrate deploy"
echo ""

npx prisma migrate deploy

echo ""
echo "========================================"
echo "✅ Migrations terminées avec succès!"
echo "========================================"