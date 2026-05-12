-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Domain" AS ENUM ('website_builder', 'document', 'web_research', 'data_transform');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('STARTED', 'PLANNING', 'BUILDING', 'VALIDATING', 'COMPLETED', 'FAILED', 'INTERRUPTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELED', 'EXPIRED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('RUN', 'TOKENS', 'STORAGE', 'API_CALL');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('USER_SUSPEND', 'USER_UNSUSPEND', 'USER_DELETE', 'USER_PLAN_CHANGE', 'USER_ROLE_CHANGE', 'RUN_CANCEL', 'TEMPLATE_APPROVE', 'TEMPLATE_REJECT', 'TEMPLATE_DELETE', 'CREDITS_GRANT');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('TOPUP', 'ADMIN_GRANT', 'PLAN_RENEWAL', 'LLM_USAGE', 'STORAGE', 'REFUND');

-- CreateEnum
CREATE TYPE "MemoryKind" AS ENUM ('PROMPT', 'RUN_SUMMARY', 'TEMPLATE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "parentId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "previousSessionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "aiRunId" TEXT,
    "prompt" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'STARTED',
    "currentStage" TEXT,
    "errorStage" TEXT,
    "finalError" TEXT,
    "validationStatus" TEXT,
    "validationScore" INTEGER,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "buildDurationSec" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "spec" JSONB,
    "runAudit" JSONB,
    "validationReport" JSONB,
    "generatedCode" TEXT,
    "outputPath" TEXT,
    "templateId" TEXT,
    "idempotencyKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "interruptedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "spec" JSONB,
    "result" JSONB,
    "semanticScore" DOUBLE PRECISION,
    "validationScore" DOUBLE PRECISION,
    "isValid" BOOLEAN,
    "templateId" TEXT,
    "templateUsed" TEXT,
    "sandboxOutput" JSONB,
    "error" TEXT,
    "repairAttempts" INTEGER NOT NULL DEFAULT 0,
    "logs" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extracted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment_refs" (
    "runId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_refs_pkey" PRIMARY KEY ("runId","attachmentId")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "Domain" NOT NULL,
    "spec" JSONB NOT NULL,
    "defaultPrompt" TEXT NOT NULL,
    "embeddingId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING',
    "forkedFromId" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "description" TEXT,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "maxConcurrentRuns" INTEGER NOT NULL DEFAULT 1,
    "maxStoredMB" INTEGER NOT NULL DEFAULT 50,
    "maxRunsPerDay" INTEGER NOT NULL DEFAULT 20,
    "priceUSDCents" INTEGER NOT NULL DEFAULT 0,
    "interval" "PlanInterval" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "features" JSONB NOT NULL,
    "priorityLevel" INTEGER NOT NULL DEFAULT 0,
    "canUseCustomTemplates" BOOLEAN NOT NULL DEFAULT false,
    "canUseApi" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_plans" (
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewsAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "user_plans_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "runId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" TEXT,
    "type" "UsageType" NOT NULL,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "filesGenerated" INTEGER NOT NULL DEFAULT 0,
    "storageBytes" INTEGER NOT NULL DEFAULT 0,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "type" "AdminActionType" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_points" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "MemoryKind" NOT NULL,
    "runId" TEXT,
    "collection" TEXT NOT NULL,
    "vectorId" TEXT NOT NULL,
    "preview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_hashedToken_key" ON "refresh_tokens"("hashedToken");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_previousSessionId_key" ON "sessions"("previousSessionId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_isArchived_idx" ON "sessions"("isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "runs_aiRunId_key" ON "runs"("aiRunId");

-- CreateIndex
CREATE INDEX "runs_userId_createdAt_idx" ON "runs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "runs_userId_status_idx" ON "runs"("userId", "status");

-- CreateIndex
CREATE INDEX "runs_userId_domain_idx" ON "runs"("userId", "domain");

-- CreateIndex
CREATE INDEX "runs_sessionId_idx" ON "runs"("sessionId");

-- CreateIndex
CREATE INDEX "runs_deletedAt_idx" ON "runs"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "runs_userId_idempotencyKey_key" ON "runs"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "agent_runs_runId_key" ON "agent_runs"("runId");

-- CreateIndex
CREATE INDEX "agent_runs_runId_idx" ON "agent_runs"("runId");

-- CreateIndex
CREATE INDEX "agent_runs_domain_idx" ON "agent_runs"("domain");

-- CreateIndex
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");

-- CreateIndex
CREATE INDEX "attachments_userId_idx" ON "attachments"("userId");

-- CreateIndex
CREATE INDEX "attachment_refs_attachmentId_idx" ON "attachment_refs"("attachmentId");

-- CreateIndex
CREATE INDEX "templates_userId_idx" ON "templates"("userId");

-- CreateIndex
CREATE INDEX "templates_domain_idx" ON "templates"("domain");

-- CreateIndex
CREATE INDEX "templates_isPublic_idx" ON "templates"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateIndex
CREATE INDEX "plans_tier_idx" ON "plans"("tier");

-- CreateIndex
CREATE INDEX "plans_active_idx" ON "plans"("active");

-- CreateIndex
CREATE INDEX "user_plans_planId_idx" ON "user_plans"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_planId_idx" ON "subscriptions"("planId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "credit_entries_userId_createdAt_idx" ON "credit_entries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_entries_runId_idx" ON "credit_entries"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_entries_runId_reason_key" ON "credit_entries"("runId", "reason");

-- CreateIndex
CREATE INDEX "usage_logs_userId_createdAt_idx" ON "usage_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "usage_logs_runId_idx" ON "usage_logs"("runId");

-- CreateIndex
CREATE INDEX "usage_logs_type_idx" ON "usage_logs"("type");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_actions_adminId_idx" ON "admin_actions"("adminId");

-- CreateIndex
CREATE INDEX "admin_actions_targetUserId_idx" ON "admin_actions"("targetUserId");

-- CreateIndex
CREATE INDEX "admin_actions_type_idx" ON "admin_actions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_revokedAt_idx" ON "api_keys"("revokedAt");

-- CreateIndex
CREATE INDEX "api_keys_expiresAt_idx" ON "api_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "memory_points_userId_kind_idx" ON "memory_points"("userId", "kind");

-- CreateIndex
CREATE INDEX "memory_points_runId_idx" ON "memory_points"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "memory_points_collection_vectorId_key" ON "memory_points"("collection", "vectorId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_previousSessionId_fkey" FOREIGN KEY ("previousSessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment_refs" ADD CONSTRAINT "attachment_refs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment_refs" ADD CONSTRAINT "attachment_refs_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_points" ADD CONSTRAINT "memory_points_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_points" ADD CONSTRAINT "memory_points_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
