import { NextResponse } from "next/server";
import { getOwnedNovel, requireNovelAccess } from "@/services/novel/guard";
import { buildStoryContext, generateOutline } from "@/services/novel/ai";

/** POST /api/novel/[id]/ai/outline — AI 生成整书章节大纲（一次性 JSON） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const novel = await getOwnedNovel(id, check.userId);
  if (!novel) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { chapterCount?: unknown; direction?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const chapterCount =
    typeof body.chapterCount === "number" && Number.isInteger(body.chapterCount)
      ? body.chapterCount
      : NaN;
  if (!Number.isFinite(chapterCount) || chapterCount < 1 || chapterCount > 20) {
    return NextResponse.json({ error: "章节数量需在 1-20 之间" }, { status: 400 });
  }

  const direction = typeof body.direction === "string" ? body.direction.trim().slice(0, 500) : "";

  try {
    const chapters = await generateOutline(buildStoryContext(novel), { chapterCount, direction });
    if (chapters.length === 0) {
      return NextResponse.json({ error: "AI 未能生成有效大纲，请重试" }, { status: 500 });
    }
    return NextResponse.json({ chapters });
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成大纲失败，请重试";
    const status = message.includes("AI_API_KEY") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
