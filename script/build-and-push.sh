#!/bin/bash
set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Build and push Management API
echo "🏗️  Building Management API..."
docker build -t feature-flags/api-management:latest \
  -f docker/api-management.Dockerfile .

docker tag feature-flags/api-management:latest \
  ${ECR_REGISTRY}/feature-flags/api-management:latest

echo "📤 Pushing Management API to ECR..."
docker push ${ECR_REGISTRY}/feature-flags/api-management:latest

# Build and push Read API
echo "🏗️  Building Read API..."
docker build -t feature-flags/api-read:latest \
  -f docker/api-read.Dockerfile .

docker tag feature-flags/api-read:latest \
  ${ECR_REGISTRY}/feature-flags/api-read:latest

echo "📤 Pushing Read API to ECR..."
docker push ${ECR_REGISTRY}/feature-flags/api-read:latest

echo "✅ Build and push completed successfully!"