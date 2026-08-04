import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVideoAccess } from "@/services/video/guard";

/** DELETE /api/video/projects/[id]/scripts/[scriptId] — 删除单个脚本（级联删除分镜） */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { id, scriptId } = await params;

  const script = await prisma.videoScript.findFirst({
    where: { id: scriptId, projectId: id },
    select: { id: true, project: { select: { userId: true } } },
  });
  if (!script || script.project.userId !== check.userId) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  await prisma.videoScript.delete({ where: { id: scriptId } });
  return NextResponse.json({ success: true });
}
