import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownsNovel, requireNovelAccess } from "@/services/novel/guard";

/** PUT /api/novel/[id]/world — 保存世界观设定（upsert） */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { background?: unknown; timeline?: unknown; geography?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const data = {
    background: typeof body.background === "string" ? body.background.slice(0, 5000) : "",
    timeline: typeof body.timeline === "string" ? body.timeline.slice(0, 5000) : "",
    geography: typeof body.geography === "string" ? body.geography.slice(0, 5000) : "",
  };

  const worldSetting = await prisma.worldSetting.upsert({
    where: { novelId: id },
    update: data,
    create: { novelId: id, ...data },
  });

  return NextResponse.json({
    worldSetting: {
      background: worldSetting.background,
      timeline: worldSetting.timeline,
      geography: worldSetting.geography,
    },
  });
}
