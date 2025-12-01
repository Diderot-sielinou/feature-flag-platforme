#!/bin/bash

# ============================================
# Script de Déploiement AWS Complet
# Feature Flags Platform
# ============================================

set -e
set -u

# ⚠️ CORRECTION 1: Forcer la région explicitement
export AWS_REGION=${AWS_REGION:-us-east-1}
export AWS_DEFAULT_REGION=${AWS_REGION}

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region ${AWS_REGION})
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
    if ! aws sts get-caller-identity --region ${AWS_REGION} &> /dev/null; then
        log_error "Credentials AWS non configurés. Exécutez 'aws configure'"
        exit 1
    fi
    
    # Vérifier la connexion Docker
    if ! docker info &> /dev/null; then
        log_error "Docker daemon non démarré. Lancez Docker Desktop"
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
    # if ! aws cloudformation describe-stacks \
    #     --stack-name CDKToolkit \
    #     --region ${AWS_REGION} &> /dev/null; then
    #     log_warning "CDK non bootstrap. Lancement du bootstrap..."
    #     npx cdk bootstrap "aws://${ACCOUNT_ID}/${AWS_REGION}"
    # fi
    
    # Déployer les stacks de base (sans ComputeStack)
    log_info "Déploiement de NetworkStack..."
    npx cdk deploy FeatureFlagsNetworkStack --require-approval never
    
    log_info "Déploiement de DatabaseStack..."
    npx cdk deploy FeatureFlagsDatabaseStack --require-approval never
    
    log_info "Déploiement de AuthStack..."
    npx cdk deploy FeatureFlagsAuthStack --require-approval never

    log_info "Déploiement de emailStack..."
    npx cdk deploy FeatureFlagsEmailStack --require-approval never
    
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
    
    # ⚠️ CORRECTION 2: Ajouter --region explicitement
    # Database Stack
    export DB_SECRET_ARN=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsDatabaseStack \
        --region ${AWS_REGION} \
        --query 'Stacks[0].Outputs[?OutputKey==`DBSecretArn`].OutputValue' \
        --output text)
    
    export RDS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsDatabaseStack \
        --region ${AWS_REGION} \
        --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' \
        --output text)
    
    export REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsDatabaseStack \
        --region ${AWS_REGION} \
        --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
        --output text)
    
    # ECR Stack
    export MGMT_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsECRStack \
        --region ${AWS_REGION} \
        --query 'Stacks[0].Outputs[?OutputKey==`ManagementRepoURI`].OutputValue' \
        --output text)
    
    export READ_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsECRStack \
        --region ${AWS_REGION} \
        --query 'Stacks[0].Outputs[?OutputKey==`ReadRepoURI`].OutputValue' \
        --output text)
    
    # Vérifier que toutes les variables sont définies
    if [ -z "$DB_SECRET_ARN" ] || [ -z "$RDS_ENDPOINT" ] || [ -z "$MGMT_REPO_URI" ] || [ -z "$READ_REPO_URI" ]; then
        log_error "Impossible de récupérer tous les outputs CloudFormation"
        echo "DB_SECRET_ARN: $DB_SECRET_ARN"
        echo "RDS_ENDPOINT: $RDS_ENDPOINT"
        echo "MGMT_REPO_URI: $MGMT_REPO_URI"
        echo "READ_REPO_URI: $READ_REPO_URI"
        exit 1
    fi
    
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
    
    # ⚠️ CORRECTION 3: Login ECR avec timeout plus long et retry
    log_info "Connexion à ECR..."
    
    MAX_RETRIES=3
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if aws ecr get-login-password --region ${AWS_REGION} | \
            docker login --username AWS --password-stdin \
            ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com; then
            log_success "Connecté à ECR"
            break
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                log_warning "Échec de connexion ECR. Tentative ${RETRY_COUNT}/${MAX_RETRIES}..."
                sleep 5
            else
                log_error "Impossible de se connecter à ECR après ${MAX_RETRIES} tentatives"
                log_info "Vérifiez votre connexion internet et Docker daemon"
                exit 1
            fi
        fi
    done
    
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
        --region ${AWS_REGION} \
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
    
    # Demander confirmation
    read -p "Voulez-vous exécuter les migrations via ECS Task ? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Migrations ignorées. Pensez à les exécuter manuellement !"
        return 0
    fi
    
    # Récupérer les credentials DB
    SECRET_JSON=$(aws secretsmanager get-secret-value \
        --secret-id "${DB_SECRET_ARN}" \
        --region ${AWS_REGION} \
        --query SecretString \
        --output text)
    
    USERNAME=$(echo $SECRET_JSON | jq -r '.username')
    PASSWORD=$(echo $SECRET_JSON | jq -r '.password')
    
    DATABASE_URL="postgresql://${USERNAME}:${PASSWORD}@${RDS_ENDPOINT}:5432/featureflags?schema=public"
    
    # ⚠️ CORRECTION 4: Récupérer TOUS les subnets privés
    SUBNET_IDS=$(aws ec2 describe-subnets \
        --region ${AWS_REGION} \
        --filters "Name=tag:aws:cloudformation:stack-name,Values=FeatureFlagsNetworkStack" \
                  "Name=tag:Name,Values=*Private*" \
        --query 'Subnets[0:3].SubnetId' \
        --output json | jq -r 'join(",")')
    
    # ⚠️ CORRECTION 5: Meilleure sélection du Security Group
    SG_ID=$(aws ec2 describe-security-groups \
        --region ${AWS_REGION} \
        --filters "Name=tag:aws:cloudformation:stack-name,Values=FeatureFlagsNetworkStack" \
        --query 'SecurityGroups[?contains(GroupName, `AppSG`)].GroupId' \
        --output text | head -n1)
    
    if [ -z "$SG_ID" ]; then
        log_error "Security Group AppSG non trouvé"
        exit 1
    fi
    
    # Récupérer la Task Definition
    TASK_DEF_ARN=$(aws ecs list-task-definitions \
        --region ${AWS_REGION} \
        --family-prefix FeatureFlagsComputeStack-ManagementTaskDef \
        --status ACTIVE \
        --sort DESC \
        --max-items 1 \
        --query 'taskDefinitionArns[0]' \
        --output text)
    
    if [ -z "$TASK_DEF_ARN" ] || [ "$TASK_DEF_ARN" == "None" ]; then
        log_error "Task Definition non trouvée"
        exit 1
    fi
    
    log_info "Task Definition: $TASK_DEF_ARN"
    log_info "Subnets: $SUBNET_IDS"
    log_info "Security Group: $SG_ID"
    
    log_info "Lancement de la tâche de migration..."
    
    # ⚠️ CORRECTION 6: Nom du container correct
    TASK_ARN=$(aws ecs run-task \
        --region ${AWS_REGION} \
        --cluster ${CLUSTER_NAME} \
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
    
    if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" == "None" ]; then
        log_error "Échec du lancement de la tâche de migration"
        exit 1
    fi
    
    log_info "Tâche lancée: $TASK_ARN"
    log_info "Attente de la fin de la migration (peut prendre 2-3 minutes)..."
    
    aws ecs wait tasks-stopped \
        --region ${AWS_REGION} \
        --cluster ${CLUSTER_NAME} \
        --tasks ${TASK_ARN}
    
    EXIT_CODE=$(aws ecs describe-tasks \
        --region ${AWS_REGION} \
        --cluster ${CLUSTER_NAME} \
        --tasks ${TASK_ARN} \
        --query 'tasks[0].containers[0].exitCode' \
        --output text)
    
    if [ "$EXIT_CODE" != "0" ]; then
        log_error "Migration échouée avec le code : ${EXIT_CODE}"
        log_info "Détails de la tâche :"
        aws ecs describe-tasks \
            --region ${AWS_REGION} \
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
        --region ${AWS_REGION} \
        --cluster ${CLUSTER_NAME} \
        --services ManagementService ReadService || {
            log_warning "Timeout lors de l'attente. Les services peuvent encore se stabiliser..."
            log_info "Vérifiez manuellement: aws ecs describe-services --cluster ${CLUSTER_NAME} --services ManagementService ReadService"
        }
    
    log_success "Services ECS stabilisés (ou timeout atteint)"
}

