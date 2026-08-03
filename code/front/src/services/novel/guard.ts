import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserWithPerms, hasPermission } from "@/lib/rbac";

/**
 * 小说模块统一守卫：登录态 + novel:use 权限。
 * 用法对齐 requireSuperAdmin 的判别联合模式：
 *   const check = await requireNovelAccess();
 *   if ("error" in check) return check.error;
 */
export async function requireNovelAccess(): Promise<{ error: NextResponse } | { userId: string }> {
  const user = await getCurrentUserWithPerms();
  if (!user) {
    return { error: NextResponse.json({ error: "未认证" }, { status: 401 }) };
  }
  if (!hasPermission(user, "novel:use")) {
    return { error: NextResponse.json({ error: "没有小说写作功能的使用权限" }, { status: 403 }) };
  }
  return { userId: user.id };
}

/** 轻量属主校验：仅判断小说是否属于当前用户 */
export async function ownsNovel(novelId: string, userId: string): Promise<boolean> {
  const found = await prisma.novel.findFirst({
    where: { id: novelId, userId },
    select: { id: true },
  });
  return found !== null;
}

/**
 * 属主校验：只返回属于当前用户的小说；查不到返回 null。
 * 路由中一律以 404 回应 null（兼防越权探测）。
 */
export async function getOwnedNovel(novelId: string, userId: string) {
  return prisma.novel.findFirst({
    where: { id: novelId, userId },
    include: { worldSetting: true, characters: true, relations: true },
  });
}
