version: '3.8'

services:
  # ==========================================================================
  # PostgreSQL Database
  # ==========================================================================
  postgres:
    image: postgres:16-alpine
    container_name: launchlayer-postgres
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: featureflags
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - launchlayer-network

  # ==========================================================================
  # Redis Cache
  # ==========================================================================
  redis:
    image: redis:7-alpine
    container_name: launchlayer-redis
    ports:
      - "6380:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - launchlayer-network

  # ==========================================================================
  # Redis Commander (Debug UI)
  # ==========================================================================
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: launchlayer-redis-commander
    ports:
      - "8081:8081"
    environment:
      REDIS_HOSTS: local:redis:6379
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - launchlayer-network

  # ==========================================================================
  # Management API (optional - can run locally)
  # ==========================================================================
  api-management:
    build:
      context: .
      dockerfile: apps/api-management/Dockerfile
    container_name: launchlayer-api-management
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/featureflags
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: local-dev-secret-change-in-production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - launchlayer-network
    profiles:
      - full

  # ==========================================================================
  # Read API (optional - can run locally)
  # ==========================================================================
  api-read:
    build:
      context: .
      dockerfile: apps/api-read/Dockerfile
    container_name: launchlayer-api-read
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: development
      PORT: 3001
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/featureflags
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - launchlayer-network
    profiles:
      - full

volumes:
  postgres_data:
  redis_data:

networks:
  launchlayer-network:
    driver: bridge
