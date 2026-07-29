import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { name, description, permissionIds, menuIds, isSystem } = body;

  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  }

  if (existing.isSystem && name !== undefined) {
    return NextResponse.json(
      { error: "系统角色不可修改名称" },
      { status: 403 }
    );
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description || null;
  if (isSystem !== undefined) data.isSystem = !!isSystem;

  if (permissionIds !== undefined) {
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    data.rolePerms = {
      create: permissionIds.map((permissionId: string) => ({ permissionId })),
    };
  }

  if (menuIds !== undefined) {
    await prisma.roleMenu.deleteMany({ where: { roleId: id } });
    data.roleMenus = {
      create: menuIds.map((menuId: string) => ({ menuId })),
    };
  }

  const role = await prisma.role.update({ where: { id }, data });
  return NextResponse.json({ role });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;

  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  }
  if (role.isSystem) {
    return NextResponse.json(
      { error: "系统角色不可删除" },
      { status: 403 }
    );
  }

  await prisma.role.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
