-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('DEVELOPMENT', 'STAGING', 'QA', 'PRODUCTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('READ_ONLY', 'WRITE', 'ADMIN');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('BOOLEAN', 'MULTIVARIATE', 'STRING', 'NUMBER', 'JSON');

-- CreateEnum
CREATE TYPE "FlagLifecycle" AS ENUM ('PERMANENT', 'TEMPORARY', 'EXPERIMENT', 'KILL_SWITCH', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "CacheStrategy" AS ENUM ('NO_CACHE', 'STANDARD', 'AGGRESSIVE', 'EDGE');

-- CreateEnum
CREATE TYPE "SnapshotType" AS ENUM ('MANUAL', 'AUTO', 'SCHEDULED', 'PRE_DEPLOY');

-- CreateEnum
CREATE TYPE "ScheduleAction" AS ENUM ('ENABLE', 'DISABLE', 'UPDATE_RULES', 'DELETE');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USER', 'ORGANIZATION', 'DEVICE', 'SERVICE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'API_KEY', 'SYSTEM', 'WEBHOOK', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('AUTHENTICATION', 'AUTHORIZATION', 'PROJECT_CHANGE', 'FLAG_CHANGE', 'ENVIRONMENT_CHANGE', 'ENTITY_CHANGE', 'API_KEY_CHANGE', 'USER_MANAGEMENT', 'CONFIGURATION', 'SECURITY');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('WEB', 'API', 'SDK', 'CLI', 'MOBILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL', 'ALERT');

-- CreateEnum
CREATE TYPE "WebhookEvent" AS ENUM ('FLAG_CREATED', 'FLAG_UPDATED', 'FLAG_DELETED', 'FLAG_TOGGLED', 'ENVIRONMENT_CREATED', 'PROJECT_CREATED', 'SEGMENT_CREATED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('SUCCESS', 'FAILED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "cognitoId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatar" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "locale" TEXT DEFAULT 'en',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "tags" TEXT[],
    "ownerId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "maxFlags" INTEGER DEFAULT 100,
    "currentFlagCount" INTEGER NOT NULL DEFAULT 0,
    "billingPlan" "BillingPlan" NOT NULL DEFAULT 'FREE',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'VIEWER',
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "EnvironmentType" NOT NULL DEFAULT 'DEVELOPMENT',
    "description" TEXT,
    "color" TEXT,
    "baseUrl" TEXT,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "envId" TEXT,
    "key" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "ApiKeyScope" NOT NULL DEFAULT 'READ_ONLY',
    "rateLimit" INTEGER DEFAULT 1000,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "ipWhitelist" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "rotatedFrom" TEXT,
    "rotatedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flags" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "FlagType" NOT NULL DEFAULT 'BOOLEAN',
    "title" TEXT,
    "description" TEXT,
    "tags" TEXT[],
    "category" TEXT,
    "ownerId" TEXT,
    "lifecycle" "FlagLifecycle" NOT NULL DEFAULT 'PERMANENT',
    "status" "FlagStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "temporary" BOOLEAN NOT NULL DEFAULT false,
    "maintainer" TEXT,
    "jiraTicket" TEXT,
    "docsUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_environment_states" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "envId" TEXT NOT NULL,
    "defaultState" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL,
    "rulesHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "offVariation" TEXT,
    "fallbackValue" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER DEFAULT 100,
    "evaluationCount" INTEGER NOT NULL DEFAULT 0,
    "lastEvaluatedAt" TIMESTAMP(3),
    "avgEvaluationMs" DOUBLE PRECISION,
    "cacheStrategy" "CacheStrategy" NOT NULL DEFAULT 'STANDARD',
    "cacheTTL" INTEGER DEFAULT 300,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastModifiedBy" TEXT,

    CONSTRAINT "flag_environment_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_state_snapshots" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "defaultState" BOOLEAN NOT NULL,
    "rules" JSONB NOT NULL,
    "snapshotType" "SnapshotType" NOT NULL,
    "createdBy" TEXT NOT NULL,
    "reason" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flag_state_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_variants" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flag_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_segments" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "variation" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flag_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_schedules" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "envId" TEXT NOT NULL,
    "action" "ScheduleAction" NOT NULL,
    "targetState" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flag_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "EntityType" NOT NULL DEFAULT 'USER',
    "attributes" JSONB NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "country" TEXT,
    "plan" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "segmentKeys" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "category" "AuditCategory" NOT NULL DEFAULT 'FLAG_CHANGE',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT,
    "envId" TEXT,
    "envName" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "diff" JSONB,
    "payload" JSONB,
    "requestId" TEXT,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "source" "AuditSource" NOT NULL DEFAULT 'WEB',
    "method" TEXT,
    "path" TEXT,
    "status" "AuditStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "reason" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "events" "WebhookEvent"[],
    "secret" TEXT NOT NULL,
    "headers" JSONB,
    "retryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeout" INTEGER NOT NULL DEFAULT 5000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "lastStatus" "WebhookStatus",
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_cognitoId_key" ON "users"("cognitoId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_cognitoId_idx" ON "users"("cognitoId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_key_key" ON "projects"("key");

-- CreateIndex
CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");

-- CreateIndex
CREATE INDEX "projects_key_idx" ON "projects"("key");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_ownerId_name_key" ON "projects"("ownerId", "name");

-- CreateIndex
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateIndex
CREATE INDEX "project_members_projectId_role_idx" ON "project_members"("projectId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE INDEX "environments_projectId_idx" ON "environments"("projectId");

-- CreateIndex
CREATE INDEX "environments_projectId_type_idx" ON "environments"("projectId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "environments_projectId_key_key" ON "environments"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_envId_idx" ON "api_keys"("envId");

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_active_expiresAt_idx" ON "api_keys"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "flags_projectId_idx" ON "flags"("projectId");

-- CreateIndex
CREATE INDEX "flags_projectId_status_idx" ON "flags"("projectId", "status");

-- CreateIndex
CREATE INDEX "flags_lifecycle_idx" ON "flags"("lifecycle");

-- CreateIndex
CREATE INDEX "flags_expiresAt_idx" ON "flags"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "flags_projectId_key_key" ON "flags"("projectId", "key");

-- CreateIndex
CREATE INDEX "flag_environment_states_flagId_idx" ON "flag_environment_states"("flagId");

-- CreateIndex
CREATE INDEX "flag_environment_states_envId_idx" ON "flag_environment_states"("envId");

-- CreateIndex
CREATE INDEX "flag_environment_states_enabled_idx" ON "flag_environment_states"("enabled");

-- CreateIndex
CREATE INDEX "flag_environment_states_envId_enabled_idx" ON "flag_environment_states"("envId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "flag_environment_states_flagId_envId_key" ON "flag_environment_states"("flagId", "envId");

-- CreateIndex
CREATE INDEX "flag_state_snapshots_stateId_createdAt_idx" ON "flag_state_snapshots"("stateId", "createdAt");

-- CreateIndex
CREATE INDEX "flag_state_snapshots_stateId_version_idx" ON "flag_state_snapshots"("stateId", "version");

-- CreateIndex
CREATE INDEX "flag_variants_flagId_idx" ON "flag_variants"("flagId");

-- CreateIndex
CREATE INDEX "flag_variants_flagId_active_idx" ON "flag_variants"("flagId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "flag_variants_flagId_key_key" ON "flag_variants"("flagId", "key");

-- CreateIndex
CREATE INDEX "segments_projectId_idx" ON "segments"("projectId");

-- CreateIndex
CREATE INDEX "segments_projectId_active_idx" ON "segments"("projectId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "segments_projectId_key_key" ON "segments"("projectId", "key");

-- CreateIndex
CREATE INDEX "flag_segments_stateId_idx" ON "flag_segments"("stateId");

-- CreateIndex
CREATE INDEX "flag_segments_segmentId_idx" ON "flag_segments"("segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "flag_segments_stateId_segmentId_key" ON "flag_segments"("stateId", "segmentId");

-- CreateIndex
CREATE INDEX "flag_schedules_flagId_scheduledAt_idx" ON "flag_schedules"("flagId", "scheduledAt");

-- CreateIndex
CREATE INDEX "flag_schedules_status_scheduledAt_idx" ON "flag_schedules"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "flag_schedules_envId_scheduledAt_idx" ON "flag_schedules"("envId", "scheduledAt");

-- CreateIndex
CREATE INDEX "entities_projectId_idx" ON "entities"("projectId");

-- CreateIndex
CREATE INDEX "entities_projectId_type_idx" ON "entities"("projectId", "type");

-- CreateIndex
CREATE INDEX "entities_email_idx" ON "entities"("email");

-- CreateIndex
CREATE INDEX "entities_country_idx" ON "entities"("country");

-- CreateIndex
CREATE INDEX "entities_plan_idx" ON "entities"("plan");

-- CreateIndex
CREATE INDEX "entities_lastSeenAt_idx" ON "entities"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_requestId_key" ON "audit_logs"("requestId");

-- CreateIndex
CREATE INDEX "audit_logs_projectId_createdAt_idx" ON "audit_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_category_createdAt_idx" ON "audit_logs"("category", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX "audit_logs_sessionId_idx" ON "audit_logs"("sessionId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "webhooks_projectId_idx" ON "webhooks"("projectId");

-- CreateIndex
CREATE INDEX "webhooks_projectId_active_idx" ON "webhooks"("projectId", "active");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_envId_fkey" FOREIGN KEY ("envId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_environment_states" ADD CONSTRAINT "flag_environment_states_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_environment_states" ADD CONSTRAINT "flag_environment_states_envId_fkey" FOREIGN KEY ("envId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_state_snapshots" ADD CONSTRAINT "flag_state_snapshots_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "flag_environment_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_variants" ADD CONSTRAINT "flag_variants_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_segments" ADD CONSTRAINT "flag_segments_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "flag_environment_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_segments" ADD CONSTRAINT "flag_segments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_schedules" ADD CONSTRAINT "flag_schedules_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
