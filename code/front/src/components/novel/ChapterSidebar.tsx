"use client";

import { useState } from "react";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChapterItem } from "@/services/novel/types";

interface Props {
  chapters: ChapterItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (title: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function ChapterSidebar({ chapters, activeId, onSelect, onCreate, onReorder }: Props) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function submitNew() {
    const title = newTitle.trim();
    if (!title) return;
    onCreate(title);
    setNewTitle("");
    setAdding(false);
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const ids = chapters.map((c) => c.id);
    const fromIndex = ids.indexOf(dragId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, dragId);
    onReorder(ids);
    setDragId(null);
    setOverId(null);
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col rounded-xl border bg-white">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <p className="text-xs font-semibold text-gray-600">章节（{chapters.length}）</p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
          title="新建章节"
        >
          <Plus size={14} />
        </button>
      </div>

      {adding && (
        <div className="border-b p-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") {
                setAdding(false);
                setNewTitle("");
              }
            }}
            onBlur={submitNew}
            placeholder="章节标题，回车确认"
            className="w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:border-blue-400"
            maxLength={100}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {chapters.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-gray-400">
            还没有章节，点右上角 + 新建
          </p>
        )}
        {chapters.map((chapter, index) => (
          <div
            key={chapter.id}
            draggable
            onDragStart={() => setDragId(chapter.id)}
            onDragOver={(e) => {
              e.preventDefault();
              if (chapter.id !== dragId) setOverId(chapter.id);
            }}
            onDragLeave={() => setOverId((cur) => (cur === chapter.id ? null : cur))}
            onDrop={() => handleDrop(chapter.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onClick={() => onSelect(chapter.id)}
            className={cn(
              "group mb-1 flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2",
              activeId === chapter.id
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50",
              overId === chapter.id && dragId !== chapter.id && "border-t-2 border-blue-400",
              dragId === chapter.id && "opacity-50"
            )}
          >
            <GripVertical
              size={12}
              className="shrink-0 cursor-grab text-gray-300 group-hover:text-gray-400"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {index + 1}. {chapter.title}
              </p>
              <p className="text-[10px] text-gray-400">{chapter.wordCount} 字</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
