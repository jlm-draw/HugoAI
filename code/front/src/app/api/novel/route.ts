import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireNovelAccess } from "@/services/novel/guard";
import { GENRES, type NovelSummary } from "@/services/novel/types";

/** GET /api/novel — 当前用户的小说列表（含章节数） */
export async function GET() {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;

  const novels = await prisma.novel.findMany({
    where: { userId: check.userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { chapters: true } } },
  });

  const list: NovelSummary[] = novels.map((n) => ({
    id: n.id,
    name: n.name,
    description: n.description,
    genre: n.genre,
    cover: n.cover,
    wordCount: n.wordCount,
    chapterCount: n._count.chapters,
    updatedAt: n.updatedAt.toISOString(),
  }));

  return NextResponse.json({ novels: list });
}

/** POST /api/novel — 新建小说（可同时携带 AI 建议的世界观与人物） */
export async function POST(request: Request) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;

  let body: {
    name?: unknown;
    genre?: unknown;
    description?: unknown;
    cover?: unknown;
    setup?: {
      world?: { background?: unknown; timeline?: unknown; geography?: unknown };
      characters?: Array<{ name?: unknown; personality?: unknown; background?: unknown }>;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const genre = typeof body.genre === "string" ? body.genre.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "请填写小说名称" }, { status: 400 });
  }
  if (name.length > 50) {
    return NextResponse.json({ error: "小说名称不能超过 50 字" }, { status: 400 });
  }
  if (!genre || !GENRES.includes(genre as (typeof GENRES)[number])) {
    return NextResponse.json({ error: "请选择有效的小说类型" }, { status: 400 });
  }

  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 500) : null;
  const cover = typeof body.cover === "string" ? body.cover.trim().slice(0, 500) : null;

  const world = body.setup?.world;
  const characters = Array.isArray(body.setup?.characters) ? body.setup.characters : [];

  const novel = await prisma.novel.create({
    data: {
      userId: check.userId,
      name,
      genre,
      description: description || null,
      cover: cover || null,
      worldSetting: world
        ? {
            create: {
              background: typeof world.background === "string" ? world.background : "",
              timeline: typeof world.timeline === "string" ? world.timeline : "",
              geography: typeof world.geography === "string" ? world.geography : "",
            },
          }
        : undefined,
      characters:
        characters.length > 0
          ? {
              create: characters.slice(0, 10).map((c) => ({
                name:
                  typeof c.name === "string" && c.name.trim() ? c.name.trim().slice(0, 30) : "未命名",
                personality: typeof c.personality === "string" ? c.personality : null,
                background: typeof c.background === "string" ? c.background : null,
              })),
            }
          : undefined,
    },
  });

  return NextResponse.json({ novel: { id: novel.id } }, { status: 201 });
}
