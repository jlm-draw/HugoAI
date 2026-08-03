import { NextResponse } from "next/server";
import { requireNovelAccess } from "@/services/novel/guard";
import { suggestNovel } from "@/services/novel/ai";
import { GENRES } from "@/services/novel/types";

/** POST /api/novel/ai/suggest — 根据类型/主题生成世界观与人物建议 */
export async function POST(request: Request) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;

  let body: { genre?: unknown; theme?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const genre = typeof body.genre === "string" ? body.genre.trim() : "";
  const theme = typeof body.theme === "string" ? body.theme.trim() : "";
  if (!genre || !GENRES.includes(genre as (typeof GENRES)[number])) {
    return NextResponse.json({ error: "请选择有效的小说类型" }, { status: 400 });
  }
  if (!theme) {
    return NextResponse.json({ error: "请填写小说主题或创意" }, { status: 400 });
  }
  if (theme.length > 500) {
    return NextResponse.json({ error: "主题描述不能超过 500 字" }, { status: 400 });
  }

  try {
    const suggestion = await suggestNovel(genre, theme);
    return NextResponse.json({ suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成建议失败，请重试";
    const status = message.includes("AI_API_KEY") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
