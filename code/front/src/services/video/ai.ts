import { chat, extractJson } from "@/lib/ai";
import { systemScriptGenerate } from "./prompts";
import { trackName, type TrackCode } from "./types";

/** AI 生成的一条脚本（入库前的中间结构） */
export interface GeneratedScript {
  titles: string[];
  narration: string;
  shots: Array<{ visual: string; line: string; duration: number; materialQuery: string | null }>;
}

/** 注入生成流程的新闻素材 */
export interface NewsMaterial {
  newsTitle: string;
  source: string;
  content: string | null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clampDuration(v: unknown): number {
  const n = typeof v === "number" ? Math.round(v) : Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.min(30, Math.max(1, n));
}

/** AI 脚本生成：选题 → 5 个标题 + 60 秒口播稿 + 分镜表 */
export async function generateScript(
  track: TrackCode,
  topic: string,
  positioning: string | null,
  material?: NewsMaterial | null
): Promise<GeneratedScript> {
  const parts = [`选题：${topic}`];
  if (material) {
    parts.push(`【新闻素材】\n标题：${material.newsTitle}\n来源：${material.source}`);
    if (material.content) {
      parts.push(`正文：${material.content}`);
    }
  }
  parts.push("请策划完整的短视频脚本。");

  const result = await chat(
    [
      {
        role: "user",
        content: parts.join("\n"),
      },
    ],
    {
      systemPrompt: systemScriptGenerate(trackName(track), positioning),
      temperature: 0.8,
      maxTokens: 4000,
    }
  );

  const parsed = extractJson(result) as {
    titles?: unknown;
    narration?: unknown;
    shots?: unknown;
  };

  const titles = Array.isArray(parsed?.titles)
    ? parsed.titles
        .slice(0, 5)
        .map((t) => str(t).trim())
        .filter(Boolean)
    : [];

  const narration = str(parsed?.narration).trim();

  const shots = Array.isArray(parsed?.shots)
    ? parsed.shots
        .slice(0, 30)
        .map(
          (s: { visual?: unknown; line?: unknown; duration?: unknown; materialQuery?: unknown }) => ({
            visual: str(s?.visual).trim(),
            line: str(s?.line).trim(),
            duration: clampDuration(s?.duration),
            materialQuery: str(s?.materialQuery).trim().slice(0, 80) || null,
          })
        )
    : [];

  if (titles.length === 0 || !narration) {
    throw new Error("AI 输出格式异常，请重试");
  }

  return { titles, narration, shots };
}
