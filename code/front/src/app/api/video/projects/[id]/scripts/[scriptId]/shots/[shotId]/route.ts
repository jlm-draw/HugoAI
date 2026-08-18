import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import { serializeShot } from "@/services/video/serialize";
import { MATERIAL_URL_PREFIX } from "@/services/video/material-store";

/** 素材/缩略图链接合法性：https 外链（Pexels）或站内 AI 生成素材路径 */
function isValidMaterialUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith(MATERIAL_URL_PREFIX);
}

/** PATCH /api/video/projects/[id]/scripts/[scriptId]/shots/[shotId] — 更新分镜素材/搜索词/画面/台词 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string; shotId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId, shotId } = await params;

  const shot = await prisma.videoShot.findFirst({
    where: { id: shotId, scriptId },
    select: {
      id: true,
      script: { select: { projectId: true, project: { select: { userId: true } } } },
    },
  });
  if (!shot || shot.script.project.userId !== check.userId || shot.script.projectId !== id) {
    return NextResponse.json({ error: "分镜不存在" }, { status: 404 });
  }

  let body: {
    materialUrl?: unknown;
    materialThumb?: unknown;
    materialQuery?: unknown;
    visual?: unknown;
    line?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const data: {
    materialUrl?: string | null;
    materialThumb?: string | null;
    materialQuery?: string | null;
    visual?: string;
    line?: string;
  } = {};

  if (body.materialUrl !== undefined) {
    if (body.materialUrl === null) {
      data.materialUrl = null;
      data.materialThumb = null;
    } else if (typeof body.materialUrl === "string" && isValidMaterialUrl(body.materialUrl)) {
      data.materialUrl = body.materialUrl.slice(0, 500);
    } else {
      return NextResponse.json({ error: "素材链接必须是 https 地址或站内素材路径" }, { status: 400 });
    }
  }
  if (body.materialThumb !== undefined && data.materialUrl !== null) {
    if (body.materialThumb === null) {
      data.materialThumb = null;
    } else if (typeof body.materialThumb === "string" && isValidMaterialUrl(body.materialThumb)) {
      data.materialThumb = body.materialThumb.slice(0, 500);
    } else {
      return NextResponse.json({ error: "缩略图链接必须是 https 地址或站内素材路径" }, { status: 400 });
    }
  }
  if (body.materialQuery !== undefined) {
    if (body.materialQuery === null) {
      data.materialQuery = null;
    } else if (typeof body.materialQuery === "string") {
      data.materialQuery = body.materialQuery.trim().slice(0, 80);
    } else {
      return NextResponse.json({ error: "搜索词必须是字符串" }, { status: 400 });
    }
  }
  if (body.visual !== undefined) {
    if (typeof body.visual === "string" && body.visual.trim().length > 0) {
      data.visual = body.visual.trim().slice(0, 500);
    } else {
      return NextResponse.json({ error: "画面描述不能为空" }, { status: 400 });
    }
  }
  if (body.line !== undefined) {
    if (typeof body.line === "string" && body.line.trim().length > 0) {
      data.line = body.line.trim().slice(0, 500);
    } else {
      return NextResponse.json({ error: "台词不能为空" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const updated = await prisma.videoShot.update({ where: { id: shotId }, data });
  // 素材变更影响导出缓存：显式 touch script.updatedAt（缓存统一失效信号）
  await prisma.videoScript.update({ where: { id: scriptId }, data: { updatedAt: new Date() } });
  return NextResponse.json({ shot: serializeShot(updated) });
}

/** DELETE /api/video/projects/[id]/scripts/[scriptId]/shots/[shotId] — 删除单条分镜 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string; shotId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId, shotId } = await params;

  const shot = await prisma.videoShot.findFirst({
    where: { id: shotId, scriptId },
    select: {
      id: true,
      script: { select: { projectId: true, project: { select: { userId: true } } } },
    },
  });
  if (!shot || shot.script.project.userId !== check.userId || shot.script.projectId !== id) {
    return NextResponse.json({ error: "分镜不存在" }, { status: 404 });
  }

  await prisma.videoShot.delete({ where: { id: shotId } });
  // 分镜变更影响导出缓存：touch script.updatedAt
  await prisma.videoScript.update({ where: { id: scriptId }, data: { updatedAt: new Date() } });
  return NextResponse.json({ success: true });
}
