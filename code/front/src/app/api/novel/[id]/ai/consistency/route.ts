import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOwnedNovel, requireNovelAccess } from "@/services/novel/guard";
import { buildStoryContext, checkConsistency } from "@/services/novel/ai";

/** POST /api/novel/[id]/ai/consistency — 一致性检查（一次性返回矛盾列表） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const novel = await getOwnedNovel(id, check.userId);
  if (!novel) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { chapterId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const chapterId = typeof body.chapterId === "string" ? body.chapterId : "";
  if (!chapterId) {
    return NextResponse.json({ error: "缺少 chapterId" }, { status: 400 });
  }

  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, novelId: id } });
  if (!chapter) {
    return NextResponse.json({ error: "章节不存在" }, { status: 404 });
  }

  try {
    const issues = await checkConsistency(buildStoryContext(novel), chapter.text ?? "");
    return NextResponse.json({ issues });
  } catch (err) {
    const message = err instanceof Error ? err.message : "一致性检查失败，请重试";
    const status = message.includes("AI_API_KEY") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
