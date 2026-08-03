import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownsNovel, requireNovelAccess } from "@/services/novel/guard";

/** POST /api/novel/[id]/chapters/reorder — 按给定顺序重排章节 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { orderedIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const orderedIds = Array.isArray(body.orderedIds)
    ? body.orderedIds.filter((v): v is string => typeof v === "string")
    : [];
  if (orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds 不能为空" }, { status: 400 });
  }

  // 校验：orderedIds 必须恰好是该小说的全部章节 id（不重不漏）
  const existing = await prisma.chapter.findMany({
    where: { novelId: id },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((c) => c.id));
  const provided = new Set(orderedIds);
  if (
    orderedIds.length !== existingIds.size ||
    provided.size !== orderedIds.length ||
    orderedIds.some((cid) => !existingIds.has(cid))
  ) {
    return NextResponse.json({ error: "章节排序数据不完整，请刷新后重试" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedIds.map((cid, index) =>
      prisma.chapter.update({ where: { id: cid }, data: { sort: index } })
    )
  );

  return NextResponse.json({ success: true });
}
