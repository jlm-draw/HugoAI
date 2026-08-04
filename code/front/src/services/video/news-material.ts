import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (compatible; HugoAI/1.0)";
const MAX_MATERIAL_CHARS = 1200;

/** 抓取新闻原文正文作为生成素材；任何失败返回 null（降级为仅标题生成） */
export async function fetchArticleMaterial(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;

    const $ = cheerio.load(await resp.text());
    $("script, style, noscript, nav, header, footer, aside, form, iframe").remove();

    // 优先常见正文容器里的段落
    let text = $(
      "article p, .article-content p, .post-content p, .article_content p, main p"
    )
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 20)
      .join("\n");

    // 容器选择器未命中时退回全部 p 标签
    if (text.length < 100) {
      text = $("p")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 20)
        .join("\n");
    }

    // 仍不足时用 meta description
    if (text.length < 50) {
      text = (
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        ""
      ).trim();
    }

    text = text.trim().slice(0, MAX_MATERIAL_CHARS);
    return text || null;
  } catch {
    return null;
  }
}
