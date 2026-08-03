import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ownsNovel, requireNovelAccess } from "@/services/novel/guard";
import { countWords, isTiptapDoc, syncNovelWordCount } from "@/services/novel/chapters";

/** GET /api/novel/[id]/chapters/[chId] — 单章详情（含正文） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; chId: string }> }
) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id, chId } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  const chapter = await prisma.chapter.findFirst({ where: { id: chId, novelId: id } });
  if (!chapter) {
    return NextResponse.json({ error: "章节不存在" }, { status: 404 });
  }

  return NextResponse.json({
    chapter: {
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      content: chapter.content ?? undefined,
      wordCount: chapter.wordCount,
      sort: chapter.sort,
    },
  });
}

/** PATCH /api/novel/[id]/chapters/[chId] — 保存章节（标题/大纲/正文，自动算字数） */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; chId: string }> }
) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id, chId } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: chId, novelId: id },
    select: { id: true },
  });
  if (!chapter) {
    return NextResponse.json({ error: "章节不存在" }, { status: 404 });
  }

  let body: { title?: unknown; summary?: unknown; content?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const data: {
    title?: string;
    summary?: string | null;
    content?: Prisma.InputJsonValue | typeof Prisma.DbNull;
    text?: string | null;
    wordCount?: number;
  } = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 100) {
      return NextResponse.json({ error: "章节标题需在 1-100 字之间" }, { status: 400 });
    }
    data.title = title;
  }
  if (body.summary !== undefined) {
    data.summary =
      typeof body.summary === "string" ? body.summary.trim().slice(0, 2000) || null : null;
  }
  if (body.content !== undefined) {
    if (body.content === null) {
      data.content = Prisma.DbNull;
    } else if (!isTiptapDoc(body.content)) {
      return NextResponse.json({ error: "content 必须是合法的 Tiptap 文档 JSON" }, { status: 400 });
    } else {
      data.content = body.content as Prisma.InputJsonValue;
    }
  }
  if (body.text !== undefined) {
    const text = typeof body.text === "string" ? body.text : null;
    data.text = text;
    data.wordCount = text ? countWords(text) : 0;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const updated = await prisma.chapter.update({ where: { id: chId }, data });
  if (data.wordCount !== undefined) {
    await syncNovelWordCount(id);
  }

  return NextResponse.json({
    chapter: {
      id: updated.id,
      title: updated.title,
      summary: updated.summary,
      wordCount: updated.wordCount,
      sort: updated.sort,
    },
  });
}

/** DELETE /api/novel/[id]/chapters/[chId] — 删除章节 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; chId: string }> }
) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id, chId } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: chId, novelId: id },
    select: { id: true },
  });
  if (!chapter) {
    return NextResponse.json({ error: "章节不存在" }, { status: 404 });
  }

  await prisma.chapter.delete({ where: { id: chId } });
  await syncNovelWordCount(id);

  return NextResponse.json({ success: true });
}
