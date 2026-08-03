"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import type { ChapterItem, ChapterOutlineItem } from "@/services/novel/types";

interface Props {
  open: boolean;
  novelId: string;
  /** 小说简介，作为剧情方向的默认值 */
  defaultDirection: string;
  /** 已有章节数（用于提示追加位置） */
  existingChapterCount: number;
  onClose: () => void;
  /** 采纳后章节创建完成的回调 */
  onAdopted: (chapters: ChapterItem[]) => void;
}

export function OutlineAiDialog({
  open,
  novelId,
  defaultDirection,
  existingChapterCount,
  onClose,
  onAdopted,
}: Props) {
  const [chapterCount, setChapterCount] = useState(8);
  const [direction, setDirection] = useState(defaultDirection);
  const [preview, setPreview] = useState<ChapterOutlineItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开目标变化时在渲染期重置（避免 effect 同步 setState）
  const dialogKey = open ? "open" : null;
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (dialogKey !== lastKey) {
    setLastKey(dialogKey);
    if (dialogKey !== null) {
      setChapterCount(8);
      setDirection(defaultDirection);
      setPreview(null);
      setError(null);
    }
  }

  async function generate() {
    if (!Number.isInteger(chapterCount) || chapterCount < 1 || chapterCount > 20) {
      setError("章节数量需在 1-20 之间");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/novel/${novelId}/ai/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterCount, direction: direction.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成大纲失败");
      setPreview(json.chapters as ChapterOutlineItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成大纲失败");
    } finally {
      setBusy(false);
    }
  }

  async function adopt() {
    if (!preview || preview.length === 0) return;
    setAdopting(true);
    setError(null);
    try {
      const created: ChapterItem[] = [];
      for (const item of preview) {
        const res = await fetch(`/api/novel/${novelId}/chapters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: item.title, summary: item.summary }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `创建「${item.title}」失败`);
        created.push(json.chapter);
      }
      toast.add({ type: "success", title: `已创建 ${created.length} 个章节` });
      onAdopted(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建章节失败");
    } finally {
      setAdopting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI 写大纲</DialogTitle>
          <DialogDescription>
            根据小说设定生成整书章节大纲，包含每章的标题与大概内容
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">章节数量（1-20）</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={chapterCount}
                onChange={(e) => setChapterCount(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">整体剧情方向（可选）</Label>
              <Input
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder="主线走向、想要的结局…"
                maxLength={500}
              />
            </div>
          </div>

          {!preview ? (
            <Button onClick={generate} disabled={busy} className="w-full gap-1.5">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {busy ? "AI 正在规划大纲…" : "生成大纲"}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2.5">
                {preview.map((item, i) => (
                  <div key={i} className="rounded-md bg-gray-50 p-2">
                    <p className="mb-0.5 text-xs font-medium text-gray-700">
                      {i + 1}. {item.title}
                    </p>
                    <p className="text-xs leading-relaxed text-gray-500">{item.summary}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generate}
                  disabled={busy}
                  className="gap-1"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  重新生成
                </Button>
                <Button size="sm" onClick={adopt} disabled={adopting} className="flex-1">
                  {adopting
                    ? "创建中…"
                    : `采纳并创建 ${preview.length} 个章节${
                        existingChapterCount > 0 ? `（追加在现有 ${existingChapterCount} 章之后）` : ""
                      }`}
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={adopting}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
