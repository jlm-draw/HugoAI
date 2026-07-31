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
  const { name, path, icon, sort, parentId, isVisible, permissionCode } = body;

  if (parentId) {
    if (parentId === id) {
      return NextResponse.json(
        { error: "不能将自身设为父菜单" },
        { status: 400 }
      );
    }
    const children = await getDescendantIds(id);
    if (children.includes(parentId)) {
      return NextResponse.json(
        { error: "不能将子菜单设为父菜单" },
        { status: 400 }
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (path !== undefined) data.path = path || null;
  if (icon !== undefined) data.icon = icon || null;
  if (sort !== undefined) data.sort = sort;
  if (parentId !== undefined) data.parentId = parentId || null;
  if (isVisible !== undefined) data.isVisible = !!isVisible;
  if (permissionCode !== undefined) data.permissionCode = permissionCode || null;

  const menu = await prisma.menu.update({ where: { id }, data });
  return NextResponse.json({ menu });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  await prisma.menu.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

async function getDescendantIds(id: string): Promise<string[]> {
  const children = await prisma.menu.findMany({ where: { parentId: id } });
  let ids = children.map((c: { id: string }) => c.id);
  for (const child of children) {
    ids = ids.concat(await getDescendantIds(child.id));
  }
  return ids;
}
