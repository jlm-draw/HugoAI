import { parseSrt } from "@/services/video/srt";

/** 导出清单中的分镜（对应 Python build_draft.py 读取的字段） */
export interface ManifestShot {
  file: string; // 相对路径 materials/NN.mp4
  sourceUrl: string; // Pexels 直链（下载用）
  sort: number; // 分镜号（告警/清单展示用）
  startMs: number;
  durationMs: number;
}

export interface ExportManifest {
  draftName: string;
  canvas: { width: number; height: number };
  audio: { file: string; durationMs: number };
  subtitle: string;
  shots: ManifestShot[];
}

/** 导出所需的脚本结构（Prisma VideoScript+shots 的结构子集） */
export interface ExportableScript {
  id: string;
  title: string;
  srt: string | null;
  shots: Array<{ sort: number; duration: number; materialUrl: string | null }>;
}

/** 竖屏短视频画布 9:16 */
export const CANVAS = { width: 1080, height: 1920 } as const;

/** 清洗剪映草稿文件夹名（= zip 名）中的非法字符 */
export function sanitizeDraftName(title: string): string {
  return title.replace(/[\\/:*?"<>|\r\n\t]/g, "").trim().slice(0, 50) || "剪映草稿";
}

/** 配音时长 = SRT 各句结束时间戳最大值（SRT 与 mp3 同源于 Edge-TTS 边界事件） */
export function audioDurationFromSrt(srt: string): number {
  return parseSrt(srt).reduce((max, c) => Math.max(max, c.endMs), 0);
}

/**
 * 构建导出清单：各分镜时长按估算比例缩放到配音实际时长。
 * 用累积比例计算 end，避免逐项舍入漂移；最后一镜 end 恒等于配音时长。
 */
export function buildManifest(script: ExportableScript): ExportManifest {
  if (!script.srt) throw new Error("请先合成配音");
  const audioDurationMs = audioDurationFromSrt(script.srt);
  if (audioDurationMs <= 0) throw new Error("字幕时间轴异常，请重新合成配音");
  const missing = script.shots.filter((s) => !s.materialUrl);
  if (missing.length > 0) {
    throw new Error(`分镜 ${missing.map((s) => s.sort).join("、")} 未选择素材`);
  }

  const totalSec = script.shots.reduce((sum, s) => sum + s.duration, 0);
  let prevEnd = 0;
  let cum = 0;
  const shots: ManifestShot[] = script.shots.map((s, i) => {
    cum += s.duration;
    const end =
      i === script.shots.length - 1
        ? audioDurationMs
        : Math.round((cum / Math.max(totalSec, 1)) * audioDurationMs);
    const seg: ManifestShot = {
      file: `materials/${String(s.sort).padStart(2, "0")}.mp4`,
      sourceUrl: s.materialUrl as string,
      sort: s.sort,
      startMs: prevEnd,
      durationMs: Math.max(200, end - prevEnd),
    };
    prevEnd = end;
    return seg;
  });

  return {
    draftName: sanitizeDraftName(script.title),
    canvas: { ...CANVAS },
    audio: { file: "audio.mp3", durationMs: audioDurationMs },
    subtitle: "subtitle.srt",
    shots,
  };
}
