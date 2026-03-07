# 🏷 LaunchLayer — Feature Flags Platform

> A production-grade, self-hosted feature flag management platform built for engineering teams who need full control over how features are released — with real-time flag evaluation, multi-environment targeting, A/B testing, and an AWS-native cloud infrastructure.

---

## 📌 Problem Statement

Engineering teams deploying software continuously face a critical challenge: how do you ship code safely without risking production stability? Traditional deployment strategies force an all-or-nothing choice — either a feature is live for every user, or it isn't deployed at all. This leads to high-risk big-bang releases, painful rollbacks, and no mechanism to test features on a subset of users before full rollout.

**LaunchLayer** solves this by decoupling feature deployment from feature activation. Developers can merge and deploy code freely while keeping features hidden behind flags that can be turned on per environment, per user segment, or via percentage rollout — all without touching a single line of code or redeploying the application. It targets engineering teams (from startups to enterprises) who want the power of a platform like LaunchDarkly but with the flexibility and ownership of a self-hosted solution.

---

## 🎯 Project Goals

- **Decouple deployment from release** — ship code anytime, activate features on your schedule
- **Serve low-latency flag evaluations** — a dedicated read API backed by Redis caching and Server-Sent Events ensures flags are evaluated in milliseconds without hitting the database on every request
- **Support multi-environment workflows** — manage flags independently across `development`, `staging`, and `production` with environment-level protection and approval gates
- **Enable advanced targeting** — target users via whitelists/blacklists, attribute-based rules (country, plan, beta opt-in), and deterministic percentage rollouts without sampling bias
- **Provide full auditability** — every flag change, member invitation, and API key rotation is logged with actor, source, before/after state, and severity level
- **Ship with production-ready AWS infrastructure** — the entire cloud stack (VPC, ECS Fargate, RDS, ElastiCache, EventBridge, SNS/SQS, CloudFront, Cognito, SES) is defined as code with AWS CDK and deployed via an automated CodePipeline

---

## 🛠 Tech Stack

### Frontend
| Technology | Role |
|---|---|
| Next.js 14 (App Router) | Dashboard SPA framework |
| React 18 | UI rendering |
| TypeScript | Static typing |
| Tailwind CSS | Utility-first styling |
| Radix UI | Accessible, headless UI primitives (Dialog, Select, Switch, Tabs, Toast, etc.) |
| Framer Motion | Animations and page transitions |
| TanStack React Query v5 | Server state management and data fetching |
| TanStack React Table v8 | Data tables with sorting and pagination |
| Zustand | Global client state management |
| React Hook Form + Zod | Form handling and schema validation |
| AWS Amplify v6 | Cognito authentication flows (login, register, verify, forgot password) |
| Axios | HTTP client for API communication |
| Recharts | Data visualization and charts |
| Sonner | Toast notification system |
| Lucide React | Icon library |
| class-variance-authority + clsx | Component variant styling |
| date-fns | Date formatting utilities |
| Playwright | End-to-end testing |
| Jest + Testing Library | Unit and component testing |

### Backend
| Technology | Role |
|---|---|
| NestJS | Framework for both `api-management` and `api-read` microservices |
| TypeScript | Static typing |
| Prisma ORM | Database access and schema management |
| Passport.js | Authentication middleware (JWT strategy + Cognito strategy) |
| @nestjs/jwt | JWT token generation and validation |
| AWS SDK v3 | Cognito, EventBridge, SNS, SES integrations |
| ioredis | Redis client for caching and pub/sub messaging |
| Swagger / OpenAPI | Auto-generated API documentation |
| class-validator + class-transformer | DTO validation |
| RxJS | Reactive extensions |
| uuid | UUID generation for SSE connection IDs |

### Database
| Technology | Role |
|---|---|
| PostgreSQL 16 | Primary relational database (via AWS RDS in production) |
| Redis 7 | Caching layer and pub/sub message broker (via AWS ElastiCache) |
| Prisma | ORM, migrations, and database seeding |

