import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireNovelAccess } from "@/services/novel/guard";
import { GENRES, type WorkspaceData } from "@/services/novel/types";

/** GET /api/novel/[id] — 工作台全量数据 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const novel = await prisma.novel.findFirst({
    where: { id, userId: check.userId },
    include: {
      worldSetting: true,
      characters: { orderBy: { createdAt: "asc" } },
      relations: { orderBy: { createdAt: "asc" } },
      chapters: { orderBy: { sort: "asc" } },
    },
  });
  if (!novel) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  const data: WorkspaceData = {
    novel: {
      id: novel.id,
      name: novel.name,
      description: novel.description,
      genre: novel.genre,
      cover: novel.cover,
      wordCount: novel.wordCount,
      chapterCount: novel.chapters.length,
      updatedAt: novel.updatedAt.toISOString(),
    },
    worldSetting: {
      background: novel.worldSetting?.background ?? "",
      timeline: novel.worldSetting?.timeline ?? "",
      geography: novel.worldSetting?.geography ?? "",
    },
    characters: novel.characters.map((c) => ({
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      personality: c.personality,
      background: c.background,
    })),
    relations: novel.relations.map((r) => ({
      id: r.id,
      fromCharacterId: r.fromCharacterId,
      toCharacterId: r.toCharacterId,
      label: r.label,
    })),
    chapters: novel.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      wordCount: c.wordCount,
      sort: c.sort,
      content: c.content ?? undefined,
    })),
  };

  return NextResponse.json(data);
}

/** PATCH /api/novel/[id] — 修改小说基本信息（名称/简介/类型/封面） */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const existing = await prisma.novel.findFirst({
    where: { id, userId: check.userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { name?: unknown; description?: unknown; genre?: unknown; cover?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const data: { name?: string; description?: string | null; genre?: string; cover?: string | null } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 50) {
      return NextResponse.json({ error: "小说名称需在 1-50 字之间" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.description !== undefined) {
    data.description =
      typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
  }
  if (body.genre !== undefined) {
    const genre = typeof body.genre === "string" ? body.genre.trim() : "";
    if (!GENRES.includes(genre as (typeof GENRES)[number])) {
      return NextResponse.json({ error: "请选择有效的小说类型" }, { status: 400 });
    }
    data.genre = genre;
  }
  if (body.cover !== undefined) {
    data.cover = typeof body.cover === "string" ? body.cover.trim().slice(0, 500) || null : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const novel = await prisma.novel.update({ where: { id }, data });
  return NextResponse.json({
    novel: {
      id: novel.id,
      name: novel.name,
      description: novel.description,
      genre: novel.genre,
      cover: novel.cover,
    },
  });
}

/** DELETE /api/novel/[id] — 删除小说（级联删除章节/人物/设定） */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const existing = await prisma.novel.findFirst({
    where: { id, userId: check.userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  await prisma.novel.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
