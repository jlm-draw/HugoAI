"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  trackEmoji,
  trackName,
  type VideoScriptItem,
  type VideoShotItem,
} from "@/services/video/types";
import { MaterialPicker } from "./MaterialPicker";
import { NarrationPanel } from "./NarrationPanel";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function ScriptDetail({
  script,
  projectId,
  onChanged,
}: {
  script: VideoScriptItem;
  projectId: string;
  /** 配音生成成功后刷新工作台数据 */
  onChanged: () => Promise<void>;
}) {
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.add({ type: "success", title: `${label}已复制到剪贴板` });
    } catch {
      toast.add({ type: "error", title: "复制失败，请手动选择复制" });
    }
  }

  const [pickerShot, setPickerShot] = useState<VideoShotItem | null>(null);

  async function removeMaterial(shotId: string) {
    try {
      const res = await fetch(
        `/api/video/projects/${projectId}/scripts/${script.id}/shots/${shotId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ materialUrl: null }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "移除失败");
      await onChanged();
      toast.add({ type: "success", title: "素材已移除" });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "移除失败" });
    }
  }

  const totalDuration = script.shots.reduce((sum, s) => sum + s.duration, 0);
  // 中文口播语速约 4.5 字/秒，估算时长
  const estimatedSeconds = Math.round(script.narration.length / 4.5);

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      {/* 标题区 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-bold text-gray-800">{script.title}</h2>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {trackEmoji(script.track)} {trackName(script.track)}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-gray-400">
            选题：{script.topic} · {formatDate(script.createdAt)}
          </p>
          {script.news && (
            <a
              href={script.news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-xs text-blue-600 hover:underline"
              title={script.news.title}
            >
              来源：{script.news.source} · {script.news.title} ↗
            </a>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1"
          onClick={() => copy(script.narration, "口播稿")}
        >
          <Copy size={13} /> 复制口播稿
        </Button>
      </div>

      {/* 候选标题 */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">爆款标题（5 选 1，蓝色为采用项，点击复制）</p>
        <div className="flex flex-wrap gap-1.5">
          {script.titles.map((t, i) => (
            <button
              key={i}
              onClick={() => copy(t, "标题")}
              title="点击复制"
              className={
                i === 0
                  ? "rounded-full bg-blue-600 px-2.5 py-1 text-xs text-white"
                  : "rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200"
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 口播稿 */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">
          口播稿（{script.narration.length} 字 · 约 {estimatedSeconds} 秒）
        </p>
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-700">
          {script.narration}
        </div>
      </div>

      {/* 分镜表 */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">
          分镜表（{script.shots.length} 个镜头 · 共约 {totalDuration} 秒）
        </p>
        {script.shots.length === 0 ? (
          <p className="text-xs text-gray-400">AI 未返回分镜数据</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="w-10 px-2 py-1.5 text-left font-medium">#</th>
                  <th className="px-2 py-1.5 text-left font-medium">画面</th>
                  <th className="px-2 py-1.5 text-left font-medium">台词</th>
                  <th className="w-14 px-2 py-1.5 text-right font-medium">秒</th>
                  <th className="w-16 px-2 py-1.5 text-left font-medium">素材</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {script.shots.map((s) => (
                  <tr key={s.id} className="align-top">
                    <td className="px-2 py-1.5 text-gray-400">{s.sort}</td>
                    <td className="px-2 py-1.5 text-gray-600">{s.visual}</td>
                    <td className="px-2 py-1.5 text-gray-700">{s.line}</td>
                    <td className="px-2 py-1.5 text-right text-gray-500">{s.duration}</td>
                    <td className="px-2 py-1.5">
                      {s.materialUrl ? (
                        <div className="group/mat relative h-16 w-9">
                          {s.materialThumb ? (
                            <img
                              src={s.materialThumb}
                              alt=""
                              className="h-16 w-9 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-9 items-center justify-center rounded bg-violet-50 text-[10px] font-medium text-violet-500">
                              AI
                            </div>
                          )}
                          <div className="absolute inset-0 hidden flex-col items-center justify-center gap-0.5 rounded bg-black/50 group-hover/mat:flex">
                            <button
                              onClick={() => setPickerShot(s)}
                              className="text-[10px] text-white hover:underline"
                            >
                              换
                            </button>
                            <button
                              onClick={() => removeMaterial(s.id)}
                              className="text-[10px] text-white hover:underline"
                            >
                              移除
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPickerShot(s)}
                          className="rounded border border-dashed px-1.5 py-1 text-[11px] text-gray-400 hover:border-blue-300 hover:text-blue-500"
                        >
                          选/生成素材
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 配音与字幕 */}
      <NarrationPanel projectId={projectId} script={script} onGenerated={onChanged} />

      {pickerShot && (
        <MaterialPicker
          projectId={projectId}
          scriptId={script.id}
          shot={pickerShot}
          open
          onClose={() => setPickerShot(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
