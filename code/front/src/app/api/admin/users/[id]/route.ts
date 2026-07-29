import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validateStrongPassword } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/rbac";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { email, displayName, password, roleIds, isActive, isSuperAdmin } = body;

  const data: Record<string, unknown> = {};
  if (email !== undefined) data.email = email || null;
  if (displayName !== undefined) data.displayName = displayName || null;
  if (isActive !== undefined) data.isActive = !!isActive;
  if (isSuperAdmin !== undefined) data.isSuperAdmin = !!isSuperAdmin;

  if (password) {
    const pwCheck = validateStrongPassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.message }, { status: 400 });
    }
    data.passwordHash = await hashPassword(password);
  }

  if (roleIds !== undefined) {
    await prisma.userRole.deleteMany({ where: { userId: id } });
    data.userRoles = {
      create: roleIds.map((roleId: string) => ({ roleId })),
    };
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  if (target.isSuperAdmin) {
    return NextResponse.json(
      { error: "不能删除超级管理员账户" },
      { status: 403 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
