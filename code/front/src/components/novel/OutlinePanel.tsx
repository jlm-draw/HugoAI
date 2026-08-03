"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { ChapterItem } from "@/services/novel/types";

interface Props {
  novelId: string;
  chapters: ChapterItem[];
  onSummarySaved: (id: string, summary: string) => void;
}

/** 大纲面板：按章节顺序编辑各章摘要，失焦自动保存 */
export function OutlinePanel({ novelId, chapters, onSummarySaved }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

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

  if (chapters.length === 0) {
    return <p className="py-8 text-center text-xs text-gray-400">暂无章节</p>;
  }

  return (
    <div className="space-y-3">
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
    </div>
  );
}
