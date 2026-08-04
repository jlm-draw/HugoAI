import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateScript, type NewsMaterial } from "@/services/video/ai";
import { getOwnedProject, requireVideoAccess } from "@/services/video/guard";
import { fetchArticleMaterial } from "@/services/video/news-material";
import { serializeScript } from "@/services/video/serialize";
import { TRACKS, type TrackCode } from "@/services/video/types";

/** POST /api/video/projects/[id]/scripts — AI 生成脚本（非流式，整体返回） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const project = await getOwnedProject(id, check.userId);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  let body: { track?: unknown; topic?: unknown; newsId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const track = typeof body.track === "string" ? body.track : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!TRACKS.some((t) => t.code === track)) {
    return NextResponse.json({ error: "请选择有效的内容赛道" }, { status: 400 });
  }
  if (!topic) {
    return NextResponse.json({ error: "请填写视频选题" }, { status: 400 });
  }
  if (topic.length > 200) {
    return NextResponse.json({ error: "选题不能超过 200 字" }, { status: 400 });
  }

  const newsId = typeof body.newsId === "string" ? body.newsId : null;
  let material: NewsMaterial | null = null;
  if (newsId) {
    const article = await prisma.newsArticle.findFirst({ where: { id: newsId } });
    if (!article) {
      return NextResponse.json({ error: "新闻不存在" }, { status: 400 });
    }
    const content = await fetchArticleMaterial(article.url);
    material = { newsTitle: article.title, source: article.source, content };
  }

  try {
    const generated = await generateScript(
      track as TrackCode,
      topic,
      project.positioning,
      material
    );

    const script = await prisma.videoScript.create({
      data: {
        projectId: id,
        track,
        topic,
        newsId,
        title: generated.titles[0],
        titles: generated.titles,
        narration: generated.narration,
        shots: {
          create: generated.shots.map((s, i) => ({
            sort: i + 1,
            visual: s.visual,
            line: s.line,
            duration: s.duration,
          })),
        },
      },
      include: { shots: { orderBy: { sort: "asc" } }, news: true },
    });

    return NextResponse.json({ script: serializeScript(script) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成失败，请重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
