import cron from "node-cron";
import { runCrawlers, getLastCrawlTime } from "@/services/news/crawler";
import { allCrawlers } from "@/services/news/crawlers";

let initialized = false;

export function initScheduler() {
  if (initialized) return;
  initialized = true;

  cron.schedule("0 8 * * *", async () => {
    console.log("[scheduler] Running daily news crawl at", new Date().toISOString());
    const result = await runCrawlers(allCrawlers);
    console.log(`[scheduler] Crawl complete: ${result.totalNew} new articles`);
  });

  (async () => {
    const last = await getLastCrawlTime();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!last || last < today) {
      console.log("[scheduler] No crawl today yet, running initial crawl...");
      try {
        const result = await runCrawlers(allCrawlers);
        console.log(`[scheduler] Initial crawl complete: ${result.totalNew} new articles`);
      } catch (err) {
        console.error("[scheduler] Initial crawl failed:", err);
      }
    } else {
      console.log("[scheduler] Already crawled today, skipping initial crawl");
    }
  })();

  console.log("[scheduler] Initialized - daily crawl at 8:00 AM");
}
