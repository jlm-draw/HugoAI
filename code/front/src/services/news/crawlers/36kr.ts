import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

export const kr36Crawler: NewsCrawler = {
  source: "36氪AI",
  async crawl(): Promise<{ source: string; items: NewsItem[] }> {
    const url = "https://36kr.com/information/AI/";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HugoAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    $("a[href*='/p/']").each((_, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      let href = $el.attr("href") || "";
      if (href.startsWith("/")) href = "https://36kr.com" + href;
      if (title && href.includes("/p/") && title.length > 5 && !seen.has(href)) {
        seen.add(href);
        items.push({ title, url: href, source: "36氪AI" });
      }
    });

    return { source: "36氪AI", items: items.slice(0, 20) };
  },
};
