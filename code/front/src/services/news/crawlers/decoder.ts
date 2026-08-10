import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

export const decoderCrawler: NewsCrawler = {
  source: "The Decoder",
  category: "ai-news",
  async crawl(): Promise<{ source: string; category: string; items: NewsItem[] }> {
    const url = "https://the-decoder.com";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HugoAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    $("article h2 a, .post-title a, h3.entry-title a, h2 a").each((_, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      const href = $el.attr("href") || "";
      if (title && href.startsWith("http") && title.length > 10 && !seen.has(href)) {
        seen.add(href);
        items.push({ title, url: href, source: "The Decoder" });
      }
    });

    return { source: "The Decoder", category: "ai-news", items: items.slice(0, 20) };
  },
};