### Infrastructure / DevOps
| Technology | Role |
|---|---|
| AWS CDK v2 | Infrastructure as Code for all cloud resources |
| AWS ECS Fargate | Containerized deployment for both backend APIs |
| AWS RDS (PostgreSQL) | Managed relational database |
| AWS ElastiCache (Redis) | Managed Redis cluster |
| AWS EventBridge | Event bus for inter-service communication in production |
| AWS SNS + SQS | Fan-out messaging between management and read services |
| AWS S3 + CloudFront | Static hosting and CDN for the Next.js dashboard |
| AWS Cognito | User authentication and identity management |
| AWS SES | Transactional email delivery (invitations, notifications) |
| AWS CodePipeline + CodeBuild | CI/CD pipeline triggered by GitHub webhooks |
| AWS ECR | Docker image registry for both API services |
| AWS Secrets Manager | Secure storage for database credentials and tokens |
| AWS Route 53 + ACM | Custom domain and SSL certificate management |
| Docker + Docker Compose | Local development environment |
| GitHub Actions | Deployment automation (`.github/workflows/deploy.yml`) |
| Turborepo | Monorepo build orchestration with task caching |

### Other Tools
| Technology | Role |
|---|---|
| Husky + lint-staged | Git pre-commit hooks for code quality |
| ESLint | Linting with security, import order, and React rules |
| Prettier | Code formatting |
| dotenv-cli | Environment variable management |

---

## 🖥 Features

### Management API (`apps/api-management` — port 3000)

**Authentication (`/auth`)**
- Cognito JWT validation via Passport.js strategy with `CognitoStrategy` and `JwtStrategy`
- Local JWT generation for development without Cognito configured
- Auto-provisioning: new Cognito users are created or linked to existing database users on first login
- `POST /auth/local` — create local dev user and return access token (disabled when Cognito is configured)

**Feature Flags (`/projects/:projectId/flags`)**
- `POST /` — create a new flag with type (`BOOLEAN`, `NUMBER`, `MULTIVARIATE`), lifecycle (`PERMANENT`, `TEMPORARY`, `EXPERIMENT`, `KILL_SWITCH`, `OPERATIONAL`), tags, and category
- `GET /` — list all flags with optional filters: `includeArchived`, `tags[]`, `search`
- `GET /:flagId` — retrieve a flag by ID with all environment states
- `GET /key/:key` — retrieve a flag by its string key
- `GET /:flagId/environments/:envId` — get flag state for a specific environment
- `GET /:flagId/environments/:envId/history` — retrieve full configuration history for versioned rollback
- `PUT /:flagId` — update flag metadata (title, description, tags, lifecycle)
- `PATCH /:flagId/environments/:envId/state` — enable or disable a flag in a specific environment
- `PUT /:flagId/environments/:envId/rules` — update targeting rules: whitelist/blacklist entity lists, attribute-match conditions, percentage rollout with deterministic SHA-256 hashing
- `POST /:flagId/environments/:envId/whitelist` — add entity IDs to the explicit allow list
- `POST /:flagId/environments/:envId/blacklist` — add entity IDs to the explicit deny list
- `POST /:flagId/copy` — copy flag configuration from one environment to another
- `POST /:flagId/environments/:envId/rollback` — rollback flag to a specific historical version
- `DELETE /:flagId` — delete a flag and all its environment states

**Multivariate Flag Support**
- Variants with weighted distribution (e.g., control 50%, variant-A 25%, variant-B 25%) for A/B and multi-arm experiments
- Variant values support arbitrary JSON payloads (`{ layout: 'vertical', showAnnual: false }`)

**Environments (`/projects/:projectId/environments`)**
- CRUD operations for environment management
- Environment types: `DEVELOPMENT`, `STAGING`, `PRODUCTION`
- Protected environments requiring approval before flag changes
- Per-environment color coding and sort ordering

**Project Members (`/projects/:projectId/members`)**
- Role-based access control with four roles: `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`
- `POST /invite` — invite a user by email; creates Cognito account if user doesn't exist, generates 72-hour invitation token, triggers SES email
- `GET /invitations` — list all pending invitations
- `POST /invitations/:invitationId/resend` — resend with a new token and extended expiry
- `DELETE /invitations/:invitationId` — cancel a pending invitation
- `PUT /:userId/role` — update a member's role (Admin+ only, cannot assign OWNER)
- `DELETE /:userId` — remove a member from the project
- `POST /invitations/accept` (public controller) — accept an invitation using the emailed token, validates email match

