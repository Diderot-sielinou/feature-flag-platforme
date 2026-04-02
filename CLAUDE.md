# CLAUDE.md — LaunchLayer Feature Flags Platform

## Project Overview

LaunchLayer is a self-hosted feature flag management platform. It enables engineering teams to decouple code deployment from feature activation with real-time evaluation, multi-environment targeting, A/B testing, and full auditability.

## Tech Stack

- **Frontend (Dashboard):** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Radix UI, TanStack React Query v5, Zustand, React Hook Form + Zod, AWS Amplify v6 (Cognito auth)
- **Backend:** NestJS 11 (two microservices), TypeScript, Prisma ORM, Passport.js + JWT, AWS SDK v3
- **Database:** PostgreSQL 16, Redis 7
- **Infrastructure:** AWS CDK v2, ECS Fargate, RDS, ElastiCache, EventBridge, S3 + CloudFront, Cognito
- **Monorepo:** Turborepo, npm workspaces, Docker Compose for local dev
- **CI/CD:** GitHub Actions, AWS CodePipeline + CodeBuild

## Project Structure

```
apps/
  api-management/    # Write API (NestJS, port 3000)
  api-read/          # Read API (NestJS, port 3001) — cache-optimized flag evaluation
  dashboard/         # Admin dashboard (Next.js, port 3002)
  docs/              # Documentation site (Next.js)
  web/               # Landing/marketing page (Next.js)
packages/
  database/          # Prisma schema, migrations, client
  shared/            # Types, constants, utilities (@repo/shared)
  sdk/               # Client SDK for flag evaluation
  ui/                # Shared React UI components
  eslint-config/     # Shared ESLint rules
  typescript-config/ # Shared TypeScript config
infrastructure/      # AWS CDK stacks
docker/              # Docker Compose + Dockerfiles
```

## Key Commands

```bash
# Development
npm run dev                # All services in parallel
npm run dev:api            # API services only
npm run dev:dashboard      # Dashboard only
npm run docker:up          # Start postgres, redis, APIs via Docker Compose
npm run docker:down        # Stop containers

# Build & Quality
npm run build              # Full monorepo build
npm run test               # Run all tests
npm run lint               # ESLint check
npm run lint:fix           # Fix lint issues
npm run type-check         # TypeScript type checking
npm run format             # Prettier format

# Database (Prisma)
npm run db:generate        # Generate Prisma Client
npm run db:migrate:dev     # Create/apply migrations (dev)
npm run db:migrate:prod    # Apply migrations (prod)
npm run db:studio          # Open Prisma Studio UI

# Infrastructure (AWS CDK)
npm run infra:deploy       # Deploy all stacks
npm run infra:diff         # Show deployment diff
npm run infra:destroy      # Destroy all stacks

# CI
npm run ci:check           # lint + test + build
```

## Architecture

- **Microservices:** Management API (write-heavy, auth-required) and Read API (read-optimized, <50ms P99 evaluation)
- **2-tier caching:** Redis (L1) → PostgreSQL (L2), with configurable TTL strategies
- **Evaluation engine:** Priority order — entityList → attributeMatch → percentage → default. Deterministic rollouts via SHA-256 hashing
- **Events:** Redis Pub/Sub (dev), AWS EventBridge + SNS/SQS (prod)
- **Auth:** Cognito in production (JWKS), local JWT in dev (set `JWT_SECRET`). Cognito disabled by default in dev
- **RBAC:** Project-level roles — OWNER, ADMIN, EDITOR, VIEWER

## Coding Conventions

- **TypeScript:** Strict mode, ES2022 target, Bundler module resolution
- **Prettier:** 100 char width, 2 spaces, trailing commas, LF line endings
- **NestJS patterns:** Module-based (module → controller → service → DTOs). Guards for auth, decorators for metadata, global exception filter + transform interceptor
- **File naming:** `{name}.module.ts`, `{name}.controller.ts`, `{name}.service.ts`, `{name}.dto.ts`
- **Case:** PascalCase (types/enums), camelCase (vars/functions), UPPER_SNAKE_CASE (constants)
- **Tests:** `*.spec.ts` co-located with source, Playwright for dashboard E2E
- **Pre-commit hooks:** Husky runs ESLint --fix + Prettier --write on `*.{ts,tsx,js,jsx,json,md}`
- **Packages prefix:** `@repo/*` for shared workspace packages

## Important Notes

- Always run `npm run db:generate` after installing dependencies
- Shared packages (`@repo/shared`, `@repo/database`) must build before APIs
- Use `.env.local` for development overrides
- Swagger docs available at `/api/docs` in non-production environments
- Redis Commander available at `localhost:8081` when Docker Compose is running
- Skip Turbo cache with `turbo run <task> --force`
