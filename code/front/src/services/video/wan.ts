/**
 * 通义万相（阿里百炼 DashScope）文生视频客户端。
 * 异步任务模式：提交 → 轮询 → SUCCEEDED 后立即下载（OSS 链接 24 小时过期）。
 */

const VIDEO_MODEL = process.env.VIDEO_GEN_MODEL || "wan2.7-t2v";

export class WanError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function apiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY || process.env.AI_API_KEY;
  if (!key || key === "your-api-key-here") {
    throw new WanError(503, "未配置 DASHSCOPE_API_KEY（或 AI_API_KEY），无法生成视频素材");
  }
  return key;
}

function baseUrl(): string {
  return (process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com").replace(/\/$/, "");
}

/** 提交文生视频异步任务，返回 task_id */
export async function submitVideoTask(prompt: string): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(`${baseUrl()}/api/v1/services/aigc/video-generation/video-synthesis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: VIDEO_MODEL,
        input: { prompt },
        parameters: {
          resolution: "720P",
          ratio: "9:16", // 竖屏短视频
          duration: 5,
          watermark: false,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new WanError(502, "视频生成服务连接失败，请稍后再试");
  }

  const json = (await resp.json()) as { output?: { task_id?: string }; message?: string; code?: string };
  if (!resp.ok || !json.output?.task_id) {
    throw new WanError(resp.status === 401 || resp.status === 403 ? 503 : 502,
      `视频生成任务提交失败：${json.message || resp.status}${json.code ? `（${json.code}）` : ""}`);
  }
  return json.output.task_id;
}

export interface WanTaskState {
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
  videoUrl: string | null;
  message: string | null;
}

/** 查询任务状态；SUCCEEDED 时附带视频直链（24 小时有效） */
export async function queryVideoTask(taskId: string): Promise<WanTaskState> {
  let resp: Response;
  try {
    resp = await fetch(`${baseUrl()}/api/v1/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new WanError(502, "查询生成进度失败，请重试");
  }

  const json = (await resp.json()) as {
    output?: { task_status?: string; video_url?: string; message?: string };
    message?: string;
  };
  if (!resp.ok) {
    throw new WanError(502, `查询生成进度失败：${json.message || resp.status}`);
  }
  const status = (json.output?.task_status ?? "UNKNOWN") as WanTaskState["status"];
  return {
    status,
    videoUrl: json.output?.video_url ?? null,
    message: json.output?.message ?? json.message ?? null,
  };
}

/** 下载生成的视频到本地（OSS 链接 24 小时过期，必须落库前落盘） */
export async function downloadVideo(url: string): Promise<Buffer> {
  let resp: Response;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  } catch {
    throw new WanError(502, "生成结果下载失败，请重新生成");
  }
  if (!resp.ok) throw new WanError(502, `生成结果下载失败 HTTP ${resp.status}`);
  const data = Buffer.from(await resp.arrayBuffer());
  if (data.length < 10_000) throw new WanError(502, "生成结果异常（文件过小），请重新生成");
  return data;
}
