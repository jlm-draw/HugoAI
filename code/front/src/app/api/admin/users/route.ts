import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validateStrongPassword } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/rbac";

export async function GET() {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      isActive: true,
      isSuperAdmin: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        include: {
          role: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const body = await request.json();
  const { username, email, password, displayName, roleIds = [], isActive = true } = body;

  if (!username || !password) {
    return NextResponse.json(
      { error: "用户名和密码必填" },
      { status: 400 }
    );
  }

  const pwCheck = validateStrongPassword(password);
  if (!pwCheck.valid) {
    return NextResponse.json({ error: pwCheck.message }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
  }

  if (email) {
    const emailExisting = await prisma.user.findUnique({ where: { email } });
    if (emailExisting) {
      return NextResponse.json({ error: "邮箱已被使用" }, { status: 409 });
    }
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      username,
      email: email || null,
      passwordHash,
      displayName: displayName || null,
      isActive,
      userRoles: {
        create: roleIds.map((roleId: string) => ({ roleId })),
      },
    },
    select: { id: true, username: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
