import { NextResponse } from "next/server";
import { requireVideoAccess } from "@/services/video/guard";
import { downloadVideo, queryVideoTask, WanError } from "@/services/video/wan";
import {
  MATERIAL_URL_PREFIX,
  isSafeName,
  materialExists,
  saveMaterial,
} from "@/services/video/material-store";

/**
 * GET /api/video/materials/generate/[taskId] — 查询生成进度。
 * SUCCEEDED 时服务端立即把视频下载到本地（OSS 直链 24 小时过期），返回站内素材路径。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;
  const { taskId } = await params;

  if (!isSafeName(taskId)) {
    return NextResponse.json({ error: "非法的任务 ID" }, { status: 400 });
  }

  // 已下载过直接返回本地路径（前端重复轮询/刷新不重复拉取）
  const name = `${taskId}.mp4`;
  if (await materialExists(name)) {
    return NextResponse.json({ status: "SUCCEEDED", fileUrl: `${MATERIAL_URL_PREFIX}${name}` });
  }

  try {
    const state = await queryVideoTask(taskId);
    if (state.status === "SUCCEEDED") {
      if (!state.videoUrl) {
        return NextResponse.json({ error: "生成完成但未返回视频地址，请重新生成" }, { status: 502 });
      }
      const data = await downloadVideo(state.videoUrl);
      await saveMaterial(name, data);
      return NextResponse.json({ status: "SUCCEEDED", fileUrl: `${MATERIAL_URL_PREFIX}${name}` });
    }
    if (state.status === "FAILED" || state.status === "CANCELED" || state.status === "UNKNOWN") {
      return NextResponse.json(
        { error: state.message || "视频生成失败，请调整描述后重试" },
        { status: 502 }
      );
    }
    return NextResponse.json({ status: state.status });
  } catch (err) {
    if (err instanceof WanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "查询生成进度失败，请重试" }, { status: 502 });
  }
}
