import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";

/**
 * AI 生成素材存储：仓库根 storage/materials/（storage/* 已被 .gitignore 忽略）。
 * 与 audio-store 一致：Next.js 进程 cwd 为 code/front，向上两级到仓库根。
 *
 * 生成的视频以 DashScope taskId 命名（<taskId>.mp4），缩略图为 thumb-<uuid>.jpg。
 * 数据库 materialUrl 存站内路径 /api/video/materials/file/<name>（带鉴权下发）。
 */
const MATERIALS_DIR = path.join(process.cwd(), "..", "..", "storage", "materials");

/** 站内素材下发路径前缀（shots PATCH 校验与导出识别都用它） */
export const MATERIAL_URL_PREFIX = "/api/video/materials/file/";

/** 校验文件名：只允许字母数字与 . _ -，防止路径穿越 */
export function isSafeName(name: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(name);
}

export function materialPath(name: string): string {
  return path.join(MATERIALS_DIR, name);
}

/** 从站内素材 URL 解析文件名；非法返回 null */
export function nameFromUrl(url: string): string | null {
  if (!url.startsWith(MATERIAL_URL_PREFIX)) return null;
  const name = url.slice(MATERIAL_URL_PREFIX.length);
  return isSafeName(name) ? name : null;
}

export async function saveMaterial(name: string, data: Buffer): Promise<string> {
  if (!isSafeName(name)) throw new Error("非法的素材文件名");
  await mkdir(MATERIALS_DIR, { recursive: true });
  const filePath = materialPath(name);
  await writeFile(filePath, data);
  return filePath;
}

export async function materialExists(name: string): Promise<boolean> {
  try {
    await stat(materialPath(name));
    return true;
  } catch {
    return false;
  }
}
