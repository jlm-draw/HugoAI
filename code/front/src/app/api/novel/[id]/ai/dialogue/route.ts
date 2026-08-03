import { NextResponse } from "next/server";
import { sseResponse } from "@/lib/sse";
import { getOwnedNovel, requireNovelAccess } from "@/services/novel/guard";
import { buildStoryContext, streamDialogue } from "@/services/novel/ai";

/** POST /api/novel/[id]/ai/dialogue — 按人物性格生成对话（SSE 流式） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  const novel = await getOwnedNovel(id, check.userId);
  if (!novel) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { characterIds?: unknown; scenario?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const characterIds = Array.isArray(body.characterIds)
    ? body.characterIds.filter((v): v is string => typeof v === "string")
    : [];
  const scenario = typeof body.scenario === "string" ? body.scenario.trim() : "";

  if (characterIds.length === 0) {
    return NextResponse.json({ error: "请至少选择一个人物" }, { status: 400 });
  }
  if (!scenario || scenario.length > 500) {
    return NextResponse.json({ error: "情境描述需在 1-500 字之间" }, { status: 400 });
  }

  const idSet = new Set(characterIds);
  const involved = novel.characters.filter((c) => idSet.has(c.id));
  if (involved.length === 0) {
    return NextResponse.json({ error: "所选人物不存在或不属于该小说" }, { status: 400 });
  }

  return sseResponse(
    streamDialogue(
      buildStoryContext(novel),
      involved.map((c) => ({ name: c.name, personality: c.personality, background: c.background })),
      scenario
    )
  );
}
