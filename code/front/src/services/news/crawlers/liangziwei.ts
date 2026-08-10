import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

export const liangziweiCrawler: NewsCrawler = {
  source: "量子位",
  category: "ai-news",
  async crawl(): Promise<{ source: string; category: string; items: NewsItem[] }> {
    const url = "https://www.qbitai.com";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HugoAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    $("article h2 a, .post-title a, h3 a, h4 a").each((_, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      const href = $el.attr("href") || "";
      if (title && href.startsWith("http") && title.length > 5 && !seen.has(href)) {
        seen.add(href);
        items.push({ title, url: href, source: "量子位" });
      }
    });

    return { source: "量子位", category: "ai-news", items: items.slice(0, 20) };
  },
};
