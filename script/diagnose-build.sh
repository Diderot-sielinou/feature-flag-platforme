#!/bin/bash

# ============================================
# Script de Diagnostic des Builds Docker
# ============================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

echo "================================================"
echo "  🔍 Diagnostic des Builds Docker"
echo "================================================"
echo ""

# ============================================
# 1. Vérifier la structure du build local
# ============================================
check_local_build() {
    log_info "Vérification du build local (npm run build)..."
    
    if [ ! -d "apps/api-management/dist" ]; then
        log_warning "Le dossier apps/api-management/dist n'existe pas"
        log_info "Lancement du build..."
        npm run build --filter=api-management
    fi
    
    echo ""
    log_info "Structure de apps/api-management/dist :"
    ls -la apps/api-management/dist/ || log_error "Impossible de lister le dossier"
    
    echo ""
    log_info "Recherche de main.js :"
    find apps/api-management/dist -name "main.js" -type f || log_warning "main.js non trouvé"
    
    echo ""
    if [ -f "apps/api-management/dist/main.js" ]; then
        log_success "✅ Structure correcte : dist/main.js"
        echo "CMD devrait être : CMD [\"node\", \"dist/main.js\"]"
    elif [ -f "apps/api-management/dist/src/main.js" ]; then
        log_success "✅ Structure avec src : dist/src/main.js"
        echo "CMD devrait être : CMD [\"node\", \"dist/src/main.js\"]"
    else
        log_error "❌ main.js introuvable dans le build"
    fi
    
    echo ""
    log_info "Même vérification pour api-read..."
    if [ -f "apps/api-read/dist/main.js" ]; then
        log_success "✅ api-read : dist/main.js"
    elif [ -f "apps/api-read/dist/src/main.js" ]; then
        log_success "✅ api-read : dist/src/main.js"
    else
        log_warning "api-read : main.js introuvable"
    fi
}

# ============================================
# 2. Tester le build Docker interactif
# ============================================
test_docker_build() {
    log_info "Test du build Docker pour api-management..."
    
    # Build temporaire
    docker build \
        -t diagnostic-test \
        -f docker/api-management.Dockerfile \
        . || {
            log_error "Échec du build Docker"
            exit 1
        }
    
    echo ""
    log_info "Inspection du contenu du conteneur :"
    docker run --rm diagnostic-test ls -la /app/dist/ || log_error "Impossible de lister /app/dist"
    
    echo ""
    log_info "Recherche de main.js dans le conteneur :"
    docker run --rm diagnostic-test find /app/dist -name "main.js" -type f || log_warning "main.js non trouvé"
    
    echo ""
    log_info "Test de l'arborescence complète :"
    docker run --rm diagnostic-test sh -c "ls -R /app/dist | head -30"
    
    echo ""
    log_info "Tentative d'exécution du CMD actuel (dist/main.js) :"
    if docker run --rm diagnostic-test node dist/main.js --help 2>&1 | head -5; then
        log_success "✅ dist/main.js fonctionne !"
    else
        log_warning "❌ dist/main.js ne fonctionne pas"
    fi
    
    echo ""
    log_info "Tentative avec dist/src/main.js :"
    if docker run --rm diagnostic-test node dist/src/main.js --help 2>&1 | head -5; then
        log_success "✅ dist/src/main.js fonctionne !"
    else
        log_warning "❌ dist/src/main.js ne fonctionne pas"
    fi
    
    # Nettoyage
    docker rmi diagnostic-test 2>/dev/null || true
}

# ============================================
# 3. Vérifier la configuration NestJS
# ============================================
check_nestjs_config() {
    log_info "Vérification de la configuration NestJS..."
    
    echo ""
    echo "📄 nest-cli.json (api-management) :"
    if [ -f "apps/api-management/nest-cli.json" ]; then
        cat apps/api-management/nest-cli.json
    else
        log_warning "nest-cli.json non trouvé"
    fi
    
    echo ""
    echo "📄 tsconfig.json (api-management) :"
    if [ -f "apps/api-management/tsconfig.json" ]; then
        echo "Extrait pertinent :"
        grep -A 5 "compilerOptions" apps/api-management/tsconfig.json | head -10 || echo "Pas de compilerOptions trouvé"
    fi
}

# ============================================
# 4. Lister toutes les images Docker
# ============================================
list_docker_images() {
    echo ""
    log_info "Images Docker existantes pour le projet :"
    docker images | grep -E "(feature-flags|docker-api|ff-)" || log_warning "Aucune image trouvée"
}

# ============================================
# 5. Recommandations
# ============================================
show_recommendations() {
    echo ""
    echo "================================================"
    log_success "📋 Recommandations"
    echo "================================================"
    echo ""
    echo "1️⃣  Vérifiez la sortie ci-dessus pour identifier :"
    echo "   - La vraie structure du dossier dist/"
    echo "   - Le bon chemin vers main.js"
    echo ""
    echo "2️⃣  Mettez à jour le CMD dans vos Dockerfiles :"
    echo "   docker/api-management.Dockerfile"
    echo "   docker/api-read.Dockerfile"
    echo ""
    echo "3️⃣  Testez avec :"
    echo "   docker compose -f docker/docker-compose.yml up --build"
    echo ""
    echo "4️⃣  Nettoyez les anciennes images :"
    echo "   docker system prune -a"
    echo ""
}

# ============================================
# MAIN
# ============================================
main() {
    check_local_build
    echo ""
    echo "================================================"
    test_docker_build
    echo ""
    echo "================================================"
    check_nestjs_config
    echo ""
    echo "================================================"
    list_docker_images
    show_recommendations
}

main