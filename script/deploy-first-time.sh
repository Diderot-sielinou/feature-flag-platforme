#!/bin/bash

# ============================================
# Script de Premier Déploiement
# Feature Flags Platform
# ============================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CLUSTER_NAME="feature-flags-cluster"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier les prérequis
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install it first."
        exit 1
    fi
    
    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install it first."
        exit 1
    fi
    
    # jq
    if ! command -v jq &> /dev/null; then
        log_error "jq not found. Please install it: brew install jq (macOS) or apt-get install jq (Linux)"
        exit 1
    fi
    
    # Vérifier les credentials AWS
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Étape 1 : Déployer l'infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure with CDK..."
    
    cd infrastructure
    
    # Bootstrap si nécessaire
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
        log_warning "CDK not bootstrapped yet. Running bootstrap..."
        npx cdk bootstrap "aws://${ACCOUNT_ID}/${AWS_REGION}"
    fi
    
    # Déployer tous les stacks
    npx cdk deploy --all --require-approval never
    
    cd ..
    
    log_success "Infrastructure deployed"
}

# Étape 2 : Récupérer les outputs CloudFormation
get_stack_outputs() {
    log_info "Retrieving stack outputs..."
    
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
    
    # Compute Stack
    export ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsComputeStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
        --output text)
    
    export MGMT_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsComputeStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ManagementRepoURI`].OutputValue' \
        --output text)
    
    export READ_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name FeatureFlagsComputeStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ReadRepoURI`].OutputValue' \
        --output text)
    
    log_success "Outputs retrieved:"
    echo "  - DB Secret: ${DB_SECRET_ARN}"
    echo "  - RDS Endpoint: ${RDS_ENDPOINT}"
    echo "  - Redis Endpoint: ${REDIS_ENDPOINT}"
    echo "  - ALB DNS: ${ALB_DNS}"
    echo "  - Management Repo: ${MGMT_REPO_URI}"
    echo "  - Read Repo: ${READ_REPO_URI}"
}

# Étape 3 : Build et push des images Docker
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Login ECR
    log_info "Logging into ECR..."
    aws ecr get-login-password --region ${AWS_REGION} | \
        docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
    
    # Build Management API
    log_info "Building Management API image..."
    docker build \
        -t ${MGMT_REPO_URI}:latest \
        -t ${MGMT_REPO_URI}:$(git rev-parse --short HEAD) \
        -f docker/api-management.Dockerfile \
        .
    
    log_info "Pushing Management API image..."
    docker push ${MGMT_REPO_URI}:latest
    docker push ${MGMT_REPO_URI}:$(git rev-parse --short HEAD)
    
    # Build Read API
    log_info "Building Read API image..."
    docker build \
        -t ${READ_REPO_URI}:latest \
        -t ${READ_REPO_URI}:$(git rev-parse --short HEAD) \
        -f docker/api-read.Dockerfile \
        .
    
    log_info "Pushing Read API image..."
    docker push ${READ_REPO_URI}:latest
    docker push ${READ_REPO_URI}:$(git rev-parse --short HEAD)
    
    log_success "Images built and pushed"
}