**API Key Management (`/projects/:projectId/api-keys`)**
- `POST /` — create scoped API keys (READ_ONLY or READ_WRITE) with optional rate limit, IP whitelist, and expiry date; the full key is only shown once at creation
- `GET /` — list all API keys (keys are masked with prefix only)
- `GET /environment/:envId` — list keys scoped to a specific environment
- `GET /:id` — retrieve a single key's metadata
- `PUT /:id` — update key settings (name, scope, rate limit, IP whitelist, expiry)
- `POST /:id/rotate` — generate a new key value while preserving settings; old key invalidated immediately
- `POST /:id/revoke` — deactivate a key (kept in DB for audit purposes)
- `DELETE /:id` — permanently delete an API key

**Projects (`/projects`)**
- Full project lifecycle management with billing plan support (`FREE`, `PRO`, `ENTERPRISE`)
- Flag count tracking, max flag limits, and project-level settings
- Team ownership model with cascading permissions

**Event System**
- In production: events published to AWS EventBridge with SNS fan-out to SQS queues for async processing
- In development: events published to Redis Pub/Sub channels (`flag_updates`, `env_updates`, `cache_invalidation`)
- Real-time flag update broadcasting via Redis for Server-Sent Events subscribers

**Audit Log**
- Every write operation produces an `AuditLog` entry with: actor (user or API key), action string, target type/ID/name, before/after state JSON, source (`WEB`, `API`, `SDK`, `SYSTEM`), status, severity (`INFO`, `WARNING`, `ERROR`, `CRITICAL`)

**Global Middleware**
- `AllExceptionsFilter` — structured error responses for all unhandled exceptions
- `TransformInterceptor` — consistent response envelope for all endpoints
- `LoggingInterceptor` — per-request structured logging with duration

---

### Read API (`apps/api-read` — port 3001)

**Flag Evaluation (`/eval`)**
- API key guard validates the `ll_`-prefixed key against a SHA-256 hash stored in the database, resolves the project and environment context
- `GET /eval/:flagKey?entityId=xxx&attr_country=FR` — evaluate a single flag; attributes passed as `attr_`-prefixed query parameters
- `POST /eval/:flagKey` — evaluate a single flag with complex attribute objects in the request body
- `GET /eval?entityId=xxx` — evaluate all active flags for an entity in one request
- `POST /eval` — evaluate a subset of flags or all flags for an entity
- `POST /eval/batch` — evaluate one flag for multiple entities simultaneously (parallel execution)
- `GET /eval/flags/all` — retrieve all raw flag states for SDK bootstrap/local caching

