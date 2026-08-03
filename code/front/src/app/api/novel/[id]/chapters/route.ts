import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownsNovel, requireNovelAccess } from "@/services/novel/guard";

/** POST /api/novel/[id]/chapters — 新建章节（追加到末尾） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { title?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 100) {
    return NextResponse.json({ error: "章节标题需在 1-100 字之间" }, { status: 400 });
  }

  const last = await prisma.chapter.findFirst({
    where: { novelId: id },
    orderBy: { sort: "desc" },
    select: { sort: true },
  });

  const chapter = await prisma.chapter.create({
    data: { novelId: id, title, sort: (last?.sort ?? -1) + 1 },
  });

  return NextResponse.json(
    {
      chapter: {
        id: chapter.id,
        title: chapter.title,
        summary: chapter.summary,
        wordCount: chapter.wordCount,
        sort: chapter.sort,
      },
    },
    { status: 201 }
  );
}
