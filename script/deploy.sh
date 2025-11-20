#!/bin/bash
set -e

echo "🚀 Deploying Feature Flags Platform..."

# Déployer l'infrastructure AWS via CDK
echo "🏗️  Deploying AWS infrastructure..."
cd infrastructure
cdk deploy --all --require-approval never

# Récupérer les outputs de la stack Database
export DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name FeatureFlagsDatabaseStack \
  --query "Stacks[0].Outputs[?OutputKey=='DBEndpoint'].OutputValue" \
  --output text)

export REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name FeatureFlagsDatabaseStack \
  --query "Stacks[0].Outputs[?OutputKey=='RedisEndpoint'].OutputValue" \
  --output text)

echo "✅ Database endpoint: ${DB_ENDPOINT}"
echo "✅ Redis endpoint: ${REDIS_ENDPOINT}"

# Exécuter les migrations de la base de données via Prisma
echo "🔄 Running database migrations..."
cd ../packages/database
# Attention : Utiliser les identifiants réels ou les secrets AWS pour la prod
# Ici, on suppose que les secrets sont gérés ailleurs ou que DATABASE_URL pointe vers le bon endpoint
export DATABASE_URL="postgresql://username:password@${DB_ENDPOINT}:5432/featureflags"
pnpm run db:migrate

echo "✅ Deployment completed successfully!"