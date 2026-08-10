import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import type { NewsCrawler, CrawlerResult } from "./types";

const LAST_CRAWL_KEY = "news:last_crawl";

export async function runCrawlers(crawlers: NewsCrawler[]): Promise<{
  totalNew: number;
  totalFetched: number;
  results: CrawlerResult[];
}> {
  const results: CrawlerResult[] = [];
  let totalNew = 0;
  let totalFetched = 0;

  for (const crawler of crawlers) {
    try {
      console.log(`[crawler] Fetching from ${crawler.source}...`);
      const result = await crawler.crawl();
      results.push(result);
      totalFetched += result.items.length;

      for (const item of result.items) {
        const existing = await prisma.newsArticle.findUnique({
          where: { url: item.url },
        });
        if (!existing) {
          await prisma.newsArticle.create({
            data: {
              title: item.title,
              summary: item.summary ?? null,
              url: item.url,
              source: item.source,
              category: result.category || "ai-news",
              publishedAt: item.publishedAt ?? null,
            },
          });
          totalNew++;
        }
      }
      console.log(`[crawler] ${crawler.source}: fetched ${result.items.length} items`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[crawler] ${crawler.source} error:`, msg);
      results.push({ source: crawler.source, category: crawler.category, items: [], error: msg });
    }
  }

  await redis.set(LAST_CRAWL_KEY, new Date().toISOString());
  return { totalNew, totalFetched, results };
}

export async function getLastCrawlTime(): Promise<Date | null> {
  const val = await redis.get(LAST_CRAWL_KEY);
  return val ? new Date(val) : null;
}
