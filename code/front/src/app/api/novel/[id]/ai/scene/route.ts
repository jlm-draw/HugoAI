import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sseResponse } from "@/lib/sse";
import { getOwnedNovel, requireNovelAccess } from "@/services/novel/guard";
import { buildStoryContext, streamScene } from "@/services/novel/ai";

/** POST /api/novel/[id]/ai/scene — 指定章节写特定场景（SSE 流式） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const novel = await getOwnedNovel(id, check.userId);
  if (!novel) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { chapterId?: unknown; scene?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const chapterId = typeof body.chapterId === "string" ? body.chapterId : "";
  const scene = typeof body.scene === "string" ? body.scene.trim() : "";
  if (!chapterId) {
    return NextResponse.json({ error: "缺少 chapterId" }, { status: 400 });
  }
  if (!scene || scene.length > 500) {
    return NextResponse.json({ error: "场景描述需在 1-500 字之间" }, { status: 400 });
  }

  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, novelId: id } });
  if (!chapter) {
    return NextResponse.json({ error: "章节不存在" }, { status: 404 });
  }

  return sseResponse(
    streamScene(buildStoryContext(novel), {
      chapterTitle: chapter.title,
      chapterText: chapter.text ?? "",
      scene,
    })
  );
}
