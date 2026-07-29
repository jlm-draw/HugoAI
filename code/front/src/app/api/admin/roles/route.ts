import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";

export async function GET() {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const roles = await prisma.role.findMany({
    include: {
      rolePerms: { include: { permission: true } },
      roleMenus: { include: { menu: true } },
      _count: { select: { userRoles: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ roles });
}

export async function POST(request: Request) {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const body = await request.json();
  const { name, code, description, permissionIds = [], menuIds = [] } = body;

  if (!name || !code) {
    return NextResponse.json(
      { error: "角色名称和编码必填" },
      { status: 400 }
    );
  }

  const existing = await prisma.role.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "角色编码已存在" }, { status: 409 });
  }

  const role = await prisma.role.create({
    data: {
      name,
      code,
      description: description || null,
      rolePerms: {
        create: permissionIds.map((permissionId: string) => ({ permissionId })),
      },
      roleMenus: {
        create: menuIds.map((menuId: string) => ({ menuId })),
      },
    },
  });

  return NextResponse.json({ role }, { status: 201 });
}
