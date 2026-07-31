import { prisma } from "./db";
import { getCurrentUser } from "./auth";
import { NextResponse } from "next/server";

export async function requireSuperAdmin() {
  const tokenUser = await getCurrentUser();
  if (!tokenUser) {
    return { error: NextResponse.json({ error: "未认证" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenUser.userId },
    select: { isSuperAdmin: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return { error: NextResponse.json({ error: "账户不可用" }, { status: 403 }) };
  }

  if (!user.isSuperAdmin) {
    return { error: NextResponse.json({ error: "需要超级管理员权限" }, { status: 403 }) };
  }

  return { userId: tokenUser.userId };
}

export async function getCurrentUserWithPerms() {
  const tokenUser = await getCurrentUser();
  if (!tokenUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: tokenUser.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      isSuperAdmin: true,
      isActive: true,
      userRoles: {
        include: {
          role: {
            include: {
              rolePerms: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const permissions = new Set<string>();
  user.userRoles.forEach((ur: { role: { rolePerms: { permission: { code: string } }[] } }) => {
    ur.role.rolePerms.forEach((rp: { permission: { code: string } }) => permissions.add(rp.permission.code));
  });

  return { ...user, permissions };
}

export function hasPermission(
  user: { isSuperAdmin: boolean; permissions: Set<string> },
  permissionCode: string
) {
  if (user.isSuperAdmin) return true;
  return user.permissions.has(permissionCode);
}
