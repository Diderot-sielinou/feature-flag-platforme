#!/bin/bash

# ============================================
# Script de Déploiement AWS Complet
# Feature Flags Platform
# ============================================

set -e
set -u

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CLUSTER_NAME="feature-flags-cluster"

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

echo "================================================"
echo "  🚀 Déploiement AWS Feature Flags Platform"
echo "================================================"
echo ""

# ============================================
# Vérifier les prérequis
# ============================================
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI non trouvé. Installez-le d'abord."
        exit 1
    fi
    
    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker non trouvé. Installez-le d'abord."
        exit 1
    fi
    
    # jq
    if ! command -v jq &> /dev/null; then
        log_error "jq non trouvé. Installez-le : brew install jq (macOS) ou apt-get install jq (Linux)"
        exit 1
    fi
    
    # Node.js et npm
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        log_error "Node.js et npm requis. Installez Node.js 20+"
        exit 1
    fi
    
    # Credentials AWS
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Credentials AWS non configurés. Exécutez 'aws configure'"
        exit 1
    fi
    
    log_success "Tous les prérequis sont satisfaits"
    echo "  - AWS Account: ${ACCOUNT_ID}"
    echo "  - AWS Region: ${AWS_REGION}"
}

# ============================================
# PHASE 1 : Déployer l'infrastructure de base
# ============================================
deploy_base_infrastructure() {
    log_info "PHASE 1 : Déploiement de l'infrastructure de base..."
    
    cd infrastructure
    
    # Bootstrap CDK si nécessaire
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
        log_warning "CDK non bootstrap. Lancement du bootstrap..."
        npx cdk bootstrap "aws://${ACCOUNT_ID}/${AWS_REGION}"
    fi
    
    # Déployer les stacks de base (sans ComputeStack)
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
    
    log_success "Infrastructure de base déployée"
}

# ============================================
# PHASE 2 : Récupérer les outputs CloudFormation
# ============================================
get_stack_outputs() {
    log_info "PHASE 2 : Récupération des outputs CloudFormation..."
    
    # Database Stack
    export DB_SECRET_ARN=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsDatabaseStack \
        --query 'Stacks[0].Outputs[?OutputKey==`DBSecretArn`].OutputValue' \
        --output text)
    
    export RDS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsDatabaseStack \
        --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' \
        --output text)
    
    export REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsDatabaseStack \
        --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
        --output text)
    
    # ECR Stack
    export MGMT_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsECRStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ManagementRepoURI`].OutputValue' \
        --output text)
    
    export READ_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsECRStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ReadRepoURI`].OutputValue' \
        --output text)
    
    log_success "Outputs récupérés :"
    echo "  - DB Secret ARN: ${DB_SECRET_ARN}"
    echo "  - RDS Endpoint: ${RDS_ENDPOINT}"
    echo "  - Redis Endpoint: ${REDIS_ENDPOINT}"
    echo "  - Management Repo: ${MGMT_REPO_URI}"
    echo "  - Read Repo: ${READ_REPO_URI}"
}

# ============================================
# PHASE 3 : Build et Push des images Docker
# ============================================
build_and_push_images() {
    log_info "PHASE 3 : Build et push des images Docker..."
    
    # Login ECR
    log_info "Connexion à ECR..."
    aws ecr get-login-password --region ${AWS_REGION} | \
        docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
    
    # Récupérer le commit SHA court
    GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
    
    # Build Management API
    log_info "Build de l'image Management API..."
    docker build \
        -t ${MGMT_REPO_URI}:${GIT_SHA} \
        -t ${MGMT_REPO_URI}:latest \
        -f docker/api-management.Dockerfile \
        . || {
            log_error "Échec du build de Management API"
            exit 1
        }
    
    log_info "Push de Management API vers ECR..."
    docker push ${MGMT_REPO_URI}:${GIT_SHA}
    docker push ${MGMT_REPO_URI}:latest
    
    # Build Read API
    log_info "Build de l'image Read API..."
    docker build \
        -t ${READ_REPO_URI}:${GIT_SHA} \
        -t ${READ_REPO_URI}:latest \
        -f docker/api-read.Dockerfile \
        . || {
            log_error "Échec du build de Read API"
            exit 1
        }
    
    log_info "Push de Read API vers ECR..."
    docker push ${READ_REPO_URI}:${GIT_SHA}
    docker push ${READ_REPO_URI}:latest
    
    log_success "Images Docker buildées et pushées"
    echo "  - Management: ${MGMT_REPO_URI}:${GIT_SHA}"
    echo "  - Read: ${READ_REPO_URI}:${GIT_SHA}"
}

