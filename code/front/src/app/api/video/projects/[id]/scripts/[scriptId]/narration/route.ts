import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import { saveAudio } from "@/services/video/audio-store";
import { getTtsProvider, toSrt } from "@/services/video/tts";
import { VOICES } from "@/services/video/types";

/** POST /api/video/projects/[id]/scripts/[scriptId]/narration — 生成 TTS 配音 + SRT 字幕（同步，约 10-30 秒） */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId } = await params;

  const script = await prisma.videoScript.findFirst({
    where: { id: scriptId, projectId: id },
    select: { id: true, narration: true, project: { select: { userId: true } } },
  });
  if (!script || script.project.userId !== check.userId) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  let body: { voice?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const voice = typeof body.voice === "string" ? body.voice : "";
  if (!VOICES.some((v) => v.id === voice)) {
    return NextResponse.json({ error: "请选择有效的音色" }, { status: 400 });
  }
  if (!script.narration.trim()) {
    return NextResponse.json({ error: "该脚本没有口播稿，无法配音" }, { status: 400 });
  }

  try {
    const { audio, sentences } = await getTtsProvider().synthesize(script.narration, voice);
    await saveAudio(scriptId, audio);
    const srt = toSrt(sentences);
    const audioUrl = `/api/video/projects/${id}/scripts/${scriptId}/audio`;

    await prisma.videoScript.update({
      where: { id: scriptId },
      data: { voice, audioUrl, srt },
    });

    return NextResponse.json({ narration: { audioUrl, srt, voice } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "语音合成失败，请重试";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
