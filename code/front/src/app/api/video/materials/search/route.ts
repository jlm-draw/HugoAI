import { NextResponse } from "next/server";
import { requireVideoAccess } from "@/services/video/guard";
import { PexelsError, searchPexelsVideos } from "@/services/video/pexels";

const ORIENTATIONS = ["portrait", "landscape", "square", "all"] as const;

/** GET /api/video/materials/search — Pexels 视频搜索代理（key 不出服务端） */
export async function GET(request: Request) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "请输入搜索关键词" }, { status: 400 });
  }
  if (query.length > 80) {
    return NextResponse.json({ error: "关键词不能超过 80 字" }, { status: 400 });
  }

  const orientation = searchParams.get("orientation") ?? "portrait";
  if (!ORIENTATIONS.includes(orientation as (typeof ORIENTATIONS)[number])) {
    return NextResponse.json({ error: "无效的画面方向" }, { status: 400 });
  }

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  try {
    const result = await searchPexelsVideos({
      query,
      orientation: orientation as (typeof ORIENTATIONS)[number],
      page,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PexelsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "素材获取失败，请稍后再试" }, { status: 502 });
  }
}
