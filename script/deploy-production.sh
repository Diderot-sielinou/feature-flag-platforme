#!/bin/bash

# ============================================
# Déploiement en 3 Phases - Feature Flags
# ============================================

set -e
set -u

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# ============================================
# PHASE 1 : Infrastructure + ECR
# ============================================
phase1_infrastructure() {
    echo ""
    echo "========================================"
    echo "  PHASE 1 : Infrastructure + ECR"
    echo "========================================"
    echo ""
    
    log_info "Déploiement des stacks d'infrastructure..."
    
    cd infrastructure
    
    # Bootstrap CDK si nécessaire
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
        log_warning "CDK Toolkit non trouvé. Bootstrap en cours..."
        npx cdk bootstrap "aws://${ACCOUNT_ID}/${AWS_REGION}"
    fi
    
    # Déployer TOUT SAUF ComputeStack
    log_info "Déploiement de NetworkStack..."
    npx cdk deploy FeatureFlagsNetworkStack --require-approval never
    
    log_info "Déploiement de DatabaseStack..."
    npx cdk deploy FeatureFlagsDatabaseStack --require-approval never
    
    log_info "Déploiement de AuthStack..."
    npx cdk deploy FeatureFlagsAuthStack --require-approval never
    
    log_info "Déploiement de MessagingStack..."
    npx cdk deploy FeatureFlagsMessagingStack --require-approval never
    
    log_info "Déploiement de ECRStack..."
    npx cdk deploy FeatureFlagsECRStack --require-approval never
    
    cd ..
    
    log_success "Phase 1 terminée : Infrastructure + ECR créés"
    
    # Récupérer les URIs des repos
    export MGMT_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsECRStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ManagementRepoURI`].OutputValue' \
        --output text)
    
    export READ_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsECRStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ReadRepoURI`].OutputValue' \
        --output text)
    
    echo ""
    log_info "Repositories ECR créés :"
    echo "  - Management: ${MGMT_REPO_URI}"
    echo "  - Read: ${READ_REPO_URI}"
    echo ""
}

# ============================================
# PHASE 2 : Build & Push Images Docker
# ============================================
phase2_docker_images() {
    echo ""
    echo "========================================"
    echo "  PHASE 2 : Build & Push Images Docker"
    echo "========================================"
    echo ""
    
    log_info "Login à ECR..."
    aws ecr get-login-password --region ${AWS_REGION} | \
        docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
    
    log_success "Connecté à ECR"
    
    # Build Management API
    log_info "Build de l'image Management API..."
    docker build \
        -t ${MGMT_REPO_URI}:latest \
        -t ${MGMT_REPO_URI}:$(git rev-parse --short HEAD 2>/dev/null || echo "manual") \
        -f docker/api-management.Dockerfile \
        . \
        --progress=plain
    
    log_info "Push de l'image Management API..."
    docker push ${MGMT_REPO_URI}:latest
    docker push ${MGMT_REPO_URI}:$(git rev-parse --short HEAD 2>/dev/null || echo "manual") || true
    
    log_success "Management API image poussée"
    
    # Build Read API
    log_info "Build de l'image Read API..."
    docker build \
        -t ${READ_REPO_URI}:latest \
        -t ${READ_REPO_URI}:$(git rev-parse --short HEAD 2>/dev/null || echo "manual") \
        -f docker/api-read.Dockerfile \
        . \
        --progress=plain
    
    log_info "Push de l'image Read API..."
    docker push ${READ_REPO_URI}:latest
    docker push ${READ_REPO_URI}:$(git rev-parse --short HEAD 2>/dev/null || echo "manual") || true
    
    log_success "Read API image poussée"
    
    echo ""
    log_success "Phase 2 terminée : Images Docker disponibles dans ECR"
    echo ""
}

