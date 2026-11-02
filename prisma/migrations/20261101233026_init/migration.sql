-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" TEXT,
    "encryptedToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardState" (
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "sourcePlaylistId" TEXT,
    "sourceName" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "destinationId" TEXT,
    "destinationUrl" TEXT,
    "total" INTEGER NOT NULL,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "notFound" INTEGER NOT NULL DEFAULT 0,
    "excluded" INTEGER NOT NULL DEFAULT 0,
    "cleanReplaced" INTEGER NOT NULL DEFAULT 0,
    "includeExplicit" BOOLEAN NOT NULL,
    "cleanMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferTrack" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "isrc" TEXT,
    "explicit" BOOLEAN,
    "selected" BOOLEAN NOT NULL,
    "destinationId" TEXT,
    "confidence" DOUBLE PRECISION,
    "result" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "TransferTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_idx" ON "VerificationToken"("userId");

-- CreateIndex
CREATE INDEX "PlatformConnection_userId_idx" ON "PlatformConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConnection_sessionId_platform_role_key" ON "PlatformConnection"("sessionId", "platform", "role");

-- CreateIndex
CREATE INDEX "Transfer_userId_createdAt_idx" ON "Transfer"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransferTrack_transferId_position_key" ON "TransferTrack"("transferId", "position");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAttempt" ADD CONSTRAINT "OAuthAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardState" ADD CONSTRAINT "WizardState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferTrack" ADD CONSTRAINT "TransferTrack_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
