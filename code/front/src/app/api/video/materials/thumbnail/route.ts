import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireVideoAccess } from "@/services/video/guard";
import { MATERIAL_URL_PREFIX, saveMaterial } from "@/services/video/material-store";

const MAX_THUMB_BYTES = 512 * 1024;

/**
 * POST /api/video/materials/thumbnail — 保存前端从生成视频里截取的封面帧（JPEG 二进制）。
 * 返回站内缩略图路径，随素材一起存入分镜。
 */
export async function POST(request: Request) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("image/jpeg")) {
    return NextResponse.json({ error: "仅支持 JPEG 图片" }, { status: 400 });
  }

  const data = Buffer.from(await request.arrayBuffer());
  if (data.length === 0 || data.length > MAX_THUMB_BYTES) {
    return NextResponse.json({ error: "缩略图大小不合法" }, { status: 400 });
  }
  // JPEG magic bytes 校验
  if (data[0] !== 0xff || data[1] !== 0xd8) {
    return NextResponse.json({ error: "不是有效的 JPEG 文件" }, { status: 400 });
  }

  const name = `thumb-${randomUUID()}.jpg`;
  await saveMaterial(name, data);
  return NextResponse.json({ fileUrl: `${MATERIAL_URL_PREFIX}${name}` }, { status: 201 });
}
