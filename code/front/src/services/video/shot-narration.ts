import { prisma } from "@/lib/db";

/**
 * 根据脚本当前所有分镜的台词（按 sort 排序）重新拼接口播稿，并写回 script.narration。
 * 同时 touch script.updatedAt 让导出缓存失效。
 *
 * 使用场景：
 * - 分镜被删除后
 * - 分镜台词被修改后
 * - 生成配音前（保证 TTS 用的文本与分镜表一致）
 *
 * @returns 拼接后的口播稿文本；若没有分镜则返回 null（不会写入）
 */
export async function syncNarrationFromShots(scriptId: string): Promise<string | null> {
  const shots = await prisma.videoShot.findMany({
    where: { scriptId },
    orderBy: { sort: "asc" },
    select: { line: true },
  });
  if (shots.length === 0) return null;

  const narration = shots.map((s) => s.line).join("");
  if (!narration.trim()) return null;

  await prisma.videoScript.update({
    where: { id: scriptId },
    data: { narration, updatedAt: new Date() },
  });
  return narration;
}
