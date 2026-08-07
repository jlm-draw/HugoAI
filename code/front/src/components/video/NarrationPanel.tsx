"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Film, Loader2, Mic, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DEFAULT_VOICE, VOICES, type VideoScriptItem } from "@/services/video/types";
import { parseSrt, type SrtCue } from "@/services/video/srt";

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

interface Props {
  projectId: string;
  script: VideoScriptItem;
  /** 配音生成成功后调用（工作台刷新数据） */
  onGenerated: () => Promise<void>;
}

export function NarrationPanel({ projectId, script, onGenerated }: Props) {
  const [voice, setVoice] = useState<string>(script.voice ?? DEFAULT_VOICE);
  const [generating, setGenerating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [exporting, setExporting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cues = useMemo(() => (script.srt ? parseSrt(script.srt) : []), [script.srt]);
  const hasAudio = Boolean(script.audioUrl);

  // 播放进度 → 当前字幕行（取「最近开始」的一句，兼容引擎时间戳的相邻句轻微重叠）
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    function onTime() {
      const el = audioRef.current;
      if (!el) return;
      const ms = el.currentTime * 1000;
      let idx = -1;
      for (let i = 0; i < cues.length; i++) {
        if (ms >= cues[i].startMs) idx = i;
      }
      setActiveIndex(idx);
    }
    audio.addEventListener("timeupdate", onTime);
    return () => audio.removeEventListener("timeupdate", onTime);
  }, [hasAudio, cues, script.audioUrl]);

  // 当前行变化时滚动到可见区域
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`srt-line-${script.id}-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, script.id]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/video/projects/${projectId}/scripts/${script.id}/narration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "配音生成失败");
      await onGenerated();
      toast.add({ type: "success", title: "配音已生成" });
    } catch (err) {
      toast.add({
        type: "error",
        title: err instanceof Error ? err.message : "配音生成失败",
      });
    } finally {
      setGenerating(false);
    }
  }

  function downloadSrt() {
    if (!script.srt) return;
    const blob = new Blob([script.srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.title}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/video/projects/${projectId}/scripts/${script.id}/export`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "导出失败");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${script.title}-剪映草稿.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.add({ type: "success", title: "已导出，按压缩包内 README 导入剪映" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "导出失败" });
    } finally {
      setExporting(false);
    }
  }

  function seekTo(cue: SrtCue) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = cue.startMs / 1000;
    void audio.play();
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-500">配音与字幕</p>
      <div className="space-y-3 rounded-lg bg-gray-50 p-3">
        {/* 音色选择 + 生成/重新生成 + 下载 */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-gray-400">音色</Label>
            <Select
              value={voice}
              onValueChange={(v: string | null) => setVoice(v ?? DEFAULT_VOICE)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择音色">
                  {(v: string | null) => {
                    const item = VOICES.find((x) => x.id === v);
                    return item ? `${item.name}（${item.gender} · ${item.style}）` : "选择音色";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}（{v.gender} · {v.style}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="sm" className="gap-1.5">
            {generating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : hasAudio ? (
              <RefreshCw size={13} />
            ) : (
              <Mic size={13} />
            )}
            {generating ? "合成中…" : hasAudio ? "重新生成配音" : "生成配音"}
          </Button>
          {hasAudio && (
            <div className="flex gap-1.5">
              <a
                href={script.audioUrl ?? undefined}
                download={`${script.title}.mp3`}
                className="inline-flex h-8 items-center gap-1 rounded-lg border bg-white px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Download size={13} /> 下载 MP3
              </a>
              <button
                onClick={downloadSrt}
                className="inline-flex h-8 items-center gap-1 rounded-lg border bg-white px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Download size={13} /> 下载 SRT
              </button>
            </div>
          )}
          <button
            onClick={handleExport}
            disabled={!hasAudio || exporting}
            title={hasAudio ? "导出为剪映草稿（素材 + 配音 + 字幕）" : "请先合成配音"}
            className="inline-flex h-8 items-center gap-1 rounded-lg border bg-white px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
            {exporting ? "导出中…" : "导出剪映草稿"}
          </button>
        </div>

        {generating && (
          <p className="text-[11px] text-gray-400">正在合成语音，约需 10-30 秒，请勿关闭页面…</p>
        )}

        {hasAudio ? (
          <>
            <audio
              ref={audioRef}
              controls
              src={script.audioUrl ?? undefined}
              preload="metadata"
              className="w-full"
            />
            {cues.length > 0 && (
              <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border bg-white p-1.5">
                {cues.map((c, i) => (
                  <button
                    key={c.index}
                    id={`srt-line-${script.id}-${i}`}
                    onClick={() => seekTo(c)}
                    className={cn(
                      "block w-full rounded px-2 py-1 text-left text-xs",
                      i === activeIndex
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <span className="mr-1.5 font-mono text-[10px] text-gray-400">
                      {fmtTime(c.startMs)}
                    </span>
                    {c.text}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          !generating && (
            <p className="text-[11px] text-gray-400">
              选择音色后点「生成配音」，产出 mp3 音频与按句对齐的 SRT 字幕
            </p>
          )
        )}
      </div>
    </div>
  );
}
