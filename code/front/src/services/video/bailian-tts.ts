/**
 * 阿里百炼（DashScope）TTS Provider：通义 CosyVoice / Qwen-TTS 系模型。
 *
 * 与非官方 Edge-TTS 不同，百炼非实时合成接口不返回句子时间戳，
 * 因此采用「按句分别合成 → 解析 WAV 得到每句精确时长 → 合并为单个 WAV」的策略，
 * 无需 ffmpeg 即可获得按句对齐的 SRT 时间轴。
 */

import type { TtsProvider, TtsResult, TtsSentence } from "./tts";

const TTS_MODEL = process.env.TTS_MODEL || "cosyvoice-v3-flash";
const SAMPLE_RATE = 24000;
/** 并发合成的句子数（太高会触发限流，太低拖慢整体） */
const CONCURRENCY = 4;

function apiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY || process.env.AI_API_KEY;
  if (!key || key === "your-api-key-here") {
    throw new Error("未配置 DASHSCOPE_API_KEY（或 AI_API_KEY），无法调用百炼语音合成");
  }
  return key;
}

function baseUrl(): string {
  return (process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com").replace(/\/$/, "");
}

/**
 * 按句切分口播稿：以句末标点为界（标点保留在前一句），
 * 超长句再按逗号二次切分，避免单句过长影响合成质量。
 */
export function splitSentences(text: string): string[] {
  const raw = text.split(/(?<=[。！？!?；;…])/);
  const out: string[] = [];
  for (let seg of raw) {
    seg = seg.trim();
    if (!seg) continue;
    if (seg.length <= 60) {
      out.push(seg);
      continue;
    }
    // 超长段按逗号切，并把末尾无标点的碎片并入下一片
    const parts = seg.split(/(?<=[，、,：:])/);
    let buf = "";
    for (const p of parts) {
      if ((buf + p).length > 60 && buf) {
        out.push(buf.trim());
        buf = p;
      } else {
        buf += p;
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}

interface WavInfo {
  /** fmt 块（不含块头），用于合并时原样复制 */
  fmtChunk: Buffer;
  dataOffset: number;
  dataSize: number;
  byteRate: number;
}

/** 解析 WAV：定位 fmt/data 块；非 WAV 返回 null */
function parseWav(buf: Buffer): WavInfo | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }
  let offset = 12;
  let fmtChunk: Buffer | null = null;
  let byteRate = 0;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      fmtChunk = buf.subarray(offset + 8, offset + 8 + size);
      byteRate = fmtChunk.readUInt32LE(8);
    } else if (id === "data") {
      dataOffset = offset + 8;
      dataSize = Math.min(size, buf.length - dataOffset);
    }
    offset += 8 + size + (size % 2);
  }
  if (!fmtChunk || dataOffset < 0 || byteRate <= 0) return null;
  return { fmtChunk, dataOffset, dataSize, byteRate };
}

/** 多段 WAV 合并为一个 WAV（各段 fmt 必须一致，取首段） */
function mergeWav(segments: Buffer[], infos: WavInfo[]): Buffer {
  const fmt = infos[0].fmtChunk;
  const channels = fmt.readUInt16LE(2);
  const sampleRate = fmt.readUInt32LE(4);
  const bits = fmt.readUInt16LE(14);
  const totalData = segments.reduce((sum, s, i) => sum + infos[i].dataSize, 0);
  const out = Buffer.alloc(44 + totalData);
  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(36 + totalData, 4);
  out.write("WAVE", 8, "ascii");
  out.write("fmt ", 12, "ascii");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(infos[0].byteRate, 28);
  out.writeUInt16LE((channels * bits) / 8, 32);
  out.writeUInt16LE(bits, 34);
  out.write("data", 36, "ascii");
  out.writeUInt32LE(totalData, 40);
  let cursor = 44;
  segments.forEach((s, i) => {
    s.copy(out, cursor, infos[i].dataOffset, infos[i].dataOffset + infos[i].dataSize);
    cursor += infos[i].dataSize;
  });
  return out;
}

/** 单句合成：调百炼非实时 TTS，返回音频字节（带一次重试） */
async function synthesizeSentence(text: string, voice: string): Promise<Buffer> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(`${baseUrl()}/api/v1/services/aigc/multimodal-generation/generation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey()}`,
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          input: { text, voice, format: "wav", sample_rate: SAMPLE_RATE },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      const json = (await resp.json()) as {
        output?: { audio?: { url?: string }; url?: string };
        code?: string;
        message?: string;
      };
      if (!resp.ok) {
        throw new Error(json.message || `HTTP ${resp.status}（${json.code ?? ""}）`);
      }
      const audioUrl = json.output?.audio?.url ?? json.output?.url;
      if (!audioUrl) throw new Error("响应中没有音频地址");
      const audioResp = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
      if (!audioResp.ok) throw new Error(`音频下载失败 HTTP ${audioResp.status}`);
      return Buffer.from(await audioResp.arrayBuffer());
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr ?? new Error("语音合成失败");
}

/** 小并发池：limit 个 worker 顺序消费 items */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return results;
}

export class BailianTtsProvider implements TtsProvider {
  async synthesize(text: string, voice: string): Promise<TtsResult> {
    const parts = splitSentences(text);
    if (parts.length === 0) throw new Error("文本为空，无法合成");

    const audios = await mapPool(parts, CONCURRENCY, (p) => synthesizeSentence(p, voice));
    const infos = audios.map((a) => parseWav(a));

    // 正常路径：全部为 WAV → 精确时长 + 合并为单个 WAV
    if (infos.every((i) => i !== null)) {
      const sentences: TtsSentence[] = [];
      let cursorMs = 0;
      parts.forEach((p, i) => {
        const info = infos[i] as NonNullable<(typeof infos)[number]>;
        const durationMs = Math.round((info.dataSize / info.byteRate) * 1000);
        sentences.push({ text: p, startMs: cursorMs, endMs: cursorMs + durationMs });
        cursorMs += durationMs;
      });
      const merged = mergeWav(audios, infos as WavInfo[]);
      return { audio: merged, sentences };
    }

    // 降级路径：引擎未按 wav 返回（如 mp3）→ 原样拼接，时长按字数比例估算
    const totalChars = parts.reduce((sum, p) => sum + p.length, 0);
    const estimatedTotalMs = Math.max(1000, Math.round((totalChars / 4.5) * 1000));
    const sentences: TtsSentence[] = [];
    let cursorMs = 0;
    for (const p of parts) {
      const dur = Math.round((p.length / Math.max(totalChars, 1)) * estimatedTotalMs);
      sentences.push({ text: p, startMs: cursorMs, endMs: cursorMs + dur });
      cursorMs += dur;
    }
    return { audio: Buffer.concat(audios), sentences };
  }
}
