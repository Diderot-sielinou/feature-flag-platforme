#!/bin/bash

# ============================================
# Script de Test Local des Images Docker
# Feature Flags Platform - Ports ajustés pour éviter les conflits locaux
# ============================================

# Utilisation de set -e pour s'assurer que le script s'arrête en cas d'erreur
set -e

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

echo "================================================"
echo "  🐳 Test Local des Images Docker"
echo "  Ports DB/Cache ajustés: PG=5433, Redis=6380"
echo "================================================"
echo ""

# Nom du fichier compose
COMPOSE_FILE="docker/docker-compose.yml"

# ============================================
# Étape 1 : Nettoyer l'environnement
# ============================================
cleanup() {
    log_info "Nettoyage de l'environnement..."
    # L'option -v retire les volumes pour un nettoyage complet
    docker compose -f $COMPOSE_FILE down -v 2>/dev/null || true
    log_success "Environnement nettoyé"
}

# ============================================
# Étape 2 : Démarrer l'infrastructure de base
# ============================================
start_infrastructure() {
    log_info "Démarrage de PostgreSQL (Port 5433) et Redis (Port 6380)..."
    
    docker compose -f $COMPOSE_FILE up -d postgres redis
    
    log_info "Attente de la disponibilité des services (30s)..."
    sleep 30
    
    # Vérifier PostgreSQL (via le port local 5433)
    # NOTE: pg_isready est exécuté DANS le conteneur, le port reste 5432
    if docker exec ff-postgres pg_isready -U ffuser > /dev/null 2>&1; then
        log_success "PostgreSQL est prêt (Host: 5433)"
    else
        log_error "PostgreSQL n'est pas disponible. Vérifiez les logs."
        docker logs ff-postgres --tail 50
        exit 1
    fi
    
    # Vérifier Redis (via le port local 6380)
    # NOTE: redis-cli ping est exécuté DANS le conteneur, le port reste 6379
    if docker exec ff-redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis est prêt (Host: 6380)"
    else
        log_error "Redis n'est pas disponible. Vérifiez les logs."
        docker logs ff-redis --tail 50
        exit 1
    fi
}

# ============================================
# Étape 3 : Générer Prisma Client (sur l'hôte)
# ============================================
generate_prisma() {
    log_info "Génération du Prisma Client (sur l'hôte)..."
    
    # Le chemin 'packages/database' est supposé être relatif à la racine du projet
    if [ -d "packages/database" ]; then
        cd packages/database
        npm run db:generate
        cd ../..
        log_success "Prisma Client généré"
    else
        log_warning "Le répertoire 'packages/database' n'existe pas. Saut de la génération Prisma."
    fi
}

# ============================================
# Étape 4 : Appliquer les migrations (sur l'hôte)
# MISE À JOUR : Utiliser le port 5433 pour la connexion à la DB
# ============================================
run_migrations() {
    log_info "Application des migrations (sur l'hôte via db:push sur le port 5433)..."
    
    # *** CHANGEMENT CRITIQUE : UTILISATION DU PORT 5433 pour la connexion HOSTE ***
    export DATABASE_URL="postgresql://ffuser:ffpassword@localhost:5433/featureflags?schema=public"
    
    if [ -d "packages/database" ]; then
        cd packages/database
        # Utilise db:push car c'est un environnement de test local
        npm run db:push
        cd ../..
        log_success "Migrations appliquées"
    else
        log_warning "Le répertoire 'packages/database' n'existe pas. Impossible d'appliquer les migrations. Poursuite..."
    fi
}

# ============================================
# Étape 5 : Build des images Docker
# ============================================
build_images() {
    log_info "Construction des images Docker..."
    
    # Les builds utilisent le contexte du répertoire parent
    log_info "Building api-management..."
    docker build \
        -t feature-flags/api-management:test \
        -f docker/api-management.Dockerfile \
        . || {
            log_error "Échec du build de api-management"
            exit 1
        }
    
    log_info "Building api-read..."
    docker build \
        -t feature-flags/api-read:test \
        -f docker/api-read.Dockerfile \
        . || {
            log_error "Échec du build de api-read"
            exit 1
        }
    
    log_success "Images construites avec succès"
}