**Rule Evaluation Engine (`@repo/shared`)**
- Priority-ordered evaluation: `entityList` (whitelist/blacklist) → `attributeMatch` → `percentage` → `default`
- Attribute operators: `EQ`, `NEQ`, `IN`, `NOT_IN`, `GT`, `GTE`, `LT`, `LTE`, `CONTAINS`, `NOT_CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `REGEX`, `EXISTS`, `NOT_EXISTS`
- Deterministic percentage rollout using SHA-256 hash of `salt:entityId:flagKey` — same entity always gets the same result
- Result sources: `WHITELIST`, `BLACKLIST`, `ATTRIBUTE`, `PERCENTAGE`, `DEFAULT`

**Real-time Updates (`/sse`)**
- `GET /sse/subscribe?apiKey=xxx` — subscribe to flag changes via Server-Sent Events (long-lived HTTP connection)
- Supports reconnection with `lastEventId` to replay missed events
- `GET /sse/stats` — active connection count and metrics
- nginx buffering disabled (`X-Accel-Buffering: no`) for real-time streaming

**Redis Caching (`CacheService`)**
- Flag states cached in Redis to avoid database queries on every evaluation
- Cache invalidated when management API publishes flag update events via Redis pub/sub

---

### Dashboard (`apps/dashboard` — port 3002)

**Marketing Pages (`/(marketing)`)**
- Public landing page at `/`

**Authentication (`/auth`)**
- `/auth/login` — email/password sign-in via AWS Amplify and Cognito
- `/auth/register` — account registration with password requirements (12+ chars, upper, lower, number, special)
- `/auth/verify` — email verification code entry
- `/auth/forgot-password` — password reset flow

**Main Dashboard (`/dashboard`)**
- Stats overview: total projects, active flags, team members, evaluations per day
- Real-time activity feed showing flag changes, member invites, and schedule events with relative timestamps
- Top flags ranked by evaluation count with progress bars
- Quick action cards: Create Flag, New Project, Invite Member, View Logs

**Project Management (`/dashboard/projects`)**
- `/dashboard/projects` — paginated project list
- `/dashboard/projects/new` — project creation form
- `/dashboard/projects/:id` — project detail view with flags and team overview

**Flag Management**
- Full CRUD interface for flags via `flagsApi` service (`src/services/flags.ts`)
- Per-environment toggle switches
- Targeting rules editor (whitelist, blacklist, attribute conditions, rollout percentage)

**Segment Management**
- Reusable user segments defined by rule sets (e.g., `beta-users` matching `beta_optin=true AND email_verified=true`)
- Support for `ALL` (AND) and `ANY` (OR) match strategies

**Schedule Management**
- Time-based flag activation scheduling via `schedulesApi` (`src/services/schedules.ts`)

**API Key Management**
- View, create, rotate, and revoke API keys per environment via `apiKeysApi` (`src/services/api-keys.ts`)

**Team Management**
- Member list, role management, invitation sending, and invitation resend via `membersApi` (`src/services/members.ts`)

**Audit Log Viewer**
- Paginated audit trail via `auditLogsApi` (`src/services/audit-logs.ts`)

---

## 📷 Screenshots

> 🖼 Screenshots coming soon — run the project locally to see it in action.

---

## 🔗 Live Demo

> 🌐 Live demo: [URL here]
> 📡 API docs: [URL here] (Swagger UI available at `/api/docs` on the management API)

---

## ⚙ Installation & Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker and Docker Compose
- AWS CLI (for production deployment)

### 1. Clone the repository

```bash
git clone https://github.com/Diderot-sielinou/feature-flags-platform.git
cd feature-flags-platform
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env` files for each app. Use the following as a reference:

**`apps/api-management/.env`**
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://ffuser:ffpassword@localhost:5433/featureflags?schema=public
DB_HOST=localhost
DB_PORT=5433
DB_NAME=featureflags
DB_USERNAME=ffuser
DB_PASSWORD=ffpassword

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=
REDIS_TLS=false

# AWS General
AWS_REGION=us-east-1

# AWS Cognito (leave empty to use local JWT mode in development)
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=

# AWS Messaging (leave empty in development — Redis is used instead)
EVENT_BUS_NAME=feature-flags-bus
FLAG_TOPIC_ARN=
READ_QUEUE_URL=

# AWS SES (emails disabled in development by default)
EMAIL_ENABLED=false
SES_SENDER_EMAIL=noreply@launchlayer.io
SES_SENDER_NAME=LaunchLayer
SES_CONFIGURATION_SET=feature-flags-emails
SES_REPLY_TO_EMAIL=

# App URLs
DASHBOARD_URL=http://localhost:3002
DOCS_URL=http://localhost:3002/docs
API_URL=http://localhost:3000

# JWT (for local development without Cognito)
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=1h

# CORS
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=debug
```

**`apps/api-read/.env`**
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://ffuser:ffpassword@localhost:5433/featureflags?schema=public
REDIS_HOST=localhost
REDIS_PORT=6380
AWS_REGION=us-east-1
```

**`apps/dashboard/.env.local`**
```env
# Leave empty to use local auth bypass in development
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_CLIENT_ID=

# Management API base URL
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 4. Start local infrastructure (PostgreSQL + Redis)

```bash
npm run docker:up
```

This starts:
- PostgreSQL 16 on port `5433`
- Redis 7 on port `6380`
- Redis Commander UI on port `8081`