# ============================================
# PHASE 7 : Vérifier le déploiement
# ============================================
verify_deployment() {
    log_info "PHASE 7 : Vérification du déploiement..."
    
    # Attendre un peu pour le warm-up
    log_info "Attente du warm-up des containers (30 secondes)..."
    sleep 30
    
    # Test Management API (health check à la racine)
    log_info "Test du health check Management API..."
    MGMT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "http://${ALB_DNS}/health" || echo "CURL_FAILED")
    
    if echo "$MGMT_RESPONSE" | grep -q "HTTP_CODE:200"; then
        log_success "Management API : ✅ HEALTHY"
        echo "$MGMT_RESPONSE" | head -n -1 | jq '.' 2>/dev/null || echo "$MGMT_RESPONSE" | head -n -1
    else
        log_warning "Management API : ⚠️ Non accessible"
        echo "Response: $MGMT_RESPONSE"
        log_info "Vérifiez les logs: aws logs tail /ecs/feature-flags/management --follow --region ${AWS_REGION}"
    fi
    
    # Test Read API
    log_info "Test du health check Read API..."
    READ_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "http://${ALB_DNS}/health" || echo "CURL_FAILED")
    
    if echo "$READ_RESPONSE" | grep -q "HTTP_CODE:200"; then
        log_success "Read API : ✅ HEALTHY"
    else
        log_warning "Read API : ⚠️ Non accessible"
        echo "Response: $READ_RESPONSE"
    fi
    
    # Test de l'endpoint eval
    log_info "Test de POST /api/v1/eval..."
    EVAL_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"projectId":"test","envId":"test","flag":"test","entity":{"id":"test","type":"user"}}' \
        "http://${ALB_DNS}/api/v1/eval" || echo "CURL_FAILED")
    
    if echo "$EVAL_RESPONSE" | grep -q '"on"'; then
        log_success "Eval endpoint : ✅ RESPONDING"
        echo "$EVAL_RESPONSE" | jq '.' 2>/dev/null || echo "$EVAL_RESPONSE"
    else
        log_warning "Eval endpoint : ⚠️ Non fonctionnel"
    fi
}

