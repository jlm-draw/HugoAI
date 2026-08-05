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
    return new Response(data, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="${scriptId}.mp3"`,
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch {
    return NextResponse.json({ error: "音频文件不存在，请重新生成配音" }, { status: 404 });
  }
}