# ============================================
# PHASE 4 : Déployer ComputeStack et MonitoringStack
# ============================================
deploy_compute_monitoring() {
    log_info "PHASE 4 : Déploiement de ComputeStack et MonitoringStack..."
    
    cd infrastructure
    
    log_info "Déploiement de ComputeStack..."
    npx cdk deploy FeatureFlagsComputeStack --require-approval never
    
    log_info "Déploiement de MonitoringStack..."
    npx cdk deploy FeatureFlagsMonitoringStack --require-approval never
    
    cd ..
    
    # Récupérer l'ALB DNS
    export ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsComputeStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
        --output text)
    
    log_success "ComputeStack et MonitoringStack déployés"
    echo "  - ALB DNS: ${ALB_DNS}"
}

# ============================================
# PHASE 5 : Exécuter les migrations de base de données
# ============================================
run_database_migrations() {
    log_info "PHASE 5 : Exécution des migrations de base de données..."
    
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
        --query 'Subnets[0].SubnetId' \
        --output text)
    
    SG_ID=$(aws ec2 describe-security-groups \
        --filters "Name=tag:aws:cloudformation:stack-name,Values=FeatureFlagsNetworkStack" \
        --query 'SecurityGroups[?GroupName==`FeatureFlagsNetworkStack/AppSG`].GroupId' \
        --output text)
    
    # Récupérer la Task Definition
    TASK_DEF_ARN=$(aws ecs list-task-definitions \
        --family-prefix FeatureFlagsComputeStack-ManagementTaskDef \
        --status ACTIVE \
        --sort DESC \
        --max-items 1 \
        --query 'taskDefinitionArns[0]' \
        --output text)
    
    log_info "Lancement de la tâche de migration..."
    TASK_ARN=$(aws ecs run-task \
        --cluster ${CLUSTER_NAME} \
        --task-definition ${TASK_DEF_ARN} \
        --launch-type FARGATE \
        --count 1 \
        --platform-version LATEST \
        --network-configuration "{
            \"awsvpcConfiguration\": {
                \"subnets\": [\"${SUBNET_IDS}\"],
                \"securityGroups\": [\"${SG_ID}\"],
                \"assignPublicIp\": \"DISABLED\"
            }
        }" \
        --overrides "{
            \"containerOverrides\": [{
                \"name\": \"ManagementContainer\",
                \"command\": [\"sh\", \"-c\", \"cd packages/database && npm run db:migrate:prod\"],
                \"environment\": [
                    {\"name\": \"DATABASE_URL\", \"value\": \"${DATABASE_URL}\"}
                ]
            }]
        }" \
        --query 'tasks[0].taskArn' \
        --output text)
    
    if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" == "None" ]; then
        log_error "Échec du lancement de la tâche de migration"
        exit 1
    fi
    
    log_info "Attente de la fin de la migration..."
    aws ecs wait tasks-stopped --cluster ${CLUSTER_NAME} --tasks ${TASK_ARN}
    
    EXIT_CODE=$(aws ecs describe-tasks \
        --cluster ${CLUSTER_NAME} \
        --tasks ${TASK_ARN} \
        --query 'tasks[0].containers[0].exitCode' \
        --output text)
    
    if [ "$EXIT_CODE" != "0" ]; then
        log_error "Migration échouée avec le code : ${EXIT_CODE}"
        aws ecs describe-tasks \
            --cluster ${CLUSTER_NAME} \
            --tasks ${TASK_ARN} \
            --query 'tasks[0].containers[0]' || true
        exit 1
    fi
    
    log_success "Migrations de base de données terminées"
}

# ============================================
# PHASE 6 : Attendre la stabilisation des services
# ============================================
wait_for_services() {
    log_info "PHASE 6 : Attente de la stabilisation des services ECS..."
    
    log_info "Cela peut prendre 5-10 minutes..."
    aws ecs wait services-stable \
        --cluster ${CLUSTER_NAME} \
        --services ManagementService ReadService \
        --region ${AWS_REGION}
    
    log_success "Services ECS stabilisés"
}

