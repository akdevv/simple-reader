-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR', 'TTS_PROCESSING', 'TTS_READY');

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "title" TEXT,
    "excerpt" TEXT,
    "siteName" TEXT,
    "sections" JSONB,
    "media" JSONB,
    "ttsAudio" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Article_userId_idx" ON "Article"("userId");

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "Article"("status");
