import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownsNovel, requireNovelAccess } from "@/services/novel/guard";

/** PATCH /api/novel/[id]/characters/[charId] — 修改人物 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; charId: string }> }
) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id, charId } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  const character = await prisma.character.findFirst({
    where: { id: charId, novelId: id },
    select: { id: true },
  });
  if (!character) {
    return NextResponse.json({ error: "人物不存在" }, { status: 404 });
  }

  let body: { name?: unknown; avatar?: unknown; personality?: unknown; background?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const data: { name?: string; avatar?: string | null; personality?: string | null; background?: string | null } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 30) {
      return NextResponse.json({ error: "人物姓名需在 1-30 字之间" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.avatar !== undefined) {
    data.avatar = typeof body.avatar === "string" ? body.avatar.trim().slice(0, 500) || null : null;
  }
  if (body.personality !== undefined) {
    data.personality =
      typeof body.personality === "string" ? body.personality.trim().slice(0, 1000) || null : null;
  }
  if (body.background !== undefined) {
    data.background =
      typeof body.background === "string" ? body.background.trim().slice(0, 2000) || null : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const updated = await prisma.character.update({ where: { id: charId }, data });
  return NextResponse.json({
    character: {
      id: updated.id,
      name: updated.name,
      avatar: updated.avatar,
      personality: updated.personality,
      background: updated.background,
    },
  });
}

/** DELETE /api/novel/[id]/characters/[charId] — 删除人物（级联删除其关系） */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; charId: string }> }
) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id, charId } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  const character = await prisma.character.findFirst({
    where: { id: charId, novelId: id },
    select: { id: true },
  });
  if (!character) {
    return NextResponse.json({ error: "人物不存在" }, { status: 404 });
  }

  await prisma.character.delete({ where: { id: charId } });
  return NextResponse.json({ success: true });
}
