import type { NewsCrawler, NewsItem } from "../types";

/**
 * 百度热搜（通用/热点类选题）。
 * 页面把榜单数据内嵌在 `<!--s-data:{...}-->` 注释里，直接解析 JSON，不依赖 DOM 结构。
 */
export const baiduHotCrawler: NewsCrawler = {
  source: "百度热搜",
  category: "general",
  async crawl(): Promise<{ source: string; category: string; items: NewsItem[] }> {
    const url = "https://top.baidu.com/board?tab=realtime";
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    const m = /<!--s-data:(.*?)-->/.exec(html);
    if (!m) throw new Error("未找到榜单数据");
    const data = JSON.parse(m[1]) as {
      data?: { cards?: Array<{ content?: Array<{ word?: string; rawUrl?: string; desc?: string }> }> };
    };

    const items: NewsItem[] = [];
    const seen = new Set<string>();
    for (const card of data.data?.cards ?? []) {
      for (const it of card.content ?? []) {
        const title = (it.word ?? "").trim();
        if (!title || title.length < 4 || seen.has(title)) continue;
        seen.add(title);
        items.push({
          title,
          summary: it.desc?.trim() || undefined,
          // 热搜条目没有独立文章页，链接指向百度搜索聚合页
          url: it.rawUrl || `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`,
          source: "百度热搜",
        });
      }
    }

    return { source: "百度热搜", category: "general", items: items.slice(0, 20) };
  },
};
