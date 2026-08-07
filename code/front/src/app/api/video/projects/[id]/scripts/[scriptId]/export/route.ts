import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";
import { audioFilePath } from "@/services/video/audio-store";
import { buildManifest } from "@/services/video/export/manifest";
import {
  cachedZip,
  exportDir,
  MaterialDownloadError,
  prepareAssets,
  zipPath,
} from "@/services/video/export/materials";
import { ExportEnvError, runBuildDraft } from "@/services/video/export/runner";

type ScriptWithShots = Prisma.VideoScriptGetPayload<{
  include: { shots: { orderBy: { sort: "asc" } }; project: { select: { userId: true } } };
}>;

/** 同一脚本进行中的构建任务（并发请求复用同一次构建） */
const building = new Map<string, Promise<string>>();

/** GET /api/video/projects/[id]/scripts/[scriptId]/export — 导出剪映草稿 zip */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId } = await params;

  const script = await prisma.videoScript.findFirst({
    where: { id: scriptId, projectId: id },
    include: { shots: { orderBy: { sort: "asc" } }, project: { select: { userId: true } } },
  });
  if (!script || script.project.userId !== check.userId) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  if (!script.audioUrl || !script.srt) {
    return NextResponse.json({ error: "请先合成配音" }, { status: 400 });
  }
  try {
    await stat(audioFilePath(scriptId));
  } catch {
    return NextResponse.json({ error: "音频文件缺失，请重新合成配音" }, { status: 400 });
  }
  const missing = script.shots.filter((s) => !s.materialUrl);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `分镜 ${missing.map((s) => s.sort).join("、")} 未选择素材，请先选择` },
      { status: 400 }
    );
  }

  try {
    const zip = await getOrBuild(script);
    const data = await readFile(zip);
    return new Response(data, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(zip))}`,
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch (err) {
    const status = err instanceof MaterialDownloadError ? 502 : 500;
    const message = err instanceof Error ? err.message : "导出失败，请重试";
    return NextResponse.json({ error: message }, { status });
  }
}

/** 缓存命中直接返回 zip；否则构建（同脚本并发复用） */
async function getOrBuild(script: ScriptWithShots): Promise<string> {
  const manifest = buildManifest(script);
  const cached = await cachedZip(script.id, manifest.draftName, script.updatedAt);
  if (cached) return cached;

  const running = building.get(script.id);
  if (running) return running;

  const task = (async () => {
    try {
      await prepareAssets(script, manifest);
      await runBuildDraft(exportDir(script.id));
      return zipPath(script.id, manifest.draftName);
    } finally {
      building.delete(script.id);
    }
  })();
  building.set(script.id, task);
  return task;
}
