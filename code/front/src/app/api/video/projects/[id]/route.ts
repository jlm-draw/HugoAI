import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteAudio } from "@/services/video/audio-store";
import { getOwnedProject, requireVideoAccess } from "@/services/video/guard";
import { serializeScript } from "@/services/video/serialize";
import type { VideoWorkspaceData } from "@/services/video/types";

/** GET /api/video/projects/[id] — 工作台全量数据（项目 + 全部脚本与分镜） */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const project = await getOwnedProject(id, check.userId);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const data: VideoWorkspaceData = {
    project: {
      id: project.id,
      name: project.name,
      positioning: project.positioning,
      scriptCount: project.scripts.length,
      updatedAt: project.updatedAt.toISOString(),
    },
    scripts: project.scripts.map(serializeScript),
  };

  return NextResponse.json(data);
}

/** PATCH /api/video/projects/[id] — 修改项目名称 / 账号定位 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const existing = await prisma.videoProject.findFirst({
    where: { id, userId: check.userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  let body: { name?: unknown; positioning?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const data: { name?: string; positioning?: string | null } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 50) {
      return NextResponse.json({ error: "项目名称需在 1-50 字之间" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.positioning !== undefined) {
    data.positioning =
      typeof body.positioning === "string"
        ? body.positioning.trim().slice(0, 200) || null
        : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const project = await prisma.videoProject.update({ where: { id }, data });
  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      positioning: project.positioning,
    },
  });
}

/** DELETE /api/video/projects/[id] — 删除项目（级联删除脚本与分镜） */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const existing = await prisma.videoProject.findFirst({
    where: { id, userId: check.userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  // 先取脚本 id 列表，删项目后顺带清理配音文件（best-effort）
  const scripts = await prisma.videoScript.findMany({
    where: { projectId: id },
    select: { id: true },
  });

  await prisma.videoProject.delete({ where: { id } });
  await Promise.all(scripts.map((s) => deleteAudio(s.id)));
  return NextResponse.json({ success: true });
}
