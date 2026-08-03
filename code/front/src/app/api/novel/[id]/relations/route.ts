import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownsNovel, requireNovelAccess } from "@/services/novel/guard";

/** POST /api/novel/[id]/relations — 添加人物关系 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { fromCharacterId?: unknown; toCharacterId?: unknown; label?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const fromCharacterId = typeof body.fromCharacterId === "string" ? body.fromCharacterId : "";
  const toCharacterId = typeof body.toCharacterId === "string" ? body.toCharacterId : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";

  if (!fromCharacterId || !toCharacterId) {
    return NextResponse.json({ error: "请选择两个人物" }, { status: 400 });
  }
  if (fromCharacterId === toCharacterId) {
    return NextResponse.json({ error: "不能与自己建立关系" }, { status: 400 });
  }
  if (!label || label.length > 30) {
    return NextResponse.json({ error: "关系描述需在 1-30 字之间" }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    prisma.character.findFirst({ where: { id: fromCharacterId, novelId: id }, select: { id: true } }),
    prisma.character.findFirst({ where: { id: toCharacterId, novelId: id }, select: { id: true } }),
  ]);
  if (!from || !to) {
    return NextResponse.json({ error: "人物不存在或不属于该小说" }, { status: 400 });
  }

  const relation = await prisma.characterRelation.create({
    data: { novelId: id, fromCharacterId, toCharacterId, label },
  });

  return NextResponse.json(
    {
      relation: {
        id: relation.id,
        fromCharacterId: relation.fromCharacterId,
        toCharacterId: relation.toCharacterId,
        label: relation.label,
      },
    },
    { status: 201 }
  );
}