# ============================================
# PHASE 3 : Déploiement ECS + Migrations
# ============================================
phase3_ecs_deployment() {
    echo ""
    echo "========================================"
    echo "  PHASE 3 : Déploiement ECS + Migrations"
    echo "========================================"
    echo ""
    
    log_info "Déploiement du ComputeStack..."
    
    cd infrastructure
    npx cdk deploy FeatureFlagsComputeStack --require-approval never
    cd ..
    
    log_success "ComputeStack déployé (ECS + ALB créés)"
    
    # Récupérer les infos
    export DB_SECRET_ARN=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsDatabaseStack \
        --query 'Stacks[0].Outputs[?OutputKey==`DBSecretArn`].OutputValue' \
        --output text)
    
    export RDS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsDatabaseStack \
        --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' \
        --output text)
    
    export ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsComputeStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
        --output text)
    
    # Migrations de base de données
    log_info "Exécution des migrations de base de données..."
    
    read -p "Voulez-vous exécuter les migrations via ECS Task ? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Récupérer les credentials DB
        SECRET_JSON=$(aws secretsmanager get-secret-value \
            --secret-id "${DB_SECRET_ARN}" \
            --query SecretString \
            --output text)
        
        USERNAME=$(echo $SECRET_JSON | jq -r '.username')
        PASSWORD=$(echo $SECRET_JSON | jq -r '.password')
        DATABASE_URL="postgresql://${USERNAME}:${PASSWORD}@${RDS_ENDPOINT}:5432/featureflags?schema=public"
        
        # Récupérer les infos réseau
        SUBNET_IDS=$(aws ec2 describe-subnets \
            --filters "Name=tag:aws:cloudformation:stack-name,Values=FeatureFlagsNetworkStack" \
                      "Name=tag:Name,Values=*Private*" \
            --query 'Subnets[0:3].SubnetId' \
            --output json | jq -r 'join(",")')
        
        SG_ID=$(aws ec2 describe-security-groups \
            --filters "Name=tag:aws:cloudformation:stack-name,Values=FeatureFlagsNetworkStack" \
                      "Name=group-name,Values=*AppSG*" \
            --query 'SecurityGroups[0].GroupId' \
            --output text)
        
        TASK_DEF_ARN=$(aws ecs list-task-definitions \
            --family-prefix FeatureFlagsComputeStack-ManagementTaskDef \
            --status ACTIVE \
            --sort DESC \
            --max-items 1 \
            --query 'taskDefinitionArns[0]' \
            --output text)
        
        log_info "Lancement de la tâche de migration..."
        
        TASK_ARN=$(aws ecs run-task \
            --cluster feature-flags-cluster \
            --task-definition ${TASK_DEF_ARN} \
            --launch-type FARGATE \
            --count 1 \
            --platform-version LATEST \
            --network-configuration "{
                \"awsvpcConfiguration\": {
                    \"subnets\": [\"${SUBNET_IDS//,/\",\"}\"],
                    \"securityGroups\": [\"${SG_ID}\"],
                    \"assignPublicIp\": \"DISABLED\"
                }
            }" \
            --overrides "{
                \"containerOverrides\": [{
                    \"name\": \"management-service\",
                    \"command\": [\"sh\", \"-c\", \"cd packages/database && npm run db:migrate:prod\"],
                    \"environment\": [
                        {\"name\": \"DATABASE_URL\", \"value\": \"${DATABASE_URL}\"}
                    ]
                }]
            }" \
            --query 'tasks[0].taskArn' \
            --output text)
        
        log_info "Attente de la fin des migrations..."
        aws ecs wait tasks-stopped --cluster feature-flags-cluster --tasks ${TASK_ARN}
        
        EXIT_CODE=$(aws ecs describe-tasks \
            --cluster feature-flags-cluster \
            --tasks ${TASK_ARN} \
            --query 'tasks[0].containers[0].exitCode' \
            --output text)
        
        if [ "$EXIT_CODE" == "0" ]; then
            log_success "Migrations terminées avec succès"
        else
            log_error "Migrations échouées (code: ${EXIT_CODE})"
            log_warning "Vérifiez les logs CloudWatch : /ecs/feature-flags/management"
        fi
    else
        log_warning "Migrations ignorées. Pensez à les exécuter manuellement !"
    fi
    
    # Déployer le MonitoringStack
    log_info "Déploiement du MonitoringStack..."
    cd infrastructure
    npx cdk deploy FeatureFlagsMonitoringStack --require-approval never
    cd ..
    
    log_success "Phase 3 terminée : ECS déployé et opérationnel"
}

