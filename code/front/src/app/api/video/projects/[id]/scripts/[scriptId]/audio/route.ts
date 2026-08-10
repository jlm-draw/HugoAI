import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import { audioFilePath } from "@/services/video/audio-store";

/** GET /api/video/projects/[id]/scripts/[scriptId]/audio — 下发配音 mp3（带鉴权） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId } = await params;

  const script = await prisma.videoScript.findFirst({
    where: { id: scriptId, projectId: id },
    select: { id: true, project: { select: { userId: true } } },
  });
  if (!script || script.project.userId !== check.userId) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  try {
    const data = await readFile(audioFilePath(scriptId));
    // 百炼引擎产出 WAV、Edge 兜底引擎产出 MP3，按文件头嗅探类型
    const isWav = data.length > 12 && data.toString("ascii", 0, 4) === "RIFF";
    return new Response(data, {
      headers: {
        "Content-Type": isWav ? "audio/wav" : "audio/mpeg",
        "Content-Disposition": `inline; filename="${scriptId}.${isWav ? "wav" : "mp3"}`,
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch {
    return NextResponse.json({ error: "音频文件不存在，请重新生成配音" }, { status: 404 });
  }
}
