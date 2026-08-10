import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { BailianTtsProvider } from "./bailian-tts";

/** 字幕句子：文本 + 起止毫秒时间戳 */
export interface TtsSentence {
  text: string;
  startMs: number;
  endMs: number;
}

/** 一次合成的产物：音频二进制 + 句子时间戳 */
export interface TtsResult {
  audio: Buffer;
  sentences: TtsSentence[];
}

/**
 * TTS 引擎抽象：日后接入 CosyVoice/其他引擎只需新增实现并在 getTtsProvider 切换。
 */
export interface TtsProvider {
  synthesize(text: string, voice: string): Promise<TtsResult>;
}

/** msedge-tts 元数据中的边界事件（只列用到的字段） */
interface EdgeBoundary {
  Type: string;
  Data?: {
    Offset: number; // 单位 100ns
    Duration: number; // 单位 100ns
    text?: { Text?: string };
  };
}

/** Edge-TTS 实现：整段合成 + 句子边界时间戳 */
export class EdgeTtsProvider implements TtsProvider {
  async synthesize(text: string, voice: string): Promise<TtsResult> {
    const tts = new MsEdgeTTS();
    const dir = await mkdtemp(path.join(os.tmpdir(), "hugoai-tts-"));
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
        sentenceBoundaryEnabled: true,
      });
      const { audioFilePath, metadataFilePath } = await tts.toFile(dir, text);
      const audio = await readFile(audioFilePath);

      let sentences: TtsSentence[] = [];
      if (metadataFilePath) {
        try {
          const meta = JSON.parse(await readFile(metadataFilePath, "utf-8")) as {
            Metadata?: EdgeBoundary[];
          };
          sentences = (meta.Metadata ?? [])
            .filter((m) => m.Type === "SentenceBoundary" && m.Data)
            .map((m) => ({
              text: m.Data?.text?.Text?.trim() ?? "",
              startMs: Math.round((m.Data?.Offset ?? 0) / 10000),
              endMs: Math.round(((m.Data?.Offset ?? 0) + (m.Data?.Duration ?? 0)) / 10000),
            }))
            .filter((s) => s.text.length > 0);
        } catch {
          // 元数据缺失/解析异常：走下方单句降级
        }
      }

      // 降级：拿不到句子边界时，用估算时长产出整段单句字幕（保证音频仍可用）
      if (sentences.length === 0) {
        const estimatedMs = Math.max(1000, Math.round((text.length / 4.5) * 1000));
        sentences = [{ text, startMs: 0, endMs: estimatedMs }];
      }

      return { audio, sentences };
    } catch (err) {
      throw new Error(
        err instanceof Error ? `语音合成失败：${err.message}` : "语音合成失败，请重试"
      );
    } finally {
      tts.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
}

/**
 * 当前 TTS 实现：
 * - TTS_ENGINE=edge    → Microsoft Edge TTS（免费非官方，兜底用）
 * - 其余/默认（bailian）→ 阿里百炼 CosyVoice/Qwen-TTS（TTS_MODEL 可换模型）
 */
export function getTtsProvider(): TtsProvider {
  if ((process.env.TTS_ENGINE ?? "").toLowerCase() === "edge") {
    return new EdgeTtsProvider();
  }
  return new BailianTtsProvider();
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

/** 毫秒 → SRT 时间戳 `HH:MM:SS,mmm` */
export function srtTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const h = Math.floor(safe / 3600000);
  const m = Math.floor((safe % 3600000) / 60000);
  const s = Math.floor((safe % 60000) / 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(safe % 1000, 3)}`;
}

/** 句子时间戳 → 标准 SRT 文本（序号 + 时间轴 + 文本，块间空行） */
export function toSrt(sentences: TtsSentence[]): string {
  return sentences
    .map((s, i) => `${i + 1}\n${srtTime(s.startMs)} --> ${srtTime(s.endMs)}\n${s.text}\n`)
    .join("\n");
}
