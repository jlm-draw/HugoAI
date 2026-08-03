import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownsNovel, requireNovelAccess } from "@/services/novel/guard";

/** DELETE /api/novel/[id]/relations/[rid] — 删除人物关系 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id, rid } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  const relation = await prisma.characterRelation.findFirst({
    where: { id: rid, novelId: id },
    select: { id: true },
  });
  if (!relation) {
    return NextResponse.json({ error: "关系不存在" }, { status: 404 });
  }

  await prisma.characterRelation.delete({ where: { id: rid } });
  return NextResponse.json({ success: true });
}
