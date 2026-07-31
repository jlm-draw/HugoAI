import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";

export async function GET() {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const menus = await prisma.menu.findMany({
    include: {
      children: true,
    },
    orderBy: [{ parentId: "asc" }, { sort: "asc" }],
  });

  const buildTree = (parentId: string | null): MenuNode[] => {
    return menus
      .filter((m: { parentId: string | null }) => (m.parentId ?? null) === parentId)
      .sort((a: { sort: number }, b: { sort: number }) => a.sort - b.sort)
      .map((m: { id: string; name: string; path: string | null; icon: string | null; sort: number; isVisible: boolean; permissionCode: string | null }) => ({
        id: m.id,
        name: m.name,
        path: m.path,
        icon: m.icon,
        sort: m.sort,
        isVisible: m.isVisible,
        permissionCode: m.permissionCode,
        children: buildTree(m.id),
      }));
  };

  const tree = buildTree(null);
  return NextResponse.json({ menus: tree, flat: menus });
}

export async function POST(request: Request) {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const body = await request.json();
  const { name, path, icon, sort, parentId, isVisible, permissionCode } = body;

  if (!name) {
    return NextResponse.json({ error: "菜单名称必填" }, { status: 400 });
  }

  const menu = await prisma.menu.create({
    data: {
      name,
      path: path || null,
      icon: icon || null,
      sort: sort ?? 0,
      parentId: parentId || null,
      isVisible: isVisible !== false,
      permissionCode: permissionCode || null,
    },
  });

  return NextResponse.json({ menu }, { status: 201 });
}

interface MenuNode {
  id: string;
  name: string;
  path: string | null;
  icon: string | null;
  sort: number;
  isVisible: boolean;
  permissionCode: string | null;
  children: MenuNode[];
}