# ============================================
# Vérification finale
# ============================================
verify_deployment() {
    echo ""
    echo "========================================"
    echo "  Vérification du Déploiement"
    echo "========================================"
    echo ""
    
    log_info "Vérification des services ECS..."
    
    # Attendre que les services se stabilisent
    log_info "Attente de la stabilisation des services (peut prendre 5 minutes)..."
    
    aws ecs wait services-stable \
        --cluster feature-flags-cluster \
        --services ManagementService ReadService \
        --region ${AWS_REGION} || log_warning "Timeout lors de l'attente de stabilisation"
    
    # Test des endpoints
    sleep 10
    
    log_info "Test des endpoints..."
    
    if curl -f -m 10 "http://${ALB_DNS}/api/v1/management/health" &> /dev/null; then
        log_success "Management API : ✅ HEALTHY"
    else
        log_warning "Management API : ⚠️ Non accessible (peut nécessiter plus de temps)"
    fi
    
    if curl -f -m 10 "http://${ALB_DNS}/api/v1/eval/health" &> /dev/null; then
        log_success "Read API : ✅ RESPONDING"
    else
        log_warning "Read API : ⚠️ Non accessible"
    fi
    
    echo ""
    echo "========================================"
    log_success "🎉 DÉPLOIEMENT TERMINÉ"
    echo "========================================"
    echo ""
    echo "📊 Informations importantes :"
    echo ""
    echo "  🌐 Load Balancer:"
    echo "     http://${ALB_DNS}"
    echo ""
    echo "  📝 API Management:"
    echo "     http://${ALB_DNS}/api/v1/management/"
    echo ""
    echo "  📖 API Read:"
    echo "     http://${ALB_DNS}/api/v1/eval"
    echo ""
    echo "  🔐 Secrets DB:"
    echo "     ${DB_SECRET_ARN}"
    echo ""
    echo "  📦 ECR Repositories:"
    echo "     ${MGMT_REPO_URI}"
    echo "     ${READ_REPO_URI}"
    echo ""
    echo "========================================"
    echo "🔄 Prochaines étapes :"
    echo "========================================"
    echo ""
    echo "  1. Configurer GitHub Secrets pour CI/CD :"
    echo "     - AWS_ACCESS_KEY_ID"
    echo "     - AWS_SECRET_ACCESS_KEY"
    echo "     - DB_SECRET_ARN=${DB_SECRET_ARN}"
    echo ""
    echo "  2. Configurer GitHub Variables :"
    echo "     - RDS_ENDPOINT=${RDS_ENDPOINT}"
    echo "     - VPC_SUBNET_IDS (voir AWS Console)"
    echo "     - APP_SECURITY_GROUP_ID (voir AWS Console)"
    echo ""
    echo "  3. Tester les APIs :"
    echo "     curl http://${ALB_DNS}/api/v1/management/health"
    echo ""
    echo "  4. Surveiller les logs :"
    echo "     aws logs tail /ecs/feature-flags/management --follow"
    echo ""
}

# ============================================
# Menu principal
# ============================================
main() {
    echo ""
    echo "========================================"
    echo "  Feature Flags - Déploiement Production"
    echo "  Déploiement en 3 phases"
    echo "========================================"
    echo ""
    
    log_warning "Ce script va déployer l'infrastructure complète en 3 phases :"
    echo "  Phase 1 : Infrastructure + ECR"
    echo "  Phase 2 : Build & Push Docker"
    echo "  Phase 3 : Déploiement ECS"
    echo ""
    
    read -p "Continuer ? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Déploiement annulé"
        exit 0
    fi
    
    # Vérifier les prérequis
    log_info "Vérification des prérequis..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI non trouvé"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker non trouvé"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq non trouvé"
        exit 1
    fi
    
    log_success "Prérequis OK"
    
    # Exécution des phases
    phase1_infrastructure
    phase2_docker_images
    phase3_ecs_deployment
    verify_deployment
}

# Exécuter
main