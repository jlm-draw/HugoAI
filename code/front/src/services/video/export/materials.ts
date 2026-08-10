import { copyFile, mkdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { audioFilePath } from "@/services/video/audio-store";
import { nameFromUrl, materialPath } from "@/services/video/material-store";
import type { ExportManifest } from "./manifest";

/**
 * 导出缓存根目录：仓库根 storage/exports/（storage/* 已被 .gitignore 忽略）。
 * Next.js 进程 cwd 为 code/front，向上两级到仓库根（对齐 audio-store 的写法）。
 */
const EXPORTS_ROOT = path.join(process.cwd(), "..", "..", "storage", "exports");

const UA = "Mozilla/5.0 (compatible; HugoAI/1.0)";

/** 某脚本的导出缓存目录 */
export function exportDir(scriptId: string): string {
  return path.join(EXPORTS_ROOT, scriptId);
}

/** 最终 zip 路径（与 build_draft.py 的产出命名一致） */
export function zipPath(scriptId: string, draftName: string): string {
  return path.join(exportDir(scriptId), `${draftName}-剪映草稿.zip`);
}

/**
 * 缓存命中判定：manifest.json 的 mtime 不早于 script.updatedAt 且 zip 存在。
 * 命中返回 zip 路径，否则 null。
 */
export async function cachedZip(
  scriptId: string,
  draftName: string,
  scriptUpdatedAt: Date
): Promise<string | null> {
  try {
    const m = await stat(path.join(exportDir(scriptId), "manifest.json"));
    if (m.mtime < scriptUpdatedAt) return null;
    const zip = zipPath(scriptId, draftName);
    await stat(zip);
    return zip;
  } catch {
    return null;
  }
}

/** 分镜素材下载失败（消息含分镜号，路由层转 502） */
export class MaterialDownloadError extends Error {
  constructor(
    readonly sort: number,
    reason: string
  ) {
    super(`分镜 ${sort} 素材下载失败（${reason}），请重试或更换素材`);
  }
}

async function downloadMaterial(url: string, dest: string, sort: number): Promise<void> {
  try {
    // 站内 AI 生成素材：直接从本地存储复制，不走网络
    const localName = nameFromUrl(url);
    if (localName) {
      await copyFile(materialPath(localName), dest);
      return;
    }
    const resp = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(120_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = Buffer.from(await resp.arrayBuffer());
    if (data.length < 10_000) throw new Error("响应过小，疑似无效");
    await writeFile(dest, data);
  } catch (err) {
    throw new MaterialDownloadError(sort, err instanceof Error ? err.message : "未知错误");
  }
}

/**
 * 重建缓存目录：删旧目录 → 写 SRT/manifest → 复制配音 → 逐个下载分镜素材。
 * 任一素材下载失败抛 MaterialDownloadError（目录保持不完整状态，下次导出会整体重建）。
 */
export async function prepareAssets(
  script: { id: string; srt: string | null },
  manifest: ExportManifest
): Promise<void> {
  if (!script.srt) throw new Error("请先合成配音");
  const dir = exportDir(script.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, "materials"), { recursive: true });

  await writeFile(path.join(dir, "subtitle.srt"), script.srt, "utf-8");
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  await copyFile(audioFilePath(script.id), path.join(dir, "audio.mp3"));

  for (const shot of manifest.shots) {
    await downloadMaterial(shot.sourceUrl, path.join(dir, shot.file), shot.sort);
  }
}