# ============================================
# PHASE 8 : Afficher les informations finales
# ============================================
show_final_info() {
    echo ""
    echo "================================================"
    log_success "🎉 Déploiement terminé !"
    echo "================================================"
    echo ""
    echo "📋 Informations de déploiement :"
    echo "  - ALB DNS: ${ALB_DNS}"
    echo "  - Management API: http://${ALB_DNS}/api/v1/management/"
    echo "  - Read API: http://${ALB_DNS}/api/v1/eval"
    echo "  - Health Check: http://${ALB_DNS}/health"
    echo "  - Cluster ECS: ${CLUSTER_NAME}"
    echo "  - Region: ${AWS_REGION}"
    echo ""
    echo "🔐 Secrets et ressources :"
    echo "  - DB Secret ARN: ${DB_SECRET_ARN}"
    echo "  - RDS Endpoint: ${RDS_ENDPOINT}"
    echo "  - Redis Endpoint: ${REDIS_ENDPOINT}"
    echo ""
    echo "📊 Monitoring :"
    echo "  - CloudWatch Logs:"
    echo "    aws logs tail /ecs/feature-flags/management --follow --region ${AWS_REGION}"
    echo "    aws logs tail /ecs/feature-flags/read --follow --region ${AWS_REGION}"
    echo ""
    echo "  - ECS Services:"
    echo "    aws ecs describe-services --cluster ${CLUSTER_NAME} --services ManagementService ReadService --region ${AWS_REGION}"
    echo ""
    echo "🧪 Tests rapides :"
    echo "  curl http://${ALB_DNS}/health"
    echo "  curl -X POST http://${ALB_DNS}/api/v1/eval -H 'Content-Type: application/json' -d '{\"projectId\":\"test\",\"envId\":\"test\",\"flag\":\"test\",\"entity\":{\"id\":\"test\",\"type\":\"user\"}}'"
    echo ""
}

# ============================================
# Gestion des erreurs
# ============================================
cleanup_on_error() {
    log_error "Une erreur s'est produite lors du déploiement"
    echo "Consultez les logs AWS CloudFormation et ECS pour plus de détails"
    echo ""
    echo "Commandes de debug :"
    echo "  aws cloudformation describe-stack-events --stack-name FeatureFlagsComputeStack --region ${AWS_REGION}"
    echo "  aws ecs describe-services --cluster ${CLUSTER_NAME} --services ManagementService --region ${AWS_REGION}"
    echo "  aws logs tail /ecs/feature-flags/management --follow --region ${AWS_REGION}"
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