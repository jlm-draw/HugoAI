import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

export const jiqizhixinCrawler: NewsCrawler = {
  source: "机器之心",
  async crawl(): Promise<{ source: string; items: NewsItem[] }> {
    const url = "https://www.jiqizhixin.com";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HugoAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    $("a[href*='/articles/']").each((_, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      let href = $el.attr("href") || "";
      if (href.startsWith("/")) href = url + href;
      if (title && href.includes("/articles/") && title.length > 5 && !seen.has(href)) {
        seen.add(href);
        items.push({ title, url: href, source: "机器之心" });
      }
    });

    return { source: "机器之心", items: items.slice(0, 20) };
  },
};
