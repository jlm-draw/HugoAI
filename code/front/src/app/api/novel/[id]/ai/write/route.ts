import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sseResponse } from "@/lib/sse";
import { getOwnedNovel, requireNovelAccess } from "@/services/novel/guard";
import { buildStoryContext, streamWrite } from "@/services/novel/ai";

/** POST /api/novel/[id]/ai/write — 根据本章大纲写整章正文（SSE 流式） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const novel = await getOwnedNovel(id, check.userId);
  if (!novel) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { chapterId?: unknown; outline?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const chapterId = typeof body.chapterId === "string" ? body.chapterId : "";
  const outline = typeof body.outline === "string" ? body.outline.trim() : "";
  if (!chapterId) {
    return NextResponse.json({ error: "缺少 chapterId" }, { status: 400 });
  }
  if (!outline) {
    return NextResponse.json(
      { error: "本章大纲为空，请先在右侧「大纲」标签填写或使用 AI 写大纲" },
      { status: 400 }
    );
  }
  if (outline.length > 2000) {
    return NextResponse.json({ error: "本章大纲不能超过 2000 字" }, { status: 400 });
  }

  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, novelId: id } });
  if (!chapter) {
    return NextResponse.json({ error: "章节不存在" }, { status: 404 });
  }

  const prev = await prisma.chapter.findFirst({
    where: { novelId: id, sort: { lt: chapter.sort } },
    orderBy: { sort: "desc" },
    select: { text: true },
  });

  return sseResponse(
    streamWrite(buildStoryContext(novel), {
      chapterTitle: chapter.title,
      outline,
      prevChapterText: prev?.text ?? null,
    })
  );
}