# ============================================
# Étape 6 : Démarrer les APIs
# ============================================
start_apis() {
    log_info "Démarrage des APIs..."
    
    docker compose -f $COMPOSE_FILE up -d api-management api-read
    
    log_info "Attente du démarrage des services (45s)..."
    sleep 45
}

# ============================================
# Étape 7 : Tests de santé
# ============================================
test_health_checks() {
    log_info "Vérification des health checks..."
    
    # Test Management API
    if curl -f -s http://localhost:3000/api/v1/management/health > /dev/null; then
        MGMT_RESPONSE=$(curl -s http://localhost:3000/api/v1/management/health)
        log_success "Management API (http://localhost:3000/api/v1/management/) : OK"
        echo "  Response: $MGMT_RESPONSE"
    else
        log_error "Management API : ÉCHEC. Le service ne répond pas au health check."
        echo "Logs de ff-api-management (50 dernières lignes):"
        docker logs ff-api-management --tail 50
        exit 1
    fi
    
    # Test Read API
    if curl -f -s http://localhost:3001/health > /dev/null; then
        READ_RESPONSE=$(curl -s http://localhost:3001/health)
        log_success "Read API (http://localhost:3001) : OK"
        echo "  Response: $READ_RESPONSE"
    else
        log_error "Read API : ÉCHEC. Le service ne répond pas au health check."
        echo "Logs de ff-api-read (50 dernières lignes):"
        docker logs ff-api-read --tail 50
        exit 1
    fi
}

# ============================================
# Étape 8 : Tests fonctionnels avancés
# ============================================
advanced_tests() {
    log_info "Tests fonctionnels avancés..."
    
    if ! command -v jq &> /dev/null; then
        log_warning "L'outil 'jq' est requis pour les tests JSON avancés mais n'est pas installé. Saut de l'étape."
        return 0
    fi

    # Test de réponse JSON valide (exemple)
    MGMT_JSON_STATUS=$(curl -s http://localhost:3000/health | jq -r '.status')
    if [ "$MGMT_JSON_STATUS" == "ok" ]; then
        log_success "Management API : statut JSON 'ok' reçu."
    else
        log_error "Management API : statut JSON invalide. Attendu 'ok', reçu '$MGMT_JSON_STATUS'."
    fi
    
    READ_JSON_STATUS=$(curl -s http://localhost:3001/health | jq -r '.status')
    if [ "$READ_JSON_STATUS" == "ok" ]; then
        log_success "Read API : statut JSON 'ok' reçu."
    else
        log_error "Read API : statut JSON invalide. Attendu 'ok', reçu '$READ_JSON_STATUS'."
    fi
}

# ============================================
# Étape 9 : Afficher les informations utiles
# ============================================
show_info() {
    echo ""
    log_success "🎉 Le test local a réussi !"
    echo ""
    echo "Services disponibles (Ports hôtes ajustés) :"
    echo "  - Management API: http://localhost:3000"
    echo "  - Read API: http://localhost:3001"
    echo "  - PostgreSQL: localhost:5433 (Conteneur: 5432)"
    echo "  - Redis: localhost:6380 (Conteneur: 6379)"
    echo "  - Redis Commander: http://localhost:8081"
    echo ""
    echo "Commandes utiles :"
    echo "  - Voir les logs: docker compose -f $COMPOSE_FILE logs -f"
    echo "  - Arrêter: docker compose -f $COMPOSE_FILE down"
    echo "  - Redémarrer: docker compose -f $COMPOSE_FILE restart"
    echo ""
}

# ============================================
# MAIN EXECUTION
# ============================================
main() {
    # Gère l'interruption (Ctrl+C) pour nettoyer
    trap 'log_error "Script interrompu (Ctrl+C). Nettoyage de la stack..."; cleanup; exit 1' INT TERM

    cleanup
    start_infrastructure
    generate_prisma
    run_migrations
    build_images
    start_apis
    test_health_checks
    advanced_tests
    show_info
    
    # Retire le trap après la fin du script normal
    trap - INT TERM
}

# Exécution principale
main