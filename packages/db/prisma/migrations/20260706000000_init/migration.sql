-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REALTOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING', 'BLOCKED');

-- CreateEnum
CREATE TYPE "StatusChangeMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "ChangeSource" AS ENUM ('WEB', 'TELEGRAM_VOICE', 'TELEGRAM_TEXT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CommissionBase" AS ENUM ('REFUND_AMOUNT', 'CONSULTANT_FEE');

-- CreateEnum
CREATE TYPE "ExecutorPayoutType" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "PayoutRecipient" AS ENUM ('REALTOR', 'PLATFORM_AGENCY', 'EXECUTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "TelegramBindingKind" AS ENUM ('ADMIN', 'EXECUTOR', 'HANDOFF_CHANNEL');

-- CreateEnum
CREATE TYPE "VoiceCommandStatus" AS ENUM ('RECEIVED', 'TRANSCRIBED', 'PARSED', 'APPLIED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'REALTOR',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "inviteCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 50,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyName" TEXT,
    "city" TEXT,
    "telegramUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealtorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FnsCredential" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "loginCiphertext" BYTEA NOT NULL,
    "loginNonce" BYTEA NOT NULL,
    "passwordCiphertext" BYTEA NOT NULL,
    "passwordNonce" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FnsCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealStatus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "referralLinkId" TEXT,
    "statusId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "saleAmount" DECIMAL(14,2) NOT NULL,
    "taxPaidAmount" DECIMAL(14,2) NOT NULL,
    "consentNoUnderstatement" BOOLEAN NOT NULL,
    "consentPaymentTerms" BOOLEAN NOT NULL,
    "consentRatePct" DECIMAL(5,2) NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentIp" TEXT,
    "consentUserAgent" TEXT,
    "belowThreshold" BOOLEAN NOT NULL DEFAULT false,
    "thresholdAtSubmission" DECIMAL(14,2),
    "duplicateOfDealId" TEXT,
    "actualRefundAmount" DECIMAL(14,2),
    "contractSentAt" TIMESTAMP(3),
    "clientPaidAmount" DECIMAL(14,2),
    "clientPaidAt" TIMESTAMP(3),
    "clientPaidMarkedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealStatusHistory" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStatusId" TEXT,
    "toStatusId" TEXT NOT NULL,
    "mode" "StatusChangeMode" NOT NULL,
    "source" "ChangeSource" NOT NULL,
    "changedById" TEXT,
    "voiceCommandLogId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "clientRatePct" DECIMAL(5,2) NOT NULL,
    "realtorRatePct" DECIMAL(5,2) NOT NULL,
    "platformRatePct" DECIMAL(5,2) NOT NULL,
    "executorPayoutType" "ExecutorPayoutType" NOT NULL DEFAULT 'FIXED',
    "executorFixedAmount" DECIMAL(14,2),
    "executorRatePct" DECIMAL(5,2),
    "commissionBase" "CommissionBase" NOT NULL DEFAULT 'REFUND_AMOUNT',
    "showPlatformShareToRealtor" BOOLEAN NOT NULL DEFAULT false,
    "minTaxThreshold" DECIMAL(14,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealCommission" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "clientFeeAmount" DECIMAL(14,2) NOT NULL,
    "realtorAmount" DECIMAL(14,2) NOT NULL,
    "platformAmount" DECIMAL(14,2) NOT NULL,
    "executorAmount" DECIMAL(14,2) NOT NULL,
    "consultantNetAmount" DECIMAL(14,2) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "recipientType" "PayoutRecipient" NOT NULL,
    "realtorId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "markedById" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramAccount" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "kind" "TelegramBindingKind" NOT NULL,
    "title" TEXT,
    "username" TEXT,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCommandLog" (
    "id" TEXT NOT NULL,
    "telegramAccountId" TEXT,
    "chatId" BIGINT NOT NULL,
    "messageId" BIGINT NOT NULL,
    "fileId" TEXT,
    "transcript" TEXT,
    "parsedIntent" JSONB,
    "dealId" TEXT,
    "status" "VoiceCommandStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "VoiceCommandLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorTelegramChatId" BIGINT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RealtorProfile_userId_key" ON "RealtorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLink_token_key" ON "ReferralLink"("token");

-- CreateIndex
CREATE INDEX "ReferralLink_realtorId_idx" ON "ReferralLink"("realtorId");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "FnsCredential_clientId_key" ON "FnsCredential"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "DealStatus_code_key" ON "DealStatus"("code");

-- CreateIndex
CREATE INDEX "DealStatus_sortOrder_idx" ON "DealStatus"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_number_key" ON "Deal"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_submissionId_key" ON "Deal"("submissionId");

-- CreateIndex
CREATE INDEX "Deal_realtorId_createdAt_idx" ON "Deal"("realtorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Deal_statusId_idx" ON "Deal"("statusId");

-- CreateIndex
CREATE INDEX "Deal_referralLinkId_idx" ON "Deal"("referralLinkId");

-- CreateIndex
CREATE INDEX "Deal_clientId_idx" ON "Deal"("clientId");

-- CreateIndex
CREATE INDEX "Deal_createdAt_idx" ON "Deal"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "DealStatusHistory_dealId_createdAt_idx" ON "DealStatusHistory"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "DealStatusHistory_changedById_idx" ON "DealStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "CommissionConfig_isActive_effectiveFrom_idx" ON "CommissionConfig"("isActive", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "DealCommission_dealId_key" ON "DealCommission"("dealId");

-- CreateIndex
CREATE INDEX "Payout_dealId_idx" ON "Payout"("dealId");

-- CreateIndex
CREATE INDEX "Payout_realtorId_idx" ON "Payout"("realtorId");

-- CreateIndex
CREATE INDEX "Payout_recipientType_paidAt_idx" ON "Payout"("recipientType", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_chatId_key" ON "TelegramAccount"("chatId");

-- CreateIndex
CREATE INDEX "VoiceCommandLog_dealId_idx" ON "VoiceCommandLog"("dealId");

-- CreateIndex
CREATE INDEX "VoiceCommandLog_createdAt_idx" ON "VoiceCommandLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtorProfile" ADD CONSTRAINT "RealtorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralLink" ADD CONSTRAINT "ReferralLink_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "RealtorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FnsCredential" ADD CONSTRAINT "FnsCredential_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FnsCredential" ADD CONSTRAINT "FnsCredential_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "RealtorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_referralLinkId_fkey" FOREIGN KEY ("referralLinkId") REFERENCES "ReferralLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "DealStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_clientPaidMarkedById_fkey" FOREIGN KEY ("clientPaidMarkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStatusHistory" ADD CONSTRAINT "DealStatusHistory_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStatusHistory" ADD CONSTRAINT "DealStatusHistory_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "DealStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStatusHistory" ADD CONSTRAINT "DealStatusHistory_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "DealStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStatusHistory" ADD CONSTRAINT "DealStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStatusHistory" ADD CONSTRAINT "DealStatusHistory_voiceCommandLogId_fkey" FOREIGN KEY ("voiceCommandLogId") REFERENCES "VoiceCommandLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealCommission" ADD CONSTRAINT "DealCommission_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealCommission" ADD CONSTRAINT "DealCommission_configId_fkey" FOREIGN KEY ("configId") REFERENCES "CommissionConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "RealtorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramAccount" ADD CONSTRAINT "TelegramAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCommandLog" ADD CONSTRAINT "VoiceCommandLog_telegramAccountId_fkey" FOREIGN KEY ("telegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCommandLog" ADD CONSTRAINT "VoiceCommandLog_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================
-- Partial-unique индексы (план §2): инварианты уровня БД,
-- которые Prisma-схема выразить не может. Приложение ловит P2002.
-- ============================================================

-- Ровно один начальный статус среди активных (DealStatus)
CREATE UNIQUE INDEX "DealStatus_single_initial_active_key"
    ON "DealStatus"("isInitial")
    WHERE "isInitial" = true AND "isActive" = true;

-- Ровно один активный конфиг комиссий (CommissionConfig)
CREATE UNIQUE INDEX "CommissionConfig_single_active_key"
    ON "CommissionConfig"("isActive")
    WHERE "isActive" = true;

-- Не больше одной активной реферальной ссылки на риэлтора
-- (getOrCreateRefLink ловит P2002 и возвращает существующую)
CREATE UNIQUE INDEX "ReferralLink_realtorId_active_key"
    ON "ReferralLink"("realtorId")
    WHERE "isActive" = true;
