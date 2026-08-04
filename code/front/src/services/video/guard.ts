import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserWithPerms, hasPermission } from "@/lib/rbac";

/**
 * 短视频模块统一守卫：登录态 + video:use 权限。
 * 用法对齐 requireNovelAccess 的判别联合模式：
 *   const check = await requireVideoAccess();
 *   if ("error" in check) return check.error;
 */
export async function requireVideoAccess(): Promise<{ error: NextResponse } | { userId: string }> {
  const user = await getCurrentUserWithPerms();
  if (!user) {
    return { error: NextResponse.json({ error: "未认证" }, { status: 401 }) };
  }
  if (!hasPermission(user, "video:use")) {
    return { error: NextResponse.json({ error: "没有短视频功能的使用权限" }, { status: 403 }) };
  }
  return { userId: user.id };
}

/**
 * 属主校验：只返回属于当前用户的视频项目（连同脚本与分镜）；查不到返回 null。
 * 路由中一律以 404 回应 null（兼防越权探测）。
 */
export async function getOwnedProject(projectId: string, userId: string) {
  return prisma.videoProject.findFirst({
    where: { id: projectId, userId },
    include: {
      scripts: {
        orderBy: { createdAt: "desc" },
        include: { shots: { orderBy: { sort: "asc" } } },
      },
    },
  });
}
