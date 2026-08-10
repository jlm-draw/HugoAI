import type { NewsCrawler, NewsItem } from "../types";

/**
 * 知乎日报（情感/知识口播类选题）。
 * 官方开放 JSON 接口，条目多为知识性/故事性话题，适合口播稿展开。
 */
export const zhihuDailyCrawler: NewsCrawler = {
  source: "知乎日报",
  category: "emotion",
  async crawl(): Promise<{ source: string; category: string; items: NewsItem[] }> {
    const url = "https://daily.zhihu.com/api/4/news/latest";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HugoAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as {
      stories?: Array<{ title?: string; id?: number }>;
    };

    const items: NewsItem[] = [];
    const seen = new Set<string>();
    for (const s of data.stories ?? []) {
      const title = (s.title ?? "").trim();
      if (!title || title.length < 6 || seen.has(title)) continue;
      seen.add(title);
      items.push({
        title,
        url: `https://daily.zhihu.com/story/${s.id}`,
        source: "知乎日报",
      });
    }

    return { source: "知乎日报", category: "emotion", items: items.slice(0, 20) };
  },
};
