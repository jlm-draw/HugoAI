import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * 音频文件存储：仓库根目录 storage/audio/（根 .gitignore 已忽略 storage/*）。
 * Next.js 进程 cwd 为 code/front，故向上两级到仓库根。
 */
const AUDIO_DIR = path.join(process.cwd(), "..", "..", "storage", "audio");

/** 某脚本的音频文件绝对路径（<scriptId>.mp3） */
export function audioFilePath(scriptId: string): string {
  return path.join(AUDIO_DIR, `${scriptId}.mp3`);
}

/** 写入音频文件（目录不存在则创建，重新生成即覆盖），返回绝对路径 */
export async function saveAudio(scriptId: string, data: Buffer): Promise<string> {
  await mkdir(AUDIO_DIR, { recursive: true });
  const filePath = audioFilePath(scriptId);
  await writeFile(filePath, data);
  return filePath;
}

/** 删除音频文件；文件不存在或删除失败均静默（不影响主流程） */
export async function deleteAudio(scriptId: string): Promise<void> {
  try {
    await unlink(audioFilePath(scriptId));
  } catch {
    // best-effort
  }
}
