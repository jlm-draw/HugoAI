import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";

export async function GET() {
  const check = await requireSuperAdmin();
  if ("error" in check) return check.error;

  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { code: "asc" }],
  });

  return NextResponse.json({ permissions });
}
