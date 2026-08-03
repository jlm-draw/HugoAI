import { NextResponse } from "next/server";
import { sseResponse } from "@/lib/sse";
import { ownsNovel, requireNovelAccess } from "@/services/novel/guard";
import { streamPolish } from "@/services/novel/ai";
import type { PolishMode } from "@/services/novel/types";

const POLISH_MODES: PolishMode[] = ["style", "condense", "expand"];

/** POST /api/novel/[id]/ai/polish — 润色选中文字（SSE 流式） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireNovelAccess();
  if ("error" in check) return check.error;
  const { id } = await params;

  if (!(await ownsNovel(id, check.userId))) {
    return NextResponse.json({ error: "小说不存在" }, { status: 404 });
  }

  let body: { text?: unknown; mode?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mode = typeof body.mode === "string" ? body.mode : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "请先选中要润色的文字" }, { status: 400 });
  }
  if (text.length > 3000) {
    return NextResponse.json({ error: "一次润色的文字不能超过 3000 字" }, { status: 400 });
  }
  if (!POLISH_MODES.includes(mode as PolishMode)) {
    return NextResponse.json({ error: "请选择有效的润色模式" }, { status: 400 });
  }

  return sseResponse(streamPolish(text, mode as PolishMode, note || undefined));
}
