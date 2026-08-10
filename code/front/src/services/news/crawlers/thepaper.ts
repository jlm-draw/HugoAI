import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

/**
 * 澎湃新闻·时事频道（通用/社会类选题）。
 * 首页为服务端渲染，newsDetail_forward 链接的标题在 img alt 或锚文本中。
 */
export const thepaperCrawler: NewsCrawler = {
  source: "澎湃新闻",
  category: "general",
  async crawl(): Promise<{ source: string; category: string; items: NewsItem[] }> {
    const url = "https://www.thepaper.cn/channel_25950";
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const $ = cheerio.load(await resp.text());
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    $("a[href*='newsDetail_forward_']").each((_, el) => {
      const $el = $(el);
      const title = ($el.find("img").attr("alt") || $el.text()).trim();
      let href = $el.attr("href") || "";
      if (href.startsWith("/")) href = "https://www.thepaper.cn" + href;
      if (title && title.length > 5 && href.includes("newsDetail_forward_") && !seen.has(href)) {
        seen.add(href);
        items.push({ title, url: href, source: "澎湃新闻" });
      }
    });

    return { source: "澎湃新闻", category: "general", items: items.slice(0, 20) };
  },
};