# ============================================
# PHASE 7 : Vérifier le déploiement
# ============================================
verify_deployment() {
    log_info "PHASE 7 : Vérification du déploiement..."
    
    # Attendre un peu pour le warm-up
    sleep 15
    
    # Test Management API
    log_info "Test du health check Management API..."
    MGMT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "http://${ALB_DNS}/api/v1/management/health" || echo "CURL_FAILED")
    
    if echo "$MGMT_RESPONSE" | grep -q "HTTP_CODE:200"; then
        log_success "Management API : OK"
        echo "$MGMT_RESPONSE" | head -n -1 | jq '.' 2>/dev/null || echo "$MGMT_RESPONSE"
    else
        log_warning "Management API : En cours de warm-up ou échec"
        echo "Response: $MGMT_RESPONSE"
    fi
    
    # Test Read API
    log_info "Test du health check Read API..."
    READ_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "http://${ALB_DNS}/api/v1/eval" || echo "CURL_FAILED")
    
    if echo "$READ_RESPONSE" | grep -q "HTTP_CODE:200\|HTTP_CODE:404"; then
        log_success "Read API : OK (répond)"
        echo "$READ_RESPONSE" | head -n -1
    else
        log_warning "Read API : En cours de warm-up ou échec"
        echo "Response: $READ_RESPONSE"
    fi
}

# ============================================
# PHASE 8 : Afficher les informations finales
# ============================================
show_final_info() {
    echo ""
    echo "================================================"
    log_success "🎉 Déploiement terminé avec succès !"
    echo "================================================"
    echo ""
    echo "📋 Informations de déploiement :"
    echo "  - ALB DNS: ${ALB_DNS}"
    echo "  - Management API: http://${ALB_DNS}/api/v1/management/"
    echo "  - Read API: http://${ALB_DNS}/api/v1/eval"
    echo "  - Cluster ECS: ${CLUSTER_NAME}"
    echo "  - Region: ${AWS_REGION}"
    echo ""
    echo "🔐 Secrets et ressources :"
    echo "  - DB Secret ARN: ${DB_SECRET_ARN}"
    echo "  - RDS Endpoint: ${RDS_ENDPOINT}"
    echo "  - Redis Endpoint: ${REDIS_ENDPOINT}"
    echo ""
    echo "📊 Monitoring :"
    echo "  - CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=FeatureFlags-Production"
    echo ""
    echo "🔄 Prochaines étapes :"
    echo "  1. Configurer GitHub Secrets pour CI/CD:"
    echo "     - AWS_ACCESS_KEY_ID"
    echo "     - AWS_SECRET_ACCESS_KEY"
    echo "     - DB_SECRET_ARN"
    echo ""
    echo "  2. Configurer GitHub Variables:"
    echo "     - RDS_ENDPOINT"
    echo "     - VPC_SUBNET_IDS"
    echo "     - APP_SECURITY_GROUP_ID"
    echo ""
    echo "  3. Tester vos endpoints:"
    echo "     curl http://${ALB_DNS}/api/v1/management/health"
    echo "     curl http://${ALB_DNS}/api/v1/eval"
    echo ""
}

# ============================================
# Gestion des erreurs
# ============================================
cleanup_on_error() {
    log_error "Une erreur s'est produite. Nettoyage en cours..."
    # Ne pas détruire l'infrastructure, juste informer
    echo "Consultez les logs AWS CloudFormation et ECS pour plus de détails."
    exit 1
}

trap cleanup_on_error ERR

# ============================================
# MAIN EXECUTION
# ============================================
main() {
    check_prerequisites
    echo ""
    
    deploy_base_infrastructure
    echo ""
    
    get_stack_outputs
    echo ""
    
    build_and_push_images
    echo ""
    
    deploy_compute_monitoring
    echo ""
    
    run_database_migrations
    echo ""
    
    wait_for_services
    echo ""
    
    verify_deployment
    echo ""
    
    show_final_info
}

# Confirmation avant exécution
read -p "Voulez-vous démarrer le déploiement complet ? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    main
else
    log_info "Déploiement annulé"
    exit 0
fi