/**
 * Pexels 视频搜索服务：服务端代理，API key 只存在服务端环境变量。
 * 文档：https://www.pexels.com/api/documentation/
 */

export interface PexelsVideo {
  id: string;
  thumb: string;
  duration: number;
  files: Array<{ quality: string; width: number; height: number; link: string }>;
}

/** 带 HTTP 状态语义的错误，由路由映射为对应响应 */
export class PexelsError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

interface RawFile {
  quality?: string;
  width?: number;
  height?: number;
  link?: string;
  file_type?: string;
}

/** 每个视频最多保留 2 个文件：优先 hd 次选 sd（uhd 过大，不传给前端） */
function pickFiles(raw: RawFile[]): PexelsVideo["files"] {
  const vids = raw.filter((f) => (f.file_type ?? "video/mp4") === "video/mp4" && f.link);
  const hd = vids.find((f) => f.quality === "hd");
  const sd = vids.find((f) => f.quality === "sd");
  return [hd, sd]
    .filter((f): f is RawFile => Boolean(f))
    .map((f) => ({
      quality: f.quality ?? "sd",
      width: f.width ?? 0,
      height: f.height ?? 0,
      link: f.link as string,
    }));
}

export async function searchPexelsVideos(opts: {
  query: string;
  orientation: "portrait" | "landscape" | "square" | "all";
  page: number;
}): Promise<{ videos: PexelsVideo[]; nextPage: number | null }> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    throw new PexelsError(503, "未配置 PEXELS_API_KEY，请在 .env.local 中添加");
  }

  const url = new URL("https://api.pexels.com/v1/videos/search");
  url.searchParams.set("query", opts.query);
  url.searchParams.set("per_page", "12");
  url.searchParams.set("size", "medium");
  url.searchParams.set("page", String(opts.page));
  if (opts.orientation !== "all") url.searchParams.set("orientation", opts.orientation);

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new PexelsError(502, "素材获取失败，请稍后再试");
  }

  if (!resp.ok) {
    const message =
      resp.status === 429 ? "素材请求过于频繁（Pexels 限流），请稍后再试" : "素材获取失败，请稍后再试";
    throw new PexelsError(502, message);
  }

  const data = (await resp.json()) as {
    videos?: Array<{ id?: number; duration?: number; image?: string; video_files?: RawFile[] }>;
    next_page?: string | number | null;
  };

  const videos: PexelsVideo[] = (data.videos ?? [])
    .filter((v) => v.id !== undefined)
    .map((v) => ({
      id: String(v.id),
      thumb: v.image ?? "",
      duration: v.duration ?? 0,
      files: pickFiles(v.video_files ?? []),
    }));

  const next = Number(data.next_page);
  return { videos, nextPage: Number.isFinite(next) && next > opts.page ? next : null };
}
