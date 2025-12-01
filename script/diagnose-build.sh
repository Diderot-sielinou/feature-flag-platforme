#!/bin/bash
# =============================================================================
# Build and Push Docker Images to ECR
# =============================================================================
# Ce script build les images Docker des deux APIs et les push vers ECR.
# À utiliser APRÈS le déploiement de ECRStack et AVANT ComputeStack.
#
# Usage:
#   ./scripts/build-and-push.sh [--minimal]
#
# Options:
#   --minimal    Build des images minimales pour le premier déploiement
# =============================================================================

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
MINIMAL_MODE=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --minimal) MINIMAL_MODE=true ;;
    *) log_error "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# URIs ECR
MANAGEMENT_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/feature-flags/api-management"
READ_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/feature-flags/api-read"

log_info "========================================="
log_info "Build and Push Docker Images to ECR"
log_info "========================================="
log_info "Account ID: ${ACCOUNT_ID}"
log_info "Region: ${REGION}"
log_info "Minimal Mode: ${MINIMAL_MODE}"
log_info "========================================="

# -----------------------------------------------------------------------------
# 1. Login ECR
# -----------------------------------------------------------------------------
log_info "Logging into ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
log_success "ECR login successful"

# -----------------------------------------------------------------------------
# 2. Build et Push
# -----------------------------------------------------------------------------

if [ "$MINIMAL_MODE" = true ]; then
  # Mode minimal: créer des images placeholder pour le premier déploiement
  log_warning "Building MINIMAL images for initial deployment..."
  
  # Créer un Dockerfile minimal temporaire
  cat > /tmp/Dockerfile.minimal << 'EOF'
FROM node:20-alpine
WORKDIR /app

# Simple health check server
RUN npm init -y && npm install express

# Create minimal server
RUN cat > server.js << 'SERVEREOF'
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Placeholder service - deploy real code' });
});

app.use((req, res) => {
  res.json({ message: 'Placeholder service running', path: req.path });
});

app.listen(port, () => {
  console.log(`Placeholder service listening on port ${port}`);
});
SERVEREOF

EXPOSE 3000 3001
CMD ["node", "server.js"]
EOF

  # Build Management (minimal)
  log_info "Building minimal Management API image..."
  docker build -t ${MANAGEMENT_REPO}:latest -f /tmp/Dockerfile.minimal .
  docker tag ${MANAGEMENT_REPO}:latest ${MANAGEMENT_REPO}:placeholder
  
  # Push Management
  log_info "Pushing minimal Management API image..."
  docker push ${MANAGEMENT_REPO}:latest
  docker push ${MANAGEMENT_REPO}:placeholder
  log_success "Management API placeholder pushed"
  
  # Build Read (minimal)
  log_info "Building minimal Read API image..."
  # Le même Dockerfile fonctionne pour les deux
  docker build -t ${READ_REPO}:latest -f /tmp/Dockerfile.minimal .
  docker tag ${READ_REPO}:latest ${READ_REPO}:placeholder
  
  # Push Read
  log_info "Pushing minimal Read API image..."
  docker push ${READ_REPO}:latest
  docker push ${READ_REPO}:placeholder
  log_success "Read API placeholder pushed"
  
  # Cleanup
  rm /tmp/Dockerfile.minimal
  
else
  # Mode normal: build des vraies images
  log_info "Building PRODUCTION images..."
  
  # Vérifier qu'on est à la racine du projet
  if [ ! -f "package.json" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
  fi
  
  # Build Management API
  log_info "Building Management API image..."
  if [ -f "apps/api-management/Dockerfile" ]; then
    docker build \
      -t ${MANAGEMENT_REPO}:latest \
      -t ${MANAGEMENT_REPO}:$(git rev-parse --short HEAD 2>/dev/null || echo "dev") \
      -f apps/api-management/Dockerfile \
      .
  else
    log_error "Dockerfile not found: apps/api-management/Dockerfile"
    exit 1
  fi
  
  # Push Management API
  log_info "Pushing Management API image..."
  docker push ${MANAGEMENT_REPO}:latest
  docker push ${MANAGEMENT_REPO}:$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
  log_success "Management API image pushed"
  
  # Build Read API
  log_info "Building Read API image..."
  if [ -f "apps/api-read/Dockerfile" ]; then
    docker build \
      -t ${READ_REPO}:latest \
      -t ${READ_REPO}:$(git rev-parse --short HEAD 2>/dev/null || echo "dev") \
      -f apps/api-read/Dockerfile \
      .
  else
    log_error "Dockerfile not found: apps/api-read/Dockerfile"
    exit 1
  fi
  
  # Push Read API
  log_info "Pushing Read API image..."
  docker push ${READ_REPO}:latest
  docker push ${READ_REPO}:$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
  log_success "Read API image pushed"
fi

# -----------------------------------------------------------------------------
# 3. Résumé
# -----------------------------------------------------------------------------
log_info "========================================="
log_success "All images pushed successfully!"
log_info "========================================="
log_info "Management API: ${MANAGEMENT_REPO}:latest"
log_info "Read API: ${READ_REPO}:latest"
log_info "========================================="

if [ "$MINIMAL_MODE" = true ]; then
  log_warning ""
  log_warning "NEXT STEPS:"
  log_warning "1. Deploy ComputeStack: cdk deploy FeatureFlagsComputeStack"
  log_warning "2. After ECS is running, rebuild with real code: ./scripts/build-and-push.sh"
  log_warning "3. Update ECS services: aws ecs update-service --cluster feature-flags-cluster --service feature-flags-management --force-new-deployment"
  log_warning ""
fi