"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { ChapterItem } from "@/services/novel/types";
import { OutlineAiDialog } from "./OutlineAiDialog";

interface Props {
  novelId: string;
  chapters: ChapterItem[];
  /** 小说简介，作为 AI 写大纲的剧情方向默认值 */
  novelDescription: string;
  onSummarySaved: (id: string, summary: string) => void;
  onChaptersCreated: (chapters: ChapterItem[]) => void;
}

/** 大纲面板：按章节顺序编辑各章摘要，失焦自动保存；支持 AI 生成整书大纲 */
export function OutlinePanel({
  novelId,
  chapters,
  novelDescription,
  onSummarySaved,
  onChaptersCreated,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  async function save(id: string) {
    const summary = drafts[id];
    if (summary === undefined) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/novel/${novelId}/chapters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "保存失败");
      }
      onSummarySaved(id, summary);
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    } catch (err) {
      toast.add({ type: "error", title: err instanceof Error ? err.message : "大纲保存失败" });
    } finally {
      setSavingId(null);
    }
  }

  const aiButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setAiDialogOpen(true)}
      className="w-full gap-1.5"
    >
      <Sparkles size={13} className="text-blue-500" /> AI 写大纲
    </Button>
  );

  const dialog = (
    <OutlineAiDialog
      open={aiDialogOpen}
      novelId={novelId}
      defaultDirection={novelDescription}
      existingChapterCount={chapters.length}
      onClose={() => setAiDialogOpen(false)}
      onAdopted={onChaptersCreated}
    />
  );

  if (chapters.length === 0) {
    return (
      <div className="space-y-3">
        {aiButton}
        <p className="py-8 text-center text-xs text-gray-400">
          暂无章节，可用「AI 写大纲」一键规划全书
        </p>
        {dialog}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {aiButton}
      {chapters.map((chapter, index) => (
        <div key={chapter.id} className="rounded-lg border p-2.5">
          <p className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-700">
            <span className="truncate">
              {index + 1}. {chapter.title}
            </span>
            {savingId === chapter.id && (
              <span className="shrink-0 text-[10px] font-normal text-gray-400">保存中…</span>
            )}
          </p>
          <Textarea
            value={drafts[chapter.id] ?? chapter.summary ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [chapter.id]: e.target.value }))}
            onBlur={() => save(chapter.id)}
            placeholder="本章大纲：主要情节、冲突、伏笔…"
            rows={2}
            className="text-xs"
          />
        </div>
      ))}
      {dialog}
    </div>
  );
}
