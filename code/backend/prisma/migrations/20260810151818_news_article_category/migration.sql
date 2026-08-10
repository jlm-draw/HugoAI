-- AlterTable
ALTER TABLE "NewsArticle" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'ai-news';

-- CreateIndex
CREATE INDEX "NewsArticle_category_idx" ON "NewsArticle"("category");