### 5. Run database migrations and seed

```bash
npm run db:migrate:dev
npm run db:generate
```

To seed with demo data (users, project, environments, flags, segments, API keys):

```bash
cd packages/database && npx prisma db seed
```

### 6. Run in development mode

Run all apps in parallel:

```bash
npm run dev
```

Or run specific apps:

```bash
# Management API only
npm run dev:api-manage

# All APIs
npm run dev:api

# Dashboard only
npm run dev:dashboard
```

Services will be available at:
- Management API: `http://localhost:3000`
- Read API: `http://localhost:3001`
- Dashboard: `http://localhost:3002`
- Swagger (API docs): `http://localhost:3000/api/docs`

### 7. Run in production mode (Docker)

```bash
npm run docker:rebuild
```

### 8. Deploy to AWS (production)

Bootstrap the CDK environment (first time only):

```bash
npm run infra:bootstrap
```

Deploy all stacks:

```bash
npm run infra:deploy
```

This provisions: VPC, ECS Fargate clusters, RDS PostgreSQL, ElastiCache Redis, EventBridge, SNS, SQS, S3 + CloudFront (dashboard), Cognito User Pool, SES, and the CodePipeline CI/CD pipeline.

### Additional commands

```bash
# Run all tests
npm run test

# Run linting
npm run lint

# Type checking
npm run type-check

# Format code
npm run format

# Clean all node_modules and build artifacts
npm run clean

# Tear down AWS infrastructure
npm run infra:destroy
```

---

## 🧠 Challenges Faced

**1. Designing the CQRS-style split between read and write APIs**
Separating the management API (writes, auth, business rules) from the read API (high-frequency flag evaluations) required carefully designing the event propagation layer. Getting Redis pub/sub to work as a development substitute for EventBridge+SNS while keeping the production code path identical — without environment-specific branching scattered across the codebase — took significant architectural thought. The `EventsService` cleanly handles this with a single `emit()` method that routes based on `NODE_ENV`.

**2. Building a deterministic, bias-free percentage rollout**
A naive `Math.random()` approach would produce different results on every call for the same user, breaking gradual rollouts and making debugging impossible. The solution uses a deterministic SHA-256 hash of `salt:entityId:flagKey`, taking the first 8 hex characters and mapping them to a 0–100 range. This ensures the same user always falls in or out of a rollout consistently, across all API instances, without any shared state.

**3. AWS Cognito + local development JWT interoperability**
Cognito tokens use RS256 and require network calls to the User Pool's JWKS endpoint for validation. During development without internet access or a configured User Pool, this would break everything. The `AuthService` handles this by detecting whether `COGNITO_USER_POOL_ID` is set: if not, it falls back to a local `HS256` JWT strategy and even allows creating local users via `POST /auth/local`. This made the development loop significantly faster.

**4. Real-time flag updates with Server-Sent Events at scale**
SSE connections are long-lived HTTP connections that need to survive server restarts, load balancer timeouts, and network interruptions. The `SSEService` manages connection pools per project+environment, broadcasts events received from Redis pub/sub, and supports reconnection via `lastEventId`. Disabling nginx buffering (`X-Accel-Buffering: no`) was a non-obvious requirement to prevent events from being batched before delivery.

**5. Monorepo tooling and shared package boundaries**
With five packages (`@repo/database`, `@repo/shared`, `@repo/sdk`, `@repo/ui`, `@repo/eslint-config`, `@repo/typescript-config`) consumed by three apps with different runtime environments (Node.js for NestJS, Edge/browser for Next.js), getting TypeScript path resolution, ESM/CommonJS interoperability, and Turborepo task ordering correct required careful `tsconfig.json` layering and explicit `exports` fields in each package's `package.json`.

---

## 📚 What I Learned

**1. Event-driven architecture with AWS EventBridge and SNS/SQS fan-out**
Building the production messaging layer exposed the practical differences between EventBridge (routing, filtering), SNS (fan-out, topic-based push), and SQS (reliable, ordered delivery). Learning when to use each service and how to compose them for different consumer patterns (SSE for real-time UI updates, SQS for async analytics processing) was a core architectural lesson.

