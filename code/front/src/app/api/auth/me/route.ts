import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const tokenUser = await getCurrentUser();
  if (!tokenUser) {
    return NextResponse.json({ error: "未认证" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenUser.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      avatar: true,
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

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 401 });
  }

  const permissions = new Set<string>();
  user.userRoles.forEach((ur: { role: { rolePerms: { permission: { code: string } }[] } }) => {
    ur.role.rolePerms.forEach((rp: { permission: { code: string } }) => {
      permissions.add(rp.permission.code);
    });
  });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.isSuperAdmin ? ["*"] : Array.from(permissions),
    },
  });
}
