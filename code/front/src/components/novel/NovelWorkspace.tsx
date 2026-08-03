"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import type {
  CharacterItem,
  ChapterItem,
  RelationItem,
  WorkspaceData,
  WorldSettingData,
} from "@/services/novel/types";
import { ChapterEditor } from "./ChapterEditor";
import { ChapterSidebar } from "./ChapterSidebar";
import { SettingsPanel } from "./SettingsPanel";

interface Props {
  novelId: string;
}

export function NovelWorkspace({ novelId }: Props) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/novel/${novelId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "加载失败");
        setData(json as WorkspaceData);
        setActiveId((json.chapters[0] as ChapterItem | undefined)?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [novelId]);

  /** 本地合并章节变更（标题/字数/大纲等），并重算总字数 */
  const patchChapter = useCallback(
    (
      id: string,
      patch: Partial<Pick<ChapterItem, "title" | "summary" | "wordCount" | "content">>
    ) => {
      setData((d) => {
        if (!d) return d;
        const chapters = d.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c));
        return {
          ...d,
          chapters,
          novel: {
            ...d.novel,
            wordCount: chapters.reduce((sum, c) => sum + c.wordCount, 0),
          },
        };
      });
    },
    []
  );

  async function createChapter(title: string) {
    const res = await fetch(`/api/novel/${novelId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.add({ type: "error", title: json.error ?? "创建章节失败" });
      return;
    }
    setData((d) =>
      d
        ? {
            ...d,
            chapters: [...d.chapters, json.chapter],
            novel: { ...d.novel, chapterCount: d.chapters.length + 1 },
          }
        : d
    );
    setActiveId(json.chapter.id);
  }

  async function deleteChapter(id: string) {
    if (!confirm("确定删除该章节吗？本章内容无法恢复。")) return;
    const res = await fetch(`/api/novel/${novelId}/chapters/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      toast.add({ type: "error", title: json.error ?? "删除失败" });
      return;
    }
    setData((d) => {
      if (!d) return d;
      const chapters = d.chapters.filter((c) => c.id !== id);
      return {
        ...d,
        chapters,
        novel: {
          ...d.novel,
          chapterCount: chapters.length,
          wordCount: chapters.reduce((sum, c) => sum + c.wordCount, 0),
        },
      };
    });
    setActiveId((cur) => (cur === id ? null : cur));
  }

  async function reorderChapters(orderedIds: string[]) {
    // 乐观更新，失败回滚
    setData((d) => {
      if (!d) return d;
      const byId = new Map(d.chapters.map((c) => [c.id, c]));
      return {
        ...d,
        chapters: orderedIds
          .map((cid, i) => {
            const ch = byId.get(cid);
            return ch ? { ...ch, sort: i } : null;
          })
          .filter((c): c is ChapterItem => c !== null),
      };
    });

    const res = await fetch(`/api/novel/${novelId}/chapters/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) {
      toast.add({ type: "error", title: "排序保存失败，已回滚" });
      fetch(`/api/novel/${novelId}`)
        .then(async (r) => {
          if (r.ok) setData(await r.json());
        })
        .catch(() => {});
    }
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="mb-3 text-sm text-gray-500">{error}</p>
        <Link href="/novel" className="text-sm text-blue-600">
          ← 返回小说列表
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[calc(100vh-6.5rem)] gap-4">
        <Skeleton className="w-60 rounded-xl" />
        <Skeleton className="flex-1 rounded-xl" />
        <Skeleton className="w-80 rounded-xl" />
      </div>
    );
  }

  const activeChapter = data.chapters.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col">
      <div className="mb-3 flex items-center gap-3">
        <Link
          href="/novel"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
        >
          <ArrowLeft size={14} /> 小说列表
        </Link>
        <h1 className="font-semibold text-gray-800">{data.novel.name}</h1>
        <Badge variant="secondary">{data.novel.genre}</Badge>
        <span className="text-xs text-gray-400">共 {data.novel.wordCount.toLocaleString()} 字</span>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ChapterSidebar
          chapters={data.chapters}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={createChapter}
          onReorder={reorderChapters}
        />

        <main className="min-w-0 flex-1">
          {activeChapter ? (
            <ChapterEditor
              key={activeChapter.id}
              novelId={novelId}
              chapter={activeChapter}
              characters={data.characters}
              onChapterUpdated={patchChapter}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border bg-white text-sm text-gray-400">
              选择或新建一个章节开始写作
            </div>
          )}
        </main>

        <SettingsPanel
          novelId={novelId}
          worldSetting={data.worldSetting}
          characters={data.characters}
          relations={data.relations}
          chapters={data.chapters}
          onWorldSaved={(worldSetting: WorldSettingData) =>
            setData((d) => (d ? { ...d, worldSetting } : d))
          }
          onCharactersChanged={(characters: CharacterItem[]) =>
            setData((d) => (d ? { ...d, characters } : d))
          }
          onRelationsChanged={(relations: RelationItem[]) =>
            setData((d) => (d ? { ...d, relations } : d))
          }
          onSummarySaved={(id, summary) => patchChapter(id, { summary })}
          onDeleteChapter={deleteChapter}
        />
      </div>
    </div>
  );
}
