#!/bin/bash

set -e

AWS_REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

MGMT_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/feature-flags/api-management"
READ_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/feature-flags/api-read"

echo "🔐 Login ECR"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "🐳 Build management image"
docker build -t $MGMT_REPO:latest -f docker/api-management.Dockerfile .
docker push $MGMT_REPO:latest

echo "🐳 Build read image"
docker build -t $READ_REPO:latest -f docker/api-read.Dockerfile .
docker push $READ_REPO:latest

echo "🚀 Trigger ECS deployments"
aws ecs update-service --cluster feature-flags-cluster \
  --service ManagementService --force-new-deployment

aws ecs update-service --cluster feature-flags-cluster \
  --service ReadService --force-new-deployment

echo "🎉 FIRST DEPLOY COMPLETED"
