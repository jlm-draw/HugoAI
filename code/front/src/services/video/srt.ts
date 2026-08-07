/** SRT 字幕条目 */
export interface SrtCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

function timeToMs(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600000 + Number(m) * 60000 + Number(s) * 1000 + Number(ms);
}

/** 解析 SRT 文本为字幕条目；格式异常的分块直接跳过 */
export function parseSrt(srt: string): SrtCue[] {
  const cues: SrtCue[] = [];
  for (const block of srt.split(/\n\s*\n/)) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const index = Number(lines[0]);
    const m = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!Number.isFinite(index) || !m) continue;
    cues.push({
      index,
      startMs: timeToMs(m[1], m[2], m[3], m[4]),
      endMs: timeToMs(m[5], m[6], m[7], m[8]),
      text: lines.slice(2).join(" "),
    });
  }
  return cues;
}
