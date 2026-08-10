import { NextResponse } from "next/server";
import { requireVideoAccess } from "@/services/video/guard";
import { submitVideoTask, WanError } from "@/services/video/wan";

/** POST /api/video/materials/generate — 提交通义万相文生视频任务（异步，返回 taskId） */
export async function POST(request: Request) {
  const check = await requireVideoAccess();
  if ("error" in check) return check.error;

  let body: { prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "请输入画面描述" }, { status: 400 });
  }
  if (prompt.length > 500) {
    return NextResponse.json({ error: "画面描述不能超过 500 字" }, { status: 400 });
  }

  try {
    const taskId = await submitVideoTask(prompt);
    return NextResponse.json({ taskId }, { status: 202 });
  } catch (err) {
    if (err instanceof WanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "视频生成任务提交失败，请重试" }, { status: 502 });
  }
}
