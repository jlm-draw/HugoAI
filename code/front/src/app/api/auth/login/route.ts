import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
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
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "账户已被禁用，请联系管理员" },
        { status: 403 }
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const permissions = new Set<string>();
    user.userRoles.forEach((ur: { role: { rolePerms: { permission: { code: string } }[] } }) => {
      ur.role.rolePerms.forEach((rp: { permission: { code: string } }) => {
        permissions.add(rp.permission.code);
      });
    });

    const token = await signToken({
      userId: user.id,
      username: user.username,
      isSuperAdmin: user.isSuperAdmin,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        permissions: user.isSuperAdmin ? ["*"] : Array.from(permissions),
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
