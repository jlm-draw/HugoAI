import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { requireVideoAccess } from "@/services/video/guard";
import { isSafeName, materialPath } from "@/services/video/material-store";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** GET /api/video/materials/file/[name] — 下发本地 AI 生成素材（带鉴权） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { name } = await params;

  if (!isSafeName(name)) {
    return NextResponse.json({ error: "非法的文件名" }, { status: 400 });
  }
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
  }

  try {
    const data = await readFile(materialPath(name));
    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "素材文件不存在，请重新生成" }, { status: 404 });
  }
}