# Étape 4 : Exécuter les migrations de base de données
run_database_migrations() {
    log_info "Running database migrations..."
    
    # Récupérer les credentials DB
    SECRET_JSON=$(aws secretsmanager get-secret-value \
        --secret-id "${DB_SECRET_ARN}" \
        --query SecretString \
        --output text)
    
    USERNAME=$(echo $SECRET_JSON | jq -r '.username')
    PASSWORD=$(echo $SECRET_JSON | jq -r '.password')
    
    DATABASE_URL="postgresql://${USERNAME}:${PASSWORD}@${RDS_ENDPOINT}:5432/featureflags?schema=public"
    
    # Option 1: Migration locale (nécessite un tunnel ou bastion)
    log_warning "For migrations, you have two options:"
    echo "  1. Run migrations locally via SSM tunnel (requires bastion host)"
    echo "  2. Run migrations via ECS Task (recommended)"
    
    read -p "Run migrations via ECS Task? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Récupérer les infos réseau
        SUBNET_IDS=$(aws ec2 describe-subnets \
            --filters "Name=tag:aws:cloudformation:stack-name,Values=FeatureFlagsNetworkStack" \
                      "Name=tag:Name,Values=*Private*" \
            --query 'Subnets[*].SubnetId' \
            --output json | jq -r 'join(",")')
        
        SG_ID=$(aws ec2 describe-security-groups \
            --filters "Name=tag:aws:cloudformation:stack-name,Values=FeatureFlagsNetworkStack" \
                      "Name=tag:Name,Values=*AppSG*" \
            --query 'SecurityGroups[0].GroupId' \
            --output text)
        
        # Récupérer la Task Definition
        TASK_DEF_ARN=$(aws ecs list-task-definitions \
            --family-prefix FeatureFlagsComputeStack-ManagementTaskDef \
            --status ACTIVE \
            --sort DESC \
            --max-items 1 \
            --query 'taskDefinitionArns[0]' \
            --output text)
        
        log_info "Launching migration task..."
        TASK_ARN=$(aws ecs run-task \
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
        
        log_info "Waiting for migration to complete..."
        aws ecs wait tasks-stopped --cluster ${CLUSTER_NAME} --tasks ${TASK_ARN}
        
        EXIT_CODE=$(aws ecs describe-tasks \
            --cluster ${CLUSTER_NAME} \
            --tasks ${TASK_ARN} \
            --query 'tasks[0].containers[0].exitCode' \
            --output text)
        
        if [ "$EXIT_CODE" != "0" ]; then
            log_error "Migration failed with exit code: ${EXIT_CODE}"
            exit 1
        fi
        
        log_success "Database migrations completed"
    else
        log_warning "Skipping automated migration. Please run manually."
    fi
}

# Étape 5 : Mettre à jour les services ECS
update_ecs_services() {
    log_info "Updating ECS services..."
    
    # Management Service
    aws ecs update-service \
        --cluster ${CLUSTER_NAME} \
        --service ManagementService \
        --force-new-deployment \
        --query 'service.serviceName' \
        --output text
    
    log_success "Management service deployment triggered"
    
    # Read Service
    aws ecs update-service \
        --cluster ${CLUSTER_NAME} \
        --service ReadService \
        --force-new-deployment \
        --query 'service.serviceName' \
        --output text
    
    log_success "Read service deployment triggered"
    
    log_info "Waiting for services to become stable (this may take 5-10 minutes)..."
    aws ecs wait services-stable \
        --cluster ${CLUSTER_NAME} \
        --services ManagementService ReadService
    
    log_success "All services are stable"
}

# Étape 6 : Vérifier le déploiement
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Attendre un peu pour que les services se stabilisent
    sleep 10
    
    # Test Management API
    if curl -f -m 10 "http://${ALB_DNS}/api/v1/management/health" &> /dev/null; then
        log_success "Management API is healthy"
    else
        log_warning "Management API health check failed (may need more time to warm up)"
    fi
    
    # Test Read API
    if curl -f -m 10 "http://${ALB_DNS}/api/v1/eval" &> /dev/null; then
        log_success "Read API is responding"
    else
        log_warning "Read API not yet responsive"
    fi
    
    echo ""
    log_success "🎉 Deployment completed!"
    echo ""
    echo "Next steps:"
    echo "  1. Configure GitHub secrets for CI/CD:"
    echo "     - AWS_ACCESS_KEY_ID"
    echo "     - AWS_SECRET_ACCESS_KEY"
    echo "     - DB_SECRET_ARN=${DB_SECRET_ARN}"
    echo ""
    echo "  2. Configure GitHub variables:"
    echo "     - RDS_ENDPOINT=${RDS_ENDPOINT}"
    echo "     - VPC_SUBNET_IDS=<from AWS Console>"
    echo "     - APP_SECURITY_GROUP_ID=<from AWS Console>"
    echo ""
    echo "  3. Access your APIs:"
    echo "     - Management: http://${ALB_DNS}/api/v1/management/"
    echo "     - Read: http://${ALB_DNS}/api/v1/eval"
}

# ============================================
# MAIN EXECUTION
# ============================================

main() {
    echo "================================================"
    echo "  Feature Flags Platform - First Deployment"
    echo "================================================"
    echo ""
    
    check_prerequisites
    echo ""
    
    deploy_infrastructure
    echo ""
    
    get_stack_outputs
    echo ""
    
    build_and_push_images
    echo ""
    
    run_database_migrations
    echo ""
    
    update_ecs_services
    echo ""
    
    verify_deployment
}

# Exécuter le script principal
main