import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import type { VideoProjectSummary } from "@/services/video/types";

/** GET /api/video/projects — 当前用户的视频项目列表（含脚本数） */
export async function GET() {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;

  const projects = await prisma.videoProject.findMany({
    where: { userId: check.userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { scripts: true } } },
  });

  const list: VideoProjectSummary[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    positioning: p.positioning,
    scriptCount: p._count.scripts,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ projects: list });
}

/** POST /api/video/projects — 新建视频项目 */
export async function POST(request: Request) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;

  let body: { name?: unknown; positioning?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "请填写项目名称" }, { status: 400 });
  }
  if (name.length > 50) {
    return NextResponse.json({ error: "项目名称不能超过 50 字" }, { status: 400 });
  }

  const positioning =
    typeof body.positioning === "string" ? body.positioning.trim().slice(0, 200) : null;

  const project = await prisma.videoProject.create({
    data: {
      userId: check.userId,
      name,
      positioning: positioning || null,
    },
  });

  return NextResponse.json({ project: { id: project.id } }, { status: 201 });
}
