import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownsNovel, requireNovelAccess } from "@/services/novel/guard";

/** POST /api/novel/[id]/characters — 新建人物 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { name?: unknown; avatar?: unknown; personality?: unknown; background?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 30) {
    return NextResponse.json({ error: "人物姓名需在 1-30 字之间" }, { status: 400 });
  }

  const character = await prisma.character.create({
    data: {
      novelId: id,
      name,
      avatar: typeof body.avatar === "string" ? body.avatar.trim().slice(0, 500) || null : null,
      personality:
        typeof body.personality === "string" ? body.personality.trim().slice(0, 1000) || null : null,
      background:
        typeof body.background === "string" ? body.background.trim().slice(0, 2000) || null : null,
    },
  });

  return NextResponse.json(
    {
      character: {
        id: character.id,
        name: character.name,
        avatar: character.avatar,
        personality: character.personality,
        background: character.background,
      },
    },
    { status: 201 }
  );
}
