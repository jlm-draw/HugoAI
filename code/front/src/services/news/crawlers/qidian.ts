import * as cheerio from "cheerio";
import type { NewsCrawler, NewsItem } from "../types";

/**
 * 起点中文网·移动端畅销榜（小说推文类选题）。
 * 榜单条目即当下热门小说，书名可直接作为推文选题。
 */
export const qidianCrawler: NewsCrawler = {
  source: "起点畅销榜",
  category: "novel-promo",
  async crawl(): Promise<{ source: string; category: string; items: NewsItem[] }> {
    const url = "https://m.qidian.com/rank/hotsales/";
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const $ = cheerio.load(await resp.text());
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    $("a[href*='/book/']").each((_, el) => {
      const $el = $(el);
      // 锚文本常带「最新章节在线阅读」类后缀，清洗后只留书名
      const title = ($el.attr("title") || $el.text())
        .replace(/(最新章节|在线阅读|全文免费|免费阅读|免费).*$/g, "")
        .trim();
      let href = $el.attr("href") || "";
      if (href.startsWith("//")) href = "https:" + href;
      else if (href.startsWith("/")) href = "https://m.qidian.com" + href;
      // 过滤导航/更多类链接，只保留带书名的条目
      if (title && title.length >= 2 && /\/book\/\d+/.test(href) && !seen.has(title)) {
        seen.add(title);
        items.push({
          title: `热门小说《${title}》`,
          url: href,
          source: "起点畅销榜",
        });
      }
    });

    return { source: "起点畅销榜", category: "novel-promo", items: items.slice(0, 20) };
  },
};
