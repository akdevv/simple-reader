-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "isFavourite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readStatus" TEXT NOT NULL DEFAULT 'UNREAD',
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'url',
ALTER COLUMN "url" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Article_readStatus_idx" ON "Article"("readStatus");

-- CreateIndex
CREATE INDEX "Article_isFavourite_idx" ON "Article"("isFavourite");