**2. Infrastructure as Code with AWS CDK**
Writing CDK stacks (`NetworkStack`, `DatabaseStack`, `MessagingStack`, `ComputeStack`, `DashboardStack`, `PipelineStack`) teaches cloud architecture in a way that console clicks never do. Every dependency — security groups, IAM roles, VPC subnets, environment variables injected from Secrets Manager — must be explicit. The CDK's cross-stack references and output exports also enforce thinking about stack boundaries and deployment order.

**3. NestJS module architecture and dependency injection at scale**
Building a production-grade NestJS application with nine feature modules (`AuthModule`, `FlagsModule`, `ProjectsModule`, `EnvironmentsModule`, `MembersModule`, `ApiKeysModule`, `EventsModule`, `RedisModule`, `DatabaseModule`) taught the value of the IoC container for managing cross-cutting concerns: global guards, interceptors, filters, and shared services without tight coupling.

**4. Prisma schema design for complex domain models**
Modeling the relationships between `User`, `Project`, `ProjectMember`, `Environment`, `Flag`, `FlagEnvironmentState`, `FlagVariant`, `FlagHistory`, `Segment`, `ApiKey`, `Invitation`, and `AuditLog` — with composite unique keys, JSON fields for rules and metadata, and enum types — demonstrated how ORM schema decisions cascade into query complexity and API design.

**5. Implementing a rule evaluation engine from scratch**
Writing the `evaluateRuleSet` and `evaluateCondition` functions in `@repo/shared` required reasoning about evaluation order, short-circuit logic, operator semantics, and edge cases (null attributes, invalid regex patterns, numeric comparisons on non-numbers). Shipping this as a shared package consumed by both the backend and potentially the SDK reinforced the value of zero-dependency pure utility libraries.

**6. Turborepo monorepo orchestration**
Managing parallel builds, task dependencies (`build` depends on `@repo/shared#build`), and incremental caching across five packages and three apps showed how Turborepo's task graph eliminates redundant work. Understanding pipeline configuration, filter flags, and the difference between `--parallel` and dependency ordering is essential for monorepo productivity.

---

## 🚀 Future Improvements

**1. Client SDK with local evaluation and streaming**
The `packages/sdk` package is scaffolded but not yet implemented. The next step is building a TypeScript SDK that bootstraps all flags on initialization, subscribes to the SSE endpoint for real-time updates, and evaluates flags locally using the shared rule engine — eliminating network latency from hot paths entirely.

**2. Analytics pipeline for flag evaluation metrics**
An SQS queue (`feature-flags-analytics-queue`) is already provisioned in the infrastructure. Connecting it to a Lambda consumer that writes evaluation data to a time-series store (DynamoDB or Timestream) would enable the dashboard to display real evaluation counts, rollout progress, and variant distribution — replacing the current mock data in `DashboardPage`.

**3. Scheduled flag activations**
The `schedulesApi` service and schedules types exist in the frontend but the backend module is not yet implemented. Building a `SchedulesModule` with a cron-based job runner (using `@nestjs/schedule`) would allow time-based flag activation — essential for timed promotions, maintenance windows, and experiment start/end dates.

**4. Approval workflows for production flag changes**
The `requireApproval` field already exists on environments in the schema. Implementing an approval flow where flag changes to protected environments create a pending `ChangeRequest` record, notify admins via email, and require an explicit approval before the change is applied would significantly reduce the risk of accidental production incidents.

**5. Multi-tenancy and organization-level billing**
The current model has projects owned by individual users. Introducing an `Organization` entity above `Project` would enable team-level billing plans, SSO configuration, cross-project analytics, and organization-wide API key management — the foundational change needed to offer this as a SaaS product.

---

## 👨🏽‍💻 Author

**Diderot Sielinou**
Fullstack JavaScript Developer
📩 diderotsielinou@gmail.com
🌍 Based in Cameroon | Open to remote opportunities
🔗 [LinkedIn](https://linkedin.com/in/diderot-sielinou-930905266)
🐙 [GitHub](https://github.com/Diderot-sielinou)
