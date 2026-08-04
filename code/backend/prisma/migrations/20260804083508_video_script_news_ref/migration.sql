-- AlterTable
ALTER TABLE "VideoScript" ADD COLUMN     "newsId" TEXT;

-- CreateIndex
CREATE INDEX "VideoScript_newsId_idx" ON "VideoScript"("newsId");

-- AddForeignKey
ALTER TABLE "VideoScript" ADD CONSTRAINT "VideoScript_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "NewsArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
